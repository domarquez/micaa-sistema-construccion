/**
 * Parse and validate budget-item quantities.
 * Accepts decimal comma (es-BO), rejects negatives / non-numeric / absurd values.
 * Cap matches budget_items.quantity decimal(10, 3) headroom with a practical construction limit.
 */
export const BUDGET_QTY_MAX = 1_000_000;
export const BUDGET_QTY_MIN = 0.001;

export type QuantityParseOk = { ok: true; value: number };
export type QuantityParseErr = { ok: false; message: string };
export type QuantityParseResult = QuantityParseOk | QuantityParseErr;

/** Normalize "1.234,56" / "1,5" / "1.5" → number string for parseFloat. */
export function normalizeQuantityInput(raw: unknown): string {
  if (raw == null) return "";
  let s = String(raw).trim().replace(/\s/g, "");
  if (!s) return "";
  // If both separators: assume . thousands and , decimal (es-BO) or vice-versa by last separator
  if (s.includes(",") && s.includes(".")) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastComma > lastDot) {
      // 1.234,56 → remove dots, comma → dot
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // 1,234.56 → remove commas
      s = s.replace(/,/g, "");
    }
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  return s;
}

export function parseBudgetQuantity(raw: unknown): QuantityParseResult {
  if (raw === null || raw === undefined || (typeof raw === "string" && raw.trim() === "")) {
    return { ok: false, message: "La cantidad es obligatoria" };
  }
  const normalized = normalizeQuantityInput(raw);
  if (!normalized || !/^-?\d+(\.\d+)?$/.test(normalized)) {
    return { ok: false, message: "Cantidad no numérica. Usá números; la coma decimal es válida (ej. 12,5)." };
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    return { ok: false, message: "Cantidad no numérica" };
  }
  if (value < 0) {
    return { ok: false, message: "La cantidad no puede ser negativa" };
  }
  if (value === 0) {
    return { ok: false, message: "La cantidad debe ser mayor que cero" };
  }
  if (value > BUDGET_QTY_MAX) {
    return {
      ok: false,
      message: `Cantidad demasiado grande (máximo ${BUDGET_QTY_MAX.toLocaleString("es-BO")}). Si necesitás más, dividí el ítem.`,
    };
  }
  // Round to 3 decimal places (schema scale)
  const rounded = Math.round(value * 1000) / 1000;
  if (rounded < BUDGET_QTY_MIN) {
    return { ok: false, message: `La cantidad mínima es ${BUDGET_QTY_MIN}` };
  }
  return { ok: true, value: rounded };
}
