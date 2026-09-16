/**
 * Compara nombres del catálogo DB contra un JSON curado de materiales comunes.
 * Report-only por defecto. Opcional --insert-stubs (additive, priceOrigin=pendiente).
 *
 * Dry-run: npx tsx scripts/report-catalog-gaps.ts
 * Insert:  npx tsx scripts/report-catalog-gaps.ts --insert-stubs
 *
 * NO scrapea Insucons. El JSON es una lista curada local.
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { db } from "../server/db";
import { materials, materialCategories } from "../shared/schema";
import { eq } from "drizzle-orm";

type RefItem = {
  name: string;
  unit: string;
  categoryHint?: string;
  estimatePrice?: number;
};

type RefFile = {
  items: RefItem[];
  baselineCity?: string;
};

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/["']/g, "")
    .replace(/[^a-z0-9áéíóúñü\s\/x]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Soft match: ref tokens mostly present in a DB name (or vice versa). */
function softMatch(refName: string, dbName: string): boolean {
  const a = norm(refName);
  const b = norm(dbName);
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const tokens = a.split(" ").filter((t) => t.length >= 3);
  if (tokens.length === 0) return false;
  const hit = tokens.filter((t) => b.includes(t)).length;
  return hit >= Math.ceil(tokens.length * 0.7);
}

async function main() {
  const insertStubs = process.argv.includes("--insert-stubs");
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const refPath = join(__dirname, "data", "reference-missing-materials.json");
  const ref = JSON.parse(readFileSync(refPath, "utf8")) as RefFile;
  const items = ref.items || [];

  console.log(`Reference items: ${items.length} (baseline ${ref.baselineCity || "Santa Cruz"})`);
  console.log(insertStubs ? "MODE: --insert-stubs" : "MODE: report-only");

  const dbMats = await db.select().from(materials);
  const cats = await db.select().from(materialCategories);
  const catByName = new Map(cats.map((c) => [c.name.toUpperCase(), c]));

  const missing: RefItem[] = [];
  const found: { ref: string; match: string; id: number }[] = [];

  for (const item of items) {
    const match = dbMats.find((m) => softMatch(item.name, m.name));
    if (match) {
      found.push({ ref: item.name, match: match.name, id: match.id });
    } else {
      missing.push(item);
    }
  }

  console.log(`\nMatched: ${found.length}`);
  found.slice(0, 15).forEach((f) => console.log(`  OK ref="${f.ref}" ~ db#${f.id} "${f.match}"`));
  if (found.length > 15) console.log(`  … +${found.length - 15} more`);

  console.log(`\nMissing from DB: ${missing.length}`);
  missing.forEach((m) =>
    console.log(
      `  - ${m.name} [${m.unit}] cat~${m.categoryHint || "?"} est=${m.estimatePrice ?? 0}`,
    ),
  );

  if (!insertStubs) {
    console.log(
      "\nReport-only. To insert stubs (additive): npx tsx scripts/report-catalog-gaps.ts --insert-stubs",
    );
    process.exit(0);
  }

  // Prefer a stable category; fall back to first available. Never invent categories.
  let inserted = 0;
  for (const item of missing) {
    const hint = (item.categoryHint || "").toUpperCase();
    let cat = hint ? catByName.get(hint) : undefined;
    if (!cat) {
      // fuzzy category
      cat = cats.find((c) => hint && c.name.toUpperCase().includes(hint.split(" ")[0]));
    }
    if (!cat) {
      console.warn(`SKIP (no category): ${item.name}`);
      continue;
    }
    const price = Number.isFinite(item.estimatePrice) ? Number(item.estimatePrice) : 0;
    await db.insert(materials).values({
      categoryId: cat.id,
      name: item.name,
      unit: item.unit,
      price: price.toFixed(2),
      description: "Stub MICAA (pendiente de cotización local)",
      priceOrigin: "pendiente",
      rebasedPrice: price > 0 ? price.toFixed(2) : null,
      rebasedAt: price > 0 ? new Date() : null,
    });
    inserted++;
    console.log(`INSERT stub: ${item.name} -> cat#${cat.id} ${cat.name} price=${price}`);
  }
  console.log(`\nInserted ${inserted} stubs (priceOrigin=pendiente). Review in admin.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
