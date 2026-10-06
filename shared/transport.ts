/**
 * Transporte y movilización por distancia — constantes y matemática pura (server + client).
 *
 * Política MICAA: los precios base son "puestos en obra" con el transporte básico incluido
 * (km cero urbano). Solo se cobra un extra cuando la obra está más allá del radio km cero de
 * la ciudad (SCZ: 4º anillo ≈ 5 km por calle desde la Plaza 24 de Septiembre).
 *
 *   extra_km   = max(0, distancia_por_calle − radio_km_cero)      (< TRANSPORT.minExtraKm → 0)
 *   Materiales = materiales_directos × min(tope, 0.25 % × extra_km × transport_factor_ciudad)
 *   Mano obra  = jornales × pasaje_urbano × ceil(extra_km / 5)    (jornales = horas MO / 8)
 *   Línea      = (Materiales + Mano obra) × (1+GG)(1+Utilidad)(1+IT)   — sin cargas sociales
 *
 * Todo lo ajustable está en TRANSPORT / CITY_KM_ZERO (valores estimados, ver docs).
 */

export const TRANSPORT = {
  /** % sobre materiales directos por cada km extra. */
  materialsPctPerKm: 0.25,
  /** Tope del recargo de materiales (%). */
  materialsCapPct: 12.5,
  /** Un pasaje urbano extra por obrero·día cada N km extra (ceil). */
  kmPerFare: 5,
  /** Horas por jornal. */
  hoursPerWorkerDay: 8,
  /** Extra menor a esto (km) se considera ruido de geocodificación → 0. */
  minExtraKm: 1,
  /** Tope de km extra considerados (más allá: cotizar flete específico). */
  maxExtraKm: 80,
  /** Fallback cuando OSRM no responde: distancia en línea recta × este factor. */
  straightLineRoadFactor: 1.3,
  /** Geocodificación más lejos que esto del km cero de la ciudad = probablemente mal resuelta. */
  maxGeocodeDistanceKm: 150,
  /** Pasaje urbano por defecto si la ciudad no tiene uno propio (Bs). */
  defaultFareBs: 3.5,
} as const;

export const BASE_PRICE_NOTE =
  "Precios base puestos en obra: transporte básico incluido (km cero urbano).";

export const TRANSPORT_LINE_LABEL = "Transporte y movilización";

export type TransportMethod = "osrm" | "straight_x1.3" | "preset" | "manual" | "none";

export const TRANSPORT_METHOD_LABELS: Record<TransportMethod, string> = {
  osrm: "por calle, OSRM",
  "straight_x1.3": "línea recta × 1,3, estimada",
  preset: "zona elegida",
  manual: "km ingresados a mano",
  none: "sin ubicación (sin recargo)",
};

export interface TransportZonePreset {
  key: string;
  label: string;
  /** km extra (más allá del radio km cero). */
  extraKm: number;
}

export interface CityKmZero {
  city: string;
  /** Punto km cero (plaza principal). */
  center: { name: string; lat: number; lng: number };
  /** Radio km cero por calle, en km. */
  radiusKm: number;
  /** Texto de la zona sin recargo. */
  zeroLabel: string;
  /** Pasaje urbano (Bs). */
  fareBs: number;
  fareNote: string;
  zones: TransportZonePreset[];
}

const OTHER_ZONES = (zero: string): TransportZonePreset[] => [{ key: "km0", label: zero, extraKm: 0 }];

/** Valores estimados — validar con proveedores (ver micaa-scripts/transporte-propuesta-2026-10-06.md). */
export const CITY_KM_ZERO: Record<string, CityKmZero> = {
  "Santa Cruz": {
    city: "Santa Cruz",
    center: { name: "Plaza 24 de Septiembre", lat: -17.78328, lng: -63.18212 },
    radiusKm: 5,
    zeroLabel: "Dentro del 4º anillo",
    fareBs: 3.5,
    fareNote: "Pasaje de micro Bs 3,50 (Ley Municipal 1913, 05/10/2026)",
    zones: [
      { key: "km0", label: "Dentro del 4º anillo (sin recargo)", extraKm: 0 },
      { key: "a4-6", label: "Entre 4º y 6º anillo", extraKm: 2 },
      { key: "a6-8", label: "Entre 6º y 8º anillo", extraKm: 4.5 },
      { key: "a8+", label: "Más allá del 8º anillo / periurbano", extraKm: 8 },
      { key: "urubo", label: "Urubó / Colinas (Porongo)", extraKm: 10 },
      { key: "cotoca", label: "Cotoca", extraKm: 15 },
      { key: "laguardia", label: "La Guardia", extraKm: 15 },
      { key: "porongo", label: "Porongo (pueblo)", extraKm: 20 },
      { key: "warnes", label: "Warnes", extraKm: 25 },
      { key: "eltorno", label: "El Torno", extraKm: 30 },
      { key: "montero", label: "Montero", extraKm: 50 },
    ],
  },
  "La Paz": {
    city: "La Paz",
    center: { name: "Plaza Murillo", lat: -16.49571, lng: -68.13356 },
    radiusKm: 10,
    zeroLabel: "Centro, Sopocachi, Miraflores, Obrajes, Calacoto",
    fareBs: 3,
    fareNote: "Pasaje urbano estimado Bs 3,00 (por confirmar)",
    zones: [
      { key: "km0", label: "Centro / Sopocachi / Miraflores / Obrajes / Calacoto (sin recargo)", extraKm: 0 },
      { key: "zsur-alta", label: "Zona Sur alta (Achumani, Chasquipampa, Ovejuyo, Mallasa)", extraKm: 5 },
      { key: "elalto", label: "El Alto", extraKm: 10 },
      { key: "periurb", label: "Achocalla / Mecapaca / Viacha", extraKm: 25 },
    ],
  },
  Cochabamba: {
    city: "Cochabamba",
    center: { name: "Plaza 14 de Septiembre", lat: -17.39382, lng: -66.15693 },
    radiusKm: 6,
    zeroLabel: "Cercado, dentro de la Av. Circunvalación",
    fareBs: 3,
    fareNote: "Pasaje urbano estimado Bs 3,00 (por confirmar)",
    zones: [
      { key: "km0", label: "Cercado, dentro de la Circunvalación (sin recargo)", extraKm: 0 },
      { key: "colcapirhua", label: "Colcapirhua", extraKm: 6 },
      { key: "tiquipaya", label: "Tiquipaya", extraKm: 8 },
      { key: "sacaba-quilla", label: "Sacaba / Quillacollo", extraKm: 12 },
      { key: "vinto", label: "Vinto", extraKm: 18 },
      { key: "sipesipe", label: "Sipe Sipe", extraKm: 25 },
    ],
  },
  Sucre: { city: "Sucre", center: { name: "Plaza 25 de Mayo", lat: -19.04764, lng: -65.25952 }, radiusKm: 4, zeroLabel: "Área urbana consolidada", fareBs: 3, fareNote: "Estimado", zones: OTHER_ZONES("Área urbana consolidada (sin recargo)") },
  Tarija: { city: "Tarija", center: { name: "Plaza Luis de Fuentes", lat: -21.53549, lng: -64.72956 }, radiusKm: 4, zeroLabel: "Área urbana consolidada", fareBs: 3, fareNote: "Estimado", zones: OTHER_ZONES("Área urbana consolidada (sin recargo)") },
  Oruro: { city: "Oruro", center: { name: "Plaza 10 de Febrero", lat: -17.96956, lng: -67.11498 }, radiusKm: 4, zeroLabel: "Área urbana consolidada", fareBs: 3, fareNote: "Estimado", zones: OTHER_ZONES("Área urbana consolidada (sin recargo)") },
  "Potosí": { city: "Potosí", center: { name: "Plaza 10 de Noviembre", lat: -19.58906, lng: -65.75347 }, radiusKm: 4, zeroLabel: "Área urbana consolidada", fareBs: 4, fareNote: "Bs 4 (sep-2026)", zones: OTHER_ZONES("Área urbana consolidada (sin recargo)") },
  Trinidad: { city: "Trinidad", center: { name: "Plaza José Ballivián", lat: -14.83361, lng: -64.90397 }, radiusKm: 4, zeroLabel: "Área urbana consolidada", fareBs: 3, fareNote: "Estimado", zones: OTHER_ZONES("Área urbana consolidada (sin recargo)") },
  Cobija: { city: "Cobija", center: { name: "Plaza Germán Busch", lat: -11.02671, lng: -68.76918 }, radiusKm: 4, zeroLabel: "Área urbana consolidada", fareBs: 3, fareNote: "Estimado", zones: OTHER_ZONES("Área urbana consolidada (sin recargo)") },
};

const CITY_ALIASES: Record<string, string> = {
  "santa cruz": "Santa Cruz",
  "santa cruz de la sierra": "Santa Cruz",
  scz: "Santa Cruz",
  "la paz": "La Paz",
  lpz: "La Paz",
  cochabamba: "Cochabamba",
  cbba: "Cochabamba",
  sucre: "Sucre",
  tarija: "Tarija",
  oruro: "Oruro",
  potosi: "Potosí",
  trinidad: "Trinidad",
  beni: "Trinidad",
  cobija: "Cobija",
  pando: "Cobija",
};

export function normalizeCityName(c: string | null | undefined): string {
  return (c || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Config km cero de la ciudad (default Santa Cruz si la ciudad está vacía; null si es desconocida). */
export function cityKmZero(city: string | null | undefined): CityKmZero | null {
  const n = normalizeCityName(city);
  if (!n) return CITY_KM_ZERO["Santa Cruz"];
  const key = CITY_ALIASES[n];
  return key ? CITY_KM_ZERO[key] : null;
}

export function round1(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** extra_km a partir de la distancia por calle y el radio km cero. */
export function extraKmFromDistance(distanceKm: number, radiusKm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 0;
  const extra = distanceKm - radiusKm;
  if (extra < TRANSPORT.minExtraKm) return 0;
  return round1(Math.min(extra, TRANSPORT.maxExtraKm));
}

/** Distancia en línea recta (km). */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export interface TransportPercentages {
  administrative: number;
  utility: number;
  tax: number;
}

export interface TransportInput {
  /** Materiales directos del presupuesto (Bs, sin GG/U/IT). */
  materials: number;
  /** Horas de mano de obra del presupuesto. */
  laborHours: number;
  extraKm: number;
  /** city_price_factors.transport_factor (1 = SCZ). */
  transportFactor: number;
  fareBs: number;
  percentages: TransportPercentages;
}

export interface TransportResult {
  extraKm: number;
  transportFactor: number;
  materialsBase: number;
  materialsPct: number;
  materialsCost: number;
  laborHours: number;
  workerDays: number;
  fareBs: number;
  faresPerDay: number;
  laborPerDay: number;
  laborCost: number;
  direct: number;
  markupFactor: number;
  total: number;
}

export function faresPerDay(extraKm: number): number {
  return extraKm > 0 ? Math.ceil(extraKm / TRANSPORT.kmPerFare) : 0;
}

export function materialsPct(extraKm: number, transportFactor: number): number {
  if (!(extraKm > 0)) return 0;
  const tf = Number.isFinite(transportFactor) && transportFactor > 0 ? transportFactor : 1;
  return Math.min(TRANSPORT.materialsCapPct, TRANSPORT.materialsPctPerKm * extraKm * tf);
}

export function markupFactor(p: TransportPercentages): number {
  return (1 + (p.administrative || 0) / 100) * (1 + (p.utility || 0) / 100) * (1 + (p.tax || 0) / 100);
}

export function computeTransport(i: TransportInput): TransportResult {
  const extraKm = i.extraKm > 0 ? Math.min(i.extraKm, TRANSPORT.maxExtraKm) : 0;
  const tf = Number.isFinite(i.transportFactor) && i.transportFactor > 0 ? i.transportFactor : 1;
  const mPct = materialsPct(extraKm, tf);
  const materialsBase = Math.max(0, i.materials || 0);
  const materialsCost = materialsBase * (mPct / 100);
  const laborHours = Math.max(0, i.laborHours || 0);
  const workerDays = laborHours / TRANSPORT.hoursPerWorkerDay;
  const fpd = faresPerDay(extraKm);
  const laborPerDay = (i.fareBs || 0) * fpd;
  const laborCost = workerDays * laborPerDay;
  const direct = materialsCost + laborCost;
  const mk = markupFactor(i.percentages);
  return {
    extraKm,
    transportFactor: tf,
    materialsBase: round2(materialsBase),
    materialsPct: Math.round(mPct * 1000) / 1000,
    materialsCost: round2(materialsCost),
    laborHours: round1(laborHours),
    workerDays: round1(workerDays),
    fareBs: i.fareBs,
    faresPerDay: fpd,
    laborPerDay: round2(laborPerDay),
    laborCost: round2(laborCost),
    direct: round2(direct),
    markupFactor: Math.round(mk * 10000) / 10000,
    total: round2(direct * mk),
  };
}

/** Snapshot guardado en budgets.transport_snapshot. */
export interface TransportSnapshot extends TransportResult {
  v: 1;
  computedAt: string;
  city: string;
  kmZero: { center: string; radiusKm: number; zeroLabel: string } | null;
  distanceKm: number | null;
  method: TransportMethod;
  zone: string | null;
  percentages: TransportPercentages;
  note: string;
}

/** Texto corto para UI/PDF: "26.1 km extra · materiales 6.53 % · 51 jornales × Bs 21.00". */
export function describeTransport(s: Pick<TransportResult, "extraKm" | "materialsPct" | "workerDays" | "laborPerDay">): string {
  const parts = [`${s.extraKm.toLocaleString("es-BO")} km más allá del km cero`];
  if (s.materialsPct > 0) parts.push(`materiales +${s.materialsPct.toLocaleString("es-BO", { maximumFractionDigits: 2 })} %`);
  if (s.laborPerDay > 0) parts.push(`${s.workerDays.toLocaleString("es-BO")} jornales × Bs ${s.laborPerDay.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  return parts.join(" · ");
}
