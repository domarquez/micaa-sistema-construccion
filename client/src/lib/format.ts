/**
 * Formateadores de presentación compartidos (no tocan la base de datos).
 * Unidades, precios en Bs (es-BO, 2 decimales), fechas relativas y acentos.
 */

const UNIT_MAP: Record<string, string> = {
  m3: "m³", "m^3": "m³", "mt3": "m³", "m³": "m³",
  m2: "m²", "m^2": "m²", "mt2": "m²", "m²": "m²",
  ml: "ml", m: "m", mt: "m", mts: "m",
  kg: "kg", kgs: "kg", kilo: "kg", kilos: "kg",
  pza: "pza", pieza: "pieza", und: "und", unidad: "unidad", u: "und",
  bar: "barra", barra: "barra", glb: "glb", lt: "lt", lts: "lt", litro: "lt",
  bolsa: "bolsa", rollo: "rollo", hoja: "hoja", plancha: "plancha",
};

/** "Bolsa 5Kg" → "bolsa 5 kg", "bar 6 m." → "barra 6 m", "M3" → "m³". */
export function formatUnit(unit?: string | null): string {
  if (!unit) return "";
  let s = String(unit).trim().toLowerCase().replace(/\.+$/, "").replace(/\s+/g, " ");
  if (UNIT_MAP[s]) return UNIT_MAP[s];
  // separar número de unidad: "5kg" → "5 kg"
  s = s.replace(/(\d)([a-z]{1,3}\b)/g, "$1 $2");
  return s
    .split(" ")
    .map((tok) => UNIT_MAP[tok.replace(/\.$/, "")] ?? tok.replace(/\.$/, ""))
    .join(" ");
}

const bsFmt = new Intl.NumberFormat("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Siempre 2 decimales: Bs 531,20 */
export function formatBs(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (v == null || !Number.isFinite(v)) return "Bs —";
  return `Bs ${bsFmt.format(v)}`;
}

/** 0 → "hoy", 1 → "ayer", N → "hace N días". */
export function relativeDays(d?: number | null): string {
  if (d == null || !Number.isFinite(d)) return "";
  const n = Math.max(0, Math.floor(d));
  if (n === 0) return "hoy";
  if (n === 1) return "ayer";
  return `hace ${n} días`;
}

const ACCENT_FIXES: [RegExp, string][] = [
  [/\bconstruccion\b/g, "construcción"],
  [/\belectric(a|as|o|os)\b/g, "eléctric$1"],
  [/\bceramic(a|as|o|os)\b/g, "cerámic$1"],
  [/\bmetalic(a|as|o|os)\b/g, "metálic$1"],
  [/\bhidraulic(a|as|o|os)\b/g, "hidráulic$1"],
  [/\bacustic(a|as|o|os)\b/g, "acústic$1"],
  [/\btermic(a|as|o|os)\b/g, "térmic$1"],
  [/\bplastic(a|as|o|os)\b/g, "plástic$1"],
  [/\bimpermeabilizacion\b/g, "impermeabilización"],
  [/\binstalacion\b/g, "instalación"],
  [/\bfundacion\b/g, "fundación"],
  [/\bgalvanizacion\b/g, "galvanización"],
  [/\bplomeria\b/g, "plomería"],
  [/\bcarpinteria\b/g, "carpintería"],
  [/\bherreria\b/g, "herrería"],
  [/\bvidrieria\b/g, "vidriería"],
  [/\btelefonic(a|as|o|os)\b/g, "telefónic$1"],
  [/\bpvc\b/g, "PVC"],
];

/** Mayúscula inicial + acentos comunes faltantes (sólo visualización). */
export function displayName(name?: string | null): string {
  if (!name) return "";
  let s = name.toLowerCase();
  for (const [re, rep] of ACCENT_FIXES) s = s.replace(re, rep);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
