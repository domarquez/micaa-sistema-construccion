/**
 * Lógica pura de plantillas de proyecto (sin DB), compartida por servidor, cliente y tests.
 */
import { evaluateFormula, evaluateTemplate, type TemplateDerived, type TemplateItemDef, type TemplateParamsSchema, type Vars } from "./template-formula";

export interface TemplateLineInput extends TemplateItemDef {
  missingKey?: string | null;
  missingName?: string | null;
  isOptional?: boolean;
}
export interface PricedLine {
  sortOrder: number;
  phaseId: number;
  activityId: number | null;
  missingKey: string | null;
  name: string;
  unit: string;
  quantityFormula: string;
  breakdown: string | null;
  quantity: number;
  unitPrice: number | null;
  subtotal: number;
  status: "ok" | "missing" | "price_error";
}
export interface TemplatePreview {
  params: Vars;
  vars: Vars;
  lines: PricedLine[];
  total: number;
  refQuantity: number;
  costPerRefUnit: number | null;
  missingCount: number;
  byPhase: Record<number, number>;
}

const r2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Evalúa la plantilla con los params y le pone precio a cada línea.
 * `prices`: activityId → { unitPrice, name, unit }. Las líneas con cantidad 0 se omiten.
 */
export function buildTemplatePreview(
  schema: TemplateParamsSchema,
  derived: TemplateDerived[],
  refQuantityFormula: string,
  items: TemplateLineInput[],
  params: Record<string, unknown> | null | undefined,
  prices: Map<number, { unitPrice: number; name: string; unit: string } | { error: string }>,
): TemplatePreview {
  const ev = evaluateTemplate(schema, derived, items, params);
  const lines: PricedLine[] = [];
  const byPhase: Record<number, number> = {};
  let total = 0;
  let missingCount = 0;
  for (const it of ev.items) {
    if (it.quantity <= 0) continue;
    const base = {
      sortOrder: it.sortOrder ?? 0, phaseId: it.phaseId, activityId: it.activityId, missingKey: it.missingKey ?? null,
      quantityFormula: it.quantityFormula, breakdown: it.breakdown ?? null, quantity: it.quantity,
    };
    if (it.activityId == null) {
      missingCount++;
      lines.push({ ...base, name: it.missingName || it.missingKey || "Actividad faltante", unit: "", unitPrice: null, subtotal: 0, status: "missing" });
      continue;
    }
    const p = prices.get(it.activityId);
    if (!p || "error" in p) {
      lines.push({ ...base, name: `Actividad #${it.activityId}`, unit: "", unitPrice: null, subtotal: 0, status: "price_error" });
      continue;
    }
    const subtotal = r2(r2(p.unitPrice) * it.quantity);
    total += subtotal;
    byPhase[it.phaseId] = r2((byPhase[it.phaseId] || 0) + subtotal);
    lines.push({ ...base, name: p.name, unit: p.unit, unitPrice: r2(p.unitPrice), subtotal, status: "ok" });
  }
  lines.sort((a, b) => a.phaseId - b.phaseId || a.sortOrder - b.sortOrder);
  const refQuantity = evaluateFormula(refQuantityFormula || "1", ev.vars);
  total = r2(total);
  return { params: ev.params, vars: ev.vars, lines, total, refQuantity, costPerRefUnit: refQuantity > 0 ? r2(total / refQuantity) : null, missingCount, byPhase };
}

/** Decide si el usuario puede usar (preview/instantiate) una plantilla premium. */
export function canUseTemplate(opts: {
  premiumEnabled: boolean;
  templateIsPremium: boolean;
  isAdmin: boolean;
  entitlements: Array<{ templateId: number | null; expiresAt: Date | string | null }>;
  templateId: number;
  now?: Date;
}): boolean {
  if (!opts.premiumEnabled || !opts.templateIsPremium || opts.isAdmin) return true;
  const now = opts.now ?? new Date();
  return opts.entitlements.some(
    (e) => (e.templateId == null || e.templateId === opts.templateId) && (e.expiresAt == null || new Date(e.expiresAt) > now),
  );
}
