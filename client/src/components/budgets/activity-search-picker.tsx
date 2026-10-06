import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Star, X, SlidersHorizontal } from "lucide-react";
import type { ActivityWithPhase, ConstructionPhase } from "@shared/schema";
import ActivityCatalogBrowser from "@/components/budgets/activity-catalog-browser";

/**
 * Buscador de actividades en TODAS las fases (divulgación progresiva):
 *  1) Simple: caja de búsqueda + "Más usadas" (uso real en presupuestos/plantillas + lista curada).
 *  2) Debajo: explorar por fase › familia (variantes tras «Ver variantes»).
 *  3) Avanzado (toggle): filtrar la búsqueda por una fase.
 * Al elegir, el formulario agrega la actividad en SU fase (la crea si no estaba).
 */
interface Props {
  phases?: ConstructionPhase[];
  onPick: (activity: ActivityWithPhase) => void;
}

function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const fmt = (n: unknown) => Number(n || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ActivitySearchPicker({ phases, onPick }: Props) {
  const [query, setQuery] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [phaseFilter, setPhaseFilter] = useState<string>("");
  const q = useDebounced(query.trim());
  const searching = q.length >= 2;

  const { data: searchData, isFetching } = useQuery<{ activities: ActivityWithPhase[]; totalCount: number } | null>({
    queryKey: ["/api/activities", { search: q, limit: 30, ...(phaseFilter ? { phase: phaseFilter } : {}) }],
    enabled: searching,
  });
  const { data: mostUsed } = useQuery<{ activities: ActivityWithPhase[] } | null>({
    queryKey: ["/api/activities/most-used", { limit: 12 }],
    staleTime: 10 * 60 * 1000,
  });

  const results = (searchData?.activities || []).filter((a: any) => a.isOriginal !== false);
  const pick = (a: ActivityWithPhase) => {
    onPick(a);
    setQuery("");
  };

  return (
    <div className="space-y-3" data-testid="activity-search-picker">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar actividad en todas las fases (ej. muro ladrillo hueco, drywall, contrapiso)"
          className="pl-9 pr-9 text-sm"
          aria-label="Buscar actividad"
          data-testid="input-activity-search"
        />
        {query && (
          <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setQuery("")} aria-label="Limpiar búsqueda">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {searching ? (
        <div className="border rounded-md max-h-80 overflow-y-auto divide-y" role="listbox">
          {isFetching && results.length === 0 && <p className="p-3 text-xs text-muted-foreground">Buscando…</p>}
          {!isFetching && results.length === 0 && (
            <p className="p-3 text-xs text-muted-foreground">Sin resultados para «{q}». Prueba con otra palabra (ej. «muro», «ladrillo», «piso»).</p>
          )}
          {results.map((a) => (
            <button
              key={a.id}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => pick(a)}
              className="w-full text-left p-2 sm:p-3 hover:bg-muted focus:bg-muted focus:outline-none"
              data-testid={`activity-result-${a.id}`}
            >
              <div className="text-sm font-medium leading-snug break-words">{a.name}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">
                  {a.phase?.name || "Sin fase"}
                  {a.family ? ` › ${a.family.parentName ?? a.family.name}` : ""}
                </Badge>
                <span>{a.unit}</span>
                <span>· ref. Bs {fmt(a.unitPrice)}</span>
              </div>
            </button>
          ))}
          {searchData && searchData.totalCount > results.length && (
            <p className="p-2 text-[11px] text-muted-foreground">Mostrando {results.length} de {searchData.totalCount}. Agrega otra palabra para afinar.</p>
          )}
        </div>
      ) : (
        (mostUsed?.activities?.length ?? 0) > 0 && (
          <div>
            <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-2">
              <Star className="w-3.5 h-3.5" /> Más usadas
            </p>
            <div className="flex flex-wrap gap-2">
              {mostUsed!.activities.map((a) => (
                <Button
                  key={a.id}
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-auto py-1 px-2 text-[11px] sm:text-xs max-w-full whitespace-normal text-left"
                  onClick={() => pick(a)}
                  title={`${a.name} (${a.unit}) — ${a.phase?.name ?? ""}`}
                  data-testid={`most-used-${a.id}`}
                >
                  {a.name.length > 48 ? a.name.slice(0, 46) + "…" : a.name}
                </Button>
              ))}
            </div>
          </div>
        )
      )}

      {!searching && <ActivityCatalogBrowser onPick={pick} />}

      <div>
        <button
          type="button"
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" /> {showAdvanced ? "Ocultar opciones avanzadas" : "Opciones avanzadas"}
        </button>
        {showAdvanced && (
          <div className="mt-2">
            <label className="text-[11px] text-muted-foreground block mb-1">Limitar la búsqueda a una fase</label>
            <select
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value)}
              className="w-full sm:w-auto p-2 border rounded text-sm"
            >
              <option value="">Todas las fases</option>
              {phases?.map((p) => (
                <option key={p.id} value={String(p.id)}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
