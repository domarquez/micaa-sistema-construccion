import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, LayoutTemplate, Lock, Loader2, Plus } from "lucide-react";

type ParamDef = { default: number; min: number; max: number; unit?: string; label?: string };
type TemplateSummary = {
  id: number; slug: string; name: string; category: string; description: string | null; unitRef: string;
  paramsSchema: Record<string, ParamDef>; isPremium: boolean; priceBs: string | null; isActive: boolean;
  inactiveReason: string | null; unlocked: boolean;
};
type ListResponse = { available: boolean; premiumEnabled: boolean; templates: TemplateSummary[] };
type PreviewLine = {
  sortOrder: number; phaseId: number; activityId: number | null; missingKey: string | null; name: string; unit: string;
  quantityFormula: string; breakdown: string | null; quantity: number; unitPrice: number | null; subtotal: number; status: string;
};
type Preview = { city: string; lines: PreviewLine[]; total: number; refQuantity: number; costPerRefUnit: number | null; missingCount: number; byPhase: Record<string, number> };

type PhaseRow = { id: number; name: string; sortOrder: number; isActive: boolean };
const CATEGORIES: Record<string, string> = {
  vivienda: "Vivienda", exteriores: "Exteriores", recreacion: "Recreación", remodelacion: "Remodelación",
  instalaciones: "Instalaciones", industrial: "Industrial", "movimiento-de-tierras": "Movimiento de tierras",
};
const bs = (n: number | null | undefined) =>
  n == null ? "—" : `Bs ${n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const errMsg = (e: unknown) => {
  const m = String((e as any)?.message || e);
  const i = m.indexOf(": ");
  try { return JSON.parse(m.slice(i + 2)).message || m; } catch { return m; }
};

export default function ProjectTemplatesPage() {
  const [selected, setSelected] = useState<TemplateSummary | null>(null);
  const { data, isLoading } = useQuery<ListResponse>({ queryKey: ["/api/project-templates"] });

  if (selected) return <TemplateConfigurator tpl={selected} onBack={() => setSelected(null)} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><LayoutTemplate className="h-6 w-6" /> Desde plantilla</h1>
        <p className="text-sm text-muted-foreground">
          Proyectos ya armados (fases, actividades y cantidades). Ajusta las medidas, revisa el costo en vivo y crea tu proyecto.
        </p>
      </div>
      {isLoading && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}</div>}
      {data && !data.available && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Las plantillas aún no están habilitadas en este servidor.</CardContent></Card>
      )}
      {data?.available && data.templates.length === 0 && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Todavía no hay plantillas publicadas.</CardContent></Card>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.templates.map((t) => (
          <Card key={t.id} className="flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{CATEGORIES[t.category] || t.category}</Badge>
                {t.isPremium && <Badge variant="outline">Premium</Badge>}
                {!t.isActive && <Badge variant="destructive">Inactiva</Badge>}
              </div>
              <CardTitle className="text-base">{t.name}</CardTitle>
              <CardDescription className="line-clamp-3">{t.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto space-y-2">
              {!t.isActive && t.inactiveReason && <p className="text-xs text-destructive">{t.inactiveReason}</p>}
              <Button className="w-full" onClick={() => setSelected(t)} disabled={!t.unlocked}>
                {t.unlocked ? "Usar plantilla" : <><Lock className="mr-2 h-4 w-4" /> Requiere plan premium</>}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TemplateConfigurator({ tpl, onBack }: { tpl: TemplateSummary; onBack: () => void }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const defaults = useMemo(() => Object.fromEntries(Object.entries(tpl.paramsSchema).map(([k, d]) => [k, String(d.default)])), [tpl]);
  const [params, setParams] = useState<Record<string, string>>(defaults);
  const [city, setCity] = useState("Santa Cruz");
  const [name, setName] = useState(tpl.name);
  const [address, setAddress] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const numericParams = () => Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Number(v)]));
  const invalid = Object.entries(tpl.paramsSchema).some(([k, d]) => {
    const v = Number(params[k]);
    return params[k] === "" || !Number.isFinite(v) || v < d.min || v > d.max;
  });

  useEffect(() => {
    if (invalid) return;
    let cancelled = false;
    const h = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiRequest("POST", `/api/project-templates/${tpl.slug}/preview`, { params: numericParams(), city });
        const pv = (await res.json()) as Preview;
        if (!cancelled) { setPreview(pv); setError(null); }
      } catch (e) {
        if (!cancelled) setError(errMsg(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(h); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params), city, tpl.slug, invalid]);

  const create = async () => {
    setCreating(true);
    try {
      const res = await apiRequest("POST", `/api/project-templates/${tpl.slug}/instantiate`, { params: numericParams(), city, name, ...(address.trim() ? { location: address.trim() } : {}) });
      const r = await res.json();
      const tr = r.transport?.project;
      const km = tr && Number(tr.extraKm) > 0 ? ` · transporte: ${Number(tr.extraKm).toLocaleString("es-BO")} km extra` : "";
      toast({ title: "Proyecto creado", description: `${r.items} actividades · ${bs(r.total)}${km}` });
      setLocation(`/budgets/${r.budgetId}`);
    } catch (e) {
      toast({ title: "No se pudo crear el proyecto", description: errMsg(e), variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  // Fases desde la BD (orden constructivo, migración 0004); incluye inactivas solo para nombrar líneas antiguas.
  const { data: phaseRows } = useQuery<PhaseRow[]>({ queryKey: ["/api/construction-phases", { includeInactive: 1 }], staleTime: 10 * 60 * 1000 });
  const phaseById = useMemo(() => new Map((phaseRows || []).map((p) => [p.id, p])), [phaseRows]);
  const phases = useMemo(() => {
    const g = new Map<number, PreviewLine[]>();
    for (const l of preview?.lines || []) g.set(l.phaseId, [...(g.get(l.phaseId) || []), l]);
    const rank = (id: number) => phaseById.get(id)?.sortOrder ?? 100000 + id;
    return Array.from(g.entries()).sort((a, b) => rank(a[0]) - rank(b[0]));
  }, [preview, phaseById]);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" /> Plantillas</Button>
      <div>
        <h1 className="text-2xl font-bold">{tpl.name}</h1>
        <p className="text-sm text-muted-foreground">{tpl.description}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Card className="h-fit">
          <CardHeader className="pb-2"><CardTitle className="text-base">Parámetros</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(tpl.paramsSchema).map(([k, d]) => {
              const v = Number(params[k]);
              const bad = params[k] === "" || !Number.isFinite(v) || v < d.min || v > d.max;
              return (
                <div key={k} className="space-y-1">
                  <Label htmlFor={`p-${k}`}>{d.label || k} {d.unit ? <span className="text-muted-foreground">({d.unit})</span> : null}</Label>
                  <div className="flex items-center gap-2">
                    <input type="range" aria-label={d.label || k} className="w-full" min={d.min} max={d.max} step={d.max - d.min <= 2 ? 0.05 : d.max - d.min <= 10 ? 0.1 : 1}
                      value={Number.isFinite(v) ? v : d.default} onChange={(e) => setParams({ ...params, [k]: e.target.value })} />
                    <Input id={`p-${k}`} className="w-24" type="number" min={d.min} max={d.max} value={params[k]}
                      onChange={(e) => setParams({ ...params, [k]: e.target.value })} />
                  </div>
                  <p className={`text-xs ${bad ? "text-destructive" : "text-muted-foreground"}`}>Rango {d.min}–{d.max}</p>
                </div>
              );
            })}
            <div className="space-y-1">
              <Label htmlFor="tpl-city">Ciudad</Label>
              <Input id="tpl-city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tpl-name">Nombre del proyecto</Label>
              <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tpl-address">Dirección de la obra <span className="font-normal text-muted-foreground">(opcional)</span></Label>
              <Input id="tpl-address" value={address} placeholder="Barrio, avenida o localidad (Warnes, Cotoca…)" onChange={(e) => setAddress(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">Precios base puestos en obra (km cero urbano). Fuera de esa zona se suma «Transporte y movilización».</p>
            </div>
            <Button className="w-full" onClick={create} disabled={creating || invalid || !preview || preview.missingCount > 0 || !!error}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Crear proyecto
            </Button>
            {preview && preview.missingCount > 0 && (
              <p className="text-xs text-destructive">Esta plantilla tiene {preview.missingCount} actividad(es) faltante(s) en el catálogo.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              Costo estimado {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            </CardTitle>
            {preview && (
              <div className="flex flex-wrap gap-6 pt-2">
                <div><div className="text-xs text-muted-foreground">Total ({preview.city})</div><div className="text-2xl font-bold">{bs(preview.total)}</div></div>
                <div><div className="text-xs text-muted-foreground">Por {tpl.unitRef}</div><div className="text-2xl font-bold">{bs(preview.costPerRefUnit)}</div></div>
                <div><div className="text-xs text-muted-foreground">Actividades</div><div className="text-2xl font-bold">{preview.lines.length}</div></div>
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <CardDescription>Precios del APU en vivo de MICAA (incluye GG, utilidad e IT). Las cantidades se recalculan con los parámetros.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {!preview && !error && <Skeleton className="h-64" />}
            {phases.map(([ph, lines]) => (
              <div key={ph} className="mb-4">
                <div className="flex items-center justify-between border-b py-1 text-sm font-semibold">
                  <span>{phaseById.get(ph)?.name || `Fase ${ph}`}</span><span>{bs(preview?.byPhase?.[ph] ?? 0)}</span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Actividad</TableHead><TableHead className="text-right">Cant.</TableHead><TableHead>Und</TableHead><TableHead className="text-right">P.U.</TableHead><TableHead className="text-right">Subtotal</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l, i) => (
                      <TableRow key={`${l.sortOrder}-${i}`}>
                        <TableCell className="max-w-md">
                          <div className="text-sm">{l.name}{l.status === "missing" && <Badge variant="destructive" className="ml-2">Falta</Badge>}</div>
                          {l.breakdown && <div className="text-xs text-muted-foreground">{l.breakdown}</div>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{l.quantity.toLocaleString("es-BO", { maximumFractionDigits: 3 })}</TableCell>
                        <TableCell>{l.unit}</TableCell>
                        <TableCell className="text-right tabular-nums">{bs(l.unitPrice)}</TableCell>
                        <TableCell className="text-right tabular-nums">{bs(l.subtotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
