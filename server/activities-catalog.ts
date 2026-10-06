/**
 * Catálogo de actividades: listado ordenado, búsqueda sin mayúsculas/acentos con sinónimos,
 * y "más usadas" (uso en presupuestos + plantillas, con lista curada de respaldo).
 *
 *  GET /api/activities?search=&phase=&limit=&offset=|page=&all=1
 *  GET /api/activities/most-used?limit=12
 *
 * - Solo actividades públicas (o las del propio usuario autenticado).
 * - Orden: con búsqueda → relevancia, luego fase y nombre; sin búsqueda → fase y nombre.
 * - Límite por defecto 100 (callers antiguos); `all=1` devuelve el catálogo completo.
 */
import { and, asc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "./db";
import { activities, constructionPhases } from "../shared/schema";
import { buildSearchGroups, escapeLike, sqlNormalizeExpr } from "../shared/activity-search";

const NORM_NAME = sql.raw(sqlNormalizeExpr(`"activities"."name"`));
const MAX_LIMIT = 1000;
const ALL_LIMIT = 5000;

export interface ActivityListParams {
  search?: unknown;
  phase?: unknown;
  phaseId?: unknown;
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

  const conds: SQL[] = [visibilityCondition(p.userId)];
  const phase = toInt(p.phase) ?? toInt(p.phaseId);
  if (phase) conds.push(eq(activities.phaseId, phase));

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
  order.push(asc(activities.phaseId), asc(activities.name), asc(activities.id));

  const rows = await db.select().from(activities).where(where).orderBy(...order).limit(limit).offset(offset);
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(activities).where(where);
  const phases = await db.select().from(constructionPhases).orderBy(asc(constructionPhases.id));
  const totalCount = Number(count) || 0;
  return {
    rows: rows.map((a) => ({
      ...a,
      phase: phases.find((ph) => ph.id === a.phaseId) || { id: 0, name: "Sin Fase", description: "" },
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
    where coalesce(a.is_public, true) = true
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
  const rows = await db.select().from(activities).where(and(inArray(activities.id, ids), visibilityCondition(null)));
  const phases = await db.select().from(constructionPhases);
  const usesById = new Map(usage.map((u) => [Number(u.id), Number(u.uses)]));
  const data = ids
    .map((id) => rows.find((r) => r.id === id))
    .filter(Boolean)
    .map((a: any) => ({
      ...a,
      phase: phases.find((ph) => ph.id === a.phaseId) || { id: 0, name: "Sin Fase", description: "" },
      uses: usesById.get(a.id) ?? 0,
      curated: !usesById.has(a.id),
    }));
  mostUsedCache = { at: Date.now(), key, data };
  return data;
}
