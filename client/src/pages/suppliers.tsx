import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { formatBs, formatUnit } from "@/lib/format";
import { PublicAdSense } from "@/components/ads/AdSenseSlot";
import { track } from "@/lib/analytics";
import { waMicaaLink } from "@/lib/wa-micaa";

type Supplier = {
  id: number;
  companyName: string;
  speciality?: string | null;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  facebook?: string | null;
  isVerified: boolean;
  source?: string | null;
  categories?: string[] | null;
  branches?: { name?: string; address?: string; phone?: string }[] | null;
  priceListUrl?: string | null;
  phoneNormalized?: string | null;
  priceCount: number;
  isFeatured?: boolean;
  featuredActive?: boolean;
  adPlan?: string | null;
  logoUrl?: string | null;
  logoThumbUrl?: string | null;
};

type SupplierPrice = {
  materialId: number | null;
  materialName: string;
  price: number;
  unit?: string | null;
  city?: string | null;
  updatedAt?: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  acero: "Acero y fierro",
  cemento: "Cemento",
  ferreteria: "Ferretería",
  construccion_seco: "Construcción en seco",
  aridos: "Áridos",
  aislamiento: "Aislamiento / EPS",
  electrico: "Eléctrico",
  electricos: "Eléctrico",
  sanitario: "Sanitario y grifería",
  plomeria: "Sanitario y grifería",
  maderas: "Maderas",
  pinturas: "Pinturas",
  ceramicos: "Cerámicos",
  vidrios: "Vidrios",
  agua: "Agua",
  quincalleria: "Quincallería",
  herramientas: "Herramientas",
  general: "General",
};

const catLabel = (c: string) => CATEGORY_LABELS[c.toLowerCase()] ?? c;

function supplierCategories(s: Supplier): string[] {
  const list = (s.categories ?? []).filter(Boolean);
  if (list.length) return list;
  return s.speciality ? [s.speciality] : [];
}

function waLink(s: Supplier): string | null {
  const p = s.phoneNormalized || (s.whatsapp || "").replace(/\D/g, "");
  return waMicaaLink(p, s.companyName);
}

function SupplierPrices({ id }: { id: number }) {
  const { data = [], isLoading } = useQuery<SupplierPrice[]>({
    queryKey: [`/api/public/suppliers/${id}/prices`],
  });
  if (isLoading) return <p className="mt-2 text-sm text-[var(--micaa-muted)]">Cargando precios…</p>;
  if (!data.length) return <p className="mt-2 text-sm text-[var(--micaa-muted)]">Todavía sin precios.</p>;
  return (
    <ul className="mt-2 divide-y divide-[var(--micaa-line)] text-sm">
      {data.map((p, i) => (
        <li key={i} className="flex items-baseline justify-between gap-3 py-1.5">
          {p.materialId ? (
            <Link href={`/materiales/${p.materialId}`} className="min-w-0 truncate hover:text-[var(--micaa-accent)]">
              {p.materialName}
            </Link>
          ) : (
            <span className="min-w-0 truncate">{p.materialName}</span>
          )}
          <span className="measure shrink-0">
            {formatBs(p.price)}
            {p.unit ? <span className="text-[var(--micaa-muted)]"> / {formatUnit(p.unit)}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

function SupplierCard({ s }: { s: Supplier }) {
  const [open, setOpen] = useState(false);
  const wa = waLink(s);
  const cats = supplierCategories(s);
  const branches = (s.branches ?? []).filter((b) => b && (b.name || b.address));
  return (
    <li className="tech-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {(s.logoThumbUrl || s.logoUrl) ? (
            <img
              src={s.logoThumbUrl || s.logoUrl || ""}
              alt=""
              className="h-12 w-12 shrink-0 rounded-lg object-cover border border-[var(--micaa-line)] bg-white"
              loading="lazy"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[var(--micaa-line)] bg-[var(--micaa-accent-soft,#fff3e8)] text-sm font-semibold text-[var(--micaa-accent)]">
              {(s.companyName || "?").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
          <h2 className="font-display text-base font-semibold tracking-tight text-[var(--micaa-fg)]">{s.companyName}</h2>
          <p className="mt-0.5 text-sm text-[var(--micaa-muted)]">
            {[s.city, branches.length > 1 ? `${branches.length} sucursales` : s.address].filter(Boolean).join(" · ")}
          </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {s.featuredActive && (
            <span className="stamp !rounded-full !border-solid bg-[var(--micaa-accent)] !text-white !border-transparent px-2 py-0.5 text-xs font-medium">
              Destacada
            </span>
          )}
          {!s.isVerified && (
            <span className="rounded-full border border-[var(--micaa-line)] px-2 py-0.5 text-xs text-[var(--micaa-muted)]">
              sin verificar
            </span>
          )}
        </div>
      </div>
      {cats.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {cats.map((c) => (
            <span key={c} className="rounded-full bg-[var(--micaa-accent-soft,#fff3e8)] px-2 py-0.5 text-xs text-[var(--micaa-accent)]">
              {catLabel(c)}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-[var(--micaa-accent)]"
            onClick={() => track("whatsapp_click", { supplierId: s.id, name: s.companyName, source: "empresas" })}
          >
            WhatsApp
          </a>
        )}
        {s.website && (
          <a
            href={s.website.startsWith("http") ? s.website : `https://${s.website}`}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--micaa-accent)]"
          >
            Web
          </a>
        )}
        {s.priceListUrl && (
          <a href={s.priceListUrl} target="_blank" rel="noreferrer" className="text-[var(--micaa-accent)]">
            Lista de precios
          </a>
        )}
        {s.priceCount > 0 && (
          <button
            type="button"
            onClick={() => {
              setOpen((v) => {
                const next = !v;
                if (next) track("company_view", { supplierId: s.id, name: s.companyName, source: "empresas" });
                return next;
              });
            }}
            className="ml-auto text-[var(--micaa-fg)] underline-offset-2 hover:underline"
          >
            {open ? "Ocultar precios" : `Ver precios (${s.priceCount})`}
          </button>
        )}
      </div>
      {open && <SupplierPrices id={s.id} />}
    </li>
  );
}

export default function Suppliers() {
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [cat, setCat] = useState("");
  const [onlyPrices, setOnlyPrices] = useState(false);

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({ queryKey: ["/api/public/suppliers"] });

  const cities = useMemo(
    () => Array.from(new Set(suppliers.map((s) => s.city).filter(Boolean) as string[])).sort(),
    [suppliers],
  );
  const cats = useMemo(
    () => Array.from(new Set(suppliers.flatMap(supplierCategories))).sort((a, b) => catLabel(a).localeCompare(catLabel(b))),
    [suppliers],
  );

  const q = search.trim().toLowerCase();
  const filtered = suppliers
    .filter(
      (s) =>
        (!q || s.companyName.toLowerCase().includes(q) || (s.description ?? "").toLowerCase().includes(q)) &&
        (!city || s.city === city) &&
        (!cat || supplierCategories(s).includes(cat)) &&
        (!onlyPrices || s.priceCount > 0),
    )
    .slice()
    .sort((a, b) => Number(!!b.featuredActive) - Number(!!a.featuredActive));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-title-fluid text-[var(--micaa-fg)]">Empresas</h1>
      <div className="accent-rule mt-2" />
      <p className="mt-2 text-base text-[var(--micaa-muted)]">
        Buscá proveedores de materiales y mirá los precios que cotizaron.
      </p>
      <p className="mt-2 text-sm">
        <Link href="/anunciar" className="font-medium text-[var(--micaa-accent)] hover:underline">
          Registrá tu empresa gratis hasta el 31 de enero de 2027 →
        </Link>
      </p>
      <PublicAdSense className="mt-4" />

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-[1fr_12rem_14rem]">
        <input
          className="h-10 rounded-lg border border-[var(--micaa-line)] px-3 text-base"
          placeholder="Buscar empresa…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="h-10 rounded-lg border border-[var(--micaa-line)] px-3 text-base"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        >
          <option value="">Todas las ciudades</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          className="h-10 rounded-lg border border-[var(--micaa-line)] px-3 text-base"
          value={cat}
          onChange={(e) => setCat(e.target.value)}
        >
          <option value="">Todos los rubros</option>
          {cats.map((c) => (
            <option key={c} value={c}>{catLabel(c)}</option>
          ))}
        </select>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-[var(--micaa-muted)]">
        <input type="checkbox" className="h-4 w-4 shrink-0 accent-[var(--micaa-accent)]" checked={onlyPrices} onChange={(e) => setOnlyPrices(e.target.checked)} />
        Solo con precios
      </label>

      {isLoading ? (
        <ul className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <li key={i} className="h-28 animate-pulse rounded-xl bg-[var(--micaa-line)]" />
          ))}
        </ul>
      ) : (
        <>
          <p className="mt-6 text-sm text-[var(--micaa-muted)]">{filtered.length} empresas</p>
          <ul className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
            {filtered.map((s) => (
              <SupplierCard key={s.id} s={s} />
            ))}
          </ul>
          {filtered.length === 0 && (
            <p className="mt-6 text-base text-[var(--micaa-muted)]">No encontramos empresas con esos filtros.</p>
          )}
        </>
      )}
    </div>
  );
}
