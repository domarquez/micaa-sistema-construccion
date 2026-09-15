import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { titleCaseMaterial } from "@/lib/lista";

type MaterialRow = {
  id: number;
  name: string;
  unit: string;
  price: string | number;
  categoryId?: number;
  category?: { id: number; name: string };
  rebasedPrice?: string | number | null;
  lastUpdated?: string;
};

const SUGGESTIONS = [
  { q: "corrugado 1/2", label: "corrugado 1/2" },
  { q: "cemento", label: "cemento" },
  { q: "tajibo", label: "tajibo" },
  { q: "platina", label: "platina" },
];

function priceOf(m: MaterialRow): number {
  const reb = m.rebasedPrice != null ? parseFloat(String(m.rebasedPrice)) : NaN;
  if (Number.isFinite(reb) && reb > 0) return reb;
  return parseFloat(String(m.price)) || 0;
}

function formatBs(n: number) {
  return `Bs ${n.toLocaleString("es-BO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function PriceHome() {
  const [, setLocation] = useLocation();
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");

  const { data: materials = [], isLoading } = useQuery<MaterialRow[]>({
    queryKey: ["/api/public/materials", { q: submitted || undefined, limit: 24 }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (submitted) params.set("q", submitted);
      params.set("limit", "24");
      const res = await fetch(`/api/public/materials?${params}`);
      if (!res.ok) throw new Error("No se pudo cargar materiales");
      return res.json();
    },
    staleTime: 60_000,
  });

  const rows = useMemo(() => materials.slice(0, 8), [materials]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const next = q.trim();
    setSubmitted(next);
    if (next) setLocation(`/materiales?q=${encodeURIComponent(next)}`);
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-[32px] font-semibold tracking-tight text-[var(--micaa-fg)]">MICAA</h1>
        <p className="mt-1 text-[14px] text-[var(--micaa-muted)]">
          Precios de materiales en Bolivia
        </p>
      </div>

      <form onSubmit={onSearch} className="mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar material…"
          className="h-11 w-full rounded-xl border border-[var(--micaa-line)] bg-white px-4 text-[14px] text-[var(--micaa-fg)] outline-none focus:border-[var(--micaa-accent)]"
          autoFocus
        />
      </form>

      <div className="mb-8 flex flex-wrap justify-center gap-2 text-[12px]">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.q}
            type="button"
            onClick={() => {
              setQ(s.q);
              setSubmitted(s.q);
              setLocation(`/materiales?q=${encodeURIComponent(s.q)}`);
            }}
            className="rounded-full border border-[var(--micaa-line)] px-3 py-1 text-[var(--micaa-muted)] hover:border-[var(--micaa-accent)] hover:text-[var(--micaa-fg)]"
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="divide-y divide-[var(--micaa-line)] border-t border-[var(--micaa-line)]">
        {isLoading && (
          <p className="py-6 text-center text-[12px] text-[var(--micaa-muted)]">Cargando…</p>
        )}
        {!isLoading &&
          rows.map((m) => (
            <Link
              key={m.id}
              href={`/materiales/${m.id}`}
              className="flex items-baseline justify-between gap-4 py-3 hover:bg-black/[0.02]"
            >
              <div className="min-w-0 text-left">
                <div className="truncate text-[14px] text-[var(--micaa-fg)]">
                  {titleCaseMaterial(m.name)}
                </div>
                <div className="mt-0.5 text-[12px] text-[var(--micaa-muted)]">
                  {m.unit}
                  {m.category?.name ? ` · ${titleCaseMaterial(m.category.name)}` : ""}
                  {" · estimada"}
                </div>
              </div>
              <div className="shrink-0 text-[20px] font-medium tabular-nums text-[var(--micaa-fg)]">
                {formatBs(priceOf(m))}
              </div>
            </Link>
          ))}
        {!isLoading && rows.length === 0 && (
          <p className="py-6 text-center text-[12px] text-[var(--micaa-muted)]">
            No hay materiales para mostrar.
          </p>
        )}
      </div>
    </div>
  );
}
