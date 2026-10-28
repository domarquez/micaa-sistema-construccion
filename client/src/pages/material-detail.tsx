import { useEffect, useMemo, useState } from "react";
import { formatBs, formatUnit, relativeDays } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { addListaItem, titleCaseMaterial } from "@/lib/lista";
import { getCity } from "@/lib/city";
import { useToast } from "@/hooks/use-toast";
import { ListSkeleton } from "@/components/ui/states";
import { track } from "@/lib/analytics";

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
  linkUnlocked?: boolean;
  verified?: boolean;
  public?: boolean;
  provenanceName?: string | null;
  supplierPhone?: string | null;
  provenanceDate?: string | null;
  source?: "whatsapp" | "market" | "person" | "supplier" | "base";
  weightKg?: number | null;
  pricePerKg?: number | null;
  estimated?: boolean;
};

type Payload = {
  materialId: number;
  name: string;
  unit: string;
  weightKg?: number | null;
  pricePerKg?: number | null;
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


function formatKg(n: number) {
  return `${n.toLocaleString("es-BO", { minimumFractionDigits: 0, maximumFractionDigits: 4 })} kg`;
}

function resolvePricePerKg(q: Quote, materialWeightKg?: number | null): number | null {
  if (q.pricePerKg != null && Number.isFinite(q.pricePerKg)) return q.pricePerKg;
  const w = q.weightKg ?? materialWeightKg;
  if (w == null || w <= 0 || !Number.isFinite(q.price)) return null;
  return Math.round((q.price / w) * 100) / 100;
}

function ageLabel(d?: number) {
  return relativeDays(d);
}

function formatProvenanceDate(iso?: string | null): string | null {
  if (!iso) return null;
  // Keep YYYY-MM-DD as-is; also accept full ISO
  const day = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

function procedenciaLine(q: Quote): string | null {
  if (q.kind === "base") return null;
  const name = q.provenanceName || q.label;
  if (!name) return null;
  const parts = [name, q.city, formatProvenanceDate(q.provenanceDate)].filter(
    Boolean,
  ) as string[];
  if (parts.length === 0) return null;
  return `Procedencia: ${parts.join(" · ")}`;
}

/** Colapsa duplicados exactos (misma fuente, mismo precio, mismo día). */
function dedupeQuotes(list: Quote[]): Quote[] {
  const seen = new Set<string>();
  return list.filter((q) => {
    const k = [q.kind, q.label, q.price, q.ageDays ?? "", q.provenanceDate ?? "", q.supplierId ?? q.userId ?? ""].join("|");
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Detalle para distinguir dos cotizaciones con la misma etiqueta. */
function distinguisher(q: Quote, i: number, list: Quote[]): string | null {
  const twins = list.filter((x) => x.label === q.label);
  if (twins.length < 2) return null;
  const n = twins.indexOf(q) + 1;
  return `cotización ${n} de ${twins.length}`;
}

function isSinIva(q: Quote): boolean {
  return q.source === "market" || /sin iva/i.test(q.label || "");
}

function IvaBadge({ q }: { q: Quote }) {
  const sin = isSinIva(q);
  return (
    <span
      className={`rounded-full border px-1.5 py-0.5 text-xs leading-none ${sin ? "border-amber-300 bg-amber-50 text-amber-900" : "border-[var(--micaa-line)] bg-white text-[var(--micaa-muted)]"}`}
      title={sin ? "Precio estimado sin factura" : "Precio con factura (IVA incluido)"}
    >
      {sin ? "sin IVA" : "con IVA"}
    </span>
  );
}

type MaterialSupplier = {
  id: number;
  companyName: string;
  city?: string | null;
  phoneNormalized?: string | null;
  isVerified: boolean;
  isFeatured?: boolean;
  featuredActive?: boolean;
  price: number;
  unit?: string | null;
};

/** Divulgación progresiva: cerrado por defecto, muestra "Ver N proveedores". */
function MaterialSuppliers({ materialId }: { materialId: string | number }) {
  const [open, setOpen] = useState(false);
  const { data = [] } = useQuery<MaterialSupplier[]>({
    queryKey: [`/api/public/materials/${materialId}/suppliers`],
  });
  if (!data.length) return null;
  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) {
              track("ver_proveedores", {
                materialId: Number(materialId),
                count: data.length,
                companies: data.slice(0, 8).map((s) => s.companyName),
              });
              data.slice(0, 5).forEach((s) =>
                track("company_view", {
                  supplierId: s.id,
                  companyName: s.companyName,
                  materialId: Number(materialId),
                  featured: !!s.featuredActive,
                }),
              );
            }
            return next;
          });
        }}
        className="text-base font-medium text-[var(--micaa-accent)]"
        aria-expanded={open}
      >
        {open ? "Ocultar proveedores" : `Ver ${data.length} ${data.length === 1 ? "proveedor" : "proveedores"}`}
      </button>
      {open && (
        <ul className="mt-2 divide-y divide-[var(--micaa-line)] border-y border-[var(--micaa-line)] text-sm">
          {data.map((s) => (
            <li key={`${s.id}-${s.price}`} className="flex items-baseline justify-between gap-3 py-2">
              <div className="min-w-0">
                <span className="text-[var(--micaa-fg)]">{s.companyName}</span>
                {s.featuredActive && (
                  <span className="ml-2 rounded-full bg-[var(--micaa-accent)] px-1.5 py-0.5 text-[10px] font-medium text-white">
                    Destacado
                  </span>
                )}
                {!s.isVerified && <span className="ml-2 text-xs text-[var(--micaa-muted)]">sin verificar</span>}
                <div className="text-[var(--micaa-muted)]">
                  {s.city}
                  {s.phoneNormalized && /^591[67]/.test(s.phoneNormalized) && (
                    <>
                      {" · "}
                      <a href={`https://wa.me/${s.phoneNormalized}`} target="_blank" rel="noreferrer" className="text-[var(--micaa-accent)]">
                        WhatsApp
                      </a>
                    </>
                  )}
                </div>
              </div>
              <span className="shrink-0 tabular-nums">{formatBs(s.price)}</span>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          <Link href="/empresas" className="text-[var(--micaa-muted)] hover:text-[var(--micaa-fg)]">
            Ver todas las empresas →
          </Link>
          <Link href="/anunciar" className="text-[var(--micaa-accent)] hover:underline">
            Registrá tu empresa (gratis hasta ene 2027)
          </Link>
        </div>
      )}
    </div>
  );
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

  const quotes = useMemo(() => dedupeQuotes(data?.quotes || []), [data?.quotes]);
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
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <ListSkeleton rows={4} />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 text-center">
        <p className="text-base text-[var(--micaa-muted)]">No se encontró el material.</p>
        <Link href="/materiales" className="mt-4 inline-block text-[var(--micaa-accent)]">
          Volver al catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-10">
      <div className="min-w-0">
      <Link href="/materiales" className="text-sm text-[var(--micaa-muted)] hover:text-[var(--micaa-fg)]">
        ← Materiales
      </Link>
      <h1 className="mt-3 text-[20px] font-semibold text-[var(--micaa-fg)]">
        {titleCaseMaterial(data.name)}
        <span className="font-normal text-[var(--micaa-muted)]"> · {formatUnit(data.unit)}</span>
      </h1>
      <p className="mt-1 text-sm text-[var(--micaa-muted)]">
        {titleCaseMaterial(data.category)}
        {data.catalogAgeDays ? ` · catálogo ${relativeDays(data.catalogAgeDays)}` : ""}
        {` · ${city}`}
        {data.cityFactor != null && data.cityFactor !== 1
          ? ` · factor mat. ×${Number(data.cityFactor).toFixed(2)}`
          : ""}
        {data.weightKg != null && data.weightKg > 0
          ? ` · peso ${formatKg(data.weightKg)}`
          : ""}
      </p>

      <div className="mt-6 divide-y divide-[var(--micaa-line)] border-y border-[var(--micaa-line)]">
        {quotes.map((q, i) => {
          const fresh = (q.ageDays ?? 999) <= 21 && q.kind !== "base";
          const procedencia = procedenciaLine(q);
          const showLink = !!(q.linkUnlocked && q.link);
          return (
            <label
              key={`${q.kind}-${q.supplierId ?? q.userId ?? "base"}-${i}`}
              className="flex cursor-pointer items-start gap-3 py-3"
            >
              <input
                type="radio"
                name="quote"
                className="mt-1 h-4 w-4 shrink-0 accent-[var(--micaa-accent)]"
                checked={selected === i}
                onChange={() => setSelected(i)}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-base text-[var(--micaa-fg)]">
                      {fresh && (
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--micaa-ok)]"
                          title="Reciente"
                        />
                      )}
                      <span className="truncate">{q.label.replace(/\s*\(sin IVA\)/i, "")}</span>
                      <IvaBadge q={q} />
                      {(q.kind === "base" || q.estimated || q.source === "market") && (
                        <span className="text-sm text-[var(--micaa-muted)]">estimada</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-sm text-[var(--micaa-muted)]">
                      {[q.city, ageLabel(q.ageDays), distinguisher(q, i, quotes)].filter(Boolean).join(" · ")}
                    </div>
                    {procedencia && (
                      <div className="mt-0.5 text-sm text-[var(--micaa-muted)]">
                        {procedencia}
                        {showLink && (
                          <>
                            {" · "}
                            <a
                              href={q.link!}
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
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[20px] font-medium tabular-nums">
                      {formatBs(q.price)}
                    </div>
                    {(q.weightKg ?? data.weightKg) != null &&
                      (q.weightKg ?? data.weightKg)! > 0 && (
                        <div className="mt-0.5 text-sm text-[var(--micaa-muted)] tabular-nums">
                          peso {(q.weightKg ?? data.weightKg)!.toLocaleString("es-BO", {
                            maximumFractionDigits: 4,
                          })}{" "}
                          kg
                          {resolvePricePerKg(q, data.weightKg) != null
                            ? ` · ≈ ${formatBs(resolvePricePerKg(q, data.weightKg)!)}/kg`
                            : ""}
                        </div>
                      )}
                  </div>
                </div>
              </div>
            </label>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-[var(--micaa-muted)]">
        <strong className="font-medium text-[var(--micaa-fg)]">con IVA</strong>: precio con factura.{" "}
        <strong className="font-medium text-[var(--micaa-fg)]">sin IVA</strong>: estimado sin factura (MICAA Market).
      </p>
      {Number.isFinite(id) && id > 0 && <MaterialSuppliers materialId={id} />}
      </div>

      <aside className="mt-6 lg:sticky lg:top-20 lg:mt-10 lg:self-start lg:rounded-xl lg:border lg:border-[var(--micaa-line)] lg:bg-white lg:p-4">
      <div className="flex items-center gap-3">
        <input
          type="number"
          min={0.01}
          step="any"
          value={qty}
          onChange={(e) => setQty(parseFloat(e.target.value) || 1)}
          className="h-10 w-20 rounded-lg border border-[var(--micaa-line)] px-3 text-base"
        />
        <button
          type="button"
          onClick={add}
          className="h-10 flex-1 rounded-lg bg-[var(--micaa-accent)] px-4 text-base font-medium text-[var(--micaa-accent-fg)]"
        >
          Agregar a la lista
        </button>
      </div>
      {active && (
        <p className="mt-2 text-sm text-[var(--micaa-muted)]">
          Vas a usar el precio de <strong className="text-[var(--micaa-fg)]">{active.label}</strong>
          {" "}({formatBs(active.price)}), no un promedio.
        </p>
      )}
      </aside>
    </div>
  );
}
