/**
 * Read-only verify: live steel kg refs + getPublicMaterialPrice for sample ids.
 * Does NOT write.
 */
import { getPublicMaterialPrice } from "../server/material-price";
import { refreshSteelKgCache } from "../server/steel-kg-ref";

const IDS = [208, 61, 62, 59, 12];

(async () => {
  const cache = await refreshSteelKgCache();
  console.log("cache buckets=", cache.buckets, "sampleHint=", cache.sampleHint);

  for (const id of IDS) {
    const d = await getPublicMaterialPrice(id, "Santa Cruz");
    if (!d) {
      console.log(id, "NOT FOUND");
      continue;
    }
    console.log(
      JSON.stringify({
        id: d.materialId,
        name: d.name,
        weightKg: d.weightKg,
        base: d.basePrice,
        origin: d.origin,
        pricePerKg: d.pricePerKg,
        steelKg: (d as any).steelKg,
        market: d.quotes.find((q) => q.source === "market")?.price,
      }),
    );
  }
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
