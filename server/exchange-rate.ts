/**
 * Tipo de cambio oficial BCB (TCO): fetch diario, historial y lectura pública.
 * Fuente primaria: bcb_tco_publico_ultima_cotizacion.php
 * Fallback: librerias/indicadores/dolar/bolsin.php
 */
import * as cheerio from "cheerio";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { exchangeRates, priceSettings } from "../shared/schema";

export const BCB_TCO_URL =
  "https://www.bcb.gob.bo/bcb_tco_publico_ultima_cotizacion.php";
export const BCB_BOLSIN_URL =
  "https://www.bcb.gob.bo/librerias/indicadores/dolar/bolsin.php";

export type ExchangeRateInfo = {
  rate: number;
  date: string; // YYYY-MM-DD (vigencia)
  source: string;
  fetchedAt?: string;
};

const MONTHS_ES: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

function parseSpanishDate(raw: string): string | null {
  const m = raw
    .normalize("NFC")
    .toLowerCase()
    .match(/(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})/i);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const monthName = m[2]
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace("setiembre", "septiembre");
  const year = parseInt(m[3], 10);
  const month = MONTHS_ES[monthName];
  if (!month || !day || !year) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseRateToken(token: string): number | null {
  const n = parseFloat(token.replace(/\./g, "").replace(",", "."));
  // BCB rates are around 6–20 nowadays; reject absurd
  if (!Number.isFinite(n) || n < 1 || n > 100) return null;
  return Math.round(n * 10000) / 10000;
}

/** Extract TCO rate + vigencia date from BCB HTML. */
export function parseBcbTcoHtml(html: string): { rate: number; date: string } | null {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");

  // "Bs 12,12/$us" or "Bs 12,12 / $us"
  const rateMatch =
    text.match(/Bs\s*([\d]{1,3}(?:[.,]\d{1,4})?)\s*\/\s*\$?\s*us/i) ||
    text.match(/TCO[^\d]{0,40}?([\d]{1,3}(?:[.,]\d{1,4})?)/i);
  if (!rateMatch) return null;
  const rate = parseRateToken(rateMatch[1]);
  if (rate == null) return null;

  // Prefer vigencia date
  const vigMatch = text.match(/VIGENCIA[:\s]+([^.]{10,80}?)(?:\.|$)/i);
  let date =
    (vigMatch && parseSpanishDate(vigMatch[1])) ||
    null;

  if (!date) {
    // Fallback: last table row with a Spanish date
    const dates = [...text.matchAll(/(\d{1,2}\s+de\s+[a-záéíóúñ]+\s+de\s+\d{4})/gi)];
    if (dates.length > 0) {
      date = parseSpanishDate(dates[dates.length - 1][1]);
    }
  }

  if (!date) {
    // Local Bolivia date as last resort
    date = new Date().toLocaleDateString("en-CA", { timeZone: "America/La_Paz" });
  }

  return { rate, date };
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "MICAA/1.0 (+https://micaa.site; exchange-rate)",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`BCB fetch ${url} → HTTP ${res.status}`);
  return await res.text();
}

async function syncPriceSettings(rate: number): Promise<void> {
  try {
    const rows = await db.select().from(priceSettings).limit(1);
    if (rows.length === 0) {
      await db.insert(priceSettings).values({
        usdExchangeRate: rate.toFixed(4),
        inflationFactor: "1.0000",
        globalAdjustmentFactor: "1.0000",
        updatedBy: "bcb_tco",
        lastUpdated: new Date(),
      });
    } else {
      await db
        .update(priceSettings)
        .set({
          usdExchangeRate: rate.toFixed(4),
          updatedBy: "bcb_tco",
          lastUpdated: new Date(),
        })
        .where(eq(priceSettings.id, rows[0].id));
    }
  } catch (e) {
    console.warn("[exchange-rate] price_settings sync failed (non-fatal):", e);
  }
}

/** Persist (upsert by rate_date) and sync price_settings. */
export async function storeExchangeRate(
  info: { rate: number; date: string; source: string },
): Promise<ExchangeRateInfo> {
  const inserted = await db
    .insert(exchangeRates)
    .values({
      rateDate: info.date,
      rate: info.rate.toFixed(4),
      source: info.source,
      fetchedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: exchangeRates.rateDate,
      set: {
        rate: info.rate.toFixed(4),
        source: info.source,
        fetchedAt: new Date(),
      },
    })
    .returning();

  await syncPriceSettings(info.rate);

  const row = inserted[0];
  return {
    rate: parseFloat(String(row.rate)),
    date: String(row.rateDate),
    source: row.source,
    fetchedAt: row.fetchedAt ? new Date(row.fetchedAt).toISOString() : undefined,
  };
}

/** Fetch from BCB (primary then fallback), store, return. Throws if both fail. */
export async function fetchAndStoreOfficialRate(): Promise<ExchangeRateInfo> {
  const attempts: { url: string; source: string }[] = [
    { url: BCB_TCO_URL, source: "bcb_tco" },
    { url: BCB_BOLSIN_URL, source: "bcb_bolsin" },
  ];
  let lastErr: unknown;
  for (const a of attempts) {
    try {
      const html = await fetchHtml(a.url);
      const parsed = parseBcbTcoHtml(html);
      if (!parsed) throw new Error(`Could not parse TCO from ${a.source}`);
      const stored = await storeExchangeRate({
        rate: parsed.rate,
        date: parsed.date,
        source: a.source,
      });
      console.log(
        `[exchange-rate] OK ${stored.rate} Bs/$us vigencia ${stored.date} (${stored.source})`,
      );
      return stored;
    } catch (e) {
      lastErr = e;
      console.warn(`[exchange-rate] fetch failed (${a.source}):`, e);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** Latest stored rate, or null if none. */
export async function getLatestExchangeRate(): Promise<ExchangeRateInfo | null> {
  const rows = await db
    .select()
    .from(exchangeRates)
    .orderBy(desc(exchangeRates.rateDate), desc(exchangeRates.fetchedAt))
    .limit(1);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    rate: parseFloat(String(r.rate)),
    date: String(r.rateDate),
    source: r.source,
    fetchedAt: r.fetchedAt ? new Date(r.fetchedAt).toISOString() : undefined,
  };
}

/**
 * Boot + daily schedule helper.
 * On fetch failure: keep last known value and log (does not throw).
 */
export async function refreshExchangeRateSafe(reason: string): Promise<ExchangeRateInfo | null> {
  try {
    return await fetchAndStoreOfficialRate();
  } catch (e) {
    const last = await getLatestExchangeRate();
    console.error(
      `[exchange-rate] ${reason} failed; keeping last known:`,
      last ? `${last.rate} (${last.date})` : "none",
      e,
    );
    return last;
  }
}

/** Normalize currency codes from ingest payloads. */
export function normalizeCurrency(raw: string | undefined | null): "BOB" | "USD" | string {
  const c = String(raw ?? "BOB")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!c || c === "BOB" || c === "BS" || c === "BS." || c === "BOLIVIANOS" || c === "B$") {
    return "BOB";
  }
  if (
    c === "USD" ||
    c === "US$" ||
    c === "$" ||
    c === "$US" ||
    c === "USS" ||
    c === "DOLAR" ||
    c === "DÓLAR" ||
    c === "DOLARES" ||
    c === "DÓLARES" ||
    c === "DOLLAR" ||
    c === "DOLLARS"
  ) {
    return "USD";
  }
  return c;
}

/**
 * Convert ingest price to BOB using today's TCO when currency is USD.
 * Returns { priceBob, originalCurrency, originalAmount, fxRate }.
 */
export async function convertIngestPriceToBob(
  price: number,
  currencyRaw: string | undefined | null,
): Promise<
  | { ok: true; priceBob: number; currency: "BOB"; originalCurrency: string | null; originalAmount: number | null; fxRate: number | null }
  | { ok: false; error: string; code: string }
> {
  const currency = normalizeCurrency(currencyRaw);
  if (currency === "BOB") {
    return {
      ok: true,
      priceBob: Math.round(price * 100) / 100,
      currency: "BOB",
      originalCurrency: null,
      originalAmount: null,
      fxRate: null,
    };
  }
  if (currency !== "USD") {
    return {
      ok: false,
      error: `Unsupported currency ${currency}; use BOB or USD`,
      code: "validation_error",
    };
  }
  let rateInfo = await getLatestExchangeRate();
  if (!rateInfo) {
    rateInfo = await refreshExchangeRateSafe("on-demand-usd-ingest");
  }
  if (!rateInfo) {
    return {
      ok: false,
      error: "No BCB exchange rate available to convert USD",
      code: "fx_unavailable",
    };
  }
  const priceBob = Math.round(price * rateInfo.rate * 100) / 100;
  return {
    ok: true,
    priceBob,
    currency: "BOB",
    originalCurrency: "USD",
    originalAmount: Math.round(price * 10000) / 10000,
    fxRate: rateInfo.rate,
  };
}

/** Ensure tables/columns exist (idempotent boot migration). */
export async function ensureExchangeRateSchema(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS exchange_rates (
        id bigserial PRIMARY KEY,
        rate_date date NOT NULL,
        rate numeric(12, 4) NOT NULL,
        source text NOT NULL DEFAULT 'bcb_tco',
        fetched_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT exchange_rates_rate_date_unique UNIQUE (rate_date)
      )
    `);
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS exchange_rates_fetched_at_idx ON exchange_rates (fetched_at DESC)`,
    );
    await db.execute(
      sql`ALTER TABLE user_material_prices ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'BOB'`,
    );
    await db.execute(
      sql`ALTER TABLE user_material_prices ADD COLUMN IF NOT EXISTS original_currency text`,
    );
    await db.execute(
      sql`ALTER TABLE user_material_prices ADD COLUMN IF NOT EXISTS original_amount numeric(14, 4)`,
    );
    await db.execute(
      sql`ALTER TABLE user_material_prices ADD COLUMN IF NOT EXISTS fx_rate numeric(12, 4)`,
    );
    console.log("[migrate] exchange_rates + quote FX columns OK");
  } catch (e) {
    console.error("[migrate] exchange_rates failed (non-fatal):", e);
  }
}
