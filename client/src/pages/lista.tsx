import { useEffect, useState } from "react";
import { formatBs, formatUnit, relativeDays } from "@/lib/format";
import { Link } from "wouter";
import {
  loadLista,
  updateListaQty,
  removeListaItem,
  listaTotal,
  titleCaseMaterial,
  type ListaState,
} from "@/lib/lista";
import { useAuth } from "@/hooks/useAuth";
import { getCity } from "@/lib/city";


export default function ListaPage() {
  const { isAuthenticated } = useAuth();
  const [lista, setLista] = useState<ListaState>(() => loadLista());
  const [city, setCityState] = useState(() => getCity());

  useEffect(() => {
    const sync = () => setLista(loadLista());
    window.addEventListener("micaa-lista", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("micaa-lista", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    const sync = () => setCityState(getCity());
    window.addEventListener("storage", sync);
    window.addEventListener("micaa-city", sync as EventListener);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("micaa-city", sync as EventListener);
    };
  }, []);

  const total = listaTotal(lista.items);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-[20px] font-semibold text-[var(--micaa-fg)]">Mi lista</h1>
      <p className="mt-1 text-sm text-[var(--micaa-muted)]">
        {isAuthenticated
          ? "Guardada en este dispositivo. La sincronización en cuenta llega en el siguiente paso."
          : "Se guarda en este dispositivo. Para no perderla, entrá a tu cuenta más tarde."}
        {" "}Ciudad preferida: <strong className="text-[var(--micaa-fg)]">{city}</strong>.
      </p>

      <div className="mt-6 divide-y divide-[var(--micaa-line)] border-y border-[var(--micaa-line)]">
        {lista.items.length === 0 && (
          <p className="py-8 text-center text-sm text-[var(--micaa-muted)]">
            Todavía no hay ítems.{" "}
            <Link href="/materiales" className="text-[var(--micaa-accent)]">
              Buscar materiales
            </Link>
          </p>
        )}
        {lista.items.map((item) => (
          <div key={item.id} className="flex items-start gap-3 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-base text-[var(--micaa-fg)]">
                {titleCaseMaterial(item.nameSnapshot)}
              </div>
              <div className="mt-0.5 text-sm text-[var(--micaa-muted)]">
                {formatUnit(item.unitSnapshot)} · {item.sourceLabelSnapshot} · {formatBs(item.unitPriceSnapshot)}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={0.01}
                  step="any"
                  value={item.qty}
                  onChange={(e) => {
                    const next = updateListaQty(item.id, parseFloat(e.target.value) || 0);
                    setLista(next);
                    window.dispatchEvent(new Event("micaa-lista"));
                  }}
                  className="h-8 w-20 rounded-md border border-[var(--micaa-line)] px-2 text-base"
                />
                <button
                  type="button"
                  onClick={() => {
                    const next = removeListaItem(item.id);
                    setLista(next);
                    window.dispatchEvent(new Event("micaa-lista"));
                  }}
                  className="text-sm text-[var(--micaa-muted)] hover:text-[var(--micaa-fg)]"
                >
                  Quitar
                </button>
              </div>
            </div>
            <div className="shrink-0 text-base font-medium tabular-nums">
              {formatBs(item.qty * item.unitPriceSnapshot)}
            </div>
          </div>
        ))}
      </div>

      {lista.items.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <Link href="/budgets" className="text-sm text-[var(--micaa-accent)]">
            Convertir en presupuesto de obra
          </Link>
          <div className="text-right">
            <div className="text-sm text-[var(--micaa-muted)]">Total</div>
            <div className="text-[20px] font-semibold tabular-nums">{formatBs(total)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
