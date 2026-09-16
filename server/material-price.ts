import { db } from "./db";
import {
  materials,
  materialCategories,
  userMaterialPrices,
  materialSupplierPrices,
  supplierCompanies,
  users,
  cityPriceFactors,
} from "../shared/schema";
import { and, eq, desc } from "drizzle-orm";
import {
  rebaseCatalogPrice,
  summarizeNetwork,
  daysSince,
  supplierLink,
  sortQuotes,
  DEFAULT_MACRO,
  type QuoteRow,
  type NetworkQuoteInput,
} from "../shared/pricing";

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

/** Alias de ciudades del selector público ↔ filas históricas en city_price_factors. */
const CITY_ALIASES: Record<string, string[]> = {
  beni: ["beni", "trinidad"],
  pando: ["pando", "cobija"],
  "potosí": ["potosí", "potosi"],
  "santa cruz": ["santa cruz", "santa cruz de la sierra"],
};

function normalizeCityKey(s: string): string {
  return s.trim().toLowerCase();
}

function cityKeys(ciudad: string): string[] {
  const key = normalizeCityKey(ciudad);
  for (const [canon, list] of Object.entries(CITY_ALIASES)) {
    if (canon === key || list.includes(key)) {
      return [...new Set([canon, ...list, key])];
    }
  }
  return [key];
}

function citiesMatch(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const A = new Set(cityKeys(a));
  return cityKeys(b).some((k) => A.has(k));
}

async function lookupMaterialsFactor(ciudad: string | null | undefined): Promise<{
  cityFactor: number;
  factorCity: string | null;
  materialsFactor: number;
}> {
  if (!ciudad) {
    return { cityFactor: 1, factorCity: null, materialsFactor: 1 };
  }
  const rows = await db
    .select()
    .from(cityPriceFactors)
    .where(eq(cityPriceFactors.isActive, true));
  const keys = new Set(cityKeys(ciudad));
  const hit = rows.find((r) => keys.has(normalizeCityKey(r.city)));
  if (!hit) {
    return { cityFactor: 1, factorCity: null, materialsFactor: 1 };
  }
  const materialsFactor = num(hit.materialsFactor, 1);
  const safe = materialsFactor > 0 ? materialsFactor : 1;
  return {
    cityFactor: safe,
    factorCity: hit.city,
    materialsFactor: safe,
  };
}

/**
 * GET payload for /api/public/material-price/:id?ciudad=
 * - Prioriza cotizaciones de la misma ciudad (sortQuotes / network sameCity).
 * - Aplica materialsFactor de city_price_factors al Base MICAA cuando ciudad ≠ SCZ.
 */
export async function getPublicMaterialPrice(
  materialId: number,
  ciudad?: string | null,
) {
  const rows = await db
    .select({
      material: materials,
      category: materialCategories,
    })
    .from(materials)
    .leftJoin(
      materialCategories,
      eq(materials.categoryId, materialCategories.id),
    )
    .where(eq(materials.id, materialId))
    .limit(1);

  if (rows.length === 0) return null;

  const { material, category } = rows[0];
  const categoryName = category?.name || "Sin categoría";
  const catalogPrice = num(material.price);
  const catalogAgeDays = daysSince(material.lastUpdated);

  // Prefer stored rebase; else compute on the fly (does not write)
  let basePrice = material.rebasedPrice != null ? num(material.rebasedPrice) : null;
  let origin = (material.priceOrigin as any) || null;
  let alpha = 0.4;
  let rebaseSkipped = false;

  if (basePrice == null || !origin) {
    const r = rebaseCatalogPrice(catalogPrice, categoryName, DEFAULT_MACRO, material.name);
    basePrice = r.basePrice;
    origin = r.origin;
    alpha = r.alpha;
    rebaseSkipped = r.rebaseSkipped;
  } else {
    const r = rebaseCatalogPrice(catalogPrice, categoryName, DEFAULT_MACRO, material.name);
    alpha = r.alpha;
    // if stored equals catalog and compute would skip, reflect that
    rebaseSkipped = Math.abs(basePrice - catalogPrice) < 0.005 && r.rebaseSkipped;
  }

  const { cityFactor, factorCity, materialsFactor } = await lookupMaterialsFactor(
    ciudad,
  );
  // Base MICAA is SCZ-anchored; scale by materialsFactor when a city factor exists.
  const adjustedBase =
    materialsFactor !== 1
      ? Math.round(basePrice * materialsFactor * 100) / 100
      : basePrice;

  const quotes: QuoteRow[] = [
    {
      kind: "base",
      label: "Base MICAA",
      price: adjustedBase,
      city: factorCity || ciudad || "Santa Cruz",
    },
  ];

  // Public person quotes
  const personRows = await db
    .select({
      ump: userMaterialPrices,
      user: users,
    })
    .from(userMaterialPrices)
    .leftJoin(users, eq(userMaterialPrices.userId, users.id))
    .where(
      and(
        eq(userMaterialPrices.materialId, materialId),
        eq(userMaterialPrices.isPublic, true),
      ),
    )
    .orderBy(desc(userMaterialPrices.updatedAt));

  for (const row of personRows) {
    const price = num(row.ump.price);
    const ageDays = daysSince(row.ump.updatedAt || row.ump.createdAt);
    const label =
      [row.user?.firstName, row.user?.lastName].filter(Boolean).join(" ") ||
      row.user?.username ||
      row.ump.customMaterialName ||
      "Profesional";
    quotes.push({
      kind: "person",
      label,
      price,
      ageDays,
      city: row.ump.city || row.user?.city || null,
      public: true,
      userId: row.ump.userId,
    });
  }

  // Supplier quotes
  const supplierRows = await db
    .select({
      msp: materialSupplierPrices,
      supplier: supplierCompanies,
    })
    .from(materialSupplierPrices)
    .innerJoin(
      supplierCompanies,
      eq(materialSupplierPrices.supplierId, supplierCompanies.id),
    )
    .where(
      and(
        eq(materialSupplierPrices.materialId, materialId),
        eq(materialSupplierPrices.isActive, true),
        eq(supplierCompanies.isActive, true),
      ),
    )
    .orderBy(desc(materialSupplierPrices.lastUpdated));

  for (const row of supplierRows) {
    const price = num(row.msp.price);
    const ageDays = daysSince(row.msp.lastUpdated);
    const { link, linkType } = supplierLink(row.supplier);
    quotes.push({
      kind: "supplier",
      label: row.supplier.companyName,
      price,
      ageDays,
      city: row.supplier.city,
      supplierId: row.supplier.id,
      link,
      linkType,
      verified: !!row.supplier.isVerified,
    });
  }

  const viewerCity = ciudad || null;
  const networkInputs: NetworkQuoteInput[] = quotes
    .filter((q) => q.kind !== "base")
    .map((q) => ({
      price: q.price,
      ageDays: q.ageDays ?? 999,
      sameCity: !!(viewerCity && q.city && citiesMatch(q.city, viewerCity)),
      verified: q.kind === "supplier" ? !!q.verified : false,
      active: true,
    }));

  const network = summarizeNetwork(networkInputs);
  // Prefer same-city person/supplier quotes in the UI order
  const sorted = sortQuotes(quotes, viewerCity);

  return {
    materialId: material.id,
    name: material.name,
    unit: material.unit,
    category: categoryName,
    origin,
    alpha,
    catalogPrice,
    catalogAgeDays,
    basePrice: adjustedBase,
    basePriceScz: basePrice,
    baseLabel: "estimada",
    rebaseSkipped,
    city: viewerCity,
    cityFactor,
    factorCity,
    materialsFactor,
    pRed: network.pRed,
    p25: network.p25,
    p75: network.p75,
    confidence: network.confidence,
    quotes: sorted,
  };
}
