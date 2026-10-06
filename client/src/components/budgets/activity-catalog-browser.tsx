import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Layers, Plus } from "lucide-react";
import type { ActivityWithPhase } from "@shared/schema";

/**
 * Explorar por fase › familia (nivel 2 de la divulgación progresiva).
 * - Fases en orden constructivo (construction_phases.sort_order), familias en su orden.
 * - Variantes (aparejos soga/canto/cabeza, tamaños, RH, doble placa…) agrupadas en subfamilias tras «Ver variantes».
 * - Familias largas: se muestran las primeras 8 y «Ver todas».
 * Al elegir, el formulario ubica la actividad en SU fase.
 */
interface CatalogActivity { id: number; name: string; unit: string; unitPrice: string | null }
interface CatalogFamily { id: number; name: string; count: number; activities: CatalogActivity[]; variants: { id: number; name: string; activities: CatalogActivity[] }[] }
interface CatalogPhase { id: number; name: string; sortOrder: number; count: number; families: CatalogFamily[]; unclassified: CatalogActivity[] }

const FIRST = 8;
const fmt = (n: unknown) => Number(n || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function ActivityRow({ a, onPick }: { a: CatalogActivity; onPick: (a: CatalogActivity) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(a)}
      className="w-full flex items-start gap-2 text-left px-2 py-2 rounded hover:bg-muted focus:bg-muted focus:outline-none"
      data-testid={`catalog-activity-${a.id}`}
    >
      <Plus className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <span className="block text-xs sm:text-sm leading-snug break-words">{a.name}</span>
        <span className="block text-[11px] text-muted-foreground">{a.unit} · ref. Bs {fmt(a.unitPrice)}</span>
      </span>
    </button>
  );
}

function FamilyBlock({ f, onPick }: { f: CatalogFamily; onPick: (a: CatalogActivity) => void }) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [openVariants, setOpenVariants] = useState<number[]>([]);
  const list = showAll ? f.activities : f.activities.slice(0, FIRST);
  return (
    <div className="border-b last:border-b-0" data-testid={`catalog-family-${f.id}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-2 py-2 text-left text-sm hover:bg-muted/60"
      >
        <span className="flex items-center gap-1 min-w-0">
          {open ? <ChevronDown className="w-4 h-4 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 flex-shrink-0" />}
          <span className="font-medium break-words">{f.name}</span>
        </span>
        <Badge variant="outline" className="text-[10px] flex-shrink-0">{f.count}</Badge>
      </button>
      {open && (
        <div className="pl-4 pb-2">
          {list.map((a) => <ActivityRow key={a.id} a={a} onPick={onPick} />)}
          {f.activities.length > FIRST && (
            <button type="button" className="text-[11px] text-primary px-2 py-1" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Ver menos" : `Ver todas (${f.activities.length})`}
            </button>
          )}
          {f.variants.map((v) => {
            const vOpen = openVariants.includes(v.id);
            return (
              <div key={v.id} className="mt-1">
                <button
                  type="button"
                  aria-expanded={vOpen}
                  onClick={() => setOpenVariants((p) => (vOpen ? p.filter((x) => x !== v.id) : [...p, v.id]))}
                  className="flex items-center gap-1 text-[11px] sm:text-xs text-primary px-2 py-1"
                  data-testid={`catalog-variants-${v.id}`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  {vOpen ? "Ocultar variantes" : "Ver variantes"} · {v.name} ({v.activities.length})
                </button>
                {vOpen && <div className="pl-3 border-l ml-3">{v.activities.map((a) => <ActivityRow key={a.id} a={a} onPick={onPick} />)}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ActivityCatalogBrowser({ onPick }: { onPick: (activity: ActivityWithPhase) => void }) {
  const [openPhase, setOpenPhase] = useState<number | null>(null);
  const { data, isLoading } = useQuery<{ phases: CatalogPhase[] } | null>({
    queryKey: ["/api/activities/catalog"],
    staleTime: 5 * 60 * 1000,
  });
  const phases = data?.phases || [];
  const pick = (p: CatalogPhase) => (a: CatalogActivity) =>
    onPick({ ...(a as any), phaseId: p.id, phase: { id: p.id, name: p.name, sortOrder: p.sortOrder } } as ActivityWithPhase);

  return (
    <div data-testid="activity-catalog-browser">
      <p className="text-xs font-medium text-muted-foreground mb-2">Explorar por fase</p>
      {isLoading && <p className="text-xs text-muted-foreground">Cargando catálogo…</p>}
      <div className="border rounded-md divide-y">
        {phases.map((p, i) => {
          const open = openPhase === p.id;
          return (
            <div key={p.id} data-testid={`catalog-phase-${p.id}`}>
              <button
                type="button"
                onClick={() => setOpenPhase(open ? null : p.id)}
                aria-expanded={open}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/60"
              >
                <span className="flex items-center gap-2 min-w-0">
                  {open ? <ChevronDown className="w-4 h-4 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 flex-shrink-0" />}
                  <span className="text-[11px] text-muted-foreground w-5 text-right flex-shrink-0">{i + 1}.</span>
                  <span className="text-sm font-medium break-words">{p.name}</span>
                </span>
                <Badge variant="secondary" className="text-[10px] flex-shrink-0">{p.count}</Badge>
              </button>
              {open && (
                <div className="px-1 sm:px-3 pb-2">
                  {p.families.map((f) => <FamilyBlock key={f.id} f={f} onPick={pick(p)} />)}
                  {p.unclassified.length > 0 && (
                    <FamilyBlock f={{ id: -p.id, name: "Otras", count: p.unclassified.length, activities: p.unclassified, variants: [] }} onPick={pick(p)} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
