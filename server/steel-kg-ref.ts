/**
 * Live steel Bs/kg reference cache for MICAA.
 * Loads recent (≤60d) non-market quotes with usable weight, builds family+city
 * robust medians. Read-only — never writes materials.price.
 */
import { db } from "./db";
import {
  materials,
  materialCategories,
  userMaterialPrices,
  materialSupplierPrices,
  supplierCompanies,
  users,
} from "../shared/schema";
import { and, eq, gt, inArray, or, sql } from "drizzle-orm";
import {
  STEEL_KG_FRESH_DAYS,
  buildSteelKgRefMap,
  classifySteelFamily,
  canonSteelCity,
  lookupSteelKgRef,
  steelFamilyUsesLiveKg,
  type SteelFamily,
  type SteelKgRef,
  type SteelKgSample,
} from "../shared/steel-kg";

const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheState = {
  loadedAt: number;
  map: Map<string, { median: number; n: number; rawN: number }>;
};

let cache: CacheState | null = null;
let inflight: Promise<CacheState> | null = null;

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Prefilter only — classifySteelFamily still decides family.
// Must cover abbreviated catalog names like "CAÑERIA GALV." / "GALVAN."
// (%galvaniz% alone misses those; Metales quotes #281/#282 were dropped).
const NAME_ILIKE = [
  "%angular%",
  "%platina%",
  "%tubo%",
  "%tubular%",
  "%tubin%",
  "%costanera%",
  "%corrugad%",
  "%plancha%",
  "%perfil%",
  "%alambre%",
  "%fierro%",
  "%hierro%",
  "%montante%",
  "%riel%",
  "%electrodo%",
  "%solera%",
  "%redondo%",
  "%varilla%",
  "%galvaniz%",
  "%galv%",
  "%cañeria%",
  "%caneria%",
  "%caño%",
  "%cano%",
] as const;

const CAT_ILIKE = [
  "%ACERO%",
  "%PLANCHA%",
  "%TUBO%",
  "%METAL%",
  "%ALAMBRE%",
  "%HIERRO%",
  "%CAÑO%",
  "%CANO%",
  "%TUBER%",
] as const;

async function loadSteelKgSamples(): Promise<SteelKgSample[]> {
  const cutoff = new Date(Date.now() - STEEL_KG_FRESH_DAYS * 24 * 60 * 60 * 1000);

  const nameConds = NAME_ILIKE.map(
    (p) => sql`lower(${materials.name}) LIKE ${p}`,
  );
  const catConds = CAT_ILIKE.map(
    (p) => sql`coalesce(${materialCategories.name}, '') ILIKE ${p}`,
  );

  const mats = await db
    .select({
      id: materials.id,
      name: materials.name,
      weightKg: materials.weightKg,
      categoryName: materialCategories.name,
    })
    .from(materials)
    .leftJoin(materialCategories, eq(materials.categoryId, materialCategories.id))
    .where(or(...nameConds, ...catConds));

  const byId = new Map<
    number,
    { family: Exclude<SteelFamily, null>; weightKg: number | null }
  >();
  for (const m of mats) {
    const fam = classifySteelFamily(m.name, m.categoryName);
    if (!fam || !steelFamilyUsesLiveKg(fam)) continue;
    byId.set(m.id, { family: fam, weightKg: num(m.weightKg) });
  }
  if (byId.size === 0) return [];

  const matIds = Array.from(byId.keys());
  const samples: SteelKgSample[] = [];
  const CHUNK = 400;

  for (let i = 0; i < matIds.length; i += CHUNK) {
    const chunk = matIds.slice(i, i + CHUNK);

    const umpRows = await db
      .select({
        materialId: userMaterialPrices.materialId,
        price: userMaterialPrices.price,
        city: userMaterialPrices.city,
        quoteWeight: userMaterialPrices.weightKg,
        reason: userMaterialPrices.reason,
        username: users.username,
      })
      .from(userMaterialPrices)
      .leftJoin(users, eq(userMaterialPrices.userId, users.id))
      .where(
        and(
          inArray(userMaterialPrices.materialId, chunk),
          gt(userMaterialPrices.price, "0"),
          sql`coalesce(${userMaterialPrices.updatedAt}, ${userMaterialPrices.createdAt}) >= ${cutoff}`,
        ),
      );

    for (const r of umpRows) {
      if (r.username === "micaa_market") continue;
      if ((r.reason || "").toUpperCase().startsWith("MARKET")) continue;
      if (r.materialId == null) continue;
      const meta = byId.get(r.materialId);
      if (!meta) continue;
      const price = num(r.price);
      if (!price) continue;
      const w = num(r.quoteWeight) ?? meta.weightKg;
      if (!w) continue;
      const bskg = price / w;
      if (!(bskg > 0) || !Number.isFinite(bskg)) continue;
      samples.push({
        family: meta.family,
        city: canonSteelCity(r.city),
        bskg,
      });
    }

    const mspRows = await db
      .select({
        materialId: materialSupplierPrices.materialId,
        price: materialSupplierPrices.price,
        city: supplierCompanies.city,
      })
      .from(materialSupplierPrices)
      .innerJoin(
        supplierCompanies,
        eq(materialSupplierPrices.supplierId, supplierCompanies.id),
      )
      .where(
        and(
          inArray(materialSupplierPrices.materialId, chunk),
          eq(materialSupplierPrices.isActive, true),
          eq(supplierCompanies.isActive, true),
          gt(materialSupplierPrices.price, "0"),
          sql`coalesce(${materialSupplierPrices.lastUpdated}, ${materialSupplierPrices.createdAt}) >= ${cutoff}`,
        ),
      );

    for (const r of mspRows) {
      if (r.materialId == null) continue;
      const meta = byId.get(r.materialId);
      if (!meta?.weightKg) continue;
      const price = num(r.price);
      if (!price) continue;
      const bskg = price / meta.weightKg;
      if (!(bskg > 0) || !Number.isFinite(bskg)) continue;
      samples.push({
        family: meta.family,
        city: canonSteelCity(r.city),
        bskg,
      });
    }
  }

  return samples;
}

async function refreshCache(): Promise<CacheState> {
  const samples = await loadSteelKgSamples();
  const map = buildSteelKgRefMap(samples);
  const state: CacheState = { loadedAt: Date.now(), map };
  cache = state;
  return state;
}

async function getCache(): Promise<CacheState> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache;
  if (inflight) return inflight;
  inflight = refreshCache().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** Lookup live steel Bs/kg ref for a material family + viewer city. */
export async function getSteelKgRefForMaterial(
  materialName: string,
  categoryName: string | null | undefined,
  viewerCity: string | null | undefined,
): Promise<SteelKgRef | null> {
  const family = classifySteelFamily(materialName, categoryName);
  if (!family || !steelFamilyUsesLiveKg(family)) return null;
  const city = canonSteelCity(viewerCity || "Santa Cruz");
  const { map } = await getCache();
  return lookupSteelKgRef(map, family, city);
}

/** Test/ops helper — force cache rebuild. */
export async function refreshSteelKgCache(): Promise<{
  buckets: number;
  sampleHint: number;
}> {
  const state = await refreshCache();
  let sampleHint = 0;
  for (const v of Array.from(state.map.values())) sampleHint += v.rawN;
  return { buckets: state.map.size, sampleHint };
}
