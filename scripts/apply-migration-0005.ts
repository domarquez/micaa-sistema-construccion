/**
 * Aplica migrations/0005_project_transport.sql en Neon (aditiva, idempotente).
 *   Dry-run (solo muestra estado):  npx tsx scripts/apply-migration-0005.ts
 *   Aplicar:                         npx tsx scripts/apply-migration-0005.ts --apply
 * NUNCA usar db:push.
 */
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import fs from "node:fs";
import path from "node:path";

neonConfig.webSocketConstructor = ws as any;

(async () => {
  const apply = process.argv.includes("--apply");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no definida");
  const file = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../migrations/0005_project_transport.sql");
  const sqlText = fs.readFileSync(file, "utf8");
  const pool = new Pool({ connectionString: url });
  const c = await pool.connect();
  const state = async () => {
    const r = await c.query(`
      SELECT table_name || '.' || column_name AS c FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND ((table_name = 'projects' AND column_name IN ('latitude','longitude','distance_km','extra_km','transport_method','transport_zone','geo_source','geocoded_address','geocoded_query','transport_updated_at'))
           OR (table_name = 'budgets' AND column_name IN ('transport_cost','transport_snapshot'))
           OR (table_name = 'geocode_cache' AND column_name = 'query'))
       ORDER BY 1`);
    return r.rows.map((x: any) => x.c);
  };
  try {
    console.log("Antes:", await state());
    if (!apply) {
      console.log("Dry-run. Usa --apply para ejecutar", file);
      return;
    }
    await c.query(sqlText);
    const after = await state();
    console.log("Después:", after);
    if (after.length !== 13) throw new Error(`Se esperaban 13 columnas, hay ${after.length}`);
    const cnt = await c.query("SELECT (SELECT count(*) FROM projects) p, (SELECT count(*) FROM budgets) b");
    console.log("Filas intactas:", cnt.rows[0]);
  } finally {
    c.release();
    await pool.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
