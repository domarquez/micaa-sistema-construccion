/**
 * APU en vivo — tipos y matemática pura (sin DB), compartida server/client.
 *
 * Orden de cálculo (normativa boliviana usada por MICAA):
 *   MO           = Σ cant × tarifa
 *   Cargas soc.  = MO × socialCharges%            (del proyecto, default 71.18)
 *   IVA MO       = (MO + cargas) × 14.94 %
 *   MO final     = MO + cargas + IVA MO
 *   Herram. men. = MO final × minorTools%          (projects.equipment_percentage, default 5)
 *   Directo      = Materiales + MO final + Equipo + Herram.
 *   GG           = Directo × administrative%
 *   Utilidad     = (Directo + GG) × utility%
 *   IT           = (Directo + GG + Utilidad) × tax%
 *   P.U.         = Directo + GG + Utilidad + IT
 */

export type ApuInputType = "material" | "labor" | "equipment";
/** Fuente elegible por el usuario (se guarda en project_price_overrides.source). */
export type ApuOverrideSource = "base" | "quote" | "market" | "manual";
/** Fuente efectiva de un insumo en el APU. snapshot = activity_compositions.unit_cost (sin catálogo). */
export type ApuPriceSource = ApuOverrideSource | "snapshot" | "custom";

export const APU_LABOR_IVA_PCT = 14.94;

export const APU_DEFAULT_PERCENTAGES = {
  socialCharges: 71.18,
  laborIva: APU_LABOR_IVA_PCT,
  minorTools: 5,
  administrative: 8,
  utility: 15,
  tax: 3.09,
} as const;

export interface ApuPercentages {
  socialCharges: number;
  laborIva: number;
  /** Herramientas menores como % de la mano de obra final. */
  minorTools: number;
  administrative: number;
  utility: number;
  tax: number;
}

export interface ApuPriceOption {
  /** Clave estable para el selector: base | market | quote:<umpId> | supplier:<mspId> */
  key: string;
  source: ApuOverrideSource;
  label: string;
  price: number;
  quoteId?: number | null;
  supplierPriceId?: number | null;
  supplierName?: string | null;
  city?: string | null;
  date?: string | null;
  estimated?: boolean;
}

export interface ApuOverrideRef {
  id: number;
  scope: "item" | "project";
  source: ApuOverrideSource;
  quoteId: number | null;
  supplierPriceId: number | null;
  manualPrice: number | null;
}

export interface ApuRow {
  compositionId: number;
  inputType: ApuInputType;
  /** materials.id / labor_categories.id / tools.id (null si la composición no enlaza catálogo). */
  inputId: number | null;
  name: string;
  description: string;
  /** Unidad de la composición (rendimiento). */
  unit: string;
  /** Unidad de venta del catálogo (material / MO / equipo). */
  catalogUnit: string | null;
  quantity: number;
  wastePct: number;
  /** quantity × (1 + wastePct/100) */
  effectiveQuantity: number;
  unitPrice: number;
  basePrice: number;
  subtotal: number;
  baseSubtotal: number;
  /** subtotal − baseSubtotal (Bs por unidad de actividad). */
  diffVsBase: number;
  source: ApuPriceSource;
  sourceLabel: string;
  override: ApuOverrideRef | null;
  options: ApuPriceOption[];
  sourceRef: string | null;
  warnings: string[];
}

export interface ApuTotals {
  materialsTotal: number;
  laborTotal: number;
  equipmentTotal: number;
  laborCharges: number;
  laborWithCharges: number;
  laborIVA: number;
  laborFinal: number;
  tools: number;
  equipmentWithTools: number;
  directCost: number;
  administrativeCost: number;
  utilityCost: number;
  taxCost: number;
  totalUnitPrice: number;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function effectiveQuantity(quantity: number, wastePct?: number | null): number {
  const q = Number.isFinite(quantity) ? quantity : 0;
  const w = wastePct != null && Number.isFinite(wastePct) ? wastePct : 0;
  return q * (1 + w / 100);
}

type RowLike = Pick<ApuRow, "inputType" | "subtotal">;

export function computeApuTotals(
  rows: RowLike[],
  pct: ApuPercentages,
  pick: (r: RowLike) => number = (r) => r.subtotal,
): ApuTotals {
  let materialsTotal = 0;
  let laborTotal = 0;
  let equipmentTotal = 0;
  for (const r of rows) {
    const v = pick(r) || 0;
    if (r.inputType === "material") materialsTotal += v;
    else if (r.inputType === "labor") laborTotal += v;
    else equipmentTotal += v;
  }
  const laborCharges = laborTotal * (pct.socialCharges / 100);
  const laborWithCharges = laborTotal + laborCharges;
  const laborIVA = laborWithCharges * (pct.laborIva / 100);
  const laborFinal = laborWithCharges + laborIVA;
  const tools = laborFinal * (pct.minorTools / 100);
  const equipmentWithTools = equipmentTotal + tools;
  const directCost = materialsTotal + laborFinal + equipmentWithTools;
  const administrativeCost = directCost * (pct.administrative / 100);
  const utilityCost = (directCost + administrativeCost) * (pct.utility / 100);
  const taxCost = (directCost + administrativeCost + utilityCost) * (pct.tax / 100);
  const totalUnitPrice = directCost + administrativeCost + utilityCost + taxCost;
  return {
    materialsTotal: round2(materialsTotal),
    laborTotal: round2(laborTotal),
    equipmentTotal: round2(equipmentTotal),
    laborCharges: round2(laborCharges),
    laborWithCharges: round2(laborWithCharges),
    laborIVA: round2(laborIVA),
    laborFinal: round2(laborFinal),
    tools: round2(tools),
    equipmentWithTools: round2(equipmentWithTools),
    directCost: round2(directCost),
    administrativeCost: round2(administrativeCost),
    utilityCost: round2(utilityCost),
    taxCost: round2(taxCost),
    totalUnitPrice: round2(totalUnitPrice),
  };
}

/** Normaliza unidades para avisos de incoherencia (kg vs bolsa, lt vs m…). */
export function normalizeUnit(u: string | null | undefined): string {
  const s = (u || "").trim().toLowerCase().replace(/\.$/, "").replace(/²/g, "2").replace(/³/g, "3");
  const map: Record<string, string> = {
    hr: "h", hrs: "h", hora: "h", horas: "h", "h": "h",
    lt: "l", lts: "l", litro: "l", litros: "l", l: "l",
    ml: "m", m: "m", metro: "m", mts: "m",
    pza: "pza", pieza: "pza", piezas: "pza", und: "pza", unidad: "pza", u: "pza",
    kg: "kg", kgs: "kg", kilo: "kg",
    bolsa: "bolsa", bls: "bolsa",
    m3: "m3", m2: "m2", p2: "p2", pie2: "p2",
  };
  return map[s] ?? s;
}

export function unitsLookIncoherent(compUnit: string | null | undefined, catalogUnit: string | null | undefined): boolean {
  if (!compUnit || !catalogUnit) return false;
  return normalizeUnit(compUnit) !== normalizeUnit(catalogUnit);
}

export const APU_SOURCE_LABELS: Record<ApuPriceSource, string> = {
  base: "Base MICAA",
  quote: "Cotización",
  market: "MICAA Market (sin IVA)",
  manual: "Manual",
  snapshot: "Costo importado (sin catálogo)",
  custom: "Actividad personalizada",
};
