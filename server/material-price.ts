import { db } from "./db";
import {
  materials,
  materialCategories,
  userMaterialPrices,
  materialSupplierPrices,
  supplierCompanies,
  companyAdvertisements,
  users,
  cityPriceFactors,
} from "../shared/schema";
import { and, eq, desc, inArray, or, isNull, gte, lte } from "drizzle-orm";
import {
  rebaseCatalogPrice,
  summarizeNetwork,
  daysSince,
  supplierLink,
  sortQuotes,
  DEFAULT_MACRO,
  deriveStreetNoInvoicePrice,
  type QuoteRow,
  type QuoteSource,
  type NetworkQuoteInput,
} from "../shared/pricing";

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

function optionalPositiveNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function computePricePerKg(
  price: number,
  weightKg: number | null | undefined,
): number | null {
  if (weightKg == null || weightKg <= 0 || !Number.isFinite(price)) return null;
  return Math.round((price / weightKg) * 100) / 100;
}

function toIsoDate(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

/** Fallback: WA reason is "WA | supplierName | confidence | collectedAt | ..." */
export function parseSupplierNameFromReason(
  reason?: string | null,
): string | null {
  if (!reason) return null;
  const parts = reason.split("|").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  if (parts[0] !== "WA" && parts[0] !== "MARKET") return null;
  const candidate = parts[1];
  // Skip if second token looks like confidence / ISO date
  if (
    ["visto", "whatsapp", "factura", "estimado"].includes(candidate.toLowerCase())
  ) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(candidate)) return null;
  return candidate || null;
}

function detectPersonSource(
  ump: {
    reason?: string | null;
    supplierName?: string | null;
  },
  username?: string | null,
): QuoteSource {
  const reason = (ump.reason || "").toUpperCase();
  if (username === "micaa_whatsapp" || reason.startsWith("WA")) return "whatsapp";
  if (username === "micaa_market" || reason.startsWith("MARKET")) return "market";
  return "person";
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

async function activeAdSupplierIds(supplierIds: number[]): Promise<Set<number>> {
  const out = new Set<number>();
  if (supplierIds.length === 0) return out;
  const now = new Date();
  const ads = await db
    .select({
      supplierId: companyAdvertisements.supplierId,
      linkUrl: companyAdvertisements.linkUrl,
    })
    .from(companyAdvertisements)
    .where(
      and(
        inArray(companyAdvertisements.supplierId, supplierIds),
        eq(companyAdvertisements.isActive, true),
        or(
          isNull(companyAdvertisements.startDate),
          lte(companyAdvertisements.startDate, now),
        ),
        or(
          isNull(companyAdvertisements.endDate),
          gte(companyAdvertisements.endDate, now),
        ),
      ),
    );
  for (const ad of ads) {
    // Prefer rows with linkUrl, but any active ad unlocks
    out.add(ad.supplierId);
  }
  return out;
}


/** Public display label for source=market (calle / sin factura). */
export const MARKET_DISPLAY_LABEL = "Calle (sin factura)";

/**
 * Same-city filter for provider quotes (base always kept).
 * Market Bot is NEVER suppressed: drop scraped market rows and always append
 * one Calle (sin factura) estimate = deriveStreetNoInvoicePrice(displayBase).
 * Does not write materials.price.
 */
function applyCityAndMarketPolicy(
  quotes: QuoteRow[],
  viewerCity: string | null,
  displayBase: number,
  materialWeightKg: number | null,
  marketCity: string,
): QuoteRow[] {
  const out = quotes.filter((q) => {
    if (q.kind === "base") return true;
    // Prefer derived-from-base market estimate over stale scraped market rows
    if (q.source === "market") return false;
    if (!viewerCity) return true;
    return q.city != null && citiesMatch(q.city, viewerCity);
  });

  const streetPrice = deriveStreetNoInvoicePrice(displayBase);
  out.push({
    kind: "person",
    label: MARKET_DISPLAY_LABEL,
    price: streetPrice,
    ageDays: 0,
    city: marketCity,
    public: true,
    provenanceName: MARKET_DISPLAY_LABEL,
    provenanceDate: null,
    source: "market",
    link: null,
    linkType: null,
    linkUnlocked: false,
    estimated: true,
    weightKg: materialWeightKg,
    pricePerKg: computePricePerKg(streetPrice, materialWeightKg),
  });

  return out;
}

/**
 * GET payload for /api/public/material-price/:id?ciudad=
 * - Solo cotizaciones de proveedores de la misma ciudad (?ciudad=); base siempre.
 * - Market Bot siempre visible como "Calle (sin factura)" = base × STREET_NO_INVOICE_FACTOR
 *   (derivado del base, no de WA); va al final; no se suprime si hay WA/supplier.
 * - Aplica materialsFactor de city_price_factors al Base MICAA cuando ciudad ≠ SCZ.
 * - Procedencia (name · city · date) always; link only if premium or active ad.
 * - NEVER writes materials.price / rebase.
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
  const materialWeightKg = optionalPositiveNum(material.weightKg);

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
      source: "base",
      linkUnlocked: false,
      link: null,
      weightKg: materialWeightKg,
      pricePerKg: computePricePerKg(adjustedBase, materialWeightKg),
    },
  ];

  // Public person / WA / market quotes
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
    const source = detectPersonSource(row.ump, row.user?.username);
    const provenanceName =
      row.ump.supplierName ||
      parseSupplierNameFromReason(row.ump.reason) ||
      null;
    const personLabel =
      provenanceName ||
      [row.user?.firstName, row.user?.lastName].filter(Boolean).join(" ") ||
      row.user?.username ||
      row.ump.customMaterialName ||
      "Profesional";
    // WA/market system user: prefer supplier name as label when present
    const label =
      (source === "whatsapp" || source === "market") && provenanceName
        ? provenanceName
        : personLabel;
    const quoteWeightKg =
      optionalPositiveNum(row.ump.weightKg) ?? materialWeightKg;
    quotes.push({
      kind: "person",
      label,
      price,
      ageDays,
      city: row.ump.city || row.user?.city || null,
      public: true,
      userId: row.ump.userId,
      provenanceName: provenanceName || label,
      supplierPhone: row.ump.supplierPhone || null,
      provenanceDate: toIsoDate(row.ump.updatedAt || row.ump.createdAt),
      source,
      link: null,
      linkType: null,
      linkUnlocked: false,
      weightKg: quoteWeightKg,
      pricePerKg: computePricePerKg(price, quoteWeightKg),
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

  const supplierIds = [
    ...new Set(supplierRows.map((r) => r.supplier.id)),
  ];
  const adActiveIds = await activeAdSupplierIds(supplierIds);

  for (const row of supplierRows) {
    const price = num(row.msp.price);
    const ageDays = daysSince(row.msp.lastUpdated);
    const adActive = adActiveIds.has(row.supplier.id);
    const { link, linkType, linkUnlocked } = supplierLink(row.supplier, {
      membershipType: row.supplier.membershipType,
      membershipExpiresAt: row.supplier.membershipExpiresAt,
      adActive,
    });
    quotes.push({
      kind: "supplier",
      label: row.supplier.companyName,
      price,
      ageDays,
      city: row.supplier.city,
      supplierId: row.supplier.id,
      link,
      linkType,
      linkUnlocked,
      verified: !!row.supplier.isVerified,
      provenanceName: row.supplier.companyName,
      supplierPhone: row.supplier.phone || row.supplier.whatsapp || null,
      provenanceDate: toIsoDate(row.msp.lastUpdated),
      source: "supplier",
      weightKg: materialWeightKg,
      pricePerKg: computePricePerKg(price, materialWeightKg),
    });
  }

  const viewerCity = ciudad || null;
  const marketCity = factorCity || viewerCity || "Santa Cruz";
  const visibleQuotes = applyCityAndMarketPolicy(
    quotes,
    viewerCity,
    adjustedBase,
    materialWeightKg,
    marketCity,
  );

  // Network from real providers only (exclude base + derived market estimate)
  const networkInputs: NetworkQuoteInput[] = visibleQuotes
    .filter((q) => q.kind !== "base" && q.source !== "market")
    .map((q) => ({
      price: q.price,
      ageDays: q.ageDays ?? 999,
      sameCity: !viewerCity || !!(q.city && citiesMatch(q.city, viewerCity)),
      verified: q.kind === "supplier" ? !!q.verified : false,
      active: true,
    }));

  const network = summarizeNetwork(networkInputs);
  // Order: base → providers → Calle (sin factura) last
  const sorted = sortQuotes(visibleQuotes, viewerCity);

  return {
    materialId: material.id,
    name: material.name,
    unit: material.unit,
    weightKg: materialWeightKg,
    pricePerKg: computePricePerKg(adjustedBase, materialWeightKg),
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
