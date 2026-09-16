/**
 * Seed / update Bolivia city_price_factors if missing.
 * Santa Cruz = 1.0 baseline. Other values are documented estimates.
 *
 * Dry-run: npx tsx scripts/enrich-city-factors.ts
 * Apply:   npx tsx scripts/enrich-city-factors.ts --apply
 *
 * Also ensures selector cities Beni / Pando exist (aliases of Trinidad / Cobija).
 */
import { db } from "../server/db";
import { cityPriceFactors } from "../shared/schema";
import { eq } from "drizzle-orm";

type Seed = {
  city: string;
  materialsFactor: string;
  laborFactor: string;
  equipmentFactor: string;
  transportFactor: string;
  description: string;
};

/**
 * Estimates relative to Santa Cruz retail construction prices.
 * Not official INE indices — operational defaults for MICAA until local quotes fill in.
 */
const SEEDS: Seed[] = [
  {
    city: "Santa Cruz",
    materialsFactor: "1.0000",
    laborFactor: "1.0000",
    equipmentFactor: "1.0000",
    transportFactor: "1.0000",
    description: "Baseline MICAA (SCZ=1.0). Ciudad de referencia para precios de catálogo.",
  },
  {
    city: "Cochabamba",
    materialsFactor: "0.9500",
    laborFactor: "0.9800",
    equipmentFactor: "0.9600",
    transportFactor: "0.9200",
    description: "Estimate: centro del país, buena conectividad (ligeramente bajo SCZ).",
  },
  {
    city: "La Paz",
    materialsFactor: "1.1500",
    laborFactor: "1.2000",
    equipmentFactor: "1.1000",
    transportFactor: "1.2500",
    description: "Estimate: altitud y logística elevan costos vs SCZ.",
  },
  {
    city: "Sucre",
    materialsFactor: "1.0500",
    laborFactor: "1.0800",
    equipmentFactor: "1.0300",
    transportFactor: "1.1500",
    description: "Estimate: capital constitucional, precios ligeramente elevados.",
  },
  {
    city: "Tarija",
    materialsFactor: "0.8800",
    laborFactor: "0.9200",
    equipmentFactor: "0.9000",
    transportFactor: "0.9500",
    description: "Estimate: menor demanda / mercado sureño.",
  },
  {
    city: "Oruro",
    materialsFactor: "1.1200",
    laborFactor: "1.1500",
    equipmentFactor: "1.0800",
    transportFactor: "1.2000",
    description: "Estimate: altiplano, transporte elevado.",
  },
  {
    city: "Potosí",
    materialsFactor: "1.2500",
    laborFactor: "1.3000",
    equipmentFactor: "1.2000",
    transportFactor: "1.4000",
    description: "Estimate: altitud extrema y logística difícil.",
  },
  {
    city: "Beni",
    materialsFactor: "1.3000",
    laborFactor: "1.2500",
    equipmentFactor: "1.3500",
    transportFactor: "1.5000",
    description: "Estimate (dept.): equivalente operativo a Trinidad — transporte fluvial/aislado.",
  },
  {
    city: "Pando",
    materialsFactor: "1.3500",
    laborFactor: "1.3000",
    equipmentFactor: "1.4000",
    transportFactor: "1.6000",
    description: "Estimate (dept.): equivalente operativo a Cobija — frontera amazónica.",
  },
  // Keep legacy capital names if apps/data still reference them
  {
    city: "Trinidad",
    materialsFactor: "1.3000",
    laborFactor: "1.2500",
    equipmentFactor: "1.3500",
    transportFactor: "1.5000",
    description: "Estimate: capital Beni (alias de Beni en selector público).",
  },
  {
    city: "Cobija",
    materialsFactor: "1.3500",
    laborFactor: "1.3000",
    equipmentFactor: "1.4000",
    transportFactor: "1.6000",
    description: "Estimate: capital Pando (alias de Pando en selector público).",
  },
];

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(apply ? "MODE: --apply" : "MODE: dry-run");

  const existing = await db.select().from(cityPriceFactors);
  const byCity = new Map(existing.map((r) => [r.city.toLowerCase(), r]));

  let inserts = 0;
  let updates = 0;

  for (const seed of SEEDS) {
    const hit = byCity.get(seed.city.toLowerCase());
    if (!hit) {
      console.log(`INSERT ${seed.city} mat=${seed.materialsFactor}`);
      if (apply) {
        await db.insert(cityPriceFactors).values({
          city: seed.city,
          country: "Bolivia",
          materialsFactor: seed.materialsFactor,
          laborFactor: seed.laborFactor,
          equipmentFactor: seed.equipmentFactor,
          transportFactor: seed.transportFactor,
          description: seed.description,
          isActive: true,
        });
      }
      inserts++;
      continue;
    }

    // Do not overwrite active curated factors; only reactivate inactive rows.
    if (!hit.isActive) {
      console.log(`REACTIVATE ${seed.city}`);
      if (apply) {
        await db
          .update(cityPriceFactors)
          .set({
            isActive: true,
            materialsFactor: seed.materialsFactor,
            laborFactor: seed.laborFactor,
            equipmentFactor: seed.equipmentFactor,
            transportFactor: seed.transportFactor,
            description: seed.description,
            updatedAt: new Date(),
          })
          .where(eq(cityPriceFactors.id, hit.id));
      }
      updates++;
    } else {
      console.log(`OK exists ${hit.city} mat=${hit.materialsFactor}`);
    }
  }

  console.log(`\nSummary: insert=${inserts} update=${updates} (existing=${existing.length})`);
  if (!apply) console.log("Dry-run complete. Re-run with --apply to write.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
