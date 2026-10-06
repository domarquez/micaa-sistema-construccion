/**
 * Transporte y movilización por distancia (server).
 *
 *  - applyProjectTransport(): geocodifica la dirección del proyecto (Nominatim), calcula la distancia
 *    por calle desde el km cero de la ciudad (OSRM, fallback recta × 1.3) y guarda lat/lng,
 *    distance_km, extra_km y transport_method. También zona elegida / km manuales / pin.
 *  - storeBudgetTransport(): calcula la línea "Transporte y movilización" del presupuesto a partir
 *    de los apu_snapshot de los ítems (fallback: APU en vivo) y la guarda en budgets.transport_cost /
 *    transport_snapshot. recomputeBudgetTotal() la suma al total.
 *
 * Endpoints:
 *  GET  /api/transport/config?city=        km cero, radio, zonas y pasaje de la ciudad (público)
 *  POST /api/transport/locate              { address, city } → preview (no escribe)
 *  PUT  /api/projects/:id/transport        { mode: auto|pin|preset|manual|none, zone?, extraKm?, lat?, lng? }
 */
import type { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { computeActivityApu, getOptionalColumns, recomputeBudgetTotal } from "./apu-live";
import { getCityFactors } from "./material-price";
import { geocodeAddress, normalizeQuery, parseLatLng, roadDistanceKm, type GeoPoint } from "./geo";
import { normalizeUnit, APU_DEFAULT_PERCENTAGES } from "../shared/apu";
import {
  BASE_PRICE_NOTE,
  TRANSPORT,
  cityKmZero,
  computeTransport,
  extraKmFromDistance,
  type TransportMethod,
  type TransportSnapshot,
} from "../shared/transport";

type Mw = (req: Request, res: Response, next: NextFunction) => any;

function rowsOf(r: any): any[] {
  return Array.isArray(r) ? r : r?.rows ?? [];
}
function num(v: unknown, fallback = 0): number {
  if (v == null || v === "") return fallback;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

/** Campos de transporte que el cliente NO puede escribir directo en POST/PUT /api/projects. */
const PROJECT_TRANSPORT_KEYS = [
  "latitude", "longitude", "distanceKm", "extraKm", "transportMethod", "transportZone",
  "geoSource", "geocodedAddress", "geocodedQuery", "transportUpdatedAt", "transport",
];
export function stripTransportFields<T extends Record<string, any>>(body: T): T {
  const out: any = { ...(body || {}) };
  for (const k of PROJECT_TRANSPORT_KEYS) delete out[k];
  return out;
}

export async function transportAvailable(): Promise<boolean> {
  const cols = await getOptionalColumns();
  return cols.has("projects.extra_km") && cols.has("budgets.transport_cost");
}

export type TransportMode = "auto" | "pin" | "preset" | "manual" | "none";
export interface TransportRequest {
  mode?: TransportMode;
  zone?: string;
  extraKm?: number;
  lat?: number;
  lng?: number;
  /** auto: geocodificar aunque la dirección no haya cambiado. */
  force?: boolean;
}
export interface TransportStatus {
  changed: boolean;
  ok: boolean;
  reason?: "no_address" | "not_found" | "unknown_city" | "bad_zone" | "unavailable";
  extraKm: number;
  distanceKm: number | null;
  method: TransportMethod | null;
}

async function loadProject(id: number): Promise<any | null> {
  return rowsOf(await db.execute(sql`SELECT * FROM projects WHERE id = ${id}`))[0] ?? null;
}

interface Patch {
  latitude: number | null;
  longitude: number | null;
  distance_km: number | null;
  extra_km: number;
  transport_method: TransportMethod;
  transport_zone: string | null;
  geo_source: string | null;
  geocoded_address: string | null;
  geocoded_query: string | null;
}

async function writePatch(id: number, p: Patch) {
  await db.execute(sql`
    UPDATE projects SET latitude = ${p.latitude}, longitude = ${p.longitude}, distance_km = ${p.distance_km},
      extra_km = ${p.extra_km}, transport_method = ${p.transport_method}, transport_zone = ${p.transport_zone},
      geo_source = ${p.geo_source}, geocoded_address = ${p.geocoded_address}, geocoded_query = ${p.geocoded_query},
      transport_updated_at = now()
    WHERE id = ${id}`);
}

export interface LocatePreview {
  ok: boolean;
  reason?: TransportStatus["reason"];
  city: string;
  point: GeoPoint | null;
  displayName: string | null;
  distanceKm: number | null;
  extraKm: number;
  method: TransportMethod;
  kmZero: { center: string; radiusKm: number; zeroLabel: string } | null;
}

/** Geocodifica + distancia (no escribe). */
export async function locateAddress(address: string | null | undefined, cityIn: string | null | undefined, pin?: GeoPoint | null): Promise<LocatePreview> {
  const city = (cityIn || "").trim() || "Santa Cruz";
  const kz = cityKmZero(city);
  const kmZero = kz ? { center: kz.center.name, radiusKm: kz.radiusKm, zeroLabel: kz.zeroLabel } : null;
  const base = { city, kmZero };
  if (!kz) return { ...base, ok: false, reason: "unknown_city", point: null, displayName: null, distanceKm: null, extraKm: 0, method: "none" };
  let point: GeoPoint | null = pin ?? parseLatLng(address);
  let displayName: string | null = point ? "Punto marcado" : null;
  if (!point) {
    const a = String(address || "").trim();
    if (!a) return { ...base, ok: false, reason: "no_address", point: null, displayName: null, distanceKm: null, extraKm: 0, method: "none" };
    const g = await geocodeAddress(a, kz.city, kz);
    if (!g) return { ...base, ok: false, reason: "not_found", point: null, displayName: null, distanceKm: null, extraKm: 0, method: "none" };
    point = { lat: g.lat, lng: g.lng };
    displayName = g.displayName;
  }
  const d = await roadDistanceKm(kz.center, point);
  return { ...base, ok: true, point, displayName, distanceKm: d.km, extraKm: extraKmFromDistance(d.km, kz.radiusKm), method: d.method };
}

/**
 * Aplica ubicación/transporte al proyecto. mode=auto (default) solo geocodifica si cambió
 * "dirección|ciudad" (o force). Si falla y el usuario ya había elegido zona/km, se conservan.
 */
export async function applyProjectTransport(projectId: number, req: TransportRequest = { mode: "auto" }): Promise<TransportStatus> {
  const none: TransportStatus = { changed: false, ok: false, reason: "unavailable", extraKm: 0, distanceKm: null, method: null };
  if (!(await transportAvailable())) return none;
  const p = await loadProject(projectId);
  if (!p) return none;
  const city = (p.city || "").trim() || "Santa Cruz";
  const kz = cityKmZero(city);
  const key = normalizeQuery(p.location || "", city);
  const prevMethod = (p.transport_method || null) as TransportMethod | null;
  const keepUserChoice = prevMethod === "preset" || prevMethod === "manual";
  const mode: TransportMode = req.mode || "auto";
  const keep = {
    latitude: p.latitude != null ? num(p.latitude) : null,
    longitude: p.longitude != null ? num(p.longitude) : null,
    geo_source: p.geo_source ?? null,
    geocoded_address: p.geocoded_address ?? null,
  };
  const status = (patch: Patch, ok: boolean, reason?: TransportStatus["reason"]): TransportStatus => ({
    changed: true, ok, reason, extraKm: patch.extra_km, distanceKm: patch.distance_km, method: patch.transport_method,
  });

  if (mode === "preset") {
    const z = kz?.zones.find((x) => x.key === req.zone);
    if (!z) return { ...none, reason: "bad_zone" };
    const patch: Patch = { ...keep, distance_km: null, extra_km: z.extraKm, transport_method: z.extraKm > 0 ? "preset" : "preset", transport_zone: z.key, geocoded_query: key };
    await writePatch(projectId, patch);
    return status(patch, true);
  }
  if (mode === "manual") {
    const km = Math.max(0, Math.min(TRANSPORT.maxExtraKm, Math.round(num(req.extraKm) * 10) / 10));
    const patch: Patch = { ...keep, distance_km: null, extra_km: km, transport_method: "manual", transport_zone: null, geocoded_query: key };
    await writePatch(projectId, patch);
    return status(patch, true);
  }
  if (mode === "none") {
    const patch: Patch = { latitude: null, longitude: null, geo_source: null, geocoded_address: null, distance_km: null, extra_km: 0, transport_method: "none", transport_zone: null, geocoded_query: key };
    await writePatch(projectId, patch);
    return status(patch, true);
  }
  if (mode === "pin") {
    const lat = num(req.lat, NaN);
    const lng = num(req.lng, NaN);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ...none, reason: "not_found" };
    const r = await locateAddress(null, city, { lat, lng });
    if (!r.ok || !r.point) return { ...none, reason: r.reason };
    const patch: Patch = { latitude: r.point.lat, longitude: r.point.lng, geo_source: "pin", geocoded_address: "Punto marcado en el mapa", distance_km: r.distanceKm, extra_km: r.extraKm, transport_method: r.method, transport_zone: null, geocoded_query: key };
    await writePatch(projectId, patch);
    return status(patch, true);
  }

  // auto
  if (!req.force && p.geocoded_query === key && prevMethod) {
    return { changed: false, ok: true, extraKm: num(p.extra_km), distanceKm: p.distance_km != null ? num(p.distance_km) : null, method: prevMethod };
  }
  const r = await locateAddress(p.location, city);
  if (!r.ok || !r.point) {
    if (keepUserChoice) {
      await db.execute(sql`UPDATE projects SET geocoded_query = ${key}, transport_updated_at = now() WHERE id = ${projectId}`);
      return { changed: false, ok: false, reason: r.reason, extraKm: num(p.extra_km), distanceKm: null, method: prevMethod };
    }
    const patch: Patch = { latitude: null, longitude: null, geo_source: null, geocoded_address: null, distance_km: null, extra_km: 0, transport_method: "none", transport_zone: null, geocoded_query: key };
    await writePatch(projectId, patch);
    return status(patch, false, r.reason);
  }
  const patch: Patch = { latitude: r.point.lat, longitude: r.point.lng, geo_source: "nominatim", geocoded_address: r.displayName, distance_km: r.distanceKm, extra_km: r.extraKm, transport_method: r.method, transport_zone: null, geocoded_query: key };
  await writePatch(projectId, patch);
  return status(patch, true);
}

/** Recalcula total (+ transporte) de todos los presupuestos del proyecto. */
export async function recomputeProjectBudgets(projectId: number): Promise<number> {
  const bs = rowsOf(await db.execute(sql`SELECT id FROM budgets WHERE project_id = ${projectId}`));
  for (const b of bs) await recomputeBudgetTotal(Number(b.id));
  return bs.length;
}

// ---------------------------------------------------------------------------------------
// Línea del presupuesto
// ---------------------------------------------------------------------------------------
function hoursFactor(unit: string | null | undefined): number {
  const u = normalizeUnit(unit);
  if (u === "h") return 1;
  const s = String(unit || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\.$/, "");
  if (["dia", "dias", "jornal", "jornales", "jor", "d"].includes(s)) return TRANSPORT.hoursPerWorkerDay;
  return 0; // gbl / pza / etc.: sin horas conocidas
}

const liveCache = new Map<string, { at: number; mat: number; hours: number }>();

async function itemInputs(item: any, projectId: number): Promise<{ mat: number; hours: number }> {
  const snap = item.apu_snapshot;
  if (snap && snap.totals && Array.isArray(snap.rows)) {
    const mat = num(snap.totals.materials);
    let hours = 0;
    for (const r of snap.rows) if (r.t === "labor") hours += num(r.qty) * (1 + num(r.waste) / 100) * hoursFactor(r.unit);
    return { mat, hours };
  }
  const key = `${item.activity_id}|${projectId}|${item.id}`;
  const c = liveCache.get(key);
  if (c && Date.now() - c.at < 15_000) return c;
  try {
    const apu = await computeActivityApu(Number(item.activity_id), projectId, Number(item.id), { includeOptions: false });
    let hours = 0;
    for (const r of apu.rows) if (r.inputType === "labor") hours += r.effectiveQuantity * hoursFactor(r.unit);
    const v = { at: Date.now(), mat: apu.materialsTotal, hours };
    liveCache.set(key, v);
    if (liveCache.size > 5000) liveCache.clear();
    return v;
  } catch {
    return { mat: 0, hours: 0 };
  }
}

export async function computeBudgetTransport(budgetId: number): Promise<{ cost: number; snapshot: TransportSnapshot } | null> {
  const b = rowsOf(await db.execute(sql`
    SELECT b.id, b.project_id, p.* FROM budgets b JOIN projects p ON p.id = b.project_id WHERE b.id = ${budgetId}`))[0];
  if (!b) return null;
  const projectId = Number(b.project_id);
  const city = (b.city || "").trim() || "Santa Cruz";
  const kz = cityKmZero(city);
  const extraKm = Math.max(0, num(b.extra_km));
  const method = (b.transport_method || "none") as TransportMethod;
  const percentages = {
    administrative: num(b.administrative_percentage, APU_DEFAULT_PERCENTAGES.administrative),
    utility: num(b.utility_percentage, APU_DEFAULT_PERCENTAGES.utility),
    tax: num(b.tax_percentage, APU_DEFAULT_PERCENTAGES.tax),
  };
  const cf = await getCityFactors(city);
  let materials = 0;
  let hours = 0;
  if (extraKm > 0) {
    const items = rowsOf(await db.execute(sql`SELECT * FROM budget_items WHERE budget_id = ${budgetId} ORDER BY id`));
    for (const it of items) {
      const q = num(it.quantity);
      const { mat, hours: h } = await itemInputs(it, projectId);
      materials += mat * q;
      hours += h * q;
    }
  }
  const r = computeTransport({
    materials,
    laborHours: hours,
    extraKm,
    transportFactor: cf.transportFactor,
    fareBs: kz?.fareBs ?? TRANSPORT.defaultFareBs,
    percentages,
  });
  const snapshot: TransportSnapshot = {
    v: 1,
    computedAt: new Date().toISOString(),
    city,
    kmZero: kz ? { center: kz.center.name, radiusKm: kz.radiusKm, zeroLabel: kz.zeroLabel } : null,
    distanceKm: b.distance_km != null ? num(b.distance_km) : null,
    method,
    zone: b.transport_zone ?? null,
    percentages,
    note: BASE_PRICE_NOTE,
    ...r,
  };
  return { cost: r.total, snapshot };
}

/** Calcula y guarda la línea en budgets; devuelve el costo (0 si no aplica). */
export async function storeBudgetTransport(budgetId: number): Promise<number> {
  if (!(await transportAvailable())) return 0;
  const t = await computeBudgetTransport(budgetId);
  if (!t) return 0;
  await db.execute(sql`UPDATE budgets SET transport_cost = ${t.cost}, transport_snapshot = ${JSON.stringify(t.snapshot)}::jsonb WHERE id = ${budgetId}`);
  return t.cost;
}

// ---------------------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------------------
export function registerTransportRoutes(app: any, requireAuth: Mw) {
  app.get("/api/transport/config", (req: Request, res: Response) => {
    const city = String(req.query.city || "");
    const kz = cityKmZero(city);
    res.json({ city: kz?.city ?? city, kmZero: kz, constants: TRANSPORT, note: BASE_PRICE_NOTE });
  });

  app.post("/api/transport/locate", requireAuth, async (req: Request, res: Response) => {
    try {
      const address = typeof req.body?.address === "string" ? req.body.address.slice(0, 200) : "";
      const city = typeof req.body?.city === "string" ? req.body.city.slice(0, 80) : "";
      const lat = num(req.body?.lat, NaN);
      const lng = num(req.body?.lng, NaN);
      const pin = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
      res.json(await locateAddress(address, city, pin));
    } catch (e) {
      console.error("transport locate error:", e);
      res.status(500).json({ message: "No se pudo calcular la ubicación" });
    }
  });

  app.put("/api/projects/:id/transport", requireAuth, async (req: any, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const own = rowsOf(await db.execute(sql`SELECT id FROM projects WHERE id = ${id} AND user_id = ${req.user.id}`))[0];
      if (!own) return res.status(404).json({ message: "Proyecto no encontrado" });
      if (!(await transportAvailable())) return res.status(503).json({ message: "Transporte no disponible (migración pendiente)" });
      const body = req.body || {};
      const mode = ["auto", "pin", "preset", "manual", "none"].includes(body.mode) ? body.mode : "auto";
      const st = await applyProjectTransport(id, { mode, zone: body.zone, extraKm: body.extraKm, lat: body.lat, lng: body.lng, force: mode === "auto" });
      if (st.reason === "bad_zone") return res.status(400).json({ message: "Zona inválida para la ciudad del proyecto" });
      const budgets = await recomputeProjectBudgets(id);
      const project = await loadProject(id);
      res.json({ status: st, budgetsUpdated: budgets, project: projectToClient(project) });
    } catch (e) {
      console.error("project transport error:", e);
      res.status(500).json({ message: "No se pudo actualizar la ubicación del proyecto" });
    }
  });
}

/** snake_case → camelCase para las columnas de transporte (mismo shape que drizzle). */
export function projectToClient(p: any) {
  if (!p) return p;
  const map: Record<string, string> = {
    user_id: "userId", start_date: "startDate", created_at: "createdAt", updated_at: "updatedAt",
    equipment_percentage: "equipmentPercentage", administrative_percentage: "administrativePercentage",
    utility_percentage: "utilityPercentage", tax_percentage: "taxPercentage", social_charges_percentage: "socialChargesPercentage",
    template_id: "templateId", template_params: "templateParams", distance_km: "distanceKm", extra_km: "extraKm",
    transport_method: "transportMethod", transport_zone: "transportZone", geo_source: "geoSource",
    geocoded_address: "geocodedAddress", geocoded_query: "geocodedQuery", transport_updated_at: "transportUpdatedAt",
  };
  const out: any = {};
  for (const [k, v] of Object.entries(p)) out[map[k] ?? k] = v;
  return out;
}

/** Hook para POST/PUT /api/projects: ubica (si cambió la dirección) y recalcula presupuestos. */
export async function afterProjectSaved(projectId: number, transport?: TransportRequest | null): Promise<{ status: TransportStatus; project: any } | null> {
  try {
    if (!(await transportAvailable())) return null;
    const st = await applyProjectTransport(projectId, transport && transport.mode ? transport : { mode: "auto" });
    if (st.changed) await recomputeProjectBudgets(projectId);
    return { status: st, project: projectToClient(await loadProject(projectId)) };
  } catch (e) {
    console.warn("afterProjectSaved transport:", (e as any)?.message);
    return null;
  }
}
