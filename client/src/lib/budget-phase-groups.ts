/**
 * Agrupa los ítems de un presupuesto por fase en orden constructivo (construction_phases.sort_order),
 * igual que el editor y el PDF: manda la fase ACTUAL de la actividad. Si esa fase está inactiva
 * (fases antiguas 3/4/7/9) o falta, se usa la fase guardada en el ítem si está activa; si ninguna
 * está activa se muestra igual (al final, por su sort_order 9xx). Sin fase conocida → «Sin fase».
 */
export interface PhaseLike {
  id: number;
  name?: string | null;
  sortOrder?: number | null;
  isActive?: boolean | null;
}

export interface GroupableItem {
  id: number;
  phaseId?: number | null;
  subtotal?: string | number | null;
  activity?: { phaseId?: number | null; phase?: PhaseLike | null } | null;
}

export interface PhaseGroup<T> {
  phaseId: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
  items: T[];
  total: number;
}

const NO_PHASE_SORT = 1_000_000;

export function groupBudgetItemsByPhase<T extends GroupableItem>(items: T[] | null | undefined, phases: PhaseLike[] = []): PhaseGroup<T>[] {
  const byId = new Map<number, PhaseLike>();
  for (const p of phases) if (p && Number.isFinite(Number(p.id))) byId.set(Number(p.id), p);

  const resolve = (id: number | null | undefined, embedded?: PhaseLike | null): PhaseLike | null => {
    const pid = Number(id ?? embedded?.id);
    if (!pid) return null;
    const known = byId.get(pid);
    if (known && embedded) return { ...embedded, ...known };
    return known ?? (embedded ? { ...embedded, id: pid } : { id: pid });
  };
  const active = (p: PhaseLike | null) => !!p && p.isActive !== false;

  const groups = new Map<number, PhaseGroup<T>>();
  for (const item of items ?? []) {
    if (!item) continue;
    const actPhase = resolve(item.activity?.phase?.id ?? item.activity?.phaseId, item.activity?.phase ?? null);
    const storedPhase = resolve(item.phaseId, null);
    const phase = active(actPhase) ? actPhase : active(storedPhase) ? storedPhase : actPhase ?? storedPhase;
    const pid = phase ? Number(phase.id) : 0;
    let g = groups.get(pid);
    if (!g) {
      g = {
        phaseId: pid,
        name: phase?.name || (pid ? `Fase ${pid}` : "Sin fase"),
        sortOrder: phase ? Number(phase.sortOrder ?? NO_PHASE_SORT - 1) : NO_PHASE_SORT,
        isActive: phase ? phase.isActive !== false : true,
        items: [],
        total: 0,
      };
      groups.set(pid, g);
    }
    g.items.push(item);
    const st = Number(item.subtotal);
    g.total += Number.isFinite(st) ? st : 0;
  }

  const out = Array.from(groups.values());
  for (const g of out) g.items.sort((a, b) => Number(a.id) - Number(b.id));
  return out.sort((a, b) => a.sortOrder - b.sortOrder || a.phaseId - b.phaseId);
}
