/**
 * MICAA pricing engine (Fase 1 briefing v1.2)
 * Pure functions — no DB. Anchors dated for catalog ~2025-05.
 */

export type PriceOrigin = "importado" | "mixto" | "nacional";

export type QuoteKind = "base" | "person" | "supplier";

export interface MacroRates {
  tcHoy: number;
  ufvHoy: number;
  tcAncla: number;
  ufvAncla: number;
}

/** Anchors for this catalog batch (briefing §5.3). */
export const DEFAULT_MACRO: MacroRates = {
  tcAncla: 6.96,
  ufvAncla: 2.8,
  tcHoy: 11.53,
  ufvHoy: 3.34405,
};

const IMPORT_KEYS = [
  "ACERO",
  "ALUMINIO",
  "GRIFERIA",
  "VIDRIOS",
  "PLANCHAS DE ACERO",
  "PLANCHAS DE ACRILICO",
] as const;

const MIXTO_KEYS = [
  "CEMENTOS",
  "PINTURAS",
  "TUBOS",
  "PVC",
  "POLITUBOS",
  "INSTALACION ELECTRICA",
  "INSTALACION SANITARIA",
  "IMPERMEABILIZANTES",
  "ADITIVOS",
  "ADHESIVOS",
] as const;

const NACIONAL_KEYS = [
  "ARIDOS",
  "LADRILLOS",
  "MADERAS",
  "MADERA ELABORADA",
  "TIERRA TOSCA",
  "ADOQUINES",
] as const;

export function classifyCategory(
  categoryName: string,
  materialName?: string,
): {
  origin: PriceOrigin;
  alpha: number;
} {
  // Prefer category, but if name clearly is wood/aggregate/cement, don't treat as steel/import.
  const n = `${categoryName || ""} ${materialName || ""}`.toUpperCase();
  const nameOnly = (materialName || "").toUpperCase();
  const WOOD_HINT = ["MADERA", "TAJIBO", "PINO", "MARA", "MACHIMBRE", "PARQUET", "CUARTON", "TABLON"];
  const NACIONAL_HINT = ["ARENA", "GRAVA", "RIPIO", "CEMENTO", "LADRILLO", "ADOBITO", "BLOQUE"];
  if (WOOD_HINT.some((k) => nameOnly.includes(k))) {
    return { origin: "mixto", alpha: 0.4 };
  }
  if (NACIONAL_HINT.some((k) => nameOnly.includes(k))) {
    return { origin: "nacional", alpha: 0.15 };
  }
  for (const k of IMPORT_KEYS) {
    if (n.includes(k)) return { origin: "importado", alpha: 0.8 };
  }
  for (const k of MIXTO_KEYS) {
    if (n.includes(k)) return { origin: "mixto", alpha: 0.4 };
  }
  for (const k of NACIONAL_KEYS) {
    if (n.includes(k)) return { origin: "nacional", alpha: 0.15 };
  }
  return { origin: "mixto", alpha: 0.4 };
}

export interface RebaseResult {
  catalogPrice: number;
  basePrice: number;
  origin: PriceOrigin;
  alpha: number;
  factor: number;
  rebaseSkipped: boolean;
}

/**
 * P_base = P_cat × [ α·(TC_hoy/TC_ancla) + (1−α)·(UFV_hoy/UFV_ancla) ]
 * If result outside [0.70, 2.20] × catalog → skip, return catalog.
 */
export function rebaseCatalogPrice(
  catalogPrice: number,
  categoryName: string,
  macro: MacroRates = DEFAULT_MACRO,
  materialName?: string,
): RebaseResult {
  const { origin, alpha } = classifyCategory(categoryName, materialName);
  const tcRatio = macro.tcHoy / macro.tcAncla;
  const ufvRatio = macro.ufvHoy / macro.ufvAncla;
  const factor = alpha * tcRatio + (1 - alpha) * ufvRatio;
  const raw = catalogPrice * factor;
  const lo = catalogPrice * 0.7;
  const hi = catalogPrice * 2.2;
  if (raw < lo || raw > hi || !Number.isFinite(raw) || catalogPrice <= 0) {
    return {
      catalogPrice,
      basePrice: catalogPrice,
      origin,
      alpha,
      factor,
      rebaseSkipped: true,
    };
  }
  return {
    catalogPrice,
    basePrice: round2(raw),
    origin,
    alpha,
    factor,
    rebaseSkipped: false,
  };
}

export const NETWORK = {
  LAMBDA: Math.LOG2E / 15, // ln(2)/15
  CITY_SAME: 1.0,
  CITY_OTHER: 0.35,
  R_VERIFIED: 1.15,
  R_DEFAULT: 1.0,
  FRESH_DAYS: 21,
  STALE_DAYS: 60,
} as const;

export interface NetworkQuoteInput {
  price: number;
  ageDays: number;
  sameCity: boolean;
  verified?: boolean;
  active?: boolean;
}

export interface NetworkSummary {
  pRed: number | null;
  p25: number | null;
  p75: number | null;
  confidence: "alta" | "media" | "baja";
  liveCount: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function weightOf(q: NetworkQuoteInput): number {
  if (q.active === false) return 0;
  if (q.ageDays > NETWORK.STALE_DAYS) return 0;
  if (!(q.price > 0) || !Number.isFinite(q.price)) return 0;
  const R = q.verified ? NETWORK.R_VERIFIED : NETWORK.R_DEFAULT;
  const C = q.sameCity ? NETWORK.CITY_SAME : NETWORK.CITY_OTHER;
  return R * Math.exp(-NETWORK.LAMBDA * q.ageDays) * C;
}

/** Weighted median of values with weights. */
export function weightedMedian(values: number[], weights: number[]): number | null {
  const pairs = values
    .map((v, i) => ({ v, w: weights[i] }))
    .filter((p) => p.w > 0 && Number.isFinite(p.v))
    .sort((a, b) => a.v - b.v);
  if (pairs.length === 0) return null;
  const total = pairs.reduce((s, p) => s + p.w, 0);
  let acc = 0;
  for (const p of pairs) {
    acc += p.w;
    if (acc >= total / 2) return p.v;
  }
  return pairs[pairs.length - 1].v;
}

function weightedAverage(values: number[], weights: number[]): number | null {
  let sw = 0;
  let sp = 0;
  for (let i = 0; i < values.length; i++) {
    if (weights[i] <= 0) continue;
    sw += weights[i];
    sp += values[i] * weights[i];
  }
  if (sw <= 0) return null;
  return sp / sw;
}

function weightedPercentile(
  values: number[],
  weights: number[],
  p: number,
): number | null {
  const pairs = values
    .map((v, i) => ({ v, w: weights[i] }))
    .filter((x) => x.w > 0 && Number.isFinite(x.v))
    .sort((a, b) => a.v - b.v);
  if (pairs.length === 0) return null;
  const total = pairs.reduce((s, x) => s + x.w, 0);
  let acc = 0;
  for (const x of pairs) {
    acc += x.w;
    if (acc / total >= p) return x.v;
  }
  return pairs[pairs.length - 1].v;
}

/**
 * Network price from person+supplier quotes only (base excluded).
 */
export function summarizeNetwork(quotes: NetworkQuoteInput[]): NetworkSummary {
  const weights = quotes.map(weightOf);
  const liveIdx = weights
    .map((w, i) => (w > 0 ? i : -1))
    .filter((i) => i >= 0);
  const liveCount = liveIdx.length;
  if (liveCount === 0) {
    return {
      pRed: null,
      p25: null,
      p75: null,
      confidence: "baja",
      liveCount: 0,
    };
  }
  const values = quotes.map((q) => q.price);
  const pRedRaw =
    liveCount >= 3
      ? weightedMedian(values, weights)
      : weightedAverage(values, weights);
  const p25 = weightedPercentile(values, weights, 0.25);
  const p75 = weightedPercentile(values, weights, 0.75);
  const pRed = pRedRaw == null ? null : round2(pRedRaw);
  const minAge = Math.min(...liveIdx.map((i) => quotes[i].ageDays));
  let confidence: NetworkSummary["confidence"] = "baja";
  if (pRed != null && pRed > 0) {
    const V =
      p25 != null && p75 != null ? (p75 - p25) / pRed : Number.POSITIVE_INFINITY;
    if (liveCount >= 3 && minAge <= NETWORK.FRESH_DAYS && V < 0.2) {
      confidence = "alta";
    } else if (liveCount >= 1 && minAge <= NETWORK.STALE_DAYS) {
      confidence = "media";
    }
  }
  return {
    pRed,
    p25: p25 == null ? null : round2(p25),
    p75: p75 == null ? null : round2(p75),
    confidence,
    liveCount,
  };
}

export function daysSince(date: Date | string | null | undefined, now = new Date()): number {
  if (!date) return NETWORK.STALE_DAYS + 1;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return NETWORK.STALE_DAYS + 1;
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));
}

/** Premium membership or active paid ad unlocks clickable supplier links. */
export function isSupplierLinkUnlocked(opts: {
  membershipType?: string | null;
  membershipExpiresAt?: Date | string | null;
  adActive?: boolean;
  now?: Date;
}): boolean {
  if (opts.adActive) return true;
  if (opts.membershipType !== "premium") return false;
  if (opts.membershipExpiresAt == null) return true;
  const now = opts.now ?? new Date();
  const exp =
    typeof opts.membershipExpiresAt === "string"
      ? new Date(opts.membershipExpiresAt)
      : opts.membershipExpiresAt;
  if (Number.isNaN(exp.getTime())) return false;
  return exp.getTime() > now.getTime();
}

/**
 * Resolve a contact link for a supplier.
 * Free suppliers (no premium / no active ad) → link=null (name-only procedencia).
 */
export function supplierLink(
  supplier: {
    website?: string | null;
    whatsapp?: string | null;
    facebook?: string | null;
    phone?: string | null;
  },
  gate?: {
    unlocked?: boolean;
    membershipType?: string | null;
    membershipExpiresAt?: Date | string | null;
    adActive?: boolean;
    now?: Date;
  },
): { link: string | null; linkType: string | null; linkUnlocked: boolean } {
  const linkUnlocked =
    gate?.unlocked ??
    isSupplierLinkUnlocked({
      membershipType: gate?.membershipType,
      membershipExpiresAt: gate?.membershipExpiresAt,
      adActive: gate?.adActive,
      now: gate?.now,
    });
  if (!linkUnlocked) {
    return { link: null, linkType: null, linkUnlocked: false };
  }
  if (supplier.website) {
    return { link: supplier.website, linkType: "website", linkUnlocked: true };
  }
  if (supplier.whatsapp) {
    const n = String(supplier.whatsapp).replace(/[^0-9]/g, "");
    return {
      link: n ? `https://wa.me/${n}` : null,
      linkType: "whatsapp",
      linkUnlocked: true,
    };
  }
  if (supplier.facebook) {
    const fb = supplier.facebook.startsWith("http")
      ? supplier.facebook
      : `https://facebook.com/${supplier.facebook}`;
    return { link: fb, linkType: "facebook", linkUnlocked: true };
  }
  if (supplier.phone) {
    return { link: `tel:${supplier.phone}`, linkType: "phone", linkUnlocked: true };
  }
  return { link: null, linkType: null, linkUnlocked: true };
}

export type QuoteSource = "whatsapp" | "market" | "person" | "supplier" | "base";

export interface QuoteRow {
  kind: QuoteKind;
  label: string;
  price: number;
  ageDays?: number;
  city?: string | null;
  public?: boolean;
  userId?: number;
  supplierId?: number;
  link?: string | null;
  linkType?: string | null;
  /** True when premium membership or active ad unlocks the link. */
  linkUnlocked?: boolean;
  verified?: boolean;
  /** Supplier/company name for procedencia line (may differ from label). */
  provenanceName?: string | null;
  supplierPhone?: string | null;
  /** ISO date (YYYY-MM-DD) for procedencia display. */
  provenanceDate?: string | null;
  source?: QuoteSource;
  /** Kg por unidad de venta (cotización o material). */
  weightKg?: number | null;
  /** Precio por kg cuando weightKg > 0. */
  pricePerKg?: number | null;
}

const CITY_SORT_ALIASES: Record<string, string[]> = {
  beni: ["beni", "trinidad"],
  pando: ["pando", "cobija"],
  "potosí": ["potosí", "potosi"],
  potosi: ["potosí", "potosi"],
  "santa cruz": ["santa cruz", "santa cruz de la sierra"],
};

function citySortKeys(city: string): Set<string> {
  const k = city.trim().toLowerCase();
  const out = new Set<string>([k]);
  for (const list of Object.values(CITY_SORT_ALIASES)) {
    if (list.includes(k)) list.forEach((x) => out.add(x));
  }
  if (CITY_SORT_ALIASES[k]) CITY_SORT_ALIASES[k].forEach((x) => out.add(x));
  return out;
}

function sameCitySort(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const A = citySortKeys(a);
  for (const x of citySortKeys(b)) if (A.has(x)) return true;
  return false;
}

/** Sort: suppliers (verified, same city, fresh) → persons → base last */
export function sortQuotes(
  quotes: QuoteRow[],
  viewerCity?: string | null,
): QuoteRow[] {
  const rank = (q: QuoteRow): number => {
    if (q.kind === "base") return 3000;
    if (q.kind === "person") {
      let r = 2000 + (q.ageDays ?? 0);
      if (viewerCity && q.city && !sameCitySort(q.city, viewerCity)) r += 50;
      return r;
    }
    // supplier
    let r = 0;
    if (!q.verified) r += 100;
    if (viewerCity && q.city && !sameCitySort(q.city, viewerCity)) r += 50;
    r += q.ageDays ?? 0;
    return r;
  };
  return [...quotes].sort((a, b) => rank(a) - rank(b));
}
