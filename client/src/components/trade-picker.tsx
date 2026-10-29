import { useMemo, useState } from "react";
import {
  TRADE_GROUPS,
  tradesInGroup,
  type TradeGroup,
} from "@shared/company-trades";

type Props = {
  selected: string[];
  customTrades: string[];
  onChange: (next: { trades: string[]; customTrades: string[] }) => void;
  /** Compact for listing filters */
  mode?: "edit" | "filter";
  activeGroup?: TradeGroup | "all" | null;
  onGroupChange?: (g: TradeGroup | "all") => void;
};

export function TradePicker({
  selected,
  customTrades,
  onChange,
  mode = "edit",
  activeGroup,
  onGroupChange,
}: Props) {
  const [group, setGroup] = useState<TradeGroup | "all">(activeGroup || "all");
  const [customDraft, setCustomDraft] = useState("");

  const effectiveGroup = activeGroup ?? group;

  const list = useMemo(() => {
    if (effectiveGroup === "all") {
      return [...tradesInGroup("materiales"), ...tradesInGroup("servicios")];
    }
    return tradesInGroup(effectiveGroup);
  }, [effectiveGroup]);

  const toggle = (slug: string) => {
    if (mode === "filter") {
      onChange({
        trades: selected.includes(slug) ? [] : [slug],
        customTrades,
      });
      return;
    }
    const next = selected.includes(slug)
      ? selected.filter((s) => s !== slug)
      : [...selected, slug];
    let nextCustom = customTrades;
    if (!next.includes("otro_servicio")) nextCustom = [];
    onChange({ trades: next, customTrades: nextCustom });
  };

  const setG = (g: TradeGroup | "all") => {
    setGroup(g);
    onGroupChange?.(g);
    if (mode === "filter") onChange({ trades: [], customTrades });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setG("all")}
          className={`rounded-full border px-3 py-1.5 text-sm ${
            effectiveGroup === "all"
              ? "border-[var(--micaa-accent)] bg-[var(--micaa-accent)]/10 text-[var(--micaa-accent)]"
              : "border-[var(--micaa-line)]"
          }`}
        >
          Todos
        </button>
        {TRADE_GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setG(g.id)}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              effectiveGroup === g.id
                ? "border-[var(--micaa-accent)] bg-[var(--micaa-accent)]/10 text-[var(--micaa-accent)]"
                : "border-[var(--micaa-line)]"
            }`}
          >
            <span className="mr-1" aria-hidden>{g.icon}</span>
            {g.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {list.map((t) => {
          const on = selected.includes(t.slug);
          return (
            <button
              key={t.slug}
              type="button"
              onClick={() => toggle(t.slug)}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs sm:text-sm ${
                on
                  ? "border-[var(--micaa-accent)] bg-[var(--micaa-accent)] text-white"
                  : "border-[var(--micaa-line)] bg-white hover:border-[var(--micaa-accent)]/50"
              }`}
            >
              <span aria-hidden>{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </div>

      {mode === "edit" && selected.includes("otro_servicio") && (
        <div className="space-y-2">
          <label className="block text-sm font-medium">Otro servicio (texto libre)</label>
          <div className="flex gap-2">
            <input
              className="h-10 flex-1 rounded-lg border border-[var(--micaa-line)] px-3 text-base"
              placeholder="Ej. corte router MDF"
              value={customDraft}
              onChange={(e) => setCustomDraft(e.target.value)}
              maxLength={80}
            />
            <button
              type="button"
              className="h-10 shrink-0 rounded-lg bg-[var(--micaa-accent)] px-3 text-sm text-white"
              onClick={() => {
                const v = customDraft.trim();
                if (v.length < 2) return;
                if (customTrades.includes(v)) return;
                onChange({
                  trades: selected,
                  customTrades: [...customTrades, v].slice(0, 5),
                });
                setCustomDraft("");
              }}
            >
              Agregar
            </button>
          </div>
          {customTrades.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {customTrades.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs"
                >
                  {c}
                  <button
                    type="button"
                    className="opacity-60 hover:opacity-100"
                    onClick={() =>
                      onChange({
                        trades: selected,
                        customTrades: customTrades.filter((x) => x !== c),
                      })
                    }
                    aria-label={`Quitar ${c}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
