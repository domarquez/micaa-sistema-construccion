import { Link } from "wouter";
import { ListSkeleton } from "@/components/ui/states";
import { useQuery } from "@tanstack/react-query";
import { useDisclosureLevel } from "@/hooks/useDisclosureLevel";
import { FilePlus2, LayoutTemplate } from "lucide-react";

type BudgetRow = {
  id: number;
  total?: string | number | null;
  status?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  project?: { id: number; name?: string | null; city?: string | null } | null;
};

const STATUS: Record<string, string> = { draft: "borrador", active: "activo", completed: "terminado", archived: "archivado" };

/**
 * Empezá un proyecto: dos opciones iguales — Desde plantilla | En blanco.
 * En blanco → /proyecto-nuevo (editor multifase: nombre/ciudad → fases/actividades).
 */
export function StartProjectCard() {
  const { can } = useDisclosureLevel();
  if (!can("projects")) return null;
  return (
    <div
      className="mb-6 min-w-0 rounded-xl border border-[var(--micaa-accent)]/40 bg-white px-4 py-4"
      data-testid="card-start-project"
    >
      <p className="text-base font-semibold text-[var(--micaa-fg)]">Empezá un proyecto</p>
      <p className="mt-0.5 text-sm text-[var(--micaa-muted)]">
        Elegí plantilla o empezá en blanco y armá fases y actividades a tu gusto.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 min-[390px]:grid-cols-2">
        <Link
          href="/plantillas"
          data-testid="cta-start-from-template"
          className="flex min-w-0 items-center gap-3 rounded-lg border border-[var(--micaa-line)] bg-[var(--micaa-bg)] px-3 py-3 text-left hover:border-[var(--micaa-accent)]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--micaa-accent)]/15 text-[var(--micaa-accent)]">
            <LayoutTemplate className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[var(--micaa-fg)]">Desde plantilla</span>
            <span className="block text-xs text-[var(--micaa-muted)] leading-snug">
              Casa, muro, baño… ajustá medidas
            </span>
          </span>
        </Link>
        <Link
          href="/proyecto-nuevo"
          data-testid="cta-start-blank-project"
          className="flex min-w-0 items-center gap-3 rounded-lg border border-[var(--micaa-line)] bg-[var(--micaa-bg)] px-3 py-3 text-left hover:border-[var(--micaa-accent)]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--micaa-accent)]/15 text-[var(--micaa-accent)]">
            <FilePlus2 className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[var(--micaa-fg)]">En blanco</span>
            <span className="block text-xs text-[var(--micaa-muted)] leading-snug">
              Proyecto nuevo a tu gusto
            </span>
          </span>
        </Link>
      </div>
    </div>
  );
}

const fmtBs = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? `Bs ${n.toLocaleString("es-BO", { maximumFractionDigits: 0 })}` : "—";
};

/**
 * Nivel 1 (divulgación progresiva): tarjeta "Empezá un proyecto" + mis proyectos, con el estilo simple
 * de la superficie de precios. Se usa en "/" (debajo de materiales) y en "/proyectos".
 */
export function MemberProjects({ limit, showAllLink = true, showCard = true }: { limit?: number; showAllLink?: boolean; showCard?: boolean }) {
  const { can, isAdmin } = useDisclosureLevel();
  const enabled = can("projects");
  const { data, isLoading } = useQuery<BudgetRow[] | null>({
    queryKey: ["/api/budgets"],
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  if (!enabled) return null;
  const rows = Array.isArray(data) ? [...data].sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""))) : [];
  const shown = limit ? rows.slice(0, limit) : rows;

  return (
    <section id="proyectos" className="mx-auto max-w-4xl px-4 pb-10" data-testid="member-projects">
      {showCard && <StartProjectCard />}

      <div className="mb-2 flex items-baseline justify-between gap-2 min-w-0">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--micaa-muted)]">Mis proyectos</h2>
        <div className="flex flex-wrap justify-end gap-3 text-sm">
          {showAllLink && rows.length > (limit || Infinity) && (
            <Link href="/proyectos" className="text-[var(--micaa-accent)]">Ver todos ({rows.length})</Link>
          )}
          <Link href="/budgets" className="text-[var(--micaa-muted)] hover:text-[var(--micaa-fg)]">Vista avanzada</Link>
          {isAdmin && <Link href="/dashboard" className="text-[var(--micaa-muted)] hover:text-[var(--micaa-fg)]">Panel</Link>}
        </div>
      </div>
      <div className="divide-y divide-[var(--micaa-line)] border-t border-[var(--micaa-line)]">
        {isLoading && <ListSkeleton rows={3} />}
        {!isLoading && shown.length === 0 && (
          <p className="py-4 text-center text-sm text-[var(--micaa-muted)]">
            Aún no tenés proyectos. Empezá desde una plantilla o en blanco.
          </p>
        )}
        {shown.map((b) => (
          <Link key={b.id} href={`/budgets/${b.id}`} className="flex items-baseline justify-between gap-4 py-3 hover:bg-black/[0.02]">
            <div className="min-w-0">
              <div className="truncate text-base text-[var(--micaa-fg)]">{b.project?.name || `Presupuesto #${b.id}`}</div>
              <div className="mt-0.5 text-sm text-[var(--micaa-muted)]">
                {[b.project?.city, STATUS[b.status || ""] ?? b.status].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div className="shrink-0 text-base font-medium tabular-nums text-[var(--micaa-fg)]">{fmtBs(b.total)}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** "/" para nivel ≥1: materiales arriba + proyectos. */
export function ProjectsPage() {
  return (
    <div className="pt-8">
      <MemberProjects showAllLink={false} />
    </div>
  );
}
