import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { titleCaseMaterial } from "@/lib/lista";
import { getCity } from "@/lib/city";

type MaterialRow = {
  id: number;
  name: string;
  unit: string;
  price: string | number;
  rebasedPrice?: string | number | null;
  category?: { name: string };
  lastUpdated?: string;
};

type CityFactor = {
  city: string;
  materialsFactor: string | number;
};

function priceOf(m: MaterialRow): number {
  const reb = m.rebasedPrice != null ? parseFloat(String(m.rebasedPrice)) : NaN;
  if (Number.isFinite(reb) && reb > 0) return reb;
  return parseFloat(String(m.price)) || 0;
}

function formatBs(n: number) {
  return `Bs ${n.toLocaleString("es-BO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function matchFactor(factors: CityFactor[], city: string): number {
  const aliases: Record<string, string[]> = {
    Beni: ["Beni", "Trinidad"],
    Pando: ["Pando", "Cobija"],
    "Potosí": ["Potosí", "Potosi"],
  };
  const names = (aliases[city] || [city]).map((x) => x.toLowerCase());
  const hit = factors.find((f) => names.includes(String(f.city || "").toLowerCase()));
  if (!hit) return 1;
  const n = parseFloat(String(hit.materialsFactor));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export default function MaterialesPage() {
  const search = useSearch();
  const initial = new URLSearchParams(search).get("q") || "";
  const [q, setQ] = useState(initial);
  const [city, setCityState] = useState(() => getCity());

  useEffect(() => {
    setQ(initial);
  }, [initial]);

  useEffect(() => {
    const sync = () => setCityState(getCity());
    window.addEventListener("storage", sync);
    window.addEventListener("micaa-city", sync as EventListener);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("micaa-city", sync as EventListener);
    };
  }, []);

  const { data: factors = [] } = useQuery<CityFactor[]>({
    queryKey: ["/api/city-factors"],
    queryFn: async () => {
      const res = await fetch("/api/city-factors");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 300_000,
  });

  const materialsFactor = useMemo(() => matchFactor(factors, city), [factors, city]);

  const { data: materials = [], isLoading } = useQuery<MaterialRow[]>({
    queryKey: ["/api/public/materials", { q, limit: 50, city }],
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
      <p className="mt-1 text-[12px] text-[var(--micaa-muted)]">
        Precios orientativos para {city}
        {materialsFactor !== 1 ? ` (×${materialsFactor.toFixed(2)} vs SCZ)` : ""}
      </p>
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
            <div className="shrink-0 text-[20px] font-medium tabular-nums">
              {formatBs(priceOf(m) * materialsFactor)}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
