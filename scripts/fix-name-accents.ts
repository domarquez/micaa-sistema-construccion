/**
 * Corrige acentos faltantes en NOMBRES de categorías y materiales (sólo `name`).
 * No toca precios ni ninguna otra columna. Idempotente: una segunda corrida no cambia nada.
 * Guarda un backup JSON (id, nombre anterior, nombre nuevo) antes de aplicar.
 *
 * Dry-run: npx tsx scripts/fix-name-accents.ts
 * Apply:   npx tsx scripts/fix-name-accents.ts --apply
 */
import { writeFileSync, mkdirSync } from "fs";
import { db } from "../server/db";
import { materials, materialCategories } from "../shared/schema";
import { eq } from "drizzle-orm";

const WORDS: [RegExp, string][] = [
  [/\bconstruccion\b/gi, "construcción"],
  [/\belectric(a|as|o|os)\b/gi, "eléctric$1"],
  [/\bceramic(a|as|o|os)\b/gi, "cerámic$1"],
  [/\bmetalic(a|as|o|os)\b/gi, "metálic$1"],
  [/\bhidraulic(a|as|o|os)\b/gi, "hidráulic$1"],
  [/\bacustic(a|as|o|os)\b/gi, "acústic$1"],
  [/\btermic(a|as|o|os)\b/gi, "térmic$1"],
  [/\bplastic(a|as|o|os)\b/gi, "plástic$1"],
  [/\bimpermeabilizacion\b/gi, "impermeabilización"],
  [/\binstalacion\b/gi, "instalación"],
  [/\bfundacion\b/gi, "fundación"],
  [/\bgalvanizacion\b/gi, "galvanización"],
  [/\bplomeria\b/gi, "plomería"],
  [/\bcarpinteria\b/gi, "carpintería"],
  [/\bherreria\b/gi, "herrería"],
  [/\bvidrieria\b/gi, "vidriería"],
  [/\btelefonic(a|as|o|os)\b/gi, "telefónic$1"],
];

function matchCase(orig: string, fixed: string): string {
  if (orig === orig.toUpperCase()) return fixed.toUpperCase();
  if (orig[0] === orig[0].toUpperCase()) return fixed[0].toUpperCase() + fixed.slice(1);
  return fixed;
}

export function fixAccents(name: string): string {
  if (!name) return name;
  let s = name;
  for (const [re, rep] of WORDS) {
    s = s.replace(re, (m: string, g1: unknown) => matchCase(m, rep.replace("$1", typeof g1 === "string" ? g1.toLowerCase() : "")));
  }
  return s;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const cats = await db.select({ id: materialCategories.id, name: materialCategories.name }).from(materialCategories);
  const mats = await db.select({ id: materials.id, name: materials.name }).from(materials);
  const changes = [
    ...cats.map((c) => ({ table: "material_categories", id: c.id, before: c.name, after: fixAccents(c.name) })),
    ...mats.map((m) => ({ table: "materials", id: m.id, before: m.name, after: fixAccents(m.name) })),
  ].filter((c) => c.before !== c.after);

  for (const c of changes) console.log(`${c.table} #${c.id}: "${c.before}" → "${c.after}"`);
  console.log(`\n${changes.length} nombres a corregir (${apply ? "APLICANDO" : "dry-run"})`);
  if (!apply || changes.length === 0) return;

  mkdirSync("scripts/data", { recursive: true });
  const backup = `scripts/data/backup-name-accents-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(backup, JSON.stringify(changes, null, 2));
  console.log(`Backup: ${backup}`);
  for (const c of changes) {
    if (c.table === "materials") await db.update(materials).set({ name: c.after }).where(eq(materials.id, c.id));
    else await db.update(materialCategories).set({ name: c.after }).where(eq(materialCategories.id, c.id));
  }
  console.log("Listo.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
