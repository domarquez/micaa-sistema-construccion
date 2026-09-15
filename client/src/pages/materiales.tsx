import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { titleCaseMaterial } from "@/lib/lista";

type MaterialRow = {
  id: number;
  name: string;
  unit: string;
  price: string | number;
  rebasedPrice?: string | number | null;
  category?: { name: string };
  lastUpdated?: string;
};

function priceOf(m: MaterialRow): number {
  const reb = m.rebasedPrice != null ? parseFloat(String(m.rebasedPrice)) : NaN;
  if (Number.isFinite(reb) && reb > 0) return reb;
  return parseFloat(String(m.price)) || 0;
}

function formatBs(n: number) {
  return `Bs ${n.toLocaleString("es-BO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function MaterialesPage() {
  const search = useSearch();
  const initial = new URLSearchParams(search).get("q") || "";
  const [q, setQ] = useState(initial);

  useEffect(() => {
    setQ(initial);
  }, [initial]);

  const { data: materials = [], isLoading } = useQuery<MaterialRow[]>({
    queryKey: ["/api/public/materials", { q, limit: 50 }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      params.set("limit", "50");
      const res = await fetch(`/api/public/materials?${params}`);
      if (!res.ok) throw new Error("Error al cargar");
      return res.json();
    },
  });

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-[20px] font-semibold text-[var(--micaa-fg)]">Materiales</h1>
      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar material…"
          className="h-11 w-full rounded-xl border border-[var(--micaa-line)] bg-white px-4 text-[14px] outline-none focus:border-[var(--micaa-accent)]"
        />
      </form>

      <div className="mt-4 divide-y divide-[var(--micaa-line)] border-t border-[var(--micaa-line)]">
        {isLoading && (
          <p className="py-6 text-center text-[12px] text-[var(--micaa-muted)]">Cargando…</p>
        )}
        {!isLoading && materials.length === 0 && (
          <p className="py-6 text-center text-[12px] text-[var(--micaa-muted)]">Sin resultados.</p>
        )}
        {materials.map((m) => (
          <Link
            key={m.id}
            href={`/materiales/${m.id}`}
            className="flex items-baseline justify-between gap-4 py-3"
          >
            <div className="min-w-0">
              <div className="truncate text-[14px]">{titleCaseMaterial(m.name)}</div>
              <div className="mt-0.5 text-[12px] text-[var(--micaa-muted)]">
                {m.unit}
                {m.category?.name ? ` · ${titleCaseMaterial(m.category.name)}` : ""}
              </div>
            </div>
            <div className="shrink-0 text-[20px] font-medium tabular-nums">{formatBs(priceOf(m))}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
