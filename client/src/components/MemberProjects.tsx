import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useDisclosureLevel } from "@/hooks/useDisclosureLevel";

type BudgetRow = {
  id: number;
  total?: string | number | null;
  status?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  project?: { id: number; name?: string | null; city?: string | null } | null;
};

const STATUS: Record<string, string> = { draft: "borrador", active: "activo", completed: "terminado", archived: "archivado" };

/** Tarjeta clara para empezar un proyecto desde una plantilla (nivel 1). */
export function StartProjectCard() {
  const { can } = useDisclosureLevel();
  if (!can("templates")) return null;
  return (
    <Link href="/plantillas" data-testid="card-start-project">
        <div className="mb-6 flex text-left cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--micaa-accent)]/40 bg-white px-4 py-4 hover:border-[var(--micaa-accent)]">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-[var(--micaa-fg)]">Empieza un proyecto</p>
            <p className="mt-0.5 text-[12px] text-[var(--micaa-muted)]">
              Desde una plantilla: casa, muro, baño, piscina, galpón… ajusta medidas y ve el costo al instante.
            </p>
          </div>
          <span className="shrink-0 rounded-lg bg-[var(--micaa-accent)] px-3 py-2 text-[13px] font-medium text-[var(--micaa-accent-fg)]">
            Desde plantilla
          </span>
        </div>
      </Link>
  );
}

const fmtBs = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? `Bs ${n.toLocaleString("es-BO", { maximumFractionDigits: 0 })}` : "—";
};

/**
 * Nivel 1 (divulgación progresiva): tarjeta "Empieza un proyecto" + mis proyectos, con el estilo simple
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
    <section id="proyectos" className="mx-auto max-w-xl px-4 pb-10" data-testid="member-projects">
      {showCard && <StartProjectCard />}

      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-[13px] font-medium uppercase tracking-wide text-[var(--micaa-muted)]">Mis proyectos</h2>
        <div className="flex gap-3 text-[12px]">
          {showAllLink && rows.length > (limit || Infinity) && (
            <Link href="/proyectos" className="text-[var(--micaa-accent)]">Ver todos ({rows.length})</Link>
          )}
          <Link href="/budgets" className="text-[var(--micaa-muted)] hover:text-[var(--micaa-fg)]">Vista avanzada</Link>
          {isAdmin && <Link href="/dashboard" className="text-[var(--micaa-muted)] hover:text-[var(--micaa-fg)]">Panel</Link>}
        </div>
      </div>
      <div className="divide-y divide-[var(--micaa-line)] border-t border-[var(--micaa-line)]">
        {isLoading && <p className="py-4 text-center text-[12px] text-[var(--micaa-muted)]">Cargando…</p>}
        {!isLoading && shown.length === 0 && (
          <p className="py-4 text-center text-[12px] text-[var(--micaa-muted)]">Aún no tienes proyectos. Empieza desde una plantilla.</p>
        )}
        {shown.map((b) => (
          <Link key={b.id} href={`/budgets/${b.id}`} className="flex items-baseline justify-between gap-4 py-3 hover:bg-black/[0.02]">
            <div className="min-w-0">
              <div className="truncate text-[14px] text-[var(--micaa-fg)]">{b.project?.name || `Presupuesto #${b.id}`}</div>
              <div className="mt-0.5 text-[12px] text-[var(--micaa-muted)]">
                {[b.project?.city, STATUS[b.status || ""] ?? b.status].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div className="shrink-0 text-[15px] font-medium tabular-nums text-[var(--micaa-fg)]">{fmtBs(b.total)}</div>
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
