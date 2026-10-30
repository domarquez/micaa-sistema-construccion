import { useEffect, useMemo, useRef, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { AlertTriangle, RotateCcw, Calculator, X } from "lucide-react";
import {
  computeApuTotals,
  effectiveQuantity,
  type ApuInputType,
  type ApuPercentages,
  type ApuPriceOption,
  type ApuRow,
  type ApuTotals,
} from "@shared/apu";
import { cn } from "@/lib/utils";

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
  const unsavedRef = useRef(false);
  const savingRef = useRef(false);

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
      if (d.choice !== cur.choice || (d.choice === MANUAL && d.manual !== cur.manual)) return true;
      // Fallback: resolved draft price differs from the row's current applied price
      return Math.abs(priceFor(r, d) - r.unitPrice) > 0.005;
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
    if (item) {
      queryClient.invalidateQueries({ queryKey: [`/api/budgets/${item.budgetId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", item.projectId] });
    }
    queryClient.invalidateQueries({ queryKey });
    const it = fresh.data?.item;
    if (it) onSaved?.({ id: it.id, unitPrice: it.unitPrice, subtotal: it.subtotal });
    return it;
  };

  const hasUnsaved = dirtyKeys.length > 0;
  unsavedRef.current = hasUnsaved;
  savingRef.current = saving;

  const requestClose = () => {
    if (savingRef.current) return;
    if (unsavedRef.current) {
      const ok = window.confirm("Hay cambios sin guardar en el APU. ¿Salir sin guardar?");
      if (!ok) return;
    }
    onClose();
  };

  // Android/system back while APU is open → confirm if dirty, then close (same as X).
  useEffect(() => {
    if (!open) return;
    const marker = { micaaApuDialog: budgetItemId };
    window.history.pushState(marker, "");
    let closedViaBack = false;
    const onPopState = () => {
      if (savingRef.current) {
        window.history.pushState(marker, "");
        return;
      }
      if (unsavedRef.current) {
        const ok = window.confirm("Hay cambios sin guardar en el APU. ¿Salir sin guardar?");
        if (!ok) {
          window.history.pushState(marker, "");
          return;
        }
      }
      closedViaBack = true;
      onClose();
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      // X / Guardar close: drop the history marker we pushed.
      if (
        !closedViaBack &&
        typeof window !== "undefined" &&
        (window.history.state as { micaaApuDialog?: number } | null)?.micaaApuDialog === budgetItemId
      ) {
        window.history.back();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, budgetItemId]);

  /** Persist draft overrides (or reprice if only stored price differs), then close. */
  const save = async () => {
    if (!apu || !item) return;
    const needsOverrides = dirtyKeys.length > 0;
    const needsRepriceOnly =
      !needsOverrides && Math.abs(item.unitPrice - (preview?.totalUnitPrice ?? apu.totalUnitPrice)) > 0.005;
    if (!needsOverrides && !needsRepriceOnly) return;
    if (needsOverrides && !apu.overridesAvailable) {
      toast({
        title: "No se puede guardar",
        description: "Falta la migración de overrides de precio.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (needsOverrides) {
        for (const k of dirtyKeys) {
          const r = apu.rows.find((x) => rowKey(x) === k)!;
          const d = drafts[k];
          const opt = r.options.find((o) => o.key === d.choice);

          // Volver a base = quitar override (no insertar source=base en ítem)
          if (d.choice === "base" || opt?.source === "base") {
            if (r.override) {
              const q = new URLSearchParams({
                inputType: r.inputType,
                inputId: String(r.inputId),
                scope: scope === "project" ? "project" : r.override.scope,
                repriceItemId: String(item.id),
              });
              if (scope === "item" || r.override.scope === "item") q.set("budgetItemId", String(item.id));
              await apiRequest("DELETE", `/api/projects/${item.projectId}/price-overrides?${q.toString()}`);
            }
            continue;
          }

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
          } else if (d.choice === "market" || opt?.source === "market") {
            Object.assign(body, { source: "market" });
          } else if (opt?.source === "quote") {
            Object.assign(body, {
              source: "quote",
              quoteId: opt.quoteId ?? null,
              supplierPriceId: opt.supplierPriceId ?? null,
            });
          } else {
            throw new Error(`Opción de precio no reconocida para ${r.name}`);
          }
          await apiRequest("PUT", `/api/projects/${item.projectId}/price-overrides`, body);
        }
      } else if (needsRepriceOnly) {
        await apiRequest("POST", `/api/budget-items/${item.id}/reprice`);
      }

      const it = await afterServerChange();
      const pu = it?.unitPrice ?? preview?.totalUnitPrice ?? apu.totalUnitPrice;
      toast({
        title: `APU guardado, P.U. ${bs(pu)}`,
        description:
          scope === "project" && needsOverrides
            ? "Precios aplicados a todo el proyecto"
            : "Precios aplicados solo a este ítem",
      });
      onClose();
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
      const it = await afterServerChange();
      if (it) {
        toast({ title: `APU actualizado, P.U. ${bs(it.unitPrice)}` });
      }
    } catch (e: any) {
      toast({ title: "No se pudo restablecer", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const storedDiffers = item && apu ? Math.abs(item.unitPrice - apu.totalUnitPrice) > 0.005 : false;
  /** Single primary action: drafts to persist, or apply live APU when stored price lags. */
  const canSave =
    !!apu &&
    !!item &&
    !saving &&
    (dirtyKeys.length > 0 ? !!apu.overridesAvailable : storedDiffers);

  const renderPriceControls = (r: ApuRow, d: Draft, selectable: boolean) => {
    if (!selectable) {
      return (
        <div className="min-w-0">
          <div className="whitespace-nowrap">{bs(r.unitPrice)}</div>
          <div className="text-xs text-muted-foreground break-words [overflow-wrap:anywhere]">{r.sourceLabel}</div>
        </div>
      );
    }
    return (
      <div className="space-y-1 min-w-0 w-full">
        <Select value={d.choice} onValueChange={(v) => setDraft(r, { choice: v })}>
          <SelectTrigger className="h-8 text-xs w-full min-w-0">
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
    );
  };

  const renderMobileCard = (r: ApuRow) => {
    const d = choiceOf(r);
    const price = priceFor(r, d);
    const eff = effectiveQuantity(r.quantity, r.wastePct);
    const sub = eff * price;
    const selectable = r.inputId != null && r.options.length > 0 && !!apu?.overridesAvailable;
    const dirty = dirtyKeys.includes(rowKey(r));
    return (
      <div
        key={r.compositionId}
        className={cn(
          "border-b last:border-b-0 px-3 py-2.5 space-y-2",
          dirty && "bg-primary/10",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm break-words [overflow-wrap:anywhere] [hyphens:none]">
              {r.name}
            </div>
            {r.override && (
              <Badge variant="outline" className="mt-0.5 text-xs">
                {r.override.scope === "item" ? "Ajuste de este ítem" : "Ajuste del proyecto"}
              </Badge>
            )}
            {r.sourceRef && <div className="text-xs text-muted-foreground break-words">Fuente: {r.sourceRef}</div>}
            {r.warnings.map((w, i) => (
              <div key={i} className="text-xs text-amber-700 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0" /> {w}
              </div>
            ))}
          </div>
          {r.override && apu?.overridesAvailable && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 shrink-0"
              title="Quitar ajuste (volver a base)"
              disabled={saving}
              onClick={() => resetRow(r)}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        <div className="grid grid-cols-4 gap-1.5 text-xs items-end">
          <div className="min-w-0">
            <div className="text-muted-foreground">Unid</div>
            <div className="font-medium truncate">{r.unit}</div>
          </div>
          <div className="min-w-0">
            <div className="text-muted-foreground">Cant</div>
            <div className="font-medium tabular-nums">
              {r.quantity.toLocaleString("es-BO", { maximumFractionDigits: 4 })}
            </div>
            {r.wastePct > 0 && (
              <div className="text-[10px] text-muted-foreground leading-tight">
                +{r.wastePct}% = {eff.toLocaleString("es-BO", { maximumFractionDigits: 4 })}
              </div>
            )}
          </div>
          <div className="min-w-0 col-span-1">
            <div className="text-muted-foreground">P.U.</div>
            {selectable && d.choice === MANUAL ? (
              <Input
                type="number"
                min="0"
                step="0.01"
                value={d.manual}
                onChange={(e) => setDraft(r, { manual: e.target.value })}
                className="h-7 text-xs px-1"
              />
            ) : (
              <div className="font-medium tabular-nums whitespace-nowrap text-[11px] sm:text-xs">{bs(price)}</div>
            )}
          </div>
          <div className="min-w-0 text-right">
            <div className="text-muted-foreground">Parcial</div>
            <div className="font-semibold tabular-nums whitespace-nowrap text-[11px] sm:text-xs">{bs(sub)}</div>
          </div>
        </div>

        {selectable && (
          <div className="pt-0.5">
            <Select
              value={d.choice}
              onValueChange={(v) => {
                if (v === MANUAL && !d.manual) {
                  setDraft(r, { choice: v, manual: String(r.unitPrice) });
                } else {
                  setDraft(r, { choice: v });
                }
              }}
            >
              <SelectTrigger className="h-8 text-xs w-full">
                <SelectValue placeholder="Fuente de precio" />
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
          </div>
        )}
      </div>
    );
  };

  const renderDesktopRow = (r: ApuRow) => {
    const d = choiceOf(r);
    const price = priceFor(r, d);
    const eff = effectiveQuantity(r.quantity, r.wastePct);
    const sub = eff * price;
    const diff = sub - eff * r.basePrice;
    const selectable = r.inputId != null && r.options.length > 0 && !!apu?.overridesAvailable;
    const dirty = dirtyKeys.includes(rowKey(r));
    return (
      <tr key={r.compositionId} className={`border-b align-top ${dirty ? "bg-primary/10" : ""}`}>
        <td className="px-2 py-1.5">
          <div className="font-medium break-words [hyphens:none]">{r.name}</div>
          {r.override && (
            <Badge variant="outline" className="mt-0.5 text-xs">
              {r.override.scope === "item" ? "Ajuste de este ítem" : "Ajuste del proyecto"}
            </Badge>
          )}
          {r.sourceRef && <div className="text-xs text-muted-foreground">Fuente: {r.sourceRef}</div>}
          {r.warnings.map((w, i) => (
            <div key={i} className="text-xs text-amber-700 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {w}
            </div>
          ))}
        </td>
        <td className="px-2 py-1.5 whitespace-nowrap">{r.unit}</td>
        <td className="px-2 py-1.5 text-right whitespace-nowrap">
          {r.quantity.toLocaleString("es-BO", { maximumFractionDigits: 4 })}
          {r.wastePct > 0 && (
            <div className="text-xs text-muted-foreground">
              +{r.wastePct}% desp. = {eff.toLocaleString("es-BO", { maximumFractionDigits: 4 })}
            </div>
          )}
        </td>
        <td className="px-2 py-1.5 min-w-[220px]">{renderPriceControls(r, d, selectable)}</td>
        <td className="px-2 py-1.5 text-right whitespace-nowrap">{bs(sub)}</td>
        <td
          className={`px-2 py-1.5 text-right whitespace-nowrap ${
            diff > 0.005 ? "text-red-600" : diff < -0.005 ? "text-green-700" : "text-muted-foreground"
          }`}
        >
          {signedBs(diff)}
        </td>
        <td className="px-1 py-1.5">
          {r.override && apu?.overridesAvailable && (
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
  };

  const sectionSubtotal = (t: ApuInputType) => {
    if (!apu) return 0;
    return apu.rows
      .filter((r) => r.inputType === t)
      .reduce((sum, r) => {
        const d = choiceOf(r);
        const price = priceFor(r, d);
        return sum + effectiveQuantity(r.quantity, r.wastePct) * price;
      }, 0);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) requestClose(); }}>
      <DialogContent
        hideCloseButton
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          requestClose();
        }}
        onPointerDownOutside={(e) => {
          // Fullscreen mobile: never dismiss by tapping outside; use X / back / Guardar.
          if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
            e.preventDefault();
          }
        }}
        className={cn(
          "apu-dialog flex flex-col gap-0 overflow-hidden p-0",
          "w-full max-w-[98vw] lg:max-w-6xl",
          "max-md:h-[100dvh] max-md:max-h-[100dvh] max-md:rounded-none",
          "md:max-h-[95vh]",
        )}
      >
        {/* Sticky header: title + always-visible X (above body; default Dialog X hidden) */}
        <div className="sticky top-0 z-20 shrink-0 border-b bg-background px-3 pt-3 pb-2 pr-12 md:px-6 md:pt-5 md:pb-3 md:pr-14">
          <button
            type="button"
            aria-label="Cerrar APU"
            className="absolute right-3 top-3 z-30 inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground md:right-4 md:top-4"
            onClick={requestClose}
            disabled={saving}
          >
            <X className="h-4 w-4" />
          </button>
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="flex items-start gap-2 text-base sm:text-lg leading-snug break-words [hyphens:none] [overflow-wrap:anywhere]">
              <Calculator className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <span className="min-w-0">APU · {apu?.activityName ?? "…"}</span>
            </DialogTitle>
            <DialogDescription className="text-left text-xs sm:text-sm break-words [hyphens:none]">
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
          {item && (
            <div className="mt-1.5 text-xs text-muted-foreground">
              Precio guardado en el ítem: <b className="text-foreground whitespace-nowrap">{bs(item.unitPrice)}</b>
              {item.apuComputedAt ? " (APU en vivo)" : " (precio anterior / manual)"}
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-3 md:px-6 md:py-4 space-y-4">
          {isLoading && <Skeleton className="h-64 w-full" />}
          {error && <p className="text-sm text-red-600">No se pudo cargar el APU: {String((error as any)?.message || error)}</p>}

          {apu && item && preview && (
            <>
              {!apu.overridesAvailable && (
                <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span className="min-w-0 break-words [hyphens:none]">
                    La selección de precios por insumo requiere aplicar la migración
                    <code className="mx-1">migrations/0001_apu_live_overrides.sql</code>. Se muestra el APU con precios base.
                  </span>
                </div>
              )}
              {apu.warnings.length > 0 && (
                <ul className="text-xs text-amber-700 list-disc ml-5">
                  {apu.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}

              {/* Alcance: full-width segmented control */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Alcance del cambio</Label>
                <div
                  role="radiogroup"
                  aria-label="Alcance del cambio"
                  className={cn(
                    "grid grid-cols-2 rounded-lg border bg-muted/40 p-0.5 gap-0.5",
                    !apu.overridesAvailable && "opacity-50 pointer-events-none",
                  )}
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={scope === "item"}
                    disabled={!apu.overridesAvailable}
                    onClick={() => setScope("item")}
                    className={cn(
                      "rounded-md px-2 py-2 text-sm font-medium transition-colors text-center break-words [hyphens:none]",
                      scope === "item"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Solo este ítem
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={scope === "project"}
                    disabled={!apu.overridesAvailable}
                    onClick={() => setScope("project")}
                    className={cn(
                      "rounded-md px-2 py-2 text-sm font-medium transition-colors text-center break-words [hyphens:none]",
                      scope === "project"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Todo el proyecto
                  </button>
                </div>
              </div>

              {(["material", "labor", "equipment"] as ApuInputType[]).map((t) => {
                const rows = apu.rows.filter((r) => r.inputType === t);
                if (rows.length === 0) return null;
                const sub = sectionSubtotal(t);
                return (
                  <div key={t} className="border rounded-md overflow-hidden">
                    <div className="bg-muted px-3 py-1.5 text-sm font-semibold flex items-center justify-between gap-2">
                      <span className="min-w-0 break-words [hyphens:none]">{SECTION_TITLES[t]}</span>
                      <span className="text-xs font-medium whitespace-nowrap shrink-0 md:hidden">{bs(sub)}</span>
                    </div>

                    {/* Mobile: card list */}
                    <div className="md:hidden">{rows.map(renderMobileCard)}</div>
                    <div className="md:hidden px-3 py-2 bg-muted/30 flex justify-between text-sm font-semibold border-t">
                      <span>Subtotal</span>
                      <span className="whitespace-nowrap tabular-nums">{bs(sub)}</span>
                    </div>

                    {/* Desktop: table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-sm">
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
                        <tbody>{rows.map(renderDesktopRow)}</tbody>
                      </table>
                    </div>
                  </div>
                );
              })}

              {/* Totals breakdown (scrolls with body; sticky footer shows Total + Guardar) */}
              <div className="grid md:grid-cols-2 gap-4 pb-2">
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
                <div className="border rounded-md p-3 bg-primary/10 hidden md:flex flex-col justify-between gap-2">
                  <div>
                    <div className="text-sm text-muted-foreground">Precio unitario {dirtyKeys.length ? "(vista previa)" : ""}</div>
                    <div className="text-2xl font-bold whitespace-nowrap">{bs(preview.totalUnitPrice)}</div>
                    <div className="text-xs">
                      Base MICAA: {bs(apu.base.totalUnitPrice)} · Diferencia:{" "}
                      <b className={preview.totalUnitPrice - apu.base.totalUnitPrice > 0 ? "text-red-600" : "text-green-700"}>
                        {signedBs(preview.totalUnitPrice - apu.base.totalUnitPrice)}
                      </b>
                    </div>
                    <div className="text-xs mt-1">
                      Subtotal ítem ({item.quantity} {apu.unit}): <b className="whitespace-nowrap">{bs(preview.totalUnitPrice * item.quantity)}</b>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <Button variant="outline" size="sm" disabled={saving || dirtyKeys.length === 0} onClick={() => setDrafts({})}>
                      Descartar
                    </Button>
                    <Button size="sm" disabled={!canSave} onClick={save}>
                      {saving
                        ? "Guardando…"
                        : dirtyKeys.length
                          ? `Guardar (${dirtyKeys.length})`
                          : storedDiffers
                            ? "Guardar P.U."
                            : "Guardar"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Mobile-only: base/diff + apply live inside body */}
              <div className="md:hidden text-xs space-y-1 border rounded-md p-3 bg-muted/20">
                <div>
                  Base MICAA: {bs(apu.base.totalUnitPrice)} · Diferencia:{" "}
                  <b className={preview.totalUnitPrice - apu.base.totalUnitPrice > 0 ? "text-red-600" : "text-green-700"}>
                    {signedBs(preview.totalUnitPrice - apu.base.totalUnitPrice)}
                  </b>
                </div>
                <div>
                  Subtotal ítem ({item.quantity} {apu.unit}):{" "}
                  <b className="whitespace-nowrap">{bs(preview.totalUnitPrice * item.quantity)}</b>
                </div>
                {dirtyKeys.length > 0 && (
                  <Button variant="outline" size="sm" className="w-full mt-1" disabled={saving} onClick={() => setDrafts({})}>
                    Descartar cambios
                  </Button>
                )}
                {storedDiffers && dirtyKeys.length === 0 && (
                  <p className="text-amber-800 mt-1">
                    El P.U. guardado del ítem difiere del APU en vivo. Pulsa <b>Guardar</b> para actualizarlo.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Sticky footer: Total APU + Guardar (mobile always; desktop also for consistency on short screens) */}
        {apu && item && preview && (
          <div className="sticky bottom-0 z-10 shrink-0 border-t bg-background px-3 py-2.5 md:px-6 md:py-3 flex items-center justify-between gap-3 safe-pb">
            <div className="min-w-0">
              <div className="text-[11px] text-muted-foreground leading-tight">
                Total APU{dirtyKeys.length ? " (vista previa)" : ""}
              </div>
              <div className="text-lg md:text-xl font-bold tabular-nums whitespace-nowrap">{bs(preview.totalUnitPrice)}</div>
            </div>
            <Button
              size="default"
              className="shrink-0 min-w-[7.5rem]"
              disabled={!canSave}
              onClick={save}
            >
              {saving
                ? "Guardando…"
                : dirtyKeys.length
                  ? `Guardar (${dirtyKeys.length})`
                  : storedDiffers
                    ? "Guardar P.U."
                    : "Guardar"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Line({ label, value, sub, bold }: { label: string; value: number; sub?: boolean; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 ${sub ? "pl-3 text-muted-foreground" : ""} ${bold ? "font-semibold border-t pt-1" : ""}`}>
      <span className="min-w-0 break-words [hyphens:none]">{label}</span>
      <span className="shrink-0 whitespace-nowrap tabular-nums">{bs(value)}</span>
    </div>
  );
}
