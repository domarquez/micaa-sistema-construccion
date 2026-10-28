import { useEffect, useState } from "react";
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
};

async function authFetch(path: string, init?: RequestInit) {
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(path, { ...init, headers, credentials: "include" });
}

/** Edición de perfil. Alta nueva → /anunciar (WhatsApp + mínimos). */
export default function SupplierRegistration() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [rubro, setRubro] = useState("ferreteria");
  const [city, setCityState] = useState<string>(() => getCity());
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");

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
        const data: Company = await res.json();
        setCompany(data);
        setCompanyName(data.companyName || "");
        setRubro(data.speciality || "general");
        setCityState(data.city || getCity());
        setDescription(data.description || "");
        setAddress(data.address || "");
        setWebsite(data.website || "");
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
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "No se pudo guardar");
      setCompany(data);
      toast({ title: "Perfil actualizado", description: "Los cambios ya están en la guía." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 text-sm text-[var(--micaa-muted)]">Cargando…</div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 text-center">
        <h1 className="text-[20px] font-semibold">Tu empresa</h1>
        <p className="mt-2 text-base text-[var(--micaa-muted)]">
          Entrá con WhatsApp para administrar tu perfil. {BETA_FREE_COPY}.
        </p>
        <Link
          href="/anunciar"
          className="mt-6 inline-flex h-10 items-center rounded-lg bg-[var(--micaa-accent)] px-4 text-base text-[var(--micaa-accent-fg)]"
        >
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
        <Link
          href="/anunciar"
          className="mt-6 inline-flex h-10 items-center rounded-lg bg-[var(--micaa-accent)] px-4 text-base text-[var(--micaa-accent-fg)]"
        >
          Ir a registrarme
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-[20px] font-semibold">Editar empresa</h1>
      <p className="mt-1 text-sm text-[var(--micaa-muted)]">
        WhatsApp: {company.phone || user.phone || "—"} (tu clave). {BETA_FREE_COPY}.
      </p>
      <form onSubmit={save} className="mt-6 space-y-4 rounded-xl border border-[var(--micaa-line)] bg-white p-5">
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
          <label className="mb-1 block text-sm font-medium">Dirección (opcional)</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className="h-11 w-full rounded-lg border border-[var(--micaa-line)] px-3 text-base" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Web (opcional)</label>
          <input value={website} onChange={(e) => setWebsite(e.target.value)} className="h-11 w-full rounded-lg border border-[var(--micaa-line)] px-3 text-base" placeholder="https://" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Descripción (opcional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-lg border border-[var(--micaa-line)] px-3 py-2 text-base" />
        </div>
        <button type="submit" disabled={saving} className="flex h-11 w-full items-center justify-center rounded-lg bg-[var(--micaa-accent)] text-base font-medium text-[var(--micaa-accent-fg)] disabled:opacity-60">
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Link href="/empresas" className="text-[var(--micaa-accent)] hover:underline">Ver en la guía →</Link>
        <Link href="/supplier-pricing" className="text-[var(--micaa-accent)] hover:underline">Cargar precios →</Link>
      </div>
    </div>
  );
}
