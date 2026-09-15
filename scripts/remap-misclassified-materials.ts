/**
 * Reclasifica materiales mal puestos (p.ej. maderas en ACERO) por reglas de nombre.
 * Luego recalcula rebasedPrice / priceOrigin.
 *
 * Dry-run: npx tsx scripts/remap-misclassified-materials.ts
 * Apply:   npx tsx scripts/remap-misclassified-materials.ts --apply
 */
import { db } from "../server/db";
import { materials, materialCategories } from "../shared/schema";
import { eq } from "drizzle-orm";
import { rebaseCatalogPrice, DEFAULT_MACRO } from "../shared/pricing";

type Rule = { categoryName: string; patterns: RegExp[] };

const RULES: Rule[] = [
  {
    categoryName: "MADERAS",
    patterns: [
      /\bmadera\b/i,
      /\btajibo\b/i,
      /\bpino\b/i,
      /\bmara\b/i,
      /\bcuchi\b/i,
      /\bmachimbre\b/i,
      /\bparquet\b/i,
      /\bcuart[oó]n\b/i,
      /\btabl[oó]n\b/i,
      /\bpelda[nñ]o\b/i,
      /\bmarco de\b/i,
    ],
  },
  {
    categoryName: "MADERA ELABORADA",
    patterns: [/\bcontrachapad/i, /\bmelamina\b/i, /\baglomerad/i, /\bmdf\b/i],
  },
  {
    categoryName: "CEMENTOS",
    patterns: [/\bcemento portland\b/i, /\bcemento tipo\b/i, /\bcemento ip\b/i],
  },
  {
    categoryName: "LADRILLOS",
    patterns: [/\bladrillo\b/i, /\badobito\b/i, /\bbloque de cemento\b/i, /\bbloque hueco\b/i],
  },
  {
    categoryName: "TUBOS DE HORMIGON",
    patterns: [/\btubo de cemento\b/i, /\btubo de hormig[oó]n\b/i],
  },
  {
    categoryName: "INSTALACION SANITARIA",
    patterns: [/\blavander[ií]a\b/i, /\blavadero\b/i, /\binodoro\b/i],
  },
  {
    categoryName: "ARIDOS Y PIEDRAS",
    patterns: [/\barena\b/i, /\bgrava\b/i, /\bripio\b/i, /\bpiedra\b/i],
  },
];

const KEEP_IN_ACERO = [
  /\bfierro\b/i,
  /\bacero\b/i,
  /\bcorrugad/i,
  /\balambre\b/i,
  /\bvarilla\b/i,
  /\bperfil\b/i,
  /\bangular\b/i,
  /\bplancha\b/i,
  /\bmalla\b/i,
  /\bclavo\b/i,
];

function guessCategory(name: string): string | null {
  if (KEEP_IN_ACERO.some((r) => r.test(name))) return null;
  for (const rule of RULES) {
    if (rule.patterns.some((r) => r.test(name))) return rule.categoryName;
  }
  return null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const cats = await db.select().from(materialCategories);
  const byName = new Map(cats.map((c) => [c.name.toUpperCase(), c]));

  const rows = await db
    .select({
      material: materials,
      categoryName: materialCategories.name,
    })
    .from(materials)
    .leftJoin(
      materialCategories,
      eq(materials.categoryId, materialCategories.id),
    );

  const plan: Array<{
    id: number;
    name: string;
    from: string;
    to: string;
    price: string;
  }> = [];

  for (const row of rows) {
    const from = row.categoryName || "";
    // Solo reclasificar si está en ACERO (o sin categoría) y el nombre dice otra cosa
    if (!/^ACERO/i.test(from) && from) continue;
    const toName = guessCategory(row.material.name);
    if (!toName) continue;
    const target = byName.get(toName.toUpperCase());
    if (!target) continue;
    if (target.id === row.material.categoryId) continue;
    plan.push({
      id: row.material.id,
      name: row.material.name,
      from,
      to: target.name,
      price: String(row.material.price),
    });
  }

  console.log(JSON.stringify({ dryRun: !apply, count: plan.length, sample: plan.slice(0, 25) }, null, 2));

  if (!apply) {
    console.log("Dry-run only. Re-run with --apply to write.");
    process.exit(0);
  }

  let updated = 0;
  for (const item of plan) {
    const target = byName.get(item.to.toUpperCase())!;
    const catalog = parseFloat(item.price);
    const r = rebaseCatalogPrice(catalog, target.name, DEFAULT_MACRO, item.name);
    await db
      .update(materials)
      .set({
        categoryId: target.id,
        rebasedPrice: r.basePrice.toFixed(2),
        rebasedAt: new Date(),
        priceOrigin: r.origin,
      })
      .where(eq(materials.id, item.id));
    updated++;
  }
  console.log(JSON.stringify({ updated }, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
