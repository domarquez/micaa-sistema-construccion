/** Variantes de búsqueda: completa, sin números de casa, y cada tramo separado por comas (del último al primero). */
export function addressCandidates(a: string): string[] {
  const out: string[] = [];
  const add = (x: string) => {
    const t = x.replace(/\s+/g, " ").trim();
    if (t.length >= 3 && !out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
  };
  add(a);
  add(a.replace(/^(barrio|b\/|zona|urb\.?|urbanizaci[oó]n|condominio|villa)\s+/i, ""));
  add(a.replace(/\b(n[°ºo.]?\s*)?\d{1,5}\b/gi, " ").replace(/\s*,\s*,/g, ","));
  const parts = a.split(/[,;\/]| - /).map((x) => x.trim()).filter(Boolean);
  if (parts.length > 1) for (const part of parts.reverse()) add(part);
  return out;
}

/**
 * Geocodificación (OSM Nominatim) + distancia por calle (OSRM público), solo server-side.
 *
 * - Nominatim: User-Agent propio, máx. 1 req/s (cola global), timeout, caché en memoria +
 *   tabla geocode_cache (migración 0005; si no existe, solo memoria). Caché negativa 7 días.
 * - OSRM: router.project-osrm.org; si falla → línea recta × TRANSPORT.straightLineRoadFactor.
 */
import { db } from "./db";
import { sql } from "drizzle-orm";
import { TRANSPORT, haversineKm, round1, type CityKmZero } from "../shared/transport";

const UA =
  process.env.GEOCODER_USER_AGENT ||
  "MICAA-presupuestos/1.0 (+https://micaa.site; geocodificacion de obras, bajo volumen)";
const NOMINATIM_URL = process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org/search";
const OSRM_URL = process.env.OSRM_URL || "https://router.project-osrm.org";
const MIN_INTERVAL_MS = 1100;
const TIMEOUT_MS = 6000;
const POS_TTL_MS = 90 * 24 * 3600 * 1000;
const NEG_TTL_MS = 7 * 24 * 3600 * 1000;

export interface GeoPoint {
  lat: number;
  lng: number;
}
export interface GeocodeResult extends GeoPoint {
  displayName: string;
}

function rowsOf(r: any): any[] {
  return Array.isArray(r) ? r : r?.rows ?? [];
}

async function fetchJson(url: string, timeoutMs = TIMEOUT_MS): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "es", Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// --- Cola global Nominatim (≥ 1.1 s entre peticiones) ---------------------------------
let chain: Promise<unknown> = Promise.resolve();
let lastCall = 0;
function nominatimQueued<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = lastCall + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    try {
      return await fn();
    } finally {
      lastCall = Date.now();
    }
  });
  chain = run.catch(() => undefined);
  return run;
}

// --- Caché -------------------------------------------------------------------------------
const mem = new Map<string, { at: number; v: GeocodeResult | null }>();
let cacheTableOk: boolean | null = null;

async function cacheTable(): Promise<boolean> {
  if (cacheTableOk !== null) return cacheTableOk;
  try {
    const r = rowsOf(await db.execute(sql`SELECT to_regclass('geocode_cache') IS NOT NULL AS ok`));
    cacheTableOk = !!r[0]?.ok;
  } catch {
    cacheTableOk = false;
  }
  return cacheTableOk;
}

async function cacheGet(key: string): Promise<{ hit: boolean; v: GeocodeResult | null }> {
  const m = mem.get(key);
  if (m && Date.now() - m.at < (m.v ? POS_TTL_MS : NEG_TTL_MS)) return { hit: true, v: m.v };
  if (!(await cacheTable())) return { hit: false, v: null };
  try {
    const r = rowsOf(
      await db.execute(sql`SELECT latitude, longitude, display_name, created_at FROM geocode_cache WHERE query = ${key}`),
    )[0];
    if (!r) return { hit: false, v: null };
    const age = Date.now() - new Date(r.created_at).getTime();
    const v = r.latitude != null ? { lat: Number(r.latitude), lng: Number(r.longitude), displayName: String(r.display_name || "") } : null;
    if (age > (v ? POS_TTL_MS : NEG_TTL_MS)) return { hit: false, v: null };
    mem.set(key, { at: Date.now() - age, v });
    return { hit: true, v };
  } catch {
    return { hit: false, v: null };
  }
}

async function cacheSet(key: string, v: GeocodeResult | null) {
  mem.set(key, { at: Date.now(), v });
  if (!(await cacheTable())) return;
  try {
    await db.execute(sql`
      INSERT INTO geocode_cache (query, latitude, longitude, display_name, provider, created_at)
      VALUES (${key}, ${v ? v.lat : null}, ${v ? v.lng : null}, ${v ? v.displayName.slice(0, 500) : null}, 'nominatim', now())
      ON CONFLICT (query) DO UPDATE SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
        display_name = EXCLUDED.display_name, created_at = now()`);
  } catch (e) {
    console.warn("geocode_cache write failed:", (e as any)?.message);
  }
}

export function normalizeQuery(address: string, city: string): string {
  return `${address}|${city}`.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 300);
}

/** "-17.78, -63.18" → punto (pin pegado en el campo dirección). */
export function parseLatLng(s: string | null | undefined): GeoPoint | null {
  const m = String(s || "").trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return null;
  return { lat, lng };
}

async function nominatimSearch(q: string, kz: CityKmZero | null, bounded: boolean): Promise<GeocodeResult | null> {
  const p = new URLSearchParams({ format: "jsonv2", limit: "1", countrycodes: "bo", q, "accept-language": "es" });
  if (kz && bounded) {
    const d = 0.6;
    p.set("viewbox", `${kz.center.lng - d},${kz.center.lat + d},${kz.center.lng + d},${kz.center.lat - d}`);
    p.set("bounded", "1");
  }
  const data = await nominatimQueued(() => fetchJson(`${NOMINATIM_URL}?${p.toString()}`));
  const hit = Array.isArray(data) ? data[0] : null;
  if (!hit) return null;
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, displayName: String(hit.display_name || "") };
}

/**
 * Geocodifica "dirección, ciudad, Bolivia". Primero acotado a ±0.6° del km cero de la ciudad;
 * si no hay resultado, sin acotar pero rechazando resultados a más de 150 km del km cero.
 */
export async function geocodeAddress(address: string, city: string, kz: CityKmZero | null): Promise<GeocodeResult | null> {
  const a = String(address || "").trim();
  if (a.length < 2) return null;
  const key = normalizeQuery(a, city);
  const c = await cacheGet(key);
  if (c.hit) return c.v;
  let r: GeocodeResult | null = null;
  try {
    // Nominatim free-form falla con direcciones compuestas ("Av. X, Barrio Y"): probar variantes
    // (máx. 3 acotadas a la ciudad + 1 sin acotar), siempre a ≤ 1 req/s.
    const cands = addressCandidates(a);
    for (const c of cands.slice(0, 3)) {
      r = await nominatimSearch(`${c}, ${city}, Bolivia`, kz, true);
      if (r) break;
    }
    if (!r) r = await nominatimSearch(`${a}, ${city}, Bolivia`, kz, false);
    if (r && kz && haversineKm(r, kz.center) > TRANSPORT.maxGeocodeDistanceKm) r = null;
  } catch (e) {
    console.warn("Nominatim error:", (e as any)?.message);
    return null; // error de red: no cachear
  }
  await cacheSet(key, r);
  return r;
}

const routeMem = new Map<string, { km: number; method: "osrm" | "straight_x1.3" }>();

/** Distancia por calle (OSRM) con fallback a línea recta × 1.3. */
export async function roadDistanceKm(
  from: GeoPoint,
  to: GeoPoint,
): Promise<{ km: number; method: "osrm" | "straight_x1.3" }> {
  const key = [from.lat, from.lng, to.lat, to.lng].map((x) => x.toFixed(4)).join(",");
  const cached = routeMem.get(key);
  if (cached) return cached;
  let out: { km: number; method: "osrm" | "straight_x1.3" };
  try {
    const url = `${OSRM_URL}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false&alternatives=false`;
    const d = await fetchJson(url);
    const m = d?.routes?.[0]?.distance;
    if (d?.code !== "Ok" || !Number.isFinite(m)) throw new Error(`OSRM ${d?.code}`);
    out = { km: round1(m / 1000), method: "osrm" };
  } catch (e) {
    console.warn("OSRM fallback (línea recta × 1.3):", (e as any)?.message);
    out = { km: round1(haversineKm(from, to) * TRANSPORT.straightLineRoadFactor), method: "straight_x1.3" };
    return out; // no cachear fallback
  }
  if (routeMem.size > 2000) routeMem.clear();
  routeMem.set(key, out);
  return out;
}
