/**
 * Verificación (SOLO LECTURA): APU en vivo del "MURO DE LADRILLO CERAMICO DE 6H" en Santa Cruz.
 *
 *   DATABASE_URL=... npx tsx scripts/verify-apu-muro-6h.ts [activityId=366] [--city="Santa Cruz"] [--project=ID] [--json]
 *
 * Todas las conexiones del pool se ponen en default_transaction_read_only = on,
 * así que el script no puede escribir aunque quisiera.
 */
import { pool } from "../server/db";

pool.on("connect", (client: any) => {
  client.query("SET default_transaction_read_only = on").catch(() => {});
});

const args = process.argv.slice(2);
const flag = (name: string) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : undefined;
};
const positional = args.filter((a) => !a.startsWith("--"));

async function main() {
  const { computeActivityApu } = await import("../server/apu-live");
  const { db } = await import("../server/db");
  const { sql } = await import("drizzle-orm");

  let activityId = positional[0] ? parseInt(positional[0]) : NaN;
  if (!Number.isFinite(activityId)) {
    const r: any = await db.execute(
      sql`SELECT id FROM activities WHERE name ILIKE 'MURO DE LADRILLO CERAMICO DE 6H' ORDER BY id LIMIT 1`,
    );
    activityId = Number((r.rows ?? r)[0]?.id ?? 366);
  }
  const city = flag("city") || "Santa Cruz";
  const projectId = flag("project") ? parseInt(flag("project")!) : null;

  const apu = await computeActivityApu(activityId, projectId, null, { city });

  if (args.includes("--json")) {
    console.log(JSON.stringify(apu, null, 2));
    return;
  }

  const f = (n: number, d = 2) => n.toLocaleString("es-BO", { minimumFractionDigits: d, maximumFractionDigits: d });
  console.log(`\nAPU en vivo · #${apu.activityId} ${apu.activityName} (${apu.unit})`);
  console.log(
    `Ciudad: ${apu.city} (fila: ${apu.factorCity ?? "—"}) · factores mat ${apu.factors.materials} / MO ${apu.factors.labor} / eq ${apu.factors.equipment}`,
  );
  console.log(
    `Porcentajes: CS ${apu.percentages.socialCharges}% · IVA MO ${apu.percentages.laborIva}% · herr. ${apu.percentages.minorTools}% MO · GG ${apu.percentages.administrative}% · util ${apu.percentages.utility}% · IT ${apu.percentages.tax}%`,
  );
  console.log(`waste_pct disponible: ${apu.wasteColumnAvailable} · overrides disponibles: ${apu.overridesAvailable}\n`);

  console.table(
    apu.rows.map((r) => ({
      tipo: r.inputType,
      id: r.inputId,
      insumo: r.name.slice(0, 42),
      unid: r.unit,
      "unid.cat": r.catalogUnit,
      cant: r.quantity,
      "desp%": r.wastePct,
      "P.U.": f(r.unitPrice),
      fuente: r.sourceLabel,
      parcial: f(r.subtotal),
      opciones: r.options.map((o) => `${o.key}=${o.price}`).join(" | ").slice(0, 80),
      avisos: r.warnings.join("; ").slice(0, 70),
    })),
  );

  const lines: Array<[string, number]> = [
    ["Materiales", apu.materialsTotal],
    ["Mano de obra", apu.laborTotal],
    ["  Cargas sociales", apu.laborCharges],
    ["  IVA MO", apu.laborIVA],
    ["  MO final", apu.laborFinal],
    ["Equipo", apu.equipmentTotal],
    ["  Herramientas menores", apu.tools],
    ["COSTO DIRECTO", apu.directCost],
    ["Gastos generales", apu.administrativeCost],
    ["Utilidad", apu.utilityCost],
    ["IT", apu.taxCost],
    ["PRECIO UNITARIO", apu.totalUnitPrice],
  ];
  for (const [k, v] of lines) console.log(`${k.padEnd(26)} ${f(v).padStart(12)}`);
  if (apu.warnings.length) console.log("\nAvisos:", apu.warnings.join(" | "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
