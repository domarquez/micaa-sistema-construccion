/**
 * Detecta duplicados y normaliza nombres/unidades de materials (sin hard deletes).
 *
 * Dry-run: npx tsx scripts/dedupe-normalize-materials.ts
 * Apply:   npx tsx scripts/dedupe-normalize-materials.ts --apply
 *
 * --apply solo:
 *  - recorta espacios
 *  - colapsa espacios múltiples
 *  - normaliza unidad a minúsculas conocidas (m2, m3, kg, pza, …)
 *  - NO borra filas; reporta grupos duplicados por nombre normalizado
 */
import { db } from "../server/db";
import { materials } from "../shared/schema";
import { eq } from "drizzle-orm";

const UNIT_MAP: Record<string, string> = {
  m2: "m2",
  "m²": "m2",
  mt2: "m2",
  mts2: "m2",
  metro2: "m2",
  "metro cuadrado": "m2",
  m3: "m3",
  "m³": "m3",
  mt3: "m3",
  "metro cubico": "m3",
  "metro cúbico": "m3",
  kg: "kg",
  kilos: "kg",
  kilogramo: "kg",
  kilogramos: "kg",
  pza: "pza",
  pieza: "pza",
  piezas: "pza",
  und: "pza",
  u: "pza",
  unidad: "pza",
  unidades: "pza",
  bolsa: "bolsa",
  bolsas: "bolsa",
  bol: "bolsa",
  gal: "gal",
  galon: "gal",
  galón: "gal",
  galones: "gal",
  lt: "lt",
  l: "lt",
  litro: "lt",
  litros: "lt",
  m: "m",
  ml: "m",
  metro: "m",
  metros: "m",
  rollo: "rollo",
  plancha: "plancha",
  balde: "balde",
  par: "par",
  juego: "juego",
  globo: "globo",
};

function normalizeName(name: string): string {
  return name
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUnit(unit: string): string {
  const key = unit.normalize("NFKC").trim().toLowerCase();
  return UNIT_MAP[key] || unit.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function dedupeKey(name: string, unit: string): string {
  return `${normalizeName(name).toLowerCase()}||${normalizeUnit(unit).toLowerCase()}`;
}

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(apply ? "MODE: --apply (write safe normalizations)" : "MODE: dry-run (report only)");

  const rows = await db.select().from(materials);
  console.log(`Materials: ${rows.length}`);

  const nameFixes: { id: number; from: string; to: string }[] = [];
  const unitFixes: { id: number; name: string; from: string; to: string }[] = [];

  for (const row of rows) {
    const n = normalizeName(row.name);
    const u = normalizeUnit(row.unit);
    if (n !== row.name) nameFixes.push({ id: row.id, from: row.name, to: n });
    if (u !== row.unit) unitFixes.push({ id: row.id, name: row.name, from: row.unit, to: u });
  }

  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = dedupeKey(row.name, row.unit);
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }
  const dupes = [...groups.entries()].filter(([, list]) => list.length > 1);

  console.log("\n=== Name whitespace / NFKC fixes ===");
  console.log(`Candidates: ${nameFixes.length}`);
  nameFixes.slice(0, 40).forEach((f) => console.log(`  #${f.id}: ${JSON.stringify(f.from)} -> ${JSON.stringify(f.to)}`));
  if (nameFixes.length > 40) console.log(`  … +${nameFixes.length - 40} more`);

  console.log("\n=== Unit normalization ===");
  console.log(`Candidates: ${unitFixes.length}`);
  unitFixes.slice(0, 40).forEach((f) =>
    console.log(`  #${f.id} ${f.name}: ${JSON.stringify(f.from)} -> ${JSON.stringify(f.to)}`),
  );
  if (unitFixes.length > 40) console.log(`  … +${unitFixes.length - 40} more`);

  console.log("\n=== Duplicate groups (same normalized name+unit) — NO deletes ===");
  console.log(`Groups: ${dupes.length}`);
  dupes.slice(0, 30).forEach(([key, list]) => {
    console.log(`  ${key} (${list.length})`);
    list.forEach((r) =>
      console.log(`    id=${r.id} price=${r.price} cat=${r.categoryId} updated=${r.lastUpdated}`),
    );
  });
  if (dupes.length > 30) console.log(`  … +${dupes.length - 30} more groups`);

  if (!apply) {
    console.log("\nDry-run complete. Re-run with --apply to write name/unit normalizations only.");
    process.exit(0);
  }

  let updated = 0;
  for (const f of nameFixes) {
    await db.update(materials).set({ name: f.to }).where(eq(materials.id, f.id));
    updated++;
  }
  for (const f of unitFixes) {
    // re-read in case name already changed same row
    await db.update(materials).set({ unit: f.to }).where(eq(materials.id, f.id));
    updated++;
  }
  console.log(`\nApplied ${updated} field updates (no deletes). Duplicate groups left for manual merge.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
