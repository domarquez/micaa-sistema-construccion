/**
 * Línea "Transporte y movilización" + nota de precios base, para resumen y PDFs.
 * Fuente: budgets.transport_cost / transport_snapshot (calculados en el servidor, server/transport.ts).
 */
import {
  BASE_PRICE_NOTE,
  TRANSPORT_LINE_LABEL,
  TRANSPORT_METHOD_LABELS,
  describeTransport,
  type TransportSnapshot,
} from "@shared/transport";

export { BASE_PRICE_NOTE, TRANSPORT_LINE_LABEL };

export interface BudgetTransport {
  cost: number;
  snapshot: TransportSnapshot | null;
}

export function budgetTransport(budget: any): BudgetTransport {
  const cost = Number(budget?.transportCost ?? budget?.transport_cost ?? 0) || 0;
  const snapshot = (budget?.transportSnapshot ?? budget?.transport_snapshot ?? null) as TransportSnapshot | null;
  return { cost, snapshot };
}

/** "26,1 km más allá del km cero · materiales +6,53 % · 241 jornales × Bs 21.00" */
export function transportDetail(s: TransportSnapshot | null): string {
  if (!s || !(s.extraKm > 0)) return "";
  return describeTransport(s);
}

/** "Obra a 31,1 km de Plaza 24 de Septiembre (distancia por calle (OSRM))" */
export function transportOrigin(s: TransportSnapshot | null): string {
  if (!s) return "";
  const center = s.kmZero?.center ?? "km cero";
  const how = TRANSPORT_METHOD_LABELS[s.method] ?? s.method;
  if (s.distanceKm != null) return `Obra a ${s.distanceKm.toLocaleString("es-BO")} km de ${center} (${how})`;
  return `Ubicación: ${how}`;
}

const fmt = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Escribe el bloque de resumen al final del PDF (jsPDF). Devuelve la nueva Y.
 *   Subtotal actividades · Transporte y movilización (si > 0) · TOTAL GENERAL · nota precios base
 */
export function writePdfTotals(
  doc: any,
  opts: { itemsTotal: number; budget: any; y: number; margin: number; pageWidth: number; checkNewPage?: (space?: number) => boolean },
): number {
  const { cost, snapshot } = budgetTransport(opts.budget);
  let y = opts.y;
  const right = opts.pageWidth - opts.margin;
  const ensure = (space: number) => {
    if (opts.checkNewPage && opts.checkNewPage(space)) y = 20;
  };
  ensure(40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Subtotal actividades:", opts.margin + 20, y);
  doc.text(`Bs ${fmt(opts.itemsTotal)}`, right, y, { align: "right" });
  y += 6;
  if (cost > 0) {
    doc.text(`${TRANSPORT_LINE_LABEL}:`, opts.margin + 20, y);
    doc.text(`Bs ${fmt(cost)}`, right, y, { align: "right" });
    y += 4;
    doc.setFontSize(7);
    const detail = [transportOrigin(snapshot), transportDetail(snapshot)].filter(Boolean).join(" · ");
    if (detail) {
      for (const line of doc.splitTextToSize(detail + " · incluye GG, utilidad e IT", right - opts.margin - 24)) {
        doc.text(line, opts.margin + 24, y);
        y += 3.2;
      }
    }
    doc.setFontSize(9);
    y += 2;
  }
  doc.line(opts.margin + 110, y, right, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL GENERAL:", opts.margin + 20, y);
  doc.text(`Bs ${fmt(opts.itemsTotal + cost)}`, right, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += 6;
  doc.setFontSize(7);
  doc.setTextColor(110, 110, 110);
  const notes = [
    `* ${BASE_PRICE_NOTE}`,
    "* Los precios unitarios ya incluyen cargas sociales, IVA de mano de obra, gastos generales, utilidad e IT (no se suma IVA aparte).",
  ];
  for (const n of notes) {
    for (const line of doc.splitTextToSize(n, right - opts.margin)) {
      doc.text(line, opts.margin, y);
      y += 3.2;
    }
  }
  doc.setTextColor(0, 0, 0);
  return y + 6;
}
