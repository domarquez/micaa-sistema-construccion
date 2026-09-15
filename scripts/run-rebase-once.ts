/**
 * One-shot: fill materials.rebasedPrice / rebasedAt / priceOrigin.
 * Does NOT overwrite materials.price.
 *
 * Usage: npx tsx scripts/run-rebase-once.ts
 * Requires DATABASE_URL.
 */
import { db } from "../server/db";
import { materials, materialCategories } from "../shared/schema";
import { eq } from "drizzle-orm";
import { rebaseCatalogPrice, DEFAULT_MACRO } from "../shared/pricing";

async function main() {
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

  let updated = 0;
  let skipped = 0;
  for (const row of rows) {
    const catalog = parseFloat(String(row.material.price));
    const r = rebaseCatalogPrice(
      catalog,
      row.categoryName || "",
      DEFAULT_MACRO,
    );
    await db
      .update(materials)
      .set({
        rebasedPrice: r.basePrice.toFixed(2),
        rebasedAt: new Date(),
        priceOrigin: r.origin,
      })
      .where(eq(materials.id, row.material.id));
    if (r.rebaseSkipped) skipped++;
    else updated++;
  }
  console.log(
    JSON.stringify({ total: rows.length, written: updated + skipped, rebaseSkipped: skipped }, null, 2),
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
