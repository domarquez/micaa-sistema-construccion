/**
 * Plantillas de proyecto predeterminadas.
 *
 *  GET  /api/project-templates                  Lista (activas; admin con ?all=1 ve también las inactivas)
 *  GET  /api/project-templates/:slug            Detalle: params, derivadas, líneas
 *  POST /api/project-templates/:slug/preview    { params, city } → cantidades + PU en vivo + total (NO escribe)
 *  POST /api/project-templates/:slug/instantiate { params, city, name, client?, location? }
 *        → crea project + budget + budget_items en UNA transacción (precios del APU en vivo)
 *
 * Funciona antes de aplicar migrations/0003_project_templates.sql: responde { available: false } / 503.
 * Premium: system_settings.templates_premium_enabled ('false' por defecto) + project_templates.is_premium
 * + user_template_entitlements. Con el flag apagado todo es gratis.
 */
import type { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { projectTemplates, projectTemplateItems, projects, budgets, budgetItems, systemSettings } from "../shared/schema";
import { asc, eq, sql } from "drizzle-orm";
import { computeActivityApu, compactApuSnapshot, getOptionalColumns } from "./apu-live";
import { buildTemplatePreview, canUseTemplate, type TemplateLineInput } from "../shared/project-templates";
import { FormulaError, type TemplateDerived, type TemplateParamsSchema } from "../shared/template-formula";

type Mw = (req: Request, res: Response, next: NextFunction) => any;
const DEFAULT_CITY = "Santa Cruz";
const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);

// ---------- disponibilidad (migración 0003) ----------
let availCache: { at: number; tables: boolean; projectCols: boolean; entitlements: boolean } | null = null;
async function availability() {
  if (availCache && Date.now() - availCache.at < 60_000) return availCache;
  const r = rowsOf(await db.execute(sql`
    SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = 'public'
       AND (table_name IN ('project_templates','project_template_items','user_template_entitlements')
            OR (table_name = 'projects' AND column_name IN ('template_id','template_params')))`));
  const t = new Set(r.map((x: any) => x.table_name));
  const pc = new Set(r.filter((x: any) => x.table_name === "projects").map((x: any) => x.column_name));
  availCache = {
    at: Date.now(),
    tables: t.has("project_templates") && t.has("project_template_items"),
    projectCols: pc.has("template_id") && pc.has("template_params"),
    entitlements: t.has("user_template_entitlements"),
  };
  return availCache;
}

async function premiumEnabled(): Promise<boolean> {
  const [s] = await db.select().from(systemSettings).where(eq(systemSettings.settingKey, "templates_premium_enabled")).limit(1);
  return s?.settingValue === "true";
}

async function userCanUse(user: any, tpl: typeof projectTemplates.$inferSelect): Promise<boolean> {
  const enabled = await premiumEnabled();
  let ents: Array<{ templateId: number | null; expiresAt: Date | null }> = [];
  if (enabled && tpl.isPremium && user?.role !== "admin" && (await availability()).entitlements) {
    ents = rowsOf(await db.execute(sql`
      SELECT template_id AS "templateId", expires_at AS "expiresAt" FROM user_template_entitlements
       WHERE user_id = ${user.id} AND (template_id IS NULL OR template_id = ${tpl.id})`));
  }
  return canUseTemplate({ premiumEnabled: enabled, templateIsPremium: tpl.isPremium, isAdmin: user?.role === "admin", entitlements: ents, templateId: tpl.id });
}

async function loadTemplate(slug: string) {
  const [tpl] = await db.select().from(projectTemplates).where(eq(projectTemplates.slug, slug)).limit(1);
  if (!tpl) return null;
  const items = await db.select().from(projectTemplateItems).where(eq(projectTemplateItems.templateId, tpl.id)).orderBy(asc(projectTemplateItems.sortOrder));
  return { tpl, items };
}

function lineInputs(items: Array<typeof projectTemplateItems.$inferSelect>): TemplateLineInput[] {
  return items.map((i) => ({
    id: i.id, sortOrder: i.sortOrder, phaseId: i.phaseId, activityId: i.activityId, quantityFormula: i.quantityFormula,
    breakdown: i.breakdown, missingKey: i.missingKey, missingName: i.missingName, isOptional: i.isOptional,
  }));
}

// ---------- precios en vivo con caché corto por (actividad, ciudad) ----------
const priceCache = new Map<string, { at: number; v: any }>();
/** Actividades calculadas en paralelo en un preview. El pool de DB (server/db.ts) limita las consultas reales. */
const PREVIEW_CONCURRENCY = Math.max(1, Number(process.env.TEMPLATE_PREVIEW_CONCURRENCY) || 6);

async function livePrices(activityIds: number[], city: string) {
  const out = new Map<number, any>();
  const todo: number[] = [];
  for (const id of activityIds) {
    const c = priceCache.get(`${id}|${city}`);
    if (c && Date.now() - c.at < 5 * 60_000) out.set(id, c.v); else todo.push(id);
  }
  // Cola con N trabajadores (antes: lotes fijos de 3 que esperaban al más lento) + caché de materiales
  // compartida entre actividades del mismo preview (cemento, arena, fierro… se consultan una sola vez).
  const materialCache: NonNullable<Parameters<typeof computeActivityApu>[3]>["materialCache"] = new Map();
  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const id = todo[next++];
      try {
        const apu = await computeActivityApu(id, null, null, { city, includeOptions: false, materialCache });
        const v = { unitPrice: apu.totalUnitPrice, name: apu.activityName, unit: apu.unit, apu };
        priceCache.set(`${id}|${city}`, { at: Date.now(), v });
        out.set(id, v);
      } catch (e: any) {
        out.set(id, { error: String(e?.message || e) });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PREVIEW_CONCURRENCY, todo.length) }, worker));
  return out;
}

function cityOf(body: any, tpl: typeof projectTemplates.$inferSelect) {
  const c = typeof body?.city === "string" ? body.city.trim().slice(0, 80) : "";
  return c || tpl.defaultCity || DEFAULT_CITY;
}

async function preview(tpl: typeof projectTemplates.$inferSelect, items: Array<typeof projectTemplateItems.$inferSelect>, params: any, city: string) {
  const ids = Array.from(new Set(items.map((i) => i.activityId).filter((x): x is number => x != null)));
  const prices = await livePrices(ids, city);
  const pv = buildTemplatePreview(tpl.paramsSchema as TemplateParamsSchema, tpl.derived as TemplateDerived[], tpl.refQuantityFormula, lineInputs(items), params, prices);
  return { pv, prices };
}

export function registerProjectTemplateRoutes(app: any, requireAuth: Mw) {
  app.get("/api/project-templates", requireAuth, async (req: any, res: Response) => {
    try {
      const av = await availability();
      if (!av.tables) return res.json({ available: false, premiumEnabled: false, templates: [] });
      const all = req.query.all === "1" && req.user?.role === "admin";
      const rows = await db.select().from(projectTemplates).orderBy(asc(projectTemplates.sortOrder), asc(projectTemplates.id));
      const enabled = await premiumEnabled();
      const list = [];
      for (const t of rows) {
        if (!t.isActive && !all) continue;
        list.push({
          id: t.id, slug: t.slug, name: t.name, category: t.category, description: t.description, coverImageUrl: t.coverImageUrl,
          unitRef: t.unitRef, paramsSchema: t.paramsSchema, isPremium: t.isPremium, priceBs: t.priceBs, isActive: t.isActive,
          inactiveReason: t.inactiveReason, version: t.version, unlocked: await userCanUse(req.user, t),
        });
      }
      res.json({ available: true, premiumEnabled: enabled, templates: list });
    } catch (e) {
      console.error("List templates error:", e);
      res.status(500).json({ message: "Error al listar plantillas" });
    }
  });

  app.get("/api/project-templates/:slug", requireAuth, async (req: any, res: Response) => {
    try {
      if (!(await availability()).tables) return res.status(503).json({ message: "Plantillas no disponibles (migración pendiente)" });
      const r = await loadTemplate(String(req.params.slug));
      if (!r || (!r.tpl.isActive && req.user?.role !== "admin")) return res.status(404).json({ message: "Plantilla no encontrada" });
      res.json({ ...r.tpl, unlocked: await userCanUse(req.user, r.tpl), items: r.items });
    } catch (e) {
      console.error("Template detail error:", e);
      res.status(500).json({ message: "Error al obtener la plantilla" });
    }
  });

  app.post("/api/project-templates/:slug/preview", requireAuth, async (req: any, res: Response) => {
    try {
      if (!(await availability()).tables) return res.status(503).json({ message: "Plantillas no disponibles (migración pendiente)" });
      const r = await loadTemplate(String(req.params.slug));
      if (!r || (!r.tpl.isActive && req.user?.role !== "admin")) return res.status(404).json({ message: "Plantilla no encontrada" });
      if (!(await userCanUse(req.user, r.tpl))) return res.status(402).json({ message: "Plantilla premium: requiere compra o plan" });
      const city = cityOf(req.body, r.tpl);
      const { pv } = await preview(r.tpl, r.items, req.body?.params, city);
      res.json({ city, ...pv });
    } catch (e) {
      if (e instanceof FormulaError) return res.status(400).json({ message: e.message });
      console.error("Template preview error:", e);
      res.status(500).json({ message: "Error al calcular la vista previa" });
    }
  });

  app.post("/api/project-templates/:slug/instantiate", requireAuth, async (req: any, res: Response) => {
    try {
      const av = await availability();
      if (!av.tables) return res.status(503).json({ message: "Plantillas no disponibles (migración pendiente)" });
      const r = await loadTemplate(String(req.params.slug));
      if (!r || !r.tpl.isActive) return res.status(404).json({ message: "Plantilla no encontrada o inactiva" });
      if (!(await userCanUse(req.user, r.tpl))) return res.status(402).json({ message: "Plantilla premium: requiere compra o plan" });
      const name = typeof req.body?.name === "string" && req.body.name.trim() ? req.body.name.trim().slice(0, 200) : r.tpl.name;
      const city = cityOf(req.body, r.tpl);
      const { pv, prices } = await preview(r.tpl, r.items, req.body?.params, city);
      if (pv.missingCount > 0) return res.status(409).json({ message: "La plantilla tiene actividades faltantes" });
      const bad = pv.lines.filter((l) => l.status !== "ok");
      if (bad.length) return res.status(502).json({ message: `No se pudo calcular el precio de ${bad.length} actividad(es)` });
      const cols = await getOptionalColumns();
      const withSnapshot = cols.has("budget_items.apu_snapshot") && cols.has("budget_items.apu_computed_at");

      const result = await db.transaction(async (tx) => {
        const [project] = await tx.insert(projects).values({
          name, client: req.body?.client ? String(req.body.client).slice(0, 200) : null,
          location: req.body?.location ? String(req.body.location).slice(0, 200) : null,
          city, country: "Bolivia", userId: req.user.id, status: "planning",
        }).returning();
        if (av.projectCols) {
          await tx.execute(sql`UPDATE projects SET template_id = ${r.tpl.id}, template_params = ${JSON.stringify({ ...pv.params, _version: r.tpl.version, _slug: r.tpl.slug })}::jsonb WHERE id = ${project.id}`);
        }
        const [budget] = await tx.insert(budgets).values({ projectId: project.id, phaseId: null, total: String(pv.total), status: "draft" }).returning();
        let n = 0;
        for (const l of pv.lines) {
          const [bi] = await tx.insert(budgetItems).values({
            budgetId: budget.id, activityId: l.activityId!, phaseId: l.phaseId,
            quantity: l.quantity.toFixed(3), unitPrice: l.unitPrice!.toFixed(2), subtotal: l.subtotal.toFixed(2),
          }).returning({ id: budgetItems.id });
          if (withSnapshot) {
            const apu = prices.get(l.activityId!)?.apu;
            if (apu) await tx.execute(sql`UPDATE budget_items SET apu_snapshot = ${JSON.stringify(compactApuSnapshot(apu))}::jsonb, apu_computed_at = now() WHERE id = ${bi.id}`);
          }
          n++;
        }
        const tot = rowsOf(await tx.execute(sql`SELECT COALESCE(SUM(subtotal),0) AS t FROM budget_items WHERE budget_id = ${budget.id}`))[0]?.t;
        await tx.update(budgets).set({ total: String(tot), updatedAt: new Date() }).where(eq(budgets.id, budget.id));
        return { projectId: project.id, budgetId: budget.id, items: n, total: Number(tot) };
      });
      res.status(201).json({ ...result, city, refQuantity: pv.refQuantity, costPerRefUnit: pv.costPerRefUnit });
    } catch (e) {
      if (e instanceof FormulaError) return res.status(400).json({ message: e.message });
      console.error("Template instantiate error:", e);
      res.status(500).json({ message: "Error al crear el proyecto desde la plantilla" });
    }
  });
}
