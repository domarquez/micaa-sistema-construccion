import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { titleCaseMaterial } from "@/lib/lista";
import { CITY_LIST, getCity, setCity, type MicaaCity } from "@/lib/city";

type Hit = { id: number; name: string; unit: string };

export default function PublicarPrecioPage() {
  const { isAuthenticated, isAnonymous } = useAuth();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [materialId, setMaterialId] = useState<number | null>(null);
  const [materialName, setMaterialName] = useState("");
  const [unit, setUnit] = useState("");
  const [price, setPrice] = useState("");
  const [city, setCityState] = useState<MicaaCity>(() => getCity());
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const sync = () => setCityState(getCity());
    window.addEventListener("storage", sync);
    window.addEventListener("micaa-city", sync as EventListener);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("micaa-city", sync as EventListener);
    };
  }, []);

  const search = async () => {
    const params = new URLSearchParams({ q: q.trim(), limit: "20" });
    const res = await fetch(`/api/public/materials?${params}`);
    if (!res.ok) return;
    const data = await res.json();
    setHits(data);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast({ title: "Entrá para publicar", description: "Los invitados solo pueden mirar." });
      return;
    }
    if (!materialId || !price) {
      toast({ title: "Faltan datos", description: "Elegí un material y un precio." });
      return;
    }
    if (!city || !CITY_LIST.includes(city)) {
      toast({
        title: "Ciudad requerida",
        description: "Elegí la ciudad donde viste o pagaste ese precio.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/materials/${materialId}/custom-price`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          price: parseFloat(price),
          customMaterialName: materialName,
          unit,
          reason: isPublic ? "public_quote" : "private_quote",
          city,
          isPublic,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "No se pudo guardar");
      }
      setCity(city);
      toast({ title: "Precio guardado", description: isPublic ? "Visible en la ficha." : "Solo para vos." });
      setPrice("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isAnonymous) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 text-center">
        <h1 className="text-[20px] font-semibold">Publicar precio</h1>
        <p className="mt-2 text-[14px] text-[var(--micaa-muted)]">
          Los invitados solo miran. Entrá para cargar un precio de persona o ferretería.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex h-10 items-center rounded-lg bg-[var(--micaa-accent)] px-4 text-[14px] text-[var(--micaa-accent-fg)]"
        >
          Entrar
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-[20px] font-semibold">Publicar precio</h1>
      <p className="mt-1 text-[12px] text-[var(--micaa-muted)]">
        Buscá el material, poné el precio en Bs y elegí ciudad (obligatoria) y si es visible en la ficha.
      </p>

      <div className="mt-4 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar material…"
          className="h-10 flex-1 rounded-lg border border-[var(--micaa-line)] px-3 text-[14px]"
        />
        <button
          type="button"
          onClick={search}
          className="h-10 rounded-lg border border-[var(--micaa-line)] px-3 text-[14px]"
        >
          Buscar
        </button>
      </div>

      {hits.length > 0 && (
        <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-[var(--micaa-line)]">
          {hits.map((h) => (
            <button
              key={h.id}
              type="button"
              className="block w-full border-b border-[var(--micaa-line)] px-3 py-2 text-left text-[14px] last:border-0 hover:bg-black/[0.02]"
              onClick={() => {
                setMaterialId(h.id);
                setMaterialName(h.name);
                setUnit(h.unit);
                setHits([]);
                setQ(titleCaseMaterial(h.name));
              }}
            >
              {titleCaseMaterial(h.name)}
              <span className="text-[var(--micaa-muted)]"> · {h.unit}</span>
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="mt-6 space-y-3">
        <div className="text-[12px] text-[var(--micaa-muted)]">
          {materialId ? (
            <>
              Elegido: <span className="text-[var(--micaa-fg)]">{titleCaseMaterial(materialName)}</span>
            </>
          ) : (
            "Todavía no elegiste material."
          )}
        </div>
        <input
          type="number"
          step="any"
          min={0}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Precio Bs"
          className="h-10 w-full rounded-lg border border-[var(--micaa-line)] px-3 text-[14px]"
          required
        />
        <div>
          <label className="mb-1 block text-[12px] text-[var(--micaa-muted)]">
            Ciudad <span className="text-red-500">*</span>
          </label>
          <select
            value={city}
            onChange={(e) => {
              const next = setCity(e.target.value);
              setCityState(next);
            }}
            required
            className="h-10 w-full rounded-lg border border-[var(--micaa-line)] px-3 text-[14px]"
          >
            {CITY_LIST.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-[14px]">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          Visible en la ficha pública
        </label>
        <button
          type="submit"
          disabled={saving}
          className="h-10 w-full rounded-lg bg-[var(--micaa-accent)] text-[14px] font-medium text-[var(--micaa-accent-fg)] disabled:opacity-60"
        >
          {saving ? "Guardando…" : "Guardar precio"}
        </button>
      </form>
    </div>
  );
}
