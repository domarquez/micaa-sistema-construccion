import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { AlertTriangle, RotateCcw, Calculator } from "lucide-react";
import {
  computeApuTotals,
  effectiveQuantity,
  type ApuInputType,
  type ApuPercentages,
  type ApuPriceOption,
  type ApuRow,
  type ApuTotals,
} from "@shared/apu";

interface ItemApuResponse {
  item: {
    id: number;
    budgetId: number;
    projectId: number;
    activityId: number;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    apuComputedAt: string | null;
  };
  apu: ApuTotals & {
    activityId: number;
    activityName: string;
    unit: string;
    city: string;
    factorCity: string | null;
    factors: { materials: number; labor: number; equipment: number };
    percentages: ApuPercentages;
    rows: ApuRow[];
    base: ApuTotals;
    diffVsBase: number;
    overridesAvailable: boolean;
    wasteColumnAvailable: boolean;
    warnings: string[];
  };
}

type Draft = { choice: string; manual: string };

const MANUAL = "manual";

function bs(n: number | null | undefined): string {
  const v = Number.isFinite(n as number) ? (n as number) : 0;
  return `Bs ${v.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function signedBs(n: number): string {
  if (Math.abs(n) < 0.005) return "—";
  return `${n > 0 ? "+" : "−"}${bs(Math.abs(n)).replace("Bs ", "Bs ")}`;
}

function rowKey(r: Pick<ApuRow, "inputType" | "inputId">) {
  return `${r.inputType}:${r.inputId}`;
}

/** Selección actual (sin borrador) a partir del override guardado. */
function currentChoice(r: ApuRow): Draft {
  const o = r.override;
  if (!o) return { choice: "base", manual: "" };
  if (o.source === "manual") return { choice: MANUAL, manual: o.manualPrice != null ? String(o.manualPrice) : "" };
  if (o.source === "market") return { choice: "market", manual: "" };
  if (o.source === "quote") {
    const k = o.supplierPriceId != null ? `supplier:${o.supplierPriceId}` : `quote:${o.quoteId}`;
    return { choice: r.options.some((x) => x.key === k) ? k : "base", manual: "" };
  }
  return { choice: "base", manual: "" };
}

function priceFor(r: ApuRow, d: Draft): number {
  if (d.choice === MANUAL) {
    const n = parseFloat(d.manual.replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : r.unitPrice;
  }
  const opt = r.options.find((o) => o.key === d.choice);
  return opt ? opt.price : r.basePrice;
}

function optionLabel(o: ApuPriceOption): string {
  const parts = [o.label];
  if (o.source === "quote" && o.city) parts.push(o.city);
  if (o.date) parts.push(o.date);
  return `${parts.join(" · ")} — ${bs(o.price)}`;
}

const SECTION_TITLES: Record<ApuInputType, string> = {
  material: "1. Materiales",
  labor: "2. Mano de obra",
  equipment: "3. Equipo y maquinaria",
};

interface Props {
  budgetItemId: number;
  open: boolean;
  onClose: () => void;
  /** Se llama cuando el servidor guardó un nuevo precio del ítem. */
  onSaved?: (item: { id: number; unitPrice: number; subtotal: number }) => void;
}

export default function BudgetItemApuDialog({ budgetItemId, open, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [scope, setScope] = useState<"item" | "project">("item");
  const [saving, setSaving] = useState(false);

  const queryKey = ["/api/budget-items", budgetItemId, "apu"];
  const { data, isLoading, error, refetch } = useQuery<ItemApuResponse>({
    queryKey,
    queryFn: async () => (await apiRequest("GET", `/api/budget-items/${budgetItemId}/apu`)).json(),
    enabled: open && budgetItemId > 0,
    staleTime: 0,
  });

  useEffect(() => {
    if (!open) setDrafts({});
  }, [open]);

  const apu = data?.apu;
  const item = data?.item;

  const choiceOf = (r: ApuRow): Draft => drafts[rowKey(r)] ?? currentChoice(r);
  const dirtyKeys = useMemo(() => {
    if (!apu) return [] as string[];
    return Object.keys(drafts).filter((k) => {
      const r = apu.rows.find((x) => rowKey(x) === k);
      if (!r) return false;
      const cur = currentChoice(r);
      const d = drafts[k];
      return d.choice !== cur.choice || (d.choice === MANUAL && d.manual !== cur.manual);
    });
  }, [drafts, apu]);

  const preview = useMemo(() => {
    if (!apu) return null;
    return computeApuTotals(
      apu.rows.map((r) => ({
        inputType: r.inputType,
        subtotal: effectiveQuantity(r.quantity, r.wastePct) * priceFor(r, choiceOf(r)),
      })),
      apu.percentages,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apu, drafts]);

  const setDraft = (r: ApuRow, patch: Partial<Draft>) => {
    const k = rowKey(r);
    setDrafts((prev) => ({ ...prev, [k]: { ...(prev[k] ?? currentChoice(r)), ...patch } }));
  };

  const afterServerChange = async () => {
    setDrafts({});
    const fresh = await refetch();
    queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
    if (item) queryClient.invalidateQueries({ queryKey: [`/api/budgets/${item.budgetId}`] });
    const it = fresh.data?.item;
    if (it) onSaved?.({ id: it.id, unitPrice: it.unitPrice, subtotal: it.subtotal });
  };

  const save = async () => {
    if (!apu || !item || dirtyKeys.length === 0) return;
    setSaving(true);
    try {
      for (const k of dirtyKeys) {
        const r = apu.rows.find((x) => rowKey(x) === k)!;
        const d = drafts[k];
        const opt = r.options.find((o) => o.key === d.choice);
        const body: Record<string, unknown> = {
          inputType: r.inputType,
          inputId: r.inputId,
          scope,
          budgetItemId: item.id,
          repriceItemId: item.id,
        };
        if (d.choice === MANUAL) {
          const n = parseFloat(d.manual.replace(",", "."));
          if (!Number.isFinite(n) || n < 0) throw new Error(`Precio manual inválido para ${r.name}`);
          Object.assign(body, { source: "manual", manualPrice: n });
        } else if (d.choice === "market") {
          Object.assign(body, { source: "market" });
        } else if (opt?.source === "quote") {
          Object.assign(body, { source: "quote", quoteId: opt.quoteId ?? null, supplierPriceId: opt.supplierPriceId ?? null });
        } else {
          Object.assign(body, { source: "base" });
        }
        await apiRequest("PUT", `/api/projects/${item.projectId}/price-overrides`, body);
      }
      await afterServerChange();
      toast({
        title: "APU actualizado",
        description: scope === "project" ? "Precios aplicados a todo el proyecto" : "Precios aplicados solo a este ítem",
      });
    } catch (e: any) {
      toast({ title: "No se pudo guardar", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const resetRow = async (r: ApuRow) => {
    if (!item || !r.override) return;
    setSaving(true);
    try {
      const q = new URLSearchParams({
        inputType: r.inputType,
        inputId: String(r.inputId),
        scope: r.override.scope,
        repriceItemId: String(item.id),
      });
      if (r.override.scope === "item") q.set("budgetItemId", String(item.id));
      await apiRequest("DELETE", `/api/projects/${item.projectId}/price-overrides?${q.toString()}`);
      await afterServerChange();
    } catch (e: any) {
      toast({ title: "No se pudo restablecer", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const applyLive = async () => {
    if (!item) return;
    setSaving(true);
    try {
      await apiRequest("POST", `/api/budget-items/${item.id}/reprice`);
      await afterServerChange();
      toast({ title: "Precio del ítem actualizado con el APU en vivo" });
    } catch (e: any) {
      toast({ title: "No se pudo recalcular", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const storedDiffers = item && apu ? Math.abs(item.unitPrice - apu.totalUnitPrice) > 0.005 : false;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-full max-w-[98vw] lg:max-w-6xl max-h-[95vh] overflow-y-auto p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Calculator className="w-5 h-5 text-primary" />
            APU · {apu?.activityName ?? "…"}
          </DialogTitle>
          <DialogDescription>
            {apu ? (
              <>
                Unidad: {apu.unit} · Ciudad: {apu.factorCity || apu.city} (factor mat. ×{apu.factors.materials}, M.O. ×
                {apu.factors.labor}, eq. ×{apu.factors.equipment})
              </>
            ) : (
              "Cargando análisis de precio unitario…"
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading && <Skeleton className="h-64 w-full" />}
        {error && <p className="text-sm text-red-600">No se pudo cargar el APU: {String((error as any)?.message || error)}</p>}

        {apu && item && preview && (
          <div className="space-y-4">
            {!apu.overridesAvailable && (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                La selección de precios por insumo requiere aplicar la migración
                <code className="mx-1">migrations/0001_apu_live_overrides.sql</code>. Se muestra el APU con precios base.
              </div>
            )}
            {apu.warnings.length > 0 && (
              <ul className="text-xs text-amber-700 list-disc ml-5">
                {apu.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Alcance del cambio:</span>
                <RadioGroup
                  value={scope}
                  onValueChange={(v) => setScope(v as "item" | "project")}
                  className="flex gap-4"
                  disabled={!apu.overridesAvailable}
                >
                  <div className="flex items-center gap-1">
                    <RadioGroupItem value="item" id="apu-scope-item" />
                    <Label htmlFor="apu-scope-item" className="text-sm">Solo este ítem</Label>
                  </div>
                  <div className="flex items-center gap-1">
                    <RadioGroupItem value="project" id="apu-scope-project" />
                    <Label htmlFor="apu-scope-project" className="text-sm">Todo el proyecto</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="text-xs text-muted-foreground">
                Precio guardado en el ítem: <b>{bs(item.unitPrice)}</b>
                {item.apuComputedAt ? " (APU en vivo)" : " (precio anterior / manual)"}
              </div>
            </div>

            {(["material", "labor", "equipment"] as ApuInputType[]).map((t) => {
              const rows = apu.rows.filter((r) => r.inputType === t);
              if (rows.length === 0) return null;
              return (
                <div key={t} className="border rounded-md overflow-x-auto">
                  <div className="bg-muted px-3 py-1.5 text-sm font-semibold">{SECTION_TITLES[t]}</div>
                  <table className="w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b">
                        <th className="px-2 py-1">Insumo</th>
                        <th className="px-2 py-1">Unid.</th>
                        <th className="px-2 py-1 text-right">Cant.</th>
                        <th className="px-2 py-1 min-w-[260px]">Precio</th>
                        <th className="px-2 py-1 text-right">Parcial</th>
                        <th className="px-2 py-1 text-right">Δ vs base</th>
                        <th className="px-2 py-1"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const d = choiceOf(r);
                        const price = priceFor(r, d);
                        const eff = effectiveQuantity(r.quantity, r.wastePct);
                        const sub = eff * price;
                        const diff = sub - eff * r.basePrice;
                        const selectable = r.inputId != null && r.options.length > 0 && apu.overridesAvailable;
                        const dirty = dirtyKeys.includes(rowKey(r));
                        return (
                          <tr key={r.compositionId} className={`border-b align-top ${dirty ? "bg-blue-50" : ""}`}>
                            <td className="px-2 py-1.5">
                              <div className="font-medium">{r.name}</div>
                              {r.override && (
                                <Badge variant="outline" className="mt-0.5 text-[10px]">
                                  {r.override.scope === "item" ? "Ajuste de este ítem" : "Ajuste del proyecto"}
                                </Badge>
                              )}
                              {r.sourceRef && <div className="text-[10px] text-muted-foreground">Fuente: {r.sourceRef}</div>}
                              {r.warnings.map((w, i) => (
                                <div key={i} className="text-[10px] text-amber-700 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" /> {w}
                                </div>
                              ))}
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap">{r.unit}</td>
                            <td className="px-2 py-1.5 text-right whitespace-nowrap">
                              {r.quantity.toLocaleString("es-BO", { maximumFractionDigits: 4 })}
                              {r.wastePct > 0 && (
                                <div className="text-[10px] text-muted-foreground">
                                  +{r.wastePct}% desp. = {eff.toLocaleString("es-BO", { maximumFractionDigits: 4 })}
                                </div>
                              )}
                            </td>
                            <td className="px-2 py-1.5">
                              {selectable ? (
                                <div className="space-y-1">
                                  <Select value={d.choice} onValueChange={(v) => setDraft(r, { choice: v })}>
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {r.options.map((o) => (
                                        <SelectItem key={o.key} value={o.key} className="text-xs">
                                          {optionLabel(o)}
                                        </SelectItem>
                                      ))}
                                      <SelectItem value={MANUAL} className="text-xs">
                                        Manual…
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                  {d.choice === MANUAL && (
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={d.manual}
                                      onChange={(e) => setDraft(r, { manual: e.target.value })}
                                      placeholder="Precio unitario Bs"
                                      className="h-8 text-xs"
                                    />
                                  )}
                                </div>
                              ) : (
                                <div>
                                  {bs(r.unitPrice)}
                                  <div className="text-[10px] text-muted-foreground">{r.sourceLabel}</div>
                                </div>
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-right whitespace-nowrap">{bs(sub)}</td>
                            <td
                              className={`px-2 py-1.5 text-right whitespace-nowrap ${
                                diff > 0.005 ? "text-red-600" : diff < -0.005 ? "text-green-700" : "text-muted-foreground"
                              }`}
                            >
                              {signedBs(diff)}
                            </td>
                            <td className="px-1 py-1.5">
                              {r.override && apu.overridesAvailable && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  title="Quitar ajuste (volver a base)"
                                  disabled={saving}
                                  onClick={() => resetRow(r)}
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="text-xs space-y-1 border rounded-md p-3">
                <Line label="Materiales" value={preview.materialsTotal} />
                <Line label="Mano de obra" value={preview.laborTotal} />
                <Line label={`Cargas sociales (${apu.percentages.socialCharges}%)`} value={preview.laborCharges} sub />
                <Line label={`IVA M.O. (${apu.percentages.laborIva}%)`} value={preview.laborIVA} sub />
                <Line label="Mano de obra total" value={preview.laborFinal} />
                <Line label="Equipo" value={preview.equipmentTotal} />
                <Line label={`Herramientas menores (${apu.percentages.minorTools}% de M.O.)`} value={preview.tools} sub />
                <Line label="Costo directo" value={preview.directCost} bold />
                <Line label={`Gastos generales (${apu.percentages.administrative}%)`} value={preview.administrativeCost} sub />
                <Line label={`Utilidad (${apu.percentages.utility}%)`} value={preview.utilityCost} sub />
                <Line label={`IT (${apu.percentages.tax}%)`} value={preview.taxCost} sub />
              </div>
              <div className="border rounded-md p-3 bg-blue-50 flex flex-col justify-between gap-2">
                <div>
                  <div className="text-sm text-muted-foreground">Precio unitario {dirtyKeys.length ? "(vista previa)" : ""}</div>
                  <div className="text-2xl font-bold">{bs(preview.totalUnitPrice)}</div>
                  <div className="text-xs">
                    Base MICAA: {bs(apu.base.totalUnitPrice)} · Diferencia:{" "}
                    <b className={preview.totalUnitPrice - apu.base.totalUnitPrice > 0 ? "text-red-600" : "text-green-700"}>
                      {signedBs(preview.totalUnitPrice - apu.base.totalUnitPrice)}
                    </b>
                  </div>
                  <div className="text-xs mt-1">
                    Subtotal ítem ({item.quantity} {apu.unit}): <b>{bs(preview.totalUnitPrice * item.quantity)}</b>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  {storedDiffers && dirtyKeys.length === 0 && (
                    <Button variant="outline" size="sm" disabled={saving} onClick={applyLive}>
                      Usar este APU en el ítem
                    </Button>
                  )}
                  <Button variant="outline" size="sm" disabled={saving || dirtyKeys.length === 0} onClick={() => setDrafts({})}>
                    Descartar
                  </Button>
                  <Button size="sm" disabled={saving || dirtyKeys.length === 0 || !apu.overridesAvailable} onClick={save}>
                    {saving ? "Guardando…" : `Guardar ${dirtyKeys.length || ""} cambio(s)`}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Line({ label, value, sub, bold }: { label: string; value: number; sub?: boolean; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${sub ? "pl-3 text-muted-foreground" : ""} ${bold ? "font-semibold border-t pt-1" : ""}`}>
      <span>{label}</span>
      <span>{bs(value)}</span>
    </div>
  );
}
