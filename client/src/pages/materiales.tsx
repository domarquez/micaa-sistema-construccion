import { useEffect, useMemo, useState } from "react";
import { ListSkeleton } from "@/components/ui/states";
import { formatBs, formatUnit, relativeDays } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { titleCaseMaterial } from "@/lib/lista";
import { getCity } from "@/lib/city";
import { PublicAdSense } from "@/components/ads/AdSenseSlot";
import { track } from "@/lib/analytics";

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
    const term = q.trim();
    if (term.length < 2) return;
    const t = window.setTimeout(() => {
      track("material_search", { q: term.slice(0, 120), source: "materiales" });
    }, 700);
    return () => window.clearTimeout(t);
  }, [q]);

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
    queryKey: ["/api/public/materials", { q, limit: 100, city }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      params.set("limit", "100");
      const res = await fetch(`/api/public/materials?${params}`);
      if (!res.ok) throw new Error("Error al cargar");
      return res.json();
    },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-title-fluid text-[var(--micaa-fg)]">Materiales</h1>
      <div className="accent-rule mt-2" />
      <PublicAdSense className="max-w-3xl" />
      <p className="mt-2 text-sm text-[var(--micaa-muted)]">
        Precios orientativos para {city}
        {materialsFactor !== 1 ? ` (×${materialsFactor.toFixed(2)} vs SCZ)` : ""}
      </p>
      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <div className="search-micaa">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar material…"
            aria-label="Buscar material"
          />
        </div>
      </form>

      <div className="mt-4 flex flex-col gap-2">
        {isLoading && (
          <ListSkeleton rows={6} />
        )}
        {!isLoading && materials.length === 0 && (
          <p className="py-6 text-center text-sm text-[var(--micaa-muted)]">Sin resultados.</p>
        )}
        {materials.map((m) => (
          <Link
            key={m.id}
            href={`/materiales/${m.id}`}
            className="row-accent flex items-center justify-between gap-3 px-4 py-3.5 pl-5 transition-colors hover:bg-black/[0.02]"
          >
            <div className="min-w-0">
              <div className="line-clamp-2 text-[14.5px] font-semibold tracking-tight">
                {titleCaseMaterial(m.name)}
              </div>
              <div className="mt-0.5 text-xs text-[var(--micaa-muted)]">
                {formatUnit(m.unit)}
                {m.category?.name ? ` · ${titleCaseMaterial(m.category.name)}` : ""}
              </div>
            </div>
            <div className="measure shrink-0 text-[18px] font-semibold">
              {formatBs(priceOf(m) * materialsFactor)}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
