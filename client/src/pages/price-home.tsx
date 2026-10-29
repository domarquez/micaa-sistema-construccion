import { useEffect, useMemo, useState } from "react";
import { ListSkeleton } from "@/components/ui/states";
import { formatBs, formatUnit } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { titleCaseMaterial } from "@/lib/lista";
import { getCity } from "@/lib/city";
import { PublicAdSense } from "@/components/ads/AdSenseSlot";

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

type CityFactor = {
  city: string;
  materialsFactor: string | number;
  isActive?: boolean;
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

export default function PriceHome({ afterSearch }: { afterSearch?: React.ReactNode } = {}) {
  const [, setLocation] = useLocation();
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [city, setCityState] = useState(() => getCity());

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
    queryKey: ["/api/public/materials", { q: submitted || undefined, limit: 100, city }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (submitted) params.set("q", submitted);
      params.set("limit", "100");
      const res = await fetch(`/api/public/materials?${params}`);
      if (!res.ok) throw new Error("No se pudo cargar materiales");
      return res.json();
    },
    staleTime: 60_000,
  });

  const rows = useMemo(
    () => (submitted ? materials : materials.slice(0, 8)),
    [materials, submitted],
  );

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const next = q.trim();
    setSubmitted(next);
    if (next) setLocation(`/materiales?q=${encodeURIComponent(next)}`);
  };

  return (
    <div className="blueprint-hero min-h-[40vh]">
      <div className="mx-auto max-w-4xl px-4 pb-12 pt-8 sm:pt-10">
        <div className="mb-6 text-center sm:mb-8">
          <span className="stamp">Beta</span>
          <h1 className="text-hero mt-3 text-[var(--micaa-fg)]">MICAA</h1>
          <div className="accent-rule mx-auto mt-3" />
          <p className="mt-3 text-base text-[var(--micaa-muted)]">
            Precios de materiales en Bolivia
          </p>
          <p className="mt-1 text-sm text-[var(--micaa-muted)]">
            Vista: {city}
            {materialsFactor !== 1 ? ` · factor mat. ×${materialsFactor.toFixed(2)}` : " · base SCZ"}
          </p>
        </div>

        <form onSubmit={onSearch} className="mb-4">
          <div className="search-micaa">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar material…"
              autoFocus
              aria-label="Buscar material"
            />
          </div>
        </form>

        <div className="mb-6 flex flex-wrap justify-center gap-2 text-sm">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.q}
              type="button"
              onClick={() => {
                setQ(s.q);
                setSubmitted(s.q);
                setLocation(`/materiales?q=${encodeURIComponent(s.q)}`);
              }}
              className="chip-micaa hover:border-[var(--micaa-accent)] hover:text-[var(--micaa-accent)] hover:bg-[var(--micaa-accent-soft)]"
            >
              {s.label}
            </button>
          ))}
        </div>

        {afterSearch}
        <PublicAdSense className="max-w-3xl mx-auto" />

        <div className="mb-2 mt-2 flex items-center justify-between px-1">
          <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--micaa-muted)]">
            {submitted ? "Resultados" : "Destacados"}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {isLoading && <ListSkeleton rows={6} />}
          {!isLoading &&
            rows.map((m) => (
              <Link
                key={m.id}
                href={`/materiales/${m.id}`}
                className="row-accent flex items-center justify-between gap-3 px-4 py-3.5 pl-5 transition-colors hover:bg-black/[0.02]"
              >
                <div className="min-w-0 text-left">
                  <div className="line-clamp-2 text-[14.5px] font-semibold tracking-tight text-[var(--micaa-fg)]">
                    {titleCaseMaterial(m.name)}
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--micaa-muted)]">
                    {formatUnit(m.unit)}
                    {m.category?.name ? ` · ${titleCaseMaterial(m.category.name)}` : ""}
                    {" · estimada"}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="measure text-[18px] font-semibold text-[var(--micaa-fg)]">
                    {formatBs(priceOf(m) * materialsFactor)}
                  </div>
                  <div className="text-[11px] text-[var(--micaa-muted)]">Bs</div>
                </div>
              </Link>
            ))}
          {!isLoading && rows.length === 0 && (
            <p className="py-6 text-center text-sm text-[var(--micaa-muted)]">
              No hay materiales para mostrar.
            </p>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/materiales"
            className="btn-micaa-primary"
            data-testid="link-ver-todos"
          >
            Ver todos los materiales
          </Link>
        </div>

        <section
          className="mt-8 rounded-[var(--micaa-radius)] border border-[var(--micaa-line)] bg-[var(--micaa-bg-elev)] p-4 text-left sm:p-5"
          data-testid="block-registra-empresa"
        >
          <h2 className="text-base font-semibold text-[var(--micaa-fg)] sm:text-lg">
            ¿Tenés una empresa de construcción o ferretería?
          </h2>
          <p className="mt-2 text-sm text-[var(--micaa-muted)]">
            Registrala gratis (beta hasta el 31/01/2027): publicidad, carga de tus precios y empresa destacada.
          </p>
          <Link
            href="/anunciar"
            className="btn-micaa-primary mt-3 inline-flex"
            data-testid="button-registra-empresa-home"
          >
            Registrá tu empresa gratis
          </Link>
        </section>

        <section className="tech-card mt-10 p-5 text-left">
          <h2 className="font-display text-lg font-semibold text-[var(--micaa-fg)]">¿Qué es MICAA?</h2>
          <div className="accent-rule mt-2" />
          <p className="mt-3 text-base text-[var(--micaa-muted)]">
            MICAA junta precios reales de materiales de construcción en Bolivia: catálogo base, cotizaciones de
            ferreterías y precios que publica la gente. Buscá un material, compará fuentes y armá tu lista.
            Cuando quieras, entrá con tu WhatsApp para guardar proyectos y presupuestos.
          </p>
        </section>
      </div>
    </div>
  );
}
