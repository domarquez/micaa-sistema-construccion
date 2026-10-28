import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Building2, CheckCircle2, MapPin, Phone, Store } from "lucide-react";
import WhatsAppCodeFlow from "@/components/WhatsAppCodeFlow";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { CITY_LIST, getCity, type MicaaCity } from "@/lib/city";
import { BETA_FREE_COPY, BETA_FREE_UNTIL_LABEL } from "@/lib/micaa-contact";
import { track, setAnalyticsUser } from "@/lib/analytics";

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
  city: string;
  speciality?: string | null;
  phone?: string | null;
  betaUntil?: string;
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

export default function AnunciarPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [company, setCompany] = useState<Company | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(false);
  const [saving, setSaving] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [rubro, setRubro] = useState("ferreteria");
  const [city, setCityState] = useState<string>(() => getCity());

  useEffect(() => {
    track("anunciar_view", {});
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setCompany(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingCompany(true);
      try {
        const res = await authFetch("/api/my-supplier-company");
        if (cancelled) return;
        if (res.status === 404) {
          setCompany(null);
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        setCompany(data);
      } finally {
        if (!cancelled) setLoadingCompany(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const onWaSuccess = (data: any) => {
    if (data?.token) localStorage.setItem("auth_token", data.token);
    if (data?.user) setAnalyticsUser(data.user);
    track(data?.isNewUser ? "registration" : "login", { method: "whatsapp", source: "anunciar" });
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    toast({
      title: "WhatsApp verificado",
      description: "Ese número es tu clave. Completá los datos de tu empresa.",
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      toast({
        title: "Falta el nombre",
        description: "Poné el nombre de tu empresa.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch("/api/my-supplier-company", {
        method: "POST",
        body: JSON.stringify({
          companyName: companyName.trim(),
          speciality: rubro,
          city,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && data.company) {
          setCompany(data.company);
          toast({ title: "Ya estás registrada", description: "Tu empresa ya figura en la guía." });
          return;
        }
        throw new Error(data.message || "No se pudo registrar");
      }
      setCompany(data);
      track("registration", { method: "company_signup" });
      toast({
        title: "Empresa publicada",
        description: `Ya aparecés en la guía. ${BETA_FREE_COPY}.`,
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const phoneOk = !!(user?.phoneVerified && user?.phone);

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <div className="mb-6">
        <p className="text-sm font-medium text-[var(--micaa-accent)]">Beta abierta</p>
        <h1 className="mt-1 text-[22px] font-semibold text-[var(--micaa-fg)]">
          Registrá tu empresa en MICAA
        </h1>
        <p className="mt-2 text-base text-[var(--micaa-muted)]">
          {BETA_FREE_COPY}. Tu WhatsApp es la clave: sin contraseña.
        </p>
      </div>

      <ul className="mb-8 space-y-2 rounded-xl border border-[var(--micaa-line)] bg-white p-4 text-sm text-[var(--micaa-fg)]">
        <li className="flex gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--micaa-accent)]" />
          Aparecés en la guía{" "}
          <Link href="/empresas" className="font-medium text-[var(--micaa-accent)] hover:underline">
            /empresas
          </Link>
        </li>
        <li className="flex gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--micaa-accent)]" />
          Destacada en materiales y precios hasta el {BETA_FREE_UNTIL_LABEL}
        </li>
        <li className="flex gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--micaa-accent)]" />
          Editás perfil y cargás precios cuando quieras
        </li>
      </ul>

      {authLoading || loadingCompany ? (
        <p className="text-sm text-[var(--micaa-muted)]">Cargando…</p>
      ) : company ? (
        <div className="rounded-xl border border-[var(--micaa-line)] bg-white p-5">
          <div className="flex items-start gap-3">
            <Store className="mt-0.5 h-5 w-5 text-[var(--micaa-accent)]" />
            <div>
              <h2 className="text-lg font-semibold">{company.companyName}</h2>
              <p className="mt-1 text-sm text-[var(--micaa-muted)]">
                {company.city}
                {company.speciality ? ` · ${company.speciality}` : ""}
              </p>
              <p className="mt-2 text-sm text-[var(--micaa-fg)]">
                Ya estás en la guía. {BETA_FREE_COPY}.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/empresas"
                  className="inline-flex h-10 items-center rounded-lg bg-[var(--micaa-accent)] px-4 text-sm font-medium text-[var(--micaa-accent-fg)]"
                >
                  Ver guía
                </Link>
                <Link
                  href="/supplier-registration"
                  className="inline-flex h-10 items-center rounded-lg border border-[var(--micaa-line)] px-4 text-sm"
                >
                  Editar perfil
                </Link>
                <Link
                  href="/supplier-pricing"
                  className="inline-flex h-10 items-center rounded-lg border border-[var(--micaa-line)] px-4 text-sm"
                >
                  Cargar precios
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : !phoneOk ? (
        <div className="rounded-xl border border-[var(--micaa-line)] bg-white p-5">
          <div className="mb-3 flex items-center gap-2 text-base font-medium">
            <Phone className="h-4 w-4 text-[var(--micaa-accent)]" />
            Paso 1 · Verificá tu WhatsApp
          </div>
          <p className="mb-4 text-sm text-[var(--micaa-muted)]">
            Ese número es tu seguridad y tu clave para entrar después. No pedimos contraseña.
          </p>
          <WhatsAppCodeFlow mode="login" onSuccess={onWaSuccess} />
          <p className="mt-4 text-center text-xs text-[var(--micaa-muted)]">
            ¿Ya tenés cuenta?{" "}
            <Link href="/login" className="text-[var(--micaa-accent)] hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      ) : (
        <form
          onSubmit={submit}
          className="space-y-4 rounded-xl border border-[var(--micaa-line)] bg-white p-5"
        >
          <div className="flex items-center gap-2 text-base font-medium">
            <Building2 className="h-4 w-4 text-[var(--micaa-accent)]" />
            Paso 2 · Datos de tu empresa
          </div>
          <p className="text-sm text-[var(--micaa-muted)]">
            WhatsApp verificado: <span className="text-[var(--micaa-fg)]">{user?.phone}</span>
          </p>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="empresa-nombre">
              Nombre de la empresa
            </label>
            <input
              id="empresa-nombre"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Ej. Ferretería Los Andes"
              className="h-11 w-full rounded-lg border border-[var(--micaa-line)] px-3 text-base"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="empresa-rubro">
              Rubro
            </label>
            <select
              id="empresa-rubro"
              value={rubro}
              onChange={(e) => setRubro(e.target.value)}
              className="h-11 w-full rounded-lg border border-[var(--micaa-line)] px-3 text-base"
            >
              {RUBROS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="empresa-ciudad">
              Ciudad
            </label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--micaa-muted)]" />
              <select
                id="empresa-ciudad"
                value={city}
                onChange={(e) => setCityState(e.target.value as MicaaCity)}
                className="h-11 w-full rounded-lg border border-[var(--micaa-line)] pl-9 pr-3 text-base"
              >
                {CITY_LIST.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex h-11 w-full items-center justify-center rounded-lg bg-[var(--micaa-accent)] text-base font-medium text-[var(--micaa-accent-fg)] disabled:opacity-60"
          >
            {saving ? "Publicando…" : "Publicar en la guía (gratis)"}
          </button>
          <p className="text-center text-xs text-[var(--micaa-muted)]">{BETA_FREE_COPY}.</p>
        </form>
      )}
    </div>
  );
}
