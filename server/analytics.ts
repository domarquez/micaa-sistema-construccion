/**
 * Analytics propio de MICAA: ingesta ligera + reportes admin + resumen WhatsApp.
 * Privacidad: no se guardan IPs. Se excluyen bots y el usuario dmarquez.
 */
import type { Express, Request, Response, NextFunction } from "express";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";

const ALLOWED_TYPES = new Set([
  "page_view",
  "page_duration",
  "session_duration",
  "material_search",
  "view_material",
  "ver_proveedores",
  "company_view",
  "budget_created",
  "pdf_exported",
  "login",
  "registration",
  "whatsapp_click",
  "anunciar_view",
]);

const BOT_UA =
  /bot|crawl|spider|slurp|facebookexternalhit|preview|wget|curl|python-requests|scrapy|headless|phantom|selenium/i;

/** Rate limit en memoria: max N eventos por visitor_id por ventana. */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 80;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function rateOk(key: string): boolean {
  const now = Date.now();
  const b = rateBuckets.get(key);
  if (!b || now >= b.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (b.count >= RATE_MAX) return false;
  b.count += 1;
  return true;
}

// limpieza ocasional
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateBuckets) {
    if (now >= v.resetAt) rateBuckets.delete(k);
  }
}, 120_000).unref?.();

function isBot(ua: string | undefined): boolean {
  if (!ua || ua.length < 10) return true;
  return BOT_UA.test(ua);
}

function clampStr(v: unknown, max: number): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
}

function asInt(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function asUserId(v: unknown): number | null {
  const n = asInt(v);
  if (n == null || n <= 0) return null;
  return n;
}

type IncomingEvent = {
  visitorId?: string;
  sessionId?: string;
  userId?: number | null;
  path?: string;
  eventType?: string;
  eventData?: Record<string, unknown>;
  referrer?: string | null;
  device?: string | null;
  city?: string | null;
  durationMs?: number | null;
  ts?: string | null;
};

const dmarquezCache = { id: null as number | null, at: 0 };

async function getDmarquezUserId(): Promise<number | null> {
  const now = Date.now();
  if (dmarquezCache.at && now - dmarquezCache.at < 600_000) return dmarquezCache.id;
  try {
    const rows = await db.select({ id: users.id }).from(users).where(eq(users.username, "dmarquez")).limit(1);
    dmarquezCache.id = rows[0]?.id ?? null;
    dmarquezCache.at = now;
    return dmarquezCache.id;
  } catch {
    return dmarquezCache.id;
  }
}

function periodStart(period: string): Date {
  const now = new Date();
  const days = period === "day" ? 1 : period === "month" ? 30 : 7;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function rowsOf(r: any): any[] {
  return Array.isArray(r) ? r : r?.rows ?? [];
}

async function insertEvents(events: IncomingEvent[], adminUserId: number | null): Promise<number> {
  let inserted = 0;
  for (const ev of events) {
    const eventType = clampStr(ev.eventType, 64);
    if (!eventType || !ALLOWED_TYPES.has(eventType)) continue;

    const visitorId = clampStr(ev.visitorId, 64);
    const sessionId = clampStr(ev.sessionId, 64);
    if (!visitorId || !sessionId) continue;
    if (!/^[\w-]{8,64}$/.test(visitorId) || !/^[\w-]{8,64}$/.test(sessionId)) continue;

    let userId = asUserId(ev.userId);
    if (userId && adminUserId && userId === adminUserId) continue;

    const path = clampStr(ev.path, 500) || "/";
    const referrer = clampStr(ev.referrer, 500);
    const device = clampStr(ev.device, 32);
    const city = clampStr(ev.city, 80);
    const durationMs = asInt(ev.durationMs);
    let eventData: Record<string, unknown> = {};
    if (ev.eventData && typeof ev.eventData === "object" && !Array.isArray(ev.eventData)) {
      // limitar tamaño
      const raw = JSON.stringify(ev.eventData);
      if (raw.length <= 4000) {
        try {
          eventData = JSON.parse(raw);
        } catch {
          eventData = {};
        }
      }
    }

    await db.execute(sql`
      INSERT INTO analytics_events
        (visitor_id, session_id, user_id, path, event_type, event_data, referrer, device, city, duration_ms)
      VALUES
        (${visitorId}, ${sessionId}, ${userId}, ${path}, ${eventType},
         ${JSON.stringify(eventData)}::jsonb, ${referrer}, ${device}, ${city}, ${durationMs})
    `);
    inserted += 1;
  }
  return inserted;
}

export function registerAnalyticsRoutes(
  app: Express,
  requireAdmin: (req: any, res: any, next: any) => void,
) {
  app.post("/api/analytics/events", async (req: Request, res: Response) => {
    try {
      if (isBot(req.headers["user-agent"])) {
        return res.status(204).end();
      }

      const body = req.body;
      const list: IncomingEvent[] = Array.isArray(body?.events)
        ? body.events.slice(0, 25)
        : body && typeof body === "object"
          ? [body as IncomingEvent]
          : [];

      if (!list.length) {
        return res.status(400).json({ message: "Sin eventos" });
      }

      const visitorKey = clampStr(list[0]?.visitorId, 64) || "anon";
      if (!rateOk(visitorKey)) {
        return res.status(429).json({ message: "Demasiados eventos. Probá en un minuto." });
      }

      const adminId = await getDmarquezUserId();
      await insertEvents(list, adminId);
      return res.status(204).end();
    } catch (e) {
      console.error("[analytics] ingest error:", e);
      return res.status(204).end(); // fallar en silencio para no romper UX
    }
  });

  app.get("/api/admin/analytics", requireAdmin, async (req: Request, res: Response) => {
    try {
      const period = String(req.query.period || "week");
      const since = periodStart(period);
      const adminId = await getDmarquezUserId();

      const baseFilter = adminId
        ? sql`ts >= ${since} AND (user_id IS NULL OR user_id <> ${adminId})`
        : sql`ts >= ${since}`;

      const visitsByDay = rowsOf(
        await db.execute(sql`
          SELECT date_trunc('day', ts AT TIME ZONE 'America/La_Paz')::date AS day,
                 count(*) FILTER (WHERE event_type = 'page_view')::int AS views,
                 count(DISTINCT visitor_id)::int AS unique_visitors
          FROM analytics_events
          WHERE ${baseFilter}
          GROUP BY 1
          ORDER BY 1
        `),
      );

      const totals = rowsOf(
        await db.execute(sql`
          SELECT
            count(*) FILTER (WHERE event_type = 'page_view')::int AS page_views,
            count(DISTINCT visitor_id)::int AS unique_visitors,
            count(DISTINCT session_id)::int AS sessions,
            count(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL)::int AS registered_active,
            count(DISTINCT visitor_id) FILTER (WHERE user_id IS NULL)::int AS anonymous_visitors
          FROM analytics_events
          WHERE ${baseFilter}
        `),
      )[0] || {};

      const topPages = rowsOf(
        await db.execute(sql`
          SELECT path, count(*)::int AS views
          FROM analytics_events
          WHERE ${baseFilter} AND event_type = 'page_view'
          GROUP BY path
          ORDER BY views DESC
          LIMIT 15
        `),
      );

      const topSearches = rowsOf(
        await db.execute(sql`
          SELECT coalesce(event_data->>'q', event_data->>'query', '(vacío)') AS q,
                 count(*)::int AS n
          FROM analytics_events
          WHERE ${baseFilter} AND event_type = 'material_search'
          GROUP BY 1
          ORDER BY n DESC
          LIMIT 15
        `),
      );

      const keyEvents = rowsOf(
        await db.execute(sql`
          SELECT event_type, count(*)::int AS n
          FROM analytics_events
          WHERE ${baseFilter}
            AND event_type NOT IN ('page_view', 'page_duration', 'session_duration')
          GROUP BY event_type
          ORDER BY n DESC
        `),
      );

      const topSuppliers = rowsOf(
        await db.execute(sql`
          SELECT coalesce(event_data->>'companyName', event_data->>'name', 'id:' || coalesce(event_data->>'supplierId', event_data->>'id', '?')) AS company,
                 count(*)::int AS n
          FROM analytics_events
          WHERE ${baseFilter} AND event_type IN ('ver_proveedores', 'company_view')
          GROUP BY 1
          ORDER BY n DESC
          LIMIT 15
        `),
      );

      const avgTimes = rowsOf(
        await db.execute(sql`
          SELECT
            avg(duration_ms) FILTER (WHERE event_type = 'session_duration' AND duration_ms > 0)::int AS avg_session_ms,
            avg(duration_ms) FILTER (WHERE event_type = 'page_duration' AND duration_ms > 0)::int AS avg_page_ms
          FROM analytics_events
          WHERE ${baseFilter}
        `),
      )[0] || {};

      const timeBySection = rowsOf(
        await db.execute(sql`
          SELECT
            CASE
              WHEN path LIKE '/materiales/%' THEN '/materiales/:id'
              WHEN path LIKE '/budgets/%' THEN '/budgets/:id'
              WHEN path LIKE '/admin/%' THEN '/admin/*'
              ELSE split_part(path, '?', 1)
            END AS section,
            avg(duration_ms)::int AS avg_ms,
            count(*)::int AS samples
          FROM analytics_events
          WHERE ${baseFilter} AND event_type = 'page_duration' AND duration_ms > 0
          GROUP BY 1
          ORDER BY avg_ms DESC NULLS LAST
          LIMIT 12
        `),
      );

      res.json({
        period,
        since: since.toISOString(),
        totals: {
          pageViews: Number(totals.page_views || 0),
          uniqueVisitors: Number(totals.unique_visitors || 0),
          sessions: Number(totals.sessions || 0),
          registeredActive: Number(totals.registered_active || 0),
          anonymousVisitors: Number(totals.anonymous_visitors || 0),
          avgSessionMs: Number(avgTimes.avg_session_ms || 0),
          avgPageMs: Number(avgTimes.avg_page_ms || 0),
        },
        visitsByDay: visitsByDay.map((r) => ({
          day: r.day,
          views: Number(r.views || 0),
          uniqueVisitors: Number(r.unique_visitors || 0),
        })),
        topPages: topPages.map((r) => ({ path: r.path, views: Number(r.views || 0) })),
        topSearches: topSearches.map((r) => ({ q: r.q, n: Number(r.n || 0) })),
        keyEvents: keyEvents.map((r) => ({ eventType: r.event_type, n: Number(r.n || 0) })),
        topSuppliers: topSuppliers.map((r) => ({ company: r.company, n: Number(r.n || 0) })),
        timeBySection: timeBySection.map((r) => ({
          section: r.section,
          avgMs: Number(r.avg_ms || 0),
          samples: Number(r.samples || 0),
        })),
      });
    } catch (e) {
      console.error("[analytics] admin report error:", e);
      res.status(500).json({ message: "No se pudo armar el reporte de estadísticas" });
    }
  });

  app.get("/api/admin/analytics/summary", requireAdmin, async (req: Request, res: Response) => {
    try {
      const period = String(req.query.period || "week");
      const since = periodStart(period);
      const adminId = await getDmarquezUserId();
      const baseFilter = adminId
        ? sql`ts >= ${since} AND (user_id IS NULL OR user_id <> ${adminId})`
        : sql`ts >= ${since}`;

      const label = period === "day" ? "hoy" : period === "month" ? "el último mes" : "la última semana";

      const t = rowsOf(
        await db.execute(sql`
          SELECT
            count(*) FILTER (WHERE event_type = 'page_view')::int AS page_views,
            count(DISTINCT visitor_id)::int AS unique_visitors,
            count(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL)::int AS registered,
            count(*) FILTER (WHERE event_type = 'material_search')::int AS searches,
            count(*) FILTER (WHERE event_type = 'budget_created')::int AS budgets,
            count(*) FILTER (WHERE event_type = 'pdf_exported')::int AS pdfs,
            count(*) FILTER (WHERE event_type = 'whatsapp_click')::int AS wa,
            count(*) FILTER (WHERE event_type = 'anunciar_view')::int AS anunciar,
            count(*) FILTER (WHERE event_type = 'ver_proveedores')::int AS ver_prov,
            avg(duration_ms) FILTER (WHERE event_type = 'session_duration' AND duration_ms > 0)::int AS avg_session_ms
          FROM analytics_events
          WHERE ${baseFilter}
        `),
      )[0] || {};

      const topSearch = rowsOf(
        await db.execute(sql`
          SELECT coalesce(event_data->>'q', event_data->>'query') AS q, count(*)::int AS n
          FROM analytics_events
          WHERE ${baseFilter} AND event_type = 'material_search'
            AND coalesce(event_data->>'q', event_data->>'query', '') <> ''
          GROUP BY 1 ORDER BY n DESC LIMIT 3
        `),
      );

      const topSupp = rowsOf(
        await db.execute(sql`
          SELECT coalesce(event_data->>'companyName', event_data->>'name') AS company, count(*)::int AS n
          FROM analytics_events
          WHERE ${baseFilter} AND event_type IN ('ver_proveedores', 'company_view')
            AND coalesce(event_data->>'companyName', event_data->>'name', '') <> ''
          GROUP BY 1 ORDER BY n DESC LIMIT 3
        `),
      );

      const avgMin = t.avg_session_ms ? Math.round(Number(t.avg_session_ms) / 60000 * 10) / 10 : 0;
      const searches = topSearch.map((r) => `"${r.q}" (${r.n})`).join(", ") || "sin datos";
      const suppliers = topSupp.map((r) => `${r.company} (${r.n})`).join(", ") || "sin datos";

      const text = [
        `📊 MICAA · resumen ${label}`,
        ``,
        `Visitas (páginas): ${Number(t.page_views || 0)}`,
        `Visitantes únicos: ${Number(t.unique_visitors || 0)}`,
        `Usuarios registrados activos: ${Number(t.registered || 0)}`,
        `Tiempo medio de sesión: ${avgMin} min`,
        ``,
        `Búsquedas de materiales: ${Number(t.searches || 0)}`,
        `Top búsquedas: ${searches}`,
        `Ver proveedores: ${Number(t.ver_prov || 0)}`,
        `Top empresas vistas: ${suppliers}`,
        `Presupuestos creados: ${Number(t.budgets || 0)}`,
        `PDF exportados: ${Number(t.pdfs || 0)}`,
        `Clicks WhatsApp MICAA: ${Number(t.wa || 0)}`,
        `Vistas /anunciar: ${Number(t.anunciar || 0)}`,
        ``,
        `micaa.site/admin/estadisticas`,
      ].join("\n");

      res.type("text/plain; charset=utf-8").send(text);
    } catch (e) {
      console.error("[analytics] summary error:", e);
      res.status(500).type("text/plain").send("No se pudo armar el resumen de estadísticas.");
    }
  });
}
