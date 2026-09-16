/** Preferencia de ciudad del usuario (localStorage). Base de precios MICAA = Santa Cruz. */

export const CITY_STORAGE_KEY = "micaa_city";

/** Ciudades soportadas en el selector público (Bolivia). */
export const CITY_LIST = [
  "Santa Cruz",
  "Cochabamba",
  "La Paz",
  "Sucre",
  "Tarija",
  "Beni",
  "Pando",
  "Oruro",
  "Potosí",
] as const;

export type MicaaCity = (typeof CITY_LIST)[number];

export const DEFAULT_CITY: MicaaCity = "Santa Cruz";

/** Alias hacia nombres históricos en city_price_factors (si existen). */
export const CITY_FACTOR_ALIASES: Record<string, string[]> = {
  Beni: ["Beni", "Trinidad"],
  Pando: ["Pando", "Cobija"],
  "Potosí": ["Potosí", "Potosi"],
  "Santa Cruz": ["Santa Cruz", "Santa Cruz de la Sierra"],
};

export function isMicaaCity(value: string): value is MicaaCity {
  return (CITY_LIST as readonly string[]).includes(value);
}

export function getCity(): MicaaCity {
  if (typeof window === "undefined") return DEFAULT_CITY;
  try {
    const raw = localStorage.getItem(CITY_STORAGE_KEY);
    if (raw && isMicaaCity(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_CITY;
}

export function setCity(city: string): MicaaCity {
  const next: MicaaCity = isMicaaCity(city) ? city : DEFAULT_CITY;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(CITY_STORAGE_KEY, next);
      window.dispatchEvent(new CustomEvent("micaa-city", { detail: next }));
    } catch {
      /* ignore */
    }
  }
  return next;
}

/** Nombres a probar al buscar un factor en DB / API. */
export function cityLookupNames(city: string): string[] {
  const aliases = CITY_FACTOR_ALIASES[city] || [city];
  const out = new Set<string>();
  for (const a of aliases) {
    out.add(a);
    out.add(a.toLowerCase());
  }
  out.add(city);
  return [...out];
}

export function citiesMatch(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const na = a.trim().toLowerCase();
  const nb = b.trim().toLowerCase();
  if (na === nb) return true;
  const expand = (c: string) => {
    const names = new Set<string>([c.toLowerCase()]);
    for (const [canon, list] of Object.entries(CITY_FACTOR_ALIASES)) {
      if (
        canon.toLowerCase() === c.toLowerCase() ||
        list.some((x) => x.toLowerCase() === c.toLowerCase())
      ) {
        names.add(canon.toLowerCase());
        list.forEach((x) => names.add(x.toLowerCase()));
      }
    }
    return names;
  };
  const A = expand(a);
  const B = expand(b);
  for (const x of A) if (B.has(x)) return true;
  return false;
}
