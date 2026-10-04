/**
 * Seed idempotente de plantillas de proyecto desde data/project-templates.json.
 *
 *   npx tsx scripts/seed-project-templates.ts            # dry-run (default): transacción + ROLLBACK, muestra el plan
 *   npx tsx scripts/seed-project-templates.ts --apply    # COMMIT
 *
 * Requiere migrations/0003_project_templates.sql aplicada.
 * - Upsert por slug. Si la versión en DB es MAYOR que la del JSON, no la toca.
 * - Reemplaza las líneas de la plantilla (DELETE + INSERT) solo si cambiaron (firma).
 * - Resuelve las actividades "faltantes" por nombre normalizado (las crea create-template-activities.ts).
 *   Si queda alguna sin resolver, o un activityId no existe: is_active = false + inactive_reason.
 * - No toca is_premium ni price_bs de plantillas existentes (los define un admin). En inserts: is_premium = false.
 * - Valida que todas las fórmulas evalúen y que las cantidades por defecto coincidan con el JSON.
 */
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import fs from "fs";
import path from "path";
import { evaluateTemplate } from "../shared/template-formula";

neonConfig.webSocketConstructor = ws as any;
const APPLY = process.argv.includes("--apply");
const FILE = path.resolve(process.cwd(), process.argv.find((a) => a.endsWith(".json")) || "data/project-templates.json");
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();

type Q = { query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> };

/** Valida el JSON (fórmulas y cantidades por defecto). Lanza si algo no cuadra. */
export function validateTemplatesJson(J: any) {
  for (const t of J.templates) {
    const ev = evaluateTemplate(t.params, t.derived, t.items, null);
    ev.items.forEach((it: any) => {
      if (Math.abs(it.quantity - Math.max(0, it.defaultQuantity)) > 0.0015)
        throw new Error(`${t.slug} #${it.sortOrder}: cantidad ${it.quantity} ≠ JSON ${it.defaultQuantity} (${it.quantityFormula})`);
    });
  }
}

/** Upsert de todas las plantillas con un cliente ya dentro de una transacción. */
export async function seedTemplates(c: Q, J: any) {
  const report: any[] = [];
  const t0 = (await c.query("select to_regclass('public.project_templates')::text t, to_regclass('public.project_template_items')::text i")).rows[0];
  if (!t0.t || !t0.i) throw new Error("Falta la migración 0003_project_templates.sql");
  const acts = (await c.query("select id, name from activities")).rows as Array<{ id: number; name: string }>;
  const byId = new Set(acts.map((a) => a.id));
  const byName = new Map(acts.map((a) => [norm(a.name), a.id]));
  let order = 0;
  for (const t of J.templates) {
    order += 10;
    const unresolved: string[] = [];
    const items = t.items.map((it: any) => {
      let activityId: number | null = it.activityId ?? null;
      if (activityId != null && !byId.has(activityId)) { unresolved.push(`#${activityId} (no existe)`); activityId = null; }
      if (activityId == null && it.missingKey) {
        const hit = it.missingName ? byName.get(norm(it.missingName)) : undefined;
        if (hit) activityId = hit; else unresolved.push(it.missingKey);
      }
      return { ...it, activityId };
    });
    const uniqMissing = Array.from(new Set(unresolved));
    const active = uniqMissing.length === 0;
    const reason = active ? null : `Faltan ${uniqMissing.length} actividad(es): ${uniqMissing.join(", ")}`;
    const sig = JSON.stringify(items.map((i: any) => [i.sortOrder, i.phaseId, i.activityId, i.missingKey ?? null, i.quantityFormula, i.breakdown ?? null]));
    const prev = (await c.query("select id, version from project_templates where slug=$1", [t.slug])).rows[0];
    if (prev && prev.version > t.version) { report.push({ slug: t.slug, action: "omitida (versión en DB mayor)" }); continue; }
    const header = [t.name, t.category, t.description, t.unitRef, t.refQuantityFormula, JSON.stringify(t.params), JSON.stringify(t.derived),
      J.city || "Santa Cruz", active, reason, t.version, order];
    let id: number;
    let action: string;
    if (prev) {
      id = prev.id;
      await c.query(`update project_templates set name=$2, category=$3, description=$4, unit_ref=$5, ref_quantity_formula=$6,
        params_schema=$7::jsonb, derived=$8::jsonb, default_city=$9, is_active=$10, inactive_reason=$11, version=$12, sort_order=$13, updated_at=now()
        where id=$1`, [id, ...header]);
      action = "actualizada";
    } else {
      id = (await c.query(`insert into project_templates (name, category, description, unit_ref, ref_quantity_formula, params_schema, derived,
        default_city, is_active, inactive_reason, version, sort_order, slug, is_premium)
        values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11,$12,$13,false) returning id`, [...header, t.slug])).rows[0].id;
      action = "creada";
    }
    const cur = (await c.query("select sort_order, phase_id, activity_id, missing_key, quantity_formula, breakdown from project_template_items where template_id=$1 order by sort_order, id", [id])).rows;
    const curSig = JSON.stringify(cur.map((r: any) => [r.sort_order, r.phase_id, r.activity_id, r.missing_key, r.quantity_formula, r.breakdown]));
    let itemsAction = "sin cambios";
    if (curSig !== sig) {
      await c.query("delete from project_template_items where template_id=$1", [id]);
      for (const i of items) {
        await c.query(`insert into project_template_items (template_id, phase_id, activity_id, missing_key, missing_name, quantity_formula,
          default_quantity, breakdown, is_optional, sort_order) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [id, i.phaseId, i.activityId, i.missingKey ?? null, i.missingName ?? null, i.quantityFormula, Math.max(0, i.defaultQuantity).toFixed(3), i.breakdown ?? null,
           !(i.defaultQuantity > 0), i.sortOrder]);
      }
      itemsAction = `reemplazadas (${items.length})`;
    }
    report.push({ slug: t.slug, id, action, items: itemsAction, active, reason });
  }
  return report;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL requerido");
  const J = JSON.parse(fs.readFileSync(FILE, "utf8"));
  validateTemplatesJson(J);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const report = await seedTemplates(c as any, J);
    if (APPLY) await c.query("COMMIT"); else await c.query("ROLLBACK");
    console.log(`MODE ${APPLY ? "apply" : "dry-run"} · ${FILE}`);
    for (const r of report) console.log(`  ${r.slug.padEnd(28)} ${String(r.action).padEnd(12)} items ${r.items ?? "-"} · ${r.active ? "ACTIVA" : "INACTIVA"}${r.reason ? " · " + r.reason : ""}`);
  } catch (e) {
    try { await c.query("ROLLBACK"); } catch {}
    throw e;
  } finally {
    c.release();
    await pool.end();
  }
}
if (process.argv[1] && /seed-project-templates\.ts$/.test(process.argv[1])) main().catch((e) => { console.error(e); process.exit(1); });
