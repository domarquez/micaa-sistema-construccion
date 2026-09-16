import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { addListaItem, titleCaseMaterial } from "@/lib/lista";
import { getCity } from "@/lib/city";
import { useToast } from "@/hooks/use-toast";

type Quote = {
  kind: "base" | "person" | "supplier";
  label: string;
  price: number;
  ageDays?: number;
  city?: string | null;
  userId?: number;
  supplierId?: number;
  link?: string | null;
  linkType?: string | null;
  verified?: boolean;
  public?: boolean;
};

type Payload = {
  materialId: number;
  name: string;
  unit: string;
  category: string;
  basePrice: number;
  baseLabel: string;
  catalogAgeDays: number;
  quotes: Quote[];
  pRed: number | null;
  confidence: string;
  city?: string | null;
  cityFactor?: number | null;
};

function formatBs(n: number) {
  return `Bs ${n.toLocaleString("es-BO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function ageLabel(d?: number) {
  if (d == null) return "";
  if (d <= 0) return "hace 0 d";
  return `hace ${d} d`;
}

export default function MaterialDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id || "", 10);
  const { toast } = useToast();
  const [selected, setSelected] = useState(0);
  const [qty, setQty] = useState(1);

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

  const { data, isLoading, error } = useQuery<Payload>({
    queryKey: ["/api/public/material-price", id, city],
    queryFn: async () => {
      const res = await fetch(
        `/api/public/material-price/${id}?ciudad=${encodeURIComponent(city)}`,
      );
      if (!res.ok) throw new Error("Material no encontrado");
      return res.json();
    },
    enabled: Number.isFinite(id),
  });

  const quotes = data?.quotes || [];
  const active = quotes[selected] || quotes[0];

  const defaultIndex = useMemo(() => {
    if (!quotes.length) return 0;
    const supplier = quotes.findIndex((q) => q.kind === "supplier");
    if (supplier >= 0) return supplier;
    const person = quotes.findIndex((q) => q.kind === "person");
    if (person >= 0) return person;
    return quotes.findIndex((q) => q.kind === "base");
  }, [quotes]);

  useEffect(() => {
    if (quotes.length) setSelected(defaultIndex < 0 ? 0 : defaultIndex);
  }, [data?.materialId, defaultIndex, quotes.length]);

  const add = () => {
    if (!data || !active) return;
    addListaItem({
      materialId: data.materialId,
      sourceKind: active.kind,
      sourceId: active.supplierId ?? active.userId ?? null,
      qty,
      unitPriceSnapshot: active.price,
      nameSnapshot: data.name,
      unitSnapshot: data.unit,
      sourceLabelSnapshot: active.label,
    });
    window.dispatchEvent(new Event("micaa-lista"));
    toast({ title: "Agregado a la lista", description: active.label });
  };

  if (isLoading) {
    return <p className="p-8 text-center text-[12px] text-[var(--micaa-muted)]">Cargando…</p>;
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 text-center">
        <p className="text-[14px] text-[var(--micaa-muted)]">No se encontró el material.</p>
        <Link href="/materiales" className="mt-4 inline-block text-[var(--micaa-accent)]">
          Volver al catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <Link href="/materiales" className="text-[12px] text-[var(--micaa-muted)] hover:text-[var(--micaa-fg)]">
        ← Materiales
      </Link>
      <h1 className="mt-3 text-[20px] font-semibold text-[var(--micaa-fg)]">
        {titleCaseMaterial(data.name)}
        <span className="font-normal text-[var(--micaa-muted)]"> · {data.unit}</span>
      </h1>
      <p className="mt-1 text-[12px] text-[var(--micaa-muted)]">
        {titleCaseMaterial(data.category)}
        {data.catalogAgeDays ? ` · catálogo hace ${data.catalogAgeDays} d` : ""}
        {` · ${city}`}
        {data.cityFactor != null && data.cityFactor !== 1
          ? ` · factor mat. ×${Number(data.cityFactor).toFixed(2)}`
          : ""}
      </p>

      <div className="mt-6 divide-y divide-[var(--micaa-line)] border-y border-[var(--micaa-line)]">
        {quotes.map((q, i) => {
          const fresh = (q.ageDays ?? 999) <= 21 && q.kind !== "base";
          return (
            <label
              key={`${q.kind}-${q.supplierId ?? q.userId ?? "base"}-${i}`}
              className="flex cursor-pointer items-start gap-3 py-3"
            >
              <input
                type="radio"
                name="quote"
                className="mt-1 accent-[var(--micaa-accent)]"
                checked={selected === i}
                onChange={() => setSelected(i)}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[14px] text-[var(--micaa-fg)]">
                      {fresh && (
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--micaa-ok)]"
                          title="Reciente"
                        />
                      )}
                      <span className="truncate">{q.label}</span>
                      {q.kind === "base" && (
                        <span className="text-[12px] text-[var(--micaa-muted)]">estimada</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[12px] text-[var(--micaa-muted)]">
                      {[q.city, ageLabel(q.ageDays)].filter(Boolean).join(" · ")}
                      {q.link && (
                        <>
                          {" · "}
                          <a
                            href={q.link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[var(--micaa-accent)]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {q.linkType === "whatsapp"
                              ? "WhatsApp"
                              : q.linkType === "website"
                                ? "Web"
                                : "Ver"}
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-[20px] font-medium tabular-nums">
                    {formatBs(q.price)}
                  </div>
                </div>
              </div>
            </label>
          );
        })}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <input
          type="number"
          min={0.01}
          step="any"
          value={qty}
          onChange={(e) => setQty(parseFloat(e.target.value) || 1)}
          className="h-10 w-20 rounded-lg border border-[var(--micaa-line)] px-3 text-[14px]"
        />
        <button
          type="button"
          onClick={add}
          className="h-10 flex-1 rounded-lg bg-[var(--micaa-accent)] px-4 text-[14px] font-medium text-[var(--micaa-accent-fg)]"
        >
          Agregar a la lista
        </button>
      </div>
      {active && (
        <p className="mt-2 text-[12px] text-[var(--micaa-muted)]">
          Usarás el precio de <strong className="text-[var(--micaa-fg)]">{active.label}</strong>
          {" "}({formatBs(active.price)}), no un promedio.
        </p>
      )}
    </div>
  );
}
