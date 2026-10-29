import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { titleCaseMaterial } from "@/lib/lista";
import { BETA_FREE_COPY } from "@/lib/micaa-contact";
import { SERVICE_UNITS } from "@shared/company-trades";

type Hit = { id: number; name: string; unit: string };
type PriceRow = {
  id: number;
  materialId: number;
  materialName: string;
  price: number;
  unit?: string | null;
  city?: string | null;
  updatedAt?: string | null;
  kind?: string;
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

export default function SupplierPricing() {
  const { user, isLoading: authLoading, isAnonymous } = useAuth();
  const { toast } = useToast();
  const [hasCompany, setHasCompany] = useState<boolean | null>(null);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [materialId, setMaterialId] = useState<number | null>(null);
  const [materialName, setMaterialName] = useState("");
  const [unit, setUnit] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [svcName, setSvcName] = useState("");
  const [svcUnit, setSvcUnit] = useState("m2");
  const [svcPrice, setSvcPrice] = useState("");
  const [savingSvc, setSavingSvc] = useState(false);

  const load = async () => {
    const co = await authFetch("/api/my-supplier-company");
    if (co.status === 404 || !co.ok) {
      setHasCompany(false);
      return;
    }
    setHasCompany(true);
    const pr = await authFetch("/api/my-supplier-company/prices");
    if (pr.ok) setPrices(await pr.json());
  };

  useEffect(() => {
    if (authLoading || !user?.id) return;
    load().catch(() => setHasCompany(false));
  }, [user?.id, authLoading]);

  const search = async () => {
    const params = new URLSearchParams({ q: q.trim(), limit: "20" });
    const res = await fetch(`/api/public/materials?${params}`);
    if (!res.ok) return;
    setHits(await res.json());
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialId || !price) {
      toast({ title: "Faltan datos", description: "Elegí material y precio.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch("/api/my-supplier-company/prices", {
        method: "POST",
        body: JSON.stringify({ materialId, price: parseFloat(price), unit: unit || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "No se pudo guardar");
      toast({ title: "Precio publicado", description: "Ya se ve en la ficha del material y en tu empresa." });
      setPrice("");
      await load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const submitService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!svcName.trim() || !svcPrice) {
      toast({ title: "Faltan datos", description: "Nombre y precio del servicio.", variant: "destructive" });
      return;
    }
    setSavingSvc(true);
    try {
      const res = await authFetch("/api/my-supplier-company/services", {
        method: "POST",
        body: JSON.stringify({
          name: svcName.trim(),
          unit: svcUnit || undefined,
          price: parseFloat(svcPrice),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "No se pudo guardar");
      toast({ title: "Servicio publicado", description: "Ya se ve en tu ficha de /empresas." });
      setSvcName("");
      setSvcPrice("");
      await load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingSvc(false);
    }
  };

  const removeService = async (id: number) => {
    const res = await authFetch(`/api/my-supplier-company/services/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  };

  if (authLoading) {
    return <div className="mx-auto max-w-xl px-4 py-10 text-sm text-[var(--micaa-muted)]">Cargando…</div>;
  }
  if (isAnonymous || !user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 text-center">
        <h1 className="text-[20px] font-semibold">Precios de tu empresa</h1>
        <p className="mt-2 text-[var(--micaa-muted)]">Entrá con WhatsApp para cargar precios.</p>
        <Link href="/anunciar" className="mt-6 inline-flex h-10 items-center rounded-lg bg-[var(--micaa-accent)] px-4 text-[var(--micaa-accent-fg)]">Entrar / registrarme</Link>
      </div>
    );
  }
  if (hasCompany === false) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 text-center">
        <h1 className="text-[20px] font-semibold">Primero registrá tu empresa</h1>
        <p className="mt-2 text-[var(--micaa-muted)]">{BETA_FREE_COPY}.</p>
        <Link href="/anunciar" className="mt-6 inline-flex h-10 items-center rounded-lg bg-[var(--micaa-accent)] px-4 text-[var(--micaa-accent-fg)]">Ir a registrarme</Link>
      </div>
    );
  }
  if (hasCompany === null) {
    return <div className="mx-auto max-w-xl px-4 py-10 text-sm text-[var(--micaa-muted)]">Cargando…</div>;
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-[20px] font-semibold">Precios y servicios</h1>
      <p className="mt-1 text-sm text-[var(--micaa-muted)]">
        Materiales (catálogo) o servicios con precio (ej. corte router Bs/m²). Se ven en /empresas. {BETA_FREE_COPY}.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-3 rounded-xl border border-[var(--micaa-line)] bg-white p-5">
        <div className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar material…" className="h-10 flex-1 rounded-lg border border-[var(--micaa-line)] px-3 text-base" />
          <button type="button" onClick={search} className="h-10 rounded-lg border border-[var(--micaa-line)] px-3 text-base">Buscar</button>
        </div>
        {hits.length > 0 && (
          <div className="max-h-48 overflow-auto rounded-lg border border-[var(--micaa-line)]">
            {hits.map((h) => (
              <button key={h.id} type="button" className="block w-full border-b border-[var(--micaa-line)] px-3 py-2 text-left text-base last:border-0 hover:bg-black/[0.02]"
                onClick={() => { setMaterialId(h.id); setMaterialName(h.name); setUnit(h.unit); setHits([]); setQ(titleCaseMaterial(h.name)); }}>
                {titleCaseMaterial(h.name)}
                <span className="text-[var(--micaa-muted)]"> · {h.unit}</span>
              </button>
            ))}
          </div>
        )}
        <p className="text-sm text-[var(--micaa-muted)]">
          {materialId ? <>Elegido: <span className="text-[var(--micaa-fg)]">{titleCaseMaterial(materialName)}</span></> : "Todavía no elegiste material."}
        </p>
        <input type="number" step="any" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Precio Bs" className="h-11 w-full rounded-lg border border-[var(--micaa-line)] px-3 text-base" />
        <button type="submit" disabled={saving} className="flex h-11 w-full items-center justify-center rounded-lg bg-[var(--micaa-accent)] text-base font-medium text-[var(--micaa-accent-fg)] disabled:opacity-60">
          {saving ? "Publicando…" : "Publicar precio"}
        </button>
      </form>
      <form onSubmit={submitService} className="mt-6 space-y-3 rounded-xl border border-[var(--micaa-line)] bg-white p-5">
        <h2 className="text-base font-semibold">Servicio con precio</h2>
        <p className="text-xs text-[var(--micaa-muted)]">Para oficios: CNC, ploteo, carpintería, alquiler, etc.</p>
        <input
          value={svcName}
          onChange={(e) => setSvcName(e.target.value)}
          placeholder="Ej. Corte router MDF"
          className="h-11 w-full rounded-lg border border-[var(--micaa-line)] px-3 text-base"
          maxLength={120}
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={svcUnit}
            onChange={(e) => setSvcUnit(e.target.value)}
            className="h-11 rounded-lg border border-[var(--micaa-line)] px-3 text-base"
          >
            {SERVICE_UNITS.map((u) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
          <input
            type="number"
            step="any"
            min={0}
            value={svcPrice}
            onChange={(e) => setSvcPrice(e.target.value)}
            placeholder="Precio Bs"
            className="h-11 rounded-lg border border-[var(--micaa-line)] px-3 text-base"
          />
        </div>
        <button
          type="submit"
          disabled={savingSvc}
          className="flex h-11 w-full items-center justify-center rounded-lg bg-[var(--micaa-accent)] text-base font-medium text-[var(--micaa-accent-fg)] disabled:opacity-60"
        >
          {savingSvc ? "Publicando…" : "Publicar servicio"}
        </button>
      </form>

      <div className="mt-8">
        <h2 className="text-base font-semibold">Tus precios y servicios publicados</h2>
        {prices.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--micaa-muted)]">Todavía no cargaste ninguno.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--micaa-line)] rounded-xl border border-[var(--micaa-line)] bg-white">
            {prices.map((p) => (
              <li key={`${p.kind}-${p.id}`} className="flex items-baseline justify-between gap-3 px-4 py-3 text-sm">
                <span>
                  {p.kind === "servicio" ? (
                    <span className="mr-1 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">serv.</span>
                  ) : null}
                  {titleCaseMaterial(p.materialName || `Material #${p.materialId}`)}
                  {p.unit ? <span className="text-[var(--micaa-muted)]"> · {p.unit}</span> : null}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-medium tabular-nums">Bs {Number(p.price).toFixed(2)}</span>
                  {p.kind === "servicio" ? (
                    <button type="button" className="text-xs text-red-600" onClick={() => removeService(p.id)}>
                      Quitar
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-4 text-sm">
        <Link href="/supplier-registration" className="text-[var(--micaa-accent)] hover:underline">Editar perfil →</Link>
      </p>
    </div>
  );
}
