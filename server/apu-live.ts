/**
 * APU en vivo (server-side, única fuente de verdad del precio de un ítem).
 *
 * computeActivityApu(activityId, projectId?, budgetItemId?) calcula:
 *  - materiales: precio resuelto = override ítem → override proyecto → Base MICAA
 *    (Base = misma lógica que getPublicMaterialPrice: rebasedPrice ?? rebase(price),
 *    × materials_factor de city_price_factors de la ciudad del proyecto).
 *    Opciones: Base → cotizaciones reales de la ciudad → MICAA Market (sin IVA) → Manual.
 *  - mano de obra: labor_categories.hourly_rate × labor_factor(ciudad).
 *  - equipo: tools.unit_price × equipment_factor(ciudad).
 *  - herramientas menores = projects.equipment_percentage (default 5 %) × MO final.
 *  - cargas sociales / GG / utilidad / IT desde el proyecto (defaults del schema).
 *  - waste_pct por composición si la columna existe (SELECT *).
 *
 * NUNCA escribe materials.price ni activity_compositions. computeActivityApu solo
 * lee; las escrituras (budget_items / budgets.total) están en funciones aparte.
 */
import { db } from "./db";
import {
  activities,
  laborCategories,
  tools,
  projects,
  budgets,
  budgetItems,
  userActivities,
  projectPriceOverrides,
  type ProjectPriceOverride,
} from "../shared/schema";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { getPublicMaterialPrice, getCityFactors } from "./material-price";
import {
  APU_DEFAULT_PERCENTAGES,
  APU_SOURCE_LABELS,
  computeApuTotals,
  effectiveQuantity,
  round2,
  unitsLookIncoherent,
  type ApuInputType,
  type ApuOverrideRef,
  type ApuOverrideSource,
  type ApuPercentages,
  type ApuPriceOption,
  type ApuPriceSource,
  type ApuRow,
  type ApuTotals,
} from "../shared/apu";

const DEFAULT_CITY = "Santa Cruz";

function num(v: unknown, fallback = 0): number {
  if (v == null || v === "") return fallback;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

function pgCode(err: any): string | undefined {
  return err?.code || err?.cause?.code;
}

function rowsOf(r: any): any[] {
  return Array.isArray(r) ? r : r?.rows ?? [];
}

// ---------------------------------------------------------------------------
// Detección de columnas/tablas aditivas (cache 60 s → no hace falta reiniciar tras migrar)
// ---------------------------------------------------------------------------
let colCache: { at: number; cols: Set<string> } | null = null;

export async function getOptionalColumns(): Promise<Set<string>> {
  if (colCache && Date.now() - colCache.at < 60_000) return colCache.cols;
  const r: any = await db.execute(sql`
    SELECT table_name || '.' || column_name AS c
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND ((table_name = 'budget_items' AND column_name IN ('apu_snapshot','apu_computed_at'))
        OR (table_name = 'activity_compositions' AND column_name IN ('waste_pct','source_ref'))
        OR (table_name = 'project_price_overrides' AND column_name = 'id')
        OR (table_name = 'projects' AND column_name = 'extra_km')
        OR (table_name = 'budgets' AND column_name = 'transport_cost'))
  `);
  const cols = new Set<string>(rowsOf(r).map((x: any) => String(x.c)));
  colCache = { at: Date.now(), cols };
  return cols;
}

export function invalidateOptionalColumnsCache() {
  colCache = null;
}

export async function overridesTableExists(): Promise<boolean> {
  return (await getOptionalColumns()).has("project_price_overrides.id");
}

// ---------------------------------------------------------------------------
// Tipos de resultado
// ---------------------------------------------------------------------------
interface LegacyLine {
  id: number;
  name: string;
  unit: string;
  quantity: number;
  unitCost: number;
  subtotal: number;
}

export interface LiveApuResult extends ApuTotals {
  activityId: number;
  activityName: string;
  unit: string;
  isCustomActivity: boolean;
  projectId: number | null;
  budgetItemId: number | null;
  city: string;
  factorCity: string | null;
  factors: { materials: number; labor: number; equipment: number };
  percentages: ApuPercentages;
  rows: ApuRow[];
  /** Totales si todos los insumos estuvieran a precio Base MICAA. */
  base: ApuTotals;
  /** totalUnitPrice − base.totalUnitPrice */
  diffVsBase: number;
  overridesAvailable: boolean;
  wasteColumnAvailable: boolean;
  computedAt: string;
  warnings: string[];
  // --- Compatibilidad con la respuesta antigua de calculateAPU ---
  breakdown: {
    laborCharges: number;
    laborIVA: number;
    tools: number;
    socialChargesPercentage: number;
    laborIvaPercentage: number;
    toolsPercentage: number;
    administrativePercentage: number;
    utilityPercentage: number;
    taxPercentage: number;
  };
  materials: LegacyLine[];
  labor: LegacyLine[];
  equipment: LegacyLine[];
}

export interface ComputeApuOptions {
  /** Ciudad cuando no hay proyecto (p.ej. preview público / script). */
  city?: string | null;
  /** Incluir la lista completa de cotizaciones por insumo. Default true. */
  includeOptions?: boolean;
  /**
   * Caché de precios de material compartida entre varias llamadas (p. ej. el preview de una plantilla calcula
   * ~60 actividades que repiten cemento, arena, fierro…). Clave `${materialId}|${city}`. Guarda la promesa,
   * así dos actividades concurrentes no consultan dos veces el mismo material. No cambia resultados.
   */
  materialCache?: Map<string, Promise<Awaited<ReturnType<typeof materialPriceOptions>>>>;
}

type CompRow = {
  id: number;
  type: string;
  material_id: number | null;
  labor_id: number | null;
  tool_id: number | null;
  description: string;
  unit: string;
  quantity: string | number;
  unit_cost: string | number;
  waste_pct?: string | number | null;
  source_ref?: string | null;
};

function normalizeType(t: string): ApuInputType | null {
  const s = (t || "").toLowerCase();
  if (s === "material" || s === "materials") return "material";
  if (s === "labor" || s === "mano_obra" || s === "mano de obra") return "labor";
  if (s === "equipment" || s === "tool" || s === "tools" || s === "equipo") return "equipment";
  return null;
}

async function loadOverrides(
  projectId: number | null,
  budgetItemId: number | null,
): Promise<{ available: boolean; rows: ProjectPriceOverride[] }> {
  const available = await overridesTableExists();
  if (!projectId || !available) return { available, rows: [] };
  try {
    const rows = await db
      .select()
      .from(projectPriceOverrides)
      .where(
        and(
          eq(projectPriceOverrides.projectId, projectId),
          budgetItemId
            ? or(isNull(projectPriceOverrides.budgetItemId), eq(projectPriceOverrides.budgetItemId, budgetItemId))
            : isNull(projectPriceOverrides.budgetItemId),
        ),
      );
    return { available: true, rows };
  } catch (err) {
    if (pgCode(err) === "42P01" || pgCode(err) === "42703") return { available: false, rows: [] };
    throw err;
  }
}

function findOverride(
  overrides: ProjectPriceOverride[],
  type: ApuInputType,
  inputId: number | null,
  budgetItemId: number | null,
): ApuOverrideRef | null {
  if (inputId == null) return null;
  const match = (o: ProjectPriceOverride) => o.inputType === type && o.inputId === inputId;
  const item = budgetItemId ? overrides.find((o) => match(o) && o.budgetItemId === budgetItemId) : undefined;
  const proj = overrides.find((o) => match(o) && o.budgetItemId == null);
  const o = item || proj;
  if (!o) return null;
  return {
    id: o.id,
    scope: o.budgetItemId != null ? "item" : "project",
    source: o.source as ApuOverrideSource,
    quoteId: o.quoteId ?? null,
    supplierPriceId: o.supplierPriceId ?? null,
    manualPrice: o.manualPrice != null ? num(o.manualPrice) : null,
  };
}

/** Opciones de precio de un material para la ciudad (Base → proveedores reales → MICAA Market). */
export async function materialPriceOptions(
  materialId: number,
  city: string,
): Promise<{ name: string; unit: string; base: number; factorCity: string | null; options: ApuPriceOption[] } | null> {
  const pub = await getPublicMaterialPrice(materialId, city);
  if (!pub) return null;
  const options: ApuPriceOption[] = [];
  for (const q of pub.quotes) {
    if (q.kind === "base" || q.source === "base") {
      options.push({
        key: "base",
        source: "base",
        label: `Base MICAA (${pub.factorCity || city})`,
        price: round2(q.price),
        city: q.city ?? null,
      });
    } else if (q.source === "market") {
      options.push({
        key: "market",
        source: "market",
        label: q.label || "MICAA Market (sin IVA)",
        price: round2(q.price),
        city: q.city ?? null,
        estimated: true,
      });
    } else if (q.quoteId != null || q.supplierPriceId != null) {
      const isSupplier = q.supplierPriceId != null;
      options.push({
        key: isSupplier ? `supplier:${q.supplierPriceId}` : `quote:${q.quoteId}`,
        source: "quote",
        label: q.provenanceName || q.label,
        price: round2(q.price),
        quoteId: isSupplier ? null : q.quoteId ?? null,
        supplierPriceId: isSupplier ? q.supplierPriceId ?? null : null,
        supplierName: q.provenanceName || q.label,
        city: q.city ?? null,
        date: q.provenanceDate ?? null,
      });
    }
  }
  return { name: pub.name, unit: pub.unit, base: round2(pub.basePrice), factorCity: pub.factorCity, options };
}

function applyOverride(
  base: number,
  options: ApuPriceOption[],
  ov: ApuOverrideRef,
  warnings: string[],
): { price: number; source: ApuPriceSource; label: string } {
  const baseLabel = options.find((o) => o.key === "base")?.label || APU_SOURCE_LABELS.base;
  if (ov.source === "base") return { price: base, source: "base", label: baseLabel };
  if (ov.source === "manual") {
    if (ov.manualPrice != null && ov.manualPrice >= 0) {
      return { price: round2(ov.manualPrice), source: "manual", label: "Precio manual" };
    }
    warnings.push("Override manual sin precio: se usa la base");
    return { price: base, source: "base", label: baseLabel };
  }
  if (ov.source === "market") {
    const m = options.find((o) => o.key === "market");
    if (m) return { price: m.price, source: "market", label: m.label };
    warnings.push("MICAA Market no disponible para este insumo: se usa la base");
    return { price: base, source: "base", label: baseLabel };
  }
  const key =
    ov.supplierPriceId != null ? `supplier:${ov.supplierPriceId}` : ov.quoteId != null ? `quote:${ov.quoteId}` : null;
  const q = key ? options.find((o) => o.key === key) : undefined;
  if (q) return { price: q.price, source: "quote", label: `Cotización · ${q.supplierName || q.label}` };
  warnings.push("La cotización elegida ya no está disponible en la ciudad del proyecto: se usa la base");
  return { price: base, source: "base", label: baseLabel };
}

// ---------------------------------------------------------------------------
// Helper principal
// ---------------------------------------------------------------------------
export async function computeActivityApu(
  activityId: number,
  projectId?: number | null,
  budgetItemId?: number | null,
  opts: ComputeApuOptions = {},
): Promise<LiveApuResult> {
  const includeOptions = opts.includeOptions !== false;
  const warnings: string[] = [];

  // Proyecto → ciudad + porcentajes
  let project: typeof projects.$inferSelect | null = null;
  if (projectId) {
    const [p] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!p) throw new Error(`Project ${projectId} not found`);
    project = p;
  }
  const city = (project?.city || opts.city || DEFAULT_CITY).trim() || DEFAULT_CITY;
  const percentages: ApuPercentages = {
    socialCharges: num(project?.socialChargesPercentage, APU_DEFAULT_PERCENTAGES.socialCharges),
    laborIva: APU_DEFAULT_PERCENTAGES.laborIva,
    minorTools: num(project?.equipmentPercentage, APU_DEFAULT_PERCENTAGES.minorTools),
    administrative: num(project?.administrativePercentage, APU_DEFAULT_PERCENTAGES.administrative),
    utility: num(project?.utilityPercentage, APU_DEFAULT_PERCENTAGES.utility),
    tax: num(project?.taxPercentage, APU_DEFAULT_PERCENTAGES.tax),
  };
  const cf = await getCityFactors(city);
  if (!cf.factorCity) warnings.push(`Ciudad "${city}" sin fila en city_price_factors: factores = 1`);

  // Actividad + composiciones (SELECT * → incluye waste_pct/source_ref si existen)
  const isCustomActivity = activityId > 10000;
  let activityName: string;
  let activityUnit: string;
  let comps: CompRow[];
  if (isCustomActivity) {
    const realId = activityId - 10000;
    const [ua] = await db.select().from(userActivities).where(eq(userActivities.id, realId)).limit(1);
    if (!ua) throw new Error(`User Activity ${realId} not found`);
    activityName = ua.customActivityName;
    activityUnit = ua.unit;
    comps = rowsOf(
      await db.execute(sql`SELECT * FROM user_activity_compositions WHERE user_activity_id = ${realId} ORDER BY id`),
    ) as CompRow[];
  } else {
    const [a] = await db.select().from(activities).where(eq(activities.id, activityId)).limit(1);
    if (!a) throw new Error(`Activity ${activityId} not found`);
    activityName = a.name;
    activityUnit = a.unit;
    comps = rowsOf(
      await db.execute(sql`SELECT * FROM activity_compositions WHERE activity_id = ${activityId} ORDER BY id`),
    ) as CompRow[];
  }
  const optionalCols = await getOptionalColumns();
  const wasteColumnAvailable = optionalCols.has("activity_compositions.waste_pct");

  const { available: overridesAvailable, rows: overrides } = await loadOverrides(projectId ?? null, budgetItemId ?? null);

  // Catálogos
  const laborIds = Array.from(new Set(comps.map((c) => c.labor_id).filter((x): x is number => x != null)));
  const toolIds = Array.from(new Set(comps.map((c) => c.tool_id).filter((x): x is number => x != null)));
  const laborMap = new Map(
    (laborIds.length ? await db.select().from(laborCategories).where(inArray(laborCategories.id, laborIds)) : []).map(
      (l) => [l.id, l] as const,
    ),
  );
  const toolMap = new Map(
    (toolIds.length ? await db.select().from(tools).where(inArray(tools.id, toolIds)) : []).map((t) => [t.id, t] as const),
  );
  const matCache = new Map<number, Awaited<ReturnType<typeof materialPriceOptions>>>();

  const rows: ApuRow[] = [];
  for (const c of comps) {
    const inputType = normalizeType(c.type);
    if (!inputType) {
      warnings.push(`Composición #${c.id}: tipo desconocido "${c.type}" (ignorada)`);
      continue;
    }
    const rowWarnings: string[] = [];
    const quantity = num(c.quantity);
    const wastePct = num(c.waste_pct, 0);
    const effQty = effectiveQuantity(quantity, wastePct);
    const snapshotCost = num(c.unit_cost);
    let inputId: number | null = null;
    let name = c.description;
    let catalogUnit: string | null = null;
    let basePrice = snapshotCost;
    let baseSource: ApuPriceSource = isCustomActivity ? "custom" : "snapshot";
    let options: ApuPriceOption[] = [];

    if (inputType === "material" && c.material_id != null) {
      inputId = c.material_id;
      if (!matCache.has(inputId)) {
        const shared = opts.materialCache;
        const key = `${inputId}|${city}`;
        let pr = shared?.get(key);
        if (!pr) {
          pr = materialPriceOptions(inputId, city);
          if (shared) {
            shared.set(key, pr);
            pr.catch(() => shared.delete(key));
          }
        }
        matCache.set(inputId, await pr);
      }
      const m = matCache.get(inputId);
      if (m) {
        name = m.name;
        catalogUnit = m.unit;
        basePrice = m.base;
        baseSource = "base";
        options = includeOptions ? m.options : m.options.filter((o) => o.key === "base" || o.key === "market");
        if (/\[DUPLICADO/i.test(m.name)) rowWarnings.push("El material enlazado está marcado como DUPLICADO");
      } else {
        rowWarnings.push(`Material #${inputId} no existe: se usa el costo importado`);
      }
    } else if (inputType === "labor" && c.labor_id != null) {
      inputId = c.labor_id;
      const l = laborMap.get(inputId);
      if (l) {
        name = l.name;
        catalogUnit = l.unit;
        basePrice = round2(num(l.hourlyRate) * cf.laborFactor);
        baseSource = "base";
        options = [{ key: "base", source: "base", label: `Tarifa MICAA (${cf.factorCity || city})`, price: basePrice }];
      } else rowWarnings.push(`Mano de obra #${inputId} no existe: se usa el costo importado`);
    } else if (inputType === "equipment" && c.tool_id != null) {
      inputId = c.tool_id;
      const t = toolMap.get(inputId);
      if (t) {
        name = t.name;
        catalogUnit = t.unit;
        basePrice = round2(num(t.unitPrice) * cf.equipmentFactor);
        baseSource = "base";
        options = [{ key: "base", source: "base", label: `Tarifa MICAA (${cf.factorCity || city})`, price: basePrice }];
      } else rowWarnings.push(`Equipo #${inputId} no existe: se usa el costo importado`);
    } else {
      rowWarnings.push("Sin enlace al catálogo: se usa el costo importado (unit_cost)");
    }

    if (inputType === "material" && unitsLookIncoherent(c.unit, catalogUnit)) {
      rowWarnings.push(`Unidad de rendimiento "${c.unit}" ≠ unidad de catálogo "${catalogUnit}"`);
    }

    let unitPrice = basePrice;
    let source: ApuPriceSource = baseSource;
    let sourceLabel =
      baseSource === "base"
        ? options.find((o) => o.key === "base")?.label || APU_SOURCE_LABELS.base
        : APU_SOURCE_LABELS[baseSource];
    const ov = baseSource === "base" ? findOverride(overrides, inputType, inputId, budgetItemId ?? null) : null;
    if (ov) {
      const r = applyOverride(basePrice, options, ov, rowWarnings);
      unitPrice = r.price;
      source = r.source;
      sourceLabel = r.label;
    }

    const subtotal = effQty * unitPrice;
    const baseSubtotal = effQty * basePrice;
    rows.push({
      compositionId: c.id,
      inputType,
      inputId,
      name,
      description: c.description,
      unit: c.unit,
      catalogUnit,
      quantity,
      wastePct,
      effectiveQuantity: Math.round(effQty * 10000) / 10000,
      unitPrice,
      basePrice,
      subtotal: round2(subtotal),
      baseSubtotal: round2(baseSubtotal),
      diffVsBase: round2(subtotal - baseSubtotal),
      source,
      sourceLabel,
      override: ov,
      options,
      sourceRef: c.source_ref ?? null,
      warnings: rowWarnings,
    });
  }

  if (!comps.length) warnings.push("La actividad no tiene composiciones: el APU es 0");

  // Totales sobre cant × precio sin redondear por fila
  const totals = computeApuTotals(
    rows.map((r) => ({ inputType: r.inputType, subtotal: effectiveQuantity(r.quantity, r.wastePct) * r.unitPrice })),
    percentages,
  );
  const base = computeApuTotals(
    rows.map((r) => ({ inputType: r.inputType, subtotal: effectiveQuantity(r.quantity, r.wastePct) * r.basePrice })),
    percentages,
  );

  const legacy = (t: ApuInputType): LegacyLine[] =>
    rows
      .filter((r) => r.inputType === t)
      .map((r) => ({
        id: r.inputId ?? 0,
        name: r.name,
        unit: r.unit,
        quantity: r.effectiveQuantity,
        unitCost: r.unitPrice,
        subtotal: r.subtotal,
      }));

  return {
    activityId,
    activityName,
    unit: activityUnit,
    isCustomActivity,
    projectId: projectId ?? null,
    budgetItemId: budgetItemId ?? null,
    city,
    factorCity: cf.factorCity,
    factors: { materials: cf.materialsFactor, labor: cf.laborFactor, equipment: cf.equipmentFactor },
    percentages,
    rows,
    ...totals,
    base,
    diffVsBase: round2(totals.totalUnitPrice - base.totalUnitPrice),
    overridesAvailable,
    wasteColumnAvailable,
    computedAt: new Date().toISOString(),
    warnings,
    breakdown: {
      laborCharges: totals.laborCharges,
      laborIVA: totals.laborIVA,
      tools: totals.tools,
      socialChargesPercentage: percentages.socialCharges,
      laborIvaPercentage: percentages.laborIva,
      toolsPercentage: percentages.minorTools,
      administrativePercentage: percentages.administrative,
      utilityPercentage: percentages.utility,
      taxPercentage: percentages.tax,
    },
    materials: legacy("material"),
    labor: legacy("labor"),
    equipment: legacy("equipment"),
  };
}

// ---------------------------------------------------------------------------
// Escrituras explícitas (budget_items / budgets.total) — nunca materials.price
// ---------------------------------------------------------------------------
export function compactApuSnapshot(apu: LiveApuResult) {
  return {
    v: 1,
    computedAt: apu.computedAt,
    activityId: apu.activityId,
    city: apu.city,
    factors: apu.factors,
    percentages: apu.percentages,
    totals: {
      materials: apu.materialsTotal,
      labor: apu.laborTotal,
      laborFinal: apu.laborFinal,
      equipment: apu.equipmentTotal,
      tools: apu.tools,
      direct: apu.directCost,
      administrative: apu.administrativeCost,
      utility: apu.utilityCost,
      tax: apu.taxCost,
      unitPrice: apu.totalUnitPrice,
      baseUnitPrice: apu.base.totalUnitPrice,
    },
    rows: apu.rows.map((r) => ({
      c: r.compositionId,
      t: r.inputType,
      id: r.inputId,
      name: r.name,
      unit: r.unit,
      qty: r.quantity,
      waste: r.wastePct,
      price: r.unitPrice,
      base: r.basePrice,
      src: r.source,
      label: r.sourceLabel,
      scope: r.override?.scope ?? null,
      sub: r.subtotal,
    })),
  };
}

/** Guarda unit_price/subtotal del ítem (y apu_snapshot/apu_computed_at si existen las columnas). */
export async function saveBudgetItemPrice(
  itemId: number,
  apu: LiveApuResult,
): Promise<{ unitPrice: number; subtotal: number; budgetTotal: number }> {
  const [item] = await db.select().from(budgetItems).where(eq(budgetItems.id, itemId)).limit(1);
  if (!item) throw new Error(`Budget item ${itemId} not found`);
  const unitPrice = round2(apu.totalUnitPrice);
  const subtotal = round2(unitPrice * num(item.quantity));
  const cols = await getOptionalColumns();
  if (cols.has("budget_items.apu_snapshot") && cols.has("budget_items.apu_computed_at")) {
    await db.execute(sql`
      UPDATE budget_items
         SET unit_price = ${unitPrice}, subtotal = ${subtotal},
             apu_snapshot = ${JSON.stringify(compactApuSnapshot(apu))}::jsonb,
             apu_computed_at = now()
       WHERE id = ${itemId}`);
  } else {
    await db
      .update(budgetItems)
      .set({ unitPrice: String(unitPrice), subtotal: String(subtotal) })
      .where(eq(budgetItems.id, itemId));
  }
  const budgetTotal = await recomputeBudgetTotal(item.budgetId);
  return { unitPrice, subtotal, budgetTotal };
}

/** Marca un ítem como preciado manualmente (borra snapshot si existe la columna). */
export async function clearBudgetItemSnapshot(itemId: number): Promise<void> {
  const cols = await getOptionalColumns();
  if (cols.has("budget_items.apu_snapshot") && cols.has("budget_items.apu_computed_at")) {
    await db.execute(sql`UPDATE budget_items SET apu_snapshot = NULL, apu_computed_at = NULL WHERE id = ${itemId}`);
  }
}

/**
 * budgets.total = Σ ítems + línea "Transporte y movilización" (server/transport.ts, migración 0005).
 * El transporte se recalcula aquí para que cualquier cambio de ítems lo mantenga al día.
 */
export async function recomputeBudgetTotal(budgetId: number): Promise<number> {
  const r = rowsOf(
    await db.execute(sql`SELECT COALESCE(SUM(subtotal), 0) AS t FROM budget_items WHERE budget_id = ${budgetId}`),
  );
  let transport = 0;
  const cols = await getOptionalColumns();
  if (cols.has("budgets.transport_cost") && cols.has("projects.extra_km")) {
    try {
      const { storeBudgetTransport } = await import("./transport");
      transport = await storeBudgetTransport(budgetId);
    } catch (e) {
      console.warn("Transporte no calculado para presupuesto", budgetId, (e as any)?.message);
    }
  }
  const total = round2(num(r[0]?.t) + transport);
  await db.update(budgets).set({ total: String(total), updatedAt: new Date() }).where(eq(budgets.id, budgetId));
  return total;
}

/** Recalcula y guarda un ítem con su APU en vivo (overrides del proyecto + ítem). */
export async function repriceBudgetItem(itemId: number, projectId: number) {
  const [item] = await db.select().from(budgetItems).where(eq(budgetItems.id, itemId)).limit(1);
  if (!item) throw new Error(`Budget item ${itemId} not found`);
  const apu = await computeActivityApu(item.activityId, projectId, itemId, { includeOptions: false });
  const saved = await saveBudgetItemPrice(itemId, apu);
  return { itemId, apu, ...saved };
}

/**
 * Tras cambiar un override: recalcula el ítem desde el que se editó y, si el
 * override es de alcance proyecto, los demás ítems del proyecto que YA fueron
 * preciados con APU en vivo (apu_computed_at NOT NULL) y usan ese insumo.
 * Los ítems "legacy" (precio viejo o manual) no se tocan sin que el usuario lo pida.
 */
export async function repriceAfterOverrideChange(
  projectId: number,
  inputType: ApuInputType,
  inputId: number,
  alsoItemId: number | null,
  projectScope: boolean,
): Promise<Array<{ itemId: number; unitPrice: number; subtotal: number }>> {
  const ids = new Set<number>();
  if (alsoItemId) ids.add(alsoItemId);
  const cols = await getOptionalColumns();
  if (projectScope && cols.has("budget_items.apu_computed_at")) {
    const col = inputType === "material" ? sql.raw("material_id") : inputType === "labor" ? sql.raw("labor_id") : sql.raw("tool_id");
    const r = rowsOf(
      await db.execute(sql`
        SELECT bi.id FROM budget_items bi
          JOIN budgets b ON b.id = bi.budget_id
         WHERE b.project_id = ${projectId}
           AND bi.apu_computed_at IS NOT NULL
           AND EXISTS (SELECT 1 FROM activity_compositions ac
                        WHERE ac.activity_id = bi.activity_id AND ac.${col} = ${inputId})`),
    );
    for (const x of r) ids.add(Number(x.id));
  }
  const out: Array<{ itemId: number; unitPrice: number; subtotal: number }> = [];
  for (const id of Array.from(ids)) {
    const r = await repriceBudgetItem(id, projectId);
    out.push({ itemId: id, unitPrice: r.unitPrice, subtotal: r.subtotal });
  }
  return out;
}
