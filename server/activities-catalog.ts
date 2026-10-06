/**
 * Catálogo de actividades: listado ordenado, búsqueda sin mayúsculas/acentos con sinónimos,
 * y "más usadas" (uso en presupuestos + plantillas, con lista curada de respaldo).
 *
 *  GET /api/activities?search=&phase=&family=&limit=&offset=|page=&all=1
 *  GET /api/activities/most-used?limit=12
 *  GET /api/activities/catalog          → árbol fase › familia › (subfamilia de variantes) › actividad
 *  GET /api/construction-phases         → fases activas en orden constructivo (?includeInactive=1 = todas)
 *
 * - Solo actividades ACTIVAS (is_active, migración 0004) y públicas (o las del propio usuario autenticado).
 * - Orden: con búsqueda → relevancia; luego fase (sort_order), familia, orden dentro de la familia y nombre.
 * - Búsqueda sobre nombre + sinónimos (activities.synonyms).
 * - Límite por defecto 100 (callers antiguos); `all=1` devuelve el catálogo completo.
 */
import { and, asc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "./db";
import { activities, activityFamilies, constructionPhases, type ConstructionPhase, type ActivityFamily } from "../shared/schema";
import { buildSearchGroups, escapeLike, sqlNormalizeExpr } from "../shared/activity-search";

const NORM_NAME = sql.raw(sqlNormalizeExpr(`("activities"."name" || ' ' || coalesce("activities"."synonyms", ''))`));
/** Orden constructivo: fase → familia (padre, luego subfamilia) → orden de la actividad → nombre. */
const ORDER_PHASE = sql`(select p.sort_order from construction_phases p where p.id = ${activities.phaseId})`;
const ORDER_FAMILY = sql`(select coalesce(pf.sort_order, f.sort_order) * 1000 + case when f.parent_id is null then 0 else f.sort_order end
  from activity_families f left join activity_families pf on pf.id = f.parent_id where f.id = ${activities.familyId})`;

// ---------- fases y familias (caché corta: son ~20 y ~100 filas) ----------
let taxoCache: { at: number; phases: ConstructionPhase[]; families: ActivityFamily[] } | null = null;
export async function getTaxonomy(force = false) {
  if (!force && taxoCache && Date.now() - taxoCache.at < 60_000) return taxoCache;
  const phases = await db.select().from(constructionPhases).orderBy(asc(constructionPhases.sortOrder), asc(constructionPhases.id));
  const families = await db.select().from(activityFamilies).orderBy(asc(activityFamilies.sortOrder), asc(activityFamilies.id));
  taxoCache = { at: Date.now(), phases, families };
  return taxoCache;
}

export async function listPhases(includeInactive = false) {
  const { phases } = await getTaxonomy();
  return includeInactive ? phases : phases.filter((p) => p.isActive);
}

function familyInfo(families: ActivityFamily[], id: number | null | undefined) {
  if (!id) return null;
  const f = families.find((x) => x.id === id);
  if (!f) return null;
  const parent = f.parentId ? families.find((x) => x.id === f.parentId) : null;
  return { id: f.id, name: f.name, parentId: f.parentId ?? null, parentName: parent?.name ?? null };
}
const NO_PHASE = { id: 0, name: "Sin Fase", description: "", slug: null, sortOrder: 9999, isActive: true };
const MAX_LIMIT = 1000;
const ALL_LIMIT = 5000;

export interface ActivityListParams {
  search?: unknown;
  phase?: unknown;
  phaseId?: unknown;
  family?: unknown;
  limit?: unknown;
  offset?: unknown;
  page?: unknown;
  all?: unknown;
  userId?: number | null;
}

function toInt(v: unknown): number | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

export function visibilityCondition(userId?: number | null): SQL {
  return userId
    ? sql`(coalesce(${activities.isPublic}, true) = true or ${activities.createdBy} = ${userId})`
    : sql`coalesce(${activities.isPublic}, true) = true`;
}

export async function listActivities(p: ActivityListParams) {
  const all = p.all === "1" || p.all === "true" || p.all === 1 || p.all === true;
  let limit = all ? ALL_LIMIT : toInt(p.limit) ?? 100;
  if (!all) limit = Math.min(Math.max(1, limit), MAX_LIMIT);
  let offset = toInt(p.offset);
  const page = toInt(p.page);
  if ((offset === null || offset < 0) && page && page > 0) offset = (page - 1) * limit;
  if (offset === null || offset < 0 || all) offset = 0;

  const conds: SQL[] = [visibilityCondition(p.userId), eq(activities.isActive, true)];
  const phase = toInt(p.phase) ?? toInt(p.phaseId);
  if (phase) conds.push(eq(activities.phaseId, phase));
  const family = toInt(p.family);
  if (family) conds.push(sql`${activities.familyId} in (select id from activity_families where id = ${family} or parent_id = ${family})`);

  const search = typeof p.search === "string" ? p.search : "";
  const groups = buildSearchGroups(search);
  for (const g of groups) {
    const ors = g.alternatives.map((a) => sql`${NORM_NAME} like ${"%" + escapeLike(a) + "%"}`);
    conds.push(sql`(${sql.join(ors, sql` or `)})`);
  }
  const where = and(...conds);

  const order: SQL[] = [];
  if (groups.length > 0) {
    // Relevancia simple: primero las que EMPIEZAN con la primera palabra (o un sinónimo); luego fase y nombre.
    const starts = groups[0].alternatives.map((a) => sql`${NORM_NAME} like ${" " + escapeLike(a.trim()) + "%"}`);
    order.push(sql`(case when ${sql.join(starts, sql` or `)} then 0 else 1 end)`);
  }
  order.push(sql`${ORDER_PHASE} asc nulls last`, sql`${ORDER_FAMILY} asc nulls last`, asc(activities.sortOrder), asc(activities.name), asc(activities.id));

  const rows = await db.select().from(activities).where(where).orderBy(...order).limit(limit).offset(offset);
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(activities).where(where);
  const { phases, families } = await getTaxonomy();
  const totalCount = Number(count) || 0;
  return {
    rows: rows.map((a) => ({
      ...a,
      phase: phases.find((ph) => ph.id === a.phaseId) || NO_PHASE,
      family: familyInfo(families, a.familyId),
      isOriginal: true,
      hasCustomActivity: false,
    })),
    phases,
    totalCount,
    limit,
    offset,
    currentPage: Math.floor(offset / limit) + 1,
    totalPages: Math.max(1, Math.ceil(totalCount / limit)),
  };
}

/**
 * Lista curada de respaldo (~12 actividades comunes de vivienda), en orden constructivo.
 * Se usa para completar "más usadas" cuando no hay suficiente uso real.
 */
export const CURATED_COMMON_ACTIVITY_IDS = [
  518, // Replanteo y trazado
  385, // Excavación manual
  526, // Hormigón simple H21
  523, // Acero de refuerzo
  524, // Encofrado columnas y vigas
  527, // Muro ladrillo 6H 12x18x25 soga
  530, // Revoque grueso interior
  539, // Contrapiso H° sobre empedrado
  421, // Piso cerámica 40x40
  612, // Pintura látex interior
  546, // Punto de iluminación LED
  544, // Punto de agua fría
];

let mostUsedCache: { at: number; key: string; data: any[] } | null = null;

export async function getMostUsedActivities(limitRaw: unknown) {
  const limit = Math.min(Math.max(toInt(limitRaw) ?? 12, 1), 40);
  const key = String(limit);
  if (mostUsedCache && mostUsedCache.key === key && Date.now() - mostUsedCache.at < 10 * 60 * 1000) {
    return mostUsedCache.data;
  }
  let usage: { id: number; uses: number }[] = [];
  const usageSql = (withTemplates: boolean) => sql.raw(`
    select u.activity_id as id, count(*)::int as uses
    from (
      select activity_id from budget_items
      ${withTemplates ? "union all select activity_id from project_template_items where activity_id is not null" : ""}
    ) u
    join activities a on a.id = u.activity_id
    where coalesce(a.is_public, true) = true and a.is_active = true
    group by u.activity_id
    order by uses desc, u.activity_id asc
    limit ${limit * 2}`);
  try {
    const r: any = await db.execute(usageSql(true));
    usage = (r.rows ?? r) as any[];
  } catch {
    const r: any = await db.execute(usageSql(false)); // antes de la migración 0003
    usage = (r.rows ?? r) as any[];
  }
  const ids: number[] = [];
  for (const u of usage) if (ids.length < limit && !ids.includes(Number(u.id))) ids.push(Number(u.id));
  for (const id of CURATED_COMMON_ACTIVITY_IDS) if (ids.length < limit && !ids.includes(id)) ids.push(id);

  if (ids.length === 0) return [];
  const rows = await db.select().from(activities).where(and(inArray(activities.id, ids), visibilityCondition(null), eq(activities.isActive, true)));
  const { phases, families } = await getTaxonomy();
  const usesById = new Map(usage.map((u) => [Number(u.id), Number(u.uses)]));
  const data = ids
    .map((id) => rows.find((r) => r.id === id))
    .filter(Boolean)
    .map((a: any) => ({
      ...a,
      phase: phases.find((ph) => ph.id === a.phaseId) || NO_PHASE,
      family: familyInfo(families, a.familyId),
      uses: usesById.get(a.id) ?? 0,
      curated: !usesById.has(a.id),
    }));
  mostUsedCache = { at: Date.now(), key, data };
  return data;
}

// ---------- árbol del catálogo (drill-down fase › familia › variantes) ----------
export interface CatalogActivity { id: number; name: string; unit: string; unitPrice: string | null }
export interface CatalogFamily { id: number; name: string; activities: CatalogActivity[]; variants: { id: number; name: string; activities: CatalogActivity[] }[]; count: number }
export interface CatalogPhase { id: number; name: string; sortOrder: number; count: number; families: CatalogFamily[]; unclassified: CatalogActivity[] }

let treeCache: { at: number; data: CatalogPhase[] } | null = null;
export function invalidateCatalogCache() { treeCache = null; taxoCache = null; mostUsedCache = null; }

export async function getActivityCatalogTree(): Promise<CatalogPhase[]> {
  if (treeCache && Date.now() - treeCache.at < 5 * 60_000) return treeCache.data;
  const { phases, families } = await getTaxonomy(true);
  const rows = await db
    .select({ id: activities.id, name: activities.name, unit: activities.unit, unitPrice: activities.unitPrice,
      phaseId: activities.phaseId, familyId: activities.familyId })
    .from(activities)
    .where(and(visibilityCondition(null), eq(activities.isActive, true)))
    .orderBy(asc(activities.sortOrder), asc(activities.name), asc(activities.id));
  const toItem = (r: (typeof rows)[number]): CatalogActivity => ({ id: r.id, name: r.name, unit: r.unit, unitPrice: r.unitPrice });
  const activeFams = families.filter((f) => f.isActive);
  const data: CatalogPhase[] = phases.filter((p) => p.isActive).map((p) => {
    const tops = activeFams.filter((f) => f.phaseId === p.id && !f.parentId);
    const fams: CatalogFamily[] = tops.map((f) => {
      const subs = activeFams.filter((s) => s.parentId === f.id);
      const direct = rows.filter((r) => r.familyId === f.id).map(toItem);
      const variants = subs.map((s) => ({ id: s.id, name: s.name, activities: rows.filter((r) => r.familyId === s.id).map(toItem) }))
        .filter((v) => v.activities.length > 0);
      return { id: f.id, name: f.name, activities: direct, variants, count: direct.length + variants.reduce((n, v) => n + v.activities.length, 0) };
    }).filter((f) => f.count > 0);
    const known = new Set(activeFams.map((f) => f.id));
    const unclassified = rows.filter((r) => r.phaseId === p.id && (!r.familyId || !known.has(r.familyId))).map(toItem);
    return { id: p.id, name: p.name, sortOrder: p.sortOrder, families: fams, unclassified,
      count: fams.reduce((n, f) => n + f.count, 0) + unclassified.length };
  });
  treeCache = { at: Date.now(), data };
  return data;
}
