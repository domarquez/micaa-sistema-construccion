import { useQuery } from "@tanstack/react-query";

type ExchangeRateResponse = {
  rate: number;
  date: string; // YYYY-MM-DD
  source: string;
};

function formatBs(rate: number): string {
  return rate.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateShort(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!m) return isoDate;
  return `${m[3]}/${m[2]}`;
}

/** Indicador compacto: «Dólar oficial BCB: Bs 12,12 · 29/10» */
export function BcbExchangeRate({ className = "" }: { className?: string }) {
  const { data } = useQuery<ExchangeRateResponse>({
    queryKey: ["/api/exchange-rate"],
    queryFn: async () => {
      const res = await fetch("/api/exchange-rate");
      if (!res.ok) throw new Error("fx");
      return res.json();
    },
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });

  if (!data?.rate) return null;

  return (
    <p
      className={`text-[11px] sm:text-xs text-[var(--micaa-muted)] ${className}`}
      title={`Fuente: ${data.source}`}
      data-testid="bcb-exchange-rate"
    >
      <span className="text-[var(--micaa-fg)]">Dólar oficial BCB:</span>{" "}
      <span className="font-mono font-semibold text-[var(--micaa-accent,#C2410C)]">
        Bs {formatBs(data.rate)}
      </span>
      <span className="mx-1 text-[var(--micaa-line)]">·</span>
      <span className="font-mono">{formatDateShort(data.date)}</span>
    </p>
  );
}
