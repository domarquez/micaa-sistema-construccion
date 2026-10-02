/**
 * Compatibilidad: calculateAPU() ahora delega en el APU en vivo
 * (server/apu-live.ts → computeActivityApu). Ya no usa activity_compositions.unit_cost
 * salvo para filas sin enlace a catálogo, ni porcentajes fijos (55 % / 5 % de equipo).
 */
import { computeActivityApu, type LiveApuResult, type ComputeApuOptions } from "./apu-live";

export type APUCalculationResult = LiveApuResult;

export async function calculateAPU(
  activityId: number,
  opts: ComputeApuOptions & { projectId?: number | null; budgetItemId?: number | null } = {},
): Promise<APUCalculationResult> {
  return computeActivityApu(activityId, opts.projectId ?? null, opts.budgetItemId ?? null, opts);
}
