import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { CITY_LIST, getCity, type MicaaCity } from "@/lib/city";
import { BETA_FREE_COPY } from "@/lib/micaa-contact";

const RUBROS: { value: string; label: string }[] = [
  { value: "ferreteria", label: "Ferretería" },
  { value: "cemento", label: "Cemento / hormigón" },
  { value: "acero", label: "Acero / fierro" },
  { value: "aridos", label: "Áridos / arena / grava" },
  { value: "electrico", label: "Eléctrico" },
  { value: "sanitario", label: "Sanitario / plomería" },
  { value: "pinturas", label: "Pinturas" },
  { value: "ceramicos", label: "Cerámicos / pisos" },
  { value: "maderas", label: "Maderas" },
  { value: "construccion_seco", label: "Construcción en seco" },
  { value: "aislamiento", label: "Aislamiento / EPS" },
  { value: "herramientas", label: "Herramientas" },
  { value: "pasto_sintetico", label: "Pasto sintético" },
  { value: "general", label: "General / varios" },
];

type Company = {
  id: number;
  companyName: string;
  speciality?: string | null;
  city: string;
  phone?: string | null;
  whatsapp?: string | null;
  description?: string | null;
  address?: string | null;
  website?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  email?: string | null;
  openingHours?: string | null;
  deliveryInfo?: string | null;
  nit?: string | null;
  productsServices?: string | null;
  logoUrl?: string | null;
  logoThumbUrl?: string | null;
  logoQualityWarn?: boolean | null;
  destacada?: boolean;
  featuredActive?: boolean;
  profileComplete?: boolean;
  priceCount?: number;
  claimStatus?: string | null;
  waPriceReminders?: boolean | null;
};

type Stats = {
  profileViews7: number;
  profileViews30: number;
  priceViews7: number;
  priceViews30: number;
  waClicks7: number;
  waClicks30: number;
};

async function authFetch(path: string, init?: RequestInit) {
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (!(init?.body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(path, { ...init, headers, credentials: "include" });
}

/** Miempresa: perfil completo, logo, stats, Destacada. Alta nueva → /anunciar. */
export default function SupplierRegistration() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [rubro, setRubro] = useState("ferreteria");
  const [city, setCityState] = useState<string>(() => getCity());
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [facebook, setFacebook] = useState("");
  const [instagram, setInstagram] = useState("");
  const [email, setEmail] = useState("");
  const [openingHours, setOpeningHours] = useState("");
  const [deliveryInfo, setDeliveryInfo] = useState("");
  const [nit, setNit] = useState("");
  const [productsServices, setProductsServices] = useState("");

  const fill = (data: Company) => {
    setCompany(data);
    setCompanyName(data.companyName || "");
    setRubro(data.speciality || "general");
    setCityState(data.city || getCity());
    setDescription(data.description || "");
    setAddress(data.address || "");
    setWebsite(data.website || "");
    setFacebook(data.facebook || "");
    setInstagram(data.instagram || "");
    setEmail(data.email || "");
    setOpeningHours(data.openingHours || "");
    setDeliveryInfo(data.deliveryInfo || "");
    setNit(data.nit || "");
    setProductsServices(data.productsServices || "");
    if (data.description || data.address || data.website || data.email) setShowMore(true);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await authFetch("/api/my-supplier-company");
        if (cancelled) return;
        if (res.status === 404) {
          setCompany(null);
          return;
        }
        if (!res.ok) return;
        fill(await res.json());
        const st = await authFetch("/api/my-supplier-company/stats");
        if (st.ok && !cancelled) setStats(await st.json());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, authLoading]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    setSaving(true);
    try {
      const res = await authFetch("/api/my-supplier-company", {
        method: "PUT",
        body: JSON.stringify({
          companyName: companyName.trim(),
          speciality: rubro,
          city,
          description: description.trim() || null,
          address: address.trim() || null,
          website: website.trim() || null,
          facebook: facebook.trim() || null,
          instagram: instagram.trim() || null,
          email: email.trim() || null,
          openingHours: openingHours.trim() || null,
          deliveryInfo: deliveryInfo.trim() || null,
          nit: nit.trim() || null,
          productsServices: productsServices.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "No se pudo guardar");
      fill(data);
      toast({
        title: "Perfil actualizado",
        description: data.destacada
          ? "Tu empresa está Destacada en la guía (perfil completo)."
          : "Completá logo, descripción y al menos 1 material para aparecer como Destacada.",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const onLogo = async (file: File | null) => {
    if (!file || !company) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await authFetch("/api/my-supplier-company/logo", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "No se pudo subir");
      if (data.company) fill(data.company);
      toast({
        title: "Logo actualizado",
        description: data.warning || "Listo.",
        variant: data.warning ? "destructive" : "default",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (authLoading || loading) {
    return <div className="mx-auto max-w-xl px-4 py-10 text-sm text-[var(--micaa-muted)]">Cargando…</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 text-center">
        <h1 className="text-[20px] font-semibold">Mi empresa</h1>
        <p className="mt-2 text-base text-[var(--micaa-muted)]">
          Entrá con WhatsApp para administrar tu perfil. {BETA_FREE_COPY}.
        </p>
        <Link href="/anunciar" className="mt-6 inline-flex h-10 items-center rounded-lg bg-[var(--micaa-accent)] px-4 text-base text-[var(--micaa-accent-fg)]">
          Registrarme
        </Link>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 text-center">
        <h1 className="text-[20px] font-semibold">Todavía no registraste tu empresa</h1>
        <p className="mt-2 text-base text-[var(--micaa-muted)]">{BETA_FREE_COPY}.</p>
        <Link href="/anunciar" className="mt-6 inline-flex h-10 items-center rounded-lg bg-[var(--micaa-accent)] px-4 text-base text-[var(--micaa-accent-fg)]">
          Ir a registrarme
        </Link>
      </div>
    );
  }

  const destacada = !!(company.destacada || company.featuredActive);

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold">Mi empresa</h1>
          <p className="mt-1 text-sm text-[var(--micaa-muted)]">
            WhatsApp: {company.phone || user.phone || "—"} (tu clave). {BETA_FREE_COPY}.
          </p>
        </div>
        {destacada ? (
          <span className="shrink-0 rounded-full bg-[var(--micaa-accent)] px-2.5 py-1 text-xs font-medium text-white">
            Destacada
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-[var(--micaa-line)] px-2.5 py-1 text-xs text-[var(--micaa-muted)]">
            Completá el perfil
          </span>
        )}
      </div>

      {!destacada && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Para ser <strong>Destacada</strong> (aparecer primero): logo + descripción (≥20 caracteres) + al menos 1 material con precio.
        </p>
      )}

      {stats && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ["Vistas perfil", stats.profileViews7, stats.profileViews30],
            ["Vistas precios", stats.priceViews7, stats.priceViews30],
            ["Clics WhatsApp", stats.waClicks7, stats.waClicks30],
          ].map(([label, d7, d30]) => (
            <div key={String(label)} className="rounded-xl border border-[var(--micaa-line)] bg-white p-3">
              <p className="text-[11px] text-[var(--micaa-muted)]">{label}</p>
              <p className="mt-1 text-lg font-semibold">{d7}</p>
              <p className="text-[11px] text-[var(--micaa-muted)]">7d · {d30} / 30d</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex items-center gap-4 rounded-xl border border-[var(--micaa-line)] bg-white p-4">
        {(company.logoThumbUrl || company.logoUrl) ? (
          <img src={company.logoThumbUrl || company.logoUrl || ""} alt="" className="h-16 w-16 rounded-lg object-cover border border-[var(--micaa-line)]" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-[var(--micaa-line)] text-xs text-[var(--micaa-muted)]">Sin logo</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Logo (cuadrado o rectangular)</p>
          <p className="text-xs text-[var(--micaa-muted)]">JPG/PNG/WebP. Si es chico avisamos, pero igual se guarda.</p>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => onLogo(e.target.files?.[0] || null)} />
          <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className="mt-2 h-9 rounded-lg border border-[var(--micaa-line)] px-3 text-sm disabled:opacity-60">
            {uploading ? "Subiendo…" : "Subir logo"}
          </button>
        </div>
      </div>

      <form onSubmit={save} className="mt-4 space-y-4 rounded-xl border border-[var(--micaa-line)] bg-white p-5">
        <div>
          <label className="mb-1 block text-sm font-medium">Nombre</label>
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="h-11 w-full rounded-lg border border-[var(--micaa-line)] px-3 text-base" required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Rubro</label>
          <select value={rubro} onChange={(e) => setRubro(e.target.value)} className="h-11 w-full rounded-lg border border-[var(--micaa-line)] px-3 text-base">
            {RUBROS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Ciudad</label>
          <select value={city} onChange={(e) => setCityState(e.target.value as MicaaCity)} className="h-11 w-full rounded-lg border border-[var(--micaa-line)] px-3 text-base">
            {CITY_LIST.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Descripción</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-lg border border-[var(--micaa-line)] px-3 py-2 text-base" placeholder="Qué vendés, zona, horarios…" />
          <p className="mt-1 text-xs text-[var(--micaa-muted)]">{description.trim().length}/20 mín. para Destacada</p>
        </div>

        {!showMore ? (
          <button type="button" onClick={() => setShowMore(true)} className="text-sm font-medium text-[var(--micaa-accent)]">
            Completá tu perfil (dirección, email, redes, NIT…) →
          </button>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium">Dirección</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} className="h-11 w-full rounded-lg border border-[var(--micaa-line)] px-3 text-base" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 w-full rounded-lg border border-[var(--micaa-line)] px-3 text-base" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Web</label>
              <input value={website} onChange={(e) => setWebsite(e.target.value)} className="h-11 w-full rounded-lg border border-[var(--micaa-line)] px-3 text-base" placeholder="https://" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Facebook</label>
                <input value={facebook} onChange={(e) => setFacebook(e.target.value)} className="h-11 w-full rounded-lg border border-[var(--micaa-line)] px-3 text-base" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Instagram</label>
                <input value={instagram} onChange={(e) => setInstagram(e.target.value)} className="h-11 w-full rounded-lg border border-[var(--micaa-line)] px-3 text-base" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Horarios</label>
              <input value={openingHours} onChange={(e) => setOpeningHours(e.target.value)} className="h-11 w-full rounded-lg border border-[var(--micaa-line)] px-3 text-base" placeholder="Lun–Vie 8–18" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Delivery / zonas</label>
              <input value={deliveryInfo} onChange={(e) => setDeliveryInfo(e.target.value)} className="h-11 w-full rounded-lg border border-[var(--micaa-line)] px-3 text-base" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">NIT</label>
              <input value={nit} onChange={(e) => setNit(e.target.value)} className="h-11 w-full rounded-lg border border-[var(--micaa-line)] px-3 text-base" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Productos / servicios</label>
              <textarea value={productsServices} onChange={(e) => setProductsServices(e.target.value)} rows={2} className="w-full rounded-lg border border-[var(--micaa-line)] px-3 py-2 text-base" />
            </div>
          </>
        )}

        <button type="submit" disabled={saving} className="flex h-11 w-full items-center justify-center rounded-lg bg-[var(--micaa-accent)] text-base font-medium text-[var(--micaa-accent-fg)] disabled:opacity-60">
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Link href="/empresas" className="text-[var(--micaa-accent)] hover:underline">Ver en la guía →</Link>
        <Link href="/supplier-pricing" className="text-[var(--micaa-accent)] hover:underline">
          Cargar precios ({company.priceCount ?? 0}) →
        </Link>
      </div>
    </div>
  );
}
