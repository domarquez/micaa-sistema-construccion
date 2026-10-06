/**
 * Estado inicial del editor de presupuestos (multi-phase-budget-form) a partir de GET /api/budgets/:id.
 * Agrupa por la fase ACTUAL de la actividad (igual que la vista y el PDF), conservando el phase_id guardado
 * (storedPhaseId) para el PUT. Si la fase de la actividad no es una fase activa y la guardada sí, usa la guardada.
 * Fases ordenadas como /api/construction-phases (sort_order); las desconocidas van al final.
 */
export interface EditorPhaseLike { id: number; name?: string | null; sortOrder?: number | null }
export interface EditorActivityLike { id: number; phaseId?: number | null; [k: string]: any }

export interface EditorItem {
  id: string;
  dbId?: number;
  activityId: number;
  activity?: any;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  priceManual?: boolean;
  storedPhaseId?: number | null;
}
export interface EditorPhase { phaseId: number; phase?: any; items: EditorItem[]; total: number }

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};

export function editorPhaseRank(phases: EditorPhaseLike[] | null | undefined, phaseId: number, phase?: any) {
  const idx = phases?.findIndex((p) => p.id === phaseId) ?? -1;
  return idx >= 0 ? idx : 1000 + Number(phase?.sortOrder ?? phaseId);
}

export function buildEditorPhases(
  items: any[] | null | undefined,
  allActivities: EditorActivityLike[] | null | undefined,
  constructionPhases: EditorPhaseLike[] | null | undefined,
): EditorPhase[] {
  const active = new Set((constructionPhases ?? []).map((p) => p.id));
  const groups = new Map<number, EditorItem[]>();

  for (const item of items ?? []) {
    if (!item) continue;
    const actPhaseId: number | undefined = item.activity?.phaseId ?? undefined;
    const storedPhaseId: number | undefined = item.phaseId ?? undefined;
    const groupPhaseId =
      actPhaseId && (active.has(actPhaseId) || !storedPhaseId || !active.has(storedPhaseId)) ? actPhaseId : storedPhaseId;
    if (!groupPhaseId) continue;

    const activity =
      (allActivities ?? []).find((a) => a.id === item.activityId) ??
      (item.activity ? { ...item.activity, phaseId: groupPhaseId } : undefined);

    if (!groups.has(groupPhaseId)) groups.set(groupPhaseId, []);
    groups.get(groupPhaseId)!.push({
      id: String(item.id),
      dbId: item.id,
      storedPhaseId: item.phaseId ?? null,
      priceManual: false,
      activityId: item.activityId,
      activity,
      quantity: num(item.quantity),
      unitPrice: num(item.unitPrice),
      subtotal: num(item.subtotal),
    });
  }

  return Array.from(groups.entries())
    .map(([phaseId, groupItems]) => ({
      phaseId,
      phase: (constructionPhases ?? []).find((p) => p.id === phaseId) ?? groupItems[0]?.activity?.phase,
      items: groupItems,
      total: groupItems.reduce((s, i) => s + i.subtotal, 0),
    }))
    .sort((a, b) => editorPhaseRank(constructionPhases, a.phaseId, a.phase) - editorPhaseRank(constructionPhases, b.phaseId, b.phase));
}

/** Quita un ítem; si la fase queda vacía, se quita la fase (antes no se podía borrar el único ítem de una fase). */
export function removeEditorItem<P extends EditorPhase>(phases: P[], phaseId: number, itemId: string): P[] {
  return phases.flatMap((p) => {
    if (p.phaseId !== phaseId) return [p];
    const items = p.items.filter((i) => i.id !== itemId);
    if (items.length === 0) return [];
    return [{ ...p, items, total: items.reduce((s, i) => s + i.subtotal, 0) }];
  });
}

/**
 * La carga desde el servidor se hace UNA vez por presupuesto. Antes el efecto dependía de un arreglo
 * recreado en cada render (allActivities = ...filter()), así que cada tecla o borrado re-ejecutaba la carga
 * y pisaba los cambios con los datos del servidor.
 */
export function shouldHydrateEditor(hydratedFor: number | null | undefined, budgetId: number | null | undefined, ready: boolean) {
  return !!budgetId && ready && hydratedFor !== budgetId;
}
