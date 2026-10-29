/**
 * Live steel Bs/kg estimates (MICAA).
 * Pure helpers — no DB. Family classify + median Bs/kg from quote samples.
 * Base = weight_kg × median Bs/kg; Market = base × STREET_NO_INVOICE_FACTOR (0.90).
 * Never writes materials.price.
 */

export type SteelFamily =
  | "corrugado"
  | "negro_perfil"
  | "galvanizado"
  | "alambre"
  | "electrodo"
  | "inox"
  | null;

export const STEEL_KG_FRESH_DAYS = 60;
/** Drop samples outside [lo, hi] × first-pass median when ≥3 remain. */
export const STEEL_KG_OUTLIER_LO = 0.55;
export const STEEL_KG_OUTLIER_HI = 1.8;

export function normSteelName(s: string): string {
  return s
    .replace(/\\'/g, "'")
    .replace(/''/g, '"')
    .replace(/\\"/g, '"')
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Classify a material into a steel family for Bs/kg pooling. null = not steel-by-kg. */
export function classifySteelFamily(
  nameRaw: string,
  categoryName?: string | null,
): SteelFamily {
  const N = normSteelName(nameRaw);
  const C = (categoryName || "").toUpperCase();
  if (/\[DUPLICADO/.test(N)) return null;
  if (
    /PVC|PEGA ?TUBO|CPVC|PPR|POLITUB|MANGUERA|LADRILLO|ADOQUIN|CEMENTO|ARENA|GRAVA|PINTURA|YESO|CERAMIC|PORCELAN|MADERA|TAJIBO|VIDRIO|SILICON|ADHESIV|THINNER|DISCO\b|TORNILL|PERNO|CLAVO|BROCA|ESMERIL/.test(
      N,
    )
  ) {
    return null;
  }
  if (/INOX|AISI\s*304|AISI\s*316/.test(N)) return "inox";
  if (/ELECTRODO/.test(N)) return "electrodo";
  if (/ALAMBRE/.test(N)) return "alambre";
  if (/CORRUGAD/.test(N)) return "corrugado";
  if (/GALVANIZ|FOGO|CA[NÑ]ERIA\s+GALV|TUBERIA\s+GALV|PLANCHA\s+GALV/.test(N)) {
    return "galvanizado";
  }
  if (
    /ANGULAR|PLATINA|SOLERA|COSTANERA|PERFIL\s*C|PERFIL\s*U|PERFIL\s*TEE|PERFIL\s*T\b|PLANCHA\s+NEGRA|PLANCHA\s+LAF|PLANCHA\s+LAC|MONTANTE|RIEL\b|BARRA\s+LISA|^LISO\b|FIERRO\s+LISO|REDONDO\s+(?:DE\s+)?\d|VARILLA/.test(
      N,
    )
  ) {
    return "negro_perfil";
  }
  if (/\b(TUBO|TUBULAR|TUBIN)\b/.test(N) && !/PVC|PPR|PEAD|POLIET/.test(N)) {
    return "negro_perfil";
  }
  if (/PLANCHA/.test(N) && /ACERO|NEGRA|LAF|LAC|METAL/.test(`${N} ${C}`)) {
    return "negro_perfil";
  }
  return null;
}

/** Families that use live Bs/kg (inox left out — different alloy price). */
export function steelFamilyUsesLiveKg(family: SteelFamily): boolean {
  return (
    family === "corrugado" ||
    family === "negro_perfil" ||
    family === "galvanizado" ||
    family === "alambre" ||
    family === "electrodo"
  );
}

export function canonSteelCity(c: string | null | undefined): string {
  if (!c) return "(sin ciudad)";
  const k = c
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (k.includes("santa cruz") || k === "scz") return "Santa Cruz";
  if (k === "la paz" || k === "lp" || k === "el alto") return "La Paz";
  if (k.includes("cochabamba") || k === "cbba" || k === "cbba.") return "Cochabamba";
  if (k.includes("beni") || k.includes("trinidad")) return "Beni";
  if (k.includes("pando") || k.includes("cobija")) return "Pando";
  if (k.includes("tarija")) return "Tarija";
  if (k.includes("sucre") || k.includes("chuquisaca")) return "Chuquisaca";
  if (k.includes("oruro")) return "Oruro";
  if (k.includes("potosi")) return "Potosí";
  return c.trim();
}

export function medianPositive(vals: number[]): number | null {
  const a = vals.filter((x) => Number.isFinite(x) && x > 0).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2;
}

/** Two-pass median: drop outliers vs first pass when enough samples remain. */
export function robustMedianBskg(samples: number[]): {
  median: number | null;
  n: number;
  rawN: number;
} {
  const raw = samples.filter((x) => Number.isFinite(x) && x > 0);
  const rawN = raw.length;
  const first = medianPositive(raw);
  if (first == null) return { median: null, n: 0, rawN };
  const kept = raw.filter(
    (x) =>
      x >= first * STEEL_KG_OUTLIER_LO && x <= first * STEEL_KG_OUTLIER_HI,
  );
  if (kept.length >= 3) {
    return { median: medianPositive(kept), n: kept.length, rawN };
  }
  return { median: first, n: rawN, rawN };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface SteelKgRef {
  family: Exclude<SteelFamily, null>;
  medianBskg: number;
  /** Sample size behind the median (after outlier filter). */
  n: number;
  rawN: number;
  cityUsed: string;
  note: "misma_ciudad" | "fallback_SCZ" | "fallback_otra_ciudad";
}

export interface SteelKgSample {
  family: Exclude<SteelFamily, null>;
  city: string;
  bskg: number;
}

/** Build family+city → robust median map from flat samples. */
export function buildSteelKgRefMap(
  samples: SteelKgSample[],
): Map<string, { median: number; n: number; rawN: number }> {
  const buckets = new Map<string, number[]>();
  for (const s of samples) {
    if (!(s.bskg > 0)) continue;
    const key = `${s.family}||${s.city}`;
    const arr = buckets.get(key) || [];
    arr.push(s.bskg);
    buckets.set(key, arr);
  }
  const out = new Map<string, { median: number; n: number; rawN: number }>();
  for (const [key, arr] of Array.from(buckets.entries())) {
    const r = robustMedianBskg(arr);
    if (r.median != null) out.set(key, { median: r.median, n: r.n, rawN: r.rawN });
  }
  return out;
}

export function lookupSteelKgRef(
  map: Map<string, { median: number; n: number; rawN: number }>,
  family: Exclude<SteelFamily, null>,
  city: string,
): SteelKgRef | null {
  const direct = map.get(`${family}||${city}`);
  if (direct) {
    return {
      family,
      medianBskg: round2(direct.median),
      n: direct.n,
      rawN: direct.rawN,
      cityUsed: city,
      note: "misma_ciudad",
    };
  }
  const scz = map.get(`${family}||Santa Cruz`);
  if (scz) {
    return {
      family,
      medianBskg: round2(scz.median),
      n: scz.n,
      rawN: scz.rawN,
      cityUsed: "Santa Cruz",
      note: "fallback_SCZ",
    };
  }
  let best: { city: string; median: number; n: number; rawN: number } | null = null;
  for (const [key, v] of Array.from(map.entries())) {
    if (!key.startsWith(`${family}||`)) continue;
    if (!best || v.n > best.n) {
      best = { city: key.slice(family.length + 2), ...v };
    }
  }
  if (!best) return null;
  return {
    family,
    medianBskg: round2(best.median),
    n: best.n,
    rawN: best.rawN,
    cityUsed: best.city,
    note: "fallback_otra_ciudad",
  };
}

/** Estimate base = weight × median Bs/kg. */
export function steelBaseFromKg(weightKg: number, medianBskg: number): number {
  return round2(weightKg * medianBskg);
}
