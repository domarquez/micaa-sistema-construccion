/**
 * Two-level company trade catalog:
 *  - materiales: proveedores de materiales (existing rubros)
 *  - servicios: oficios / servicios para arquitectura y construcción
 * Companies may pick multiple trades; "otro_servicio" allows free-text extras.
 */

export type TradeGroup = "materiales" | "servicios";

export type CompanyTrade = {
  slug: string;
  label: string;
  group: TradeGroup;
  /** Short emoji for chips/filters */
  icon: string;
};

export const TRADE_GROUPS: { id: TradeGroup; label: string; icon: string }[] = [
  { id: "materiales", label: "Proveedor de materiales", icon: "🧱" },
  { id: "servicios", label: "Servicios", icon: "🛠️" },
];

export const COMPANY_TRADES: CompanyTrade[] = [
  // —— Materiales (existing)
  { slug: "ferreteria", label: "Ferretería", group: "materiales", icon: "🔧" },
  { slug: "cemento", label: "Cemento / hormigón", group: "materiales", icon: "🏗️" },
  { slug: "acero", label: "Acero / fierro", group: "materiales", icon: "⚙️" },
  { slug: "aridos", label: "Áridos / arena / grava", group: "materiales", icon: "⛏️" },
  { slug: "electrico", label: "Eléctrico (materiales)", group: "materiales", icon: "💡" },
  { slug: "sanitario", label: "Sanitario / plomería", group: "materiales", icon: "🚿" },
  { slug: "pinturas", label: "Pinturas", group: "materiales", icon: "🎨" },
  { slug: "ceramicos", label: "Cerámicos / pisos", group: "materiales", icon: "🟫" },
  { slug: "maderas", label: "Maderas", group: "materiales", icon: "🪵" },
  { slug: "construccion_seco", label: "Construcción en seco", group: "materiales", icon: "📐" },
  { slug: "aislamiento", label: "Aislamiento / EPS", group: "materiales", icon: "📦" },
  { slug: "herramientas", label: "Herramientas", group: "materiales", icon: "🛠️" },
  { slug: "vidrios", label: "Vidrios", group: "materiales", icon: "🪟" },
  { slug: "agua", label: "Agua / tanques", group: "materiales", icon: "💧" },
  { slug: "quincalleria", label: "Quincallería", group: "materiales", icon: "🔩" },
  { slug: "pasto_sintetico", label: "Pasto sintético", group: "materiales", icon: "🌿" },
  { slug: "calaminas", label: "Calaminas / cubiertas", group: "materiales", icon: "🏠" },
  { slug: "general", label: "General / varios materiales", group: "materiales", icon: "🏪" },

  // —— Servicios
  { slug: "arquitectura", label: "Arquitectos / estudios de arquitectura", group: "servicios", icon: "🏛️" },
  { slug: "constructoras", label: "Constructoras", group: "servicios", icon: "🏗️" },
  { slug: "diseno", label: "Estudios de diseño (interiores / gráfico)", group: "servicios", icon: "✏️" },
  { slug: "ingenieria", label: "Ingenieros / cálculo estructural", group: "servicios", icon: "📊" },
  { slug: "topografia", label: "Topografía", group: "servicios", icon: "🧭" },
  { slug: "carpinteria", label: "Carpinterías", group: "servicios", icon: "🪚" },
  { slug: "cerrajeria", label: "Cerrajería / metalmecánica", group: "servicios", icon: "🔒" },
  { slug: "corte_cnc", label: "Corte CNC / router / láser", group: "servicios", icon: "✂️" },
  { slug: "imprenta", label: "Imprentas", group: "servicios", icon: "🖨️" },
  { slug: "ploteo", label: "Ploteo / impresión de planos", group: "servicios", icon: "📄" },
  { slug: "render_3d", label: "Render / 3D", group: "servicios", icon: "🖥️" },
  { slug: "instalaciones", label: "Instalaciones (eléctricas / sanitarias / gas)", group: "servicios", icon: "🔌" },
  { slug: "alquiler_maquinaria", label: "Alquiler de maquinaria / equipos", group: "servicios", icon: "🚜" },
  { slug: "transporte", label: "Transporte / fletes", group: "servicios", icon: "🚛" },
  { slug: "mano_obra", label: "Mano de obra / contratistas", group: "servicios", icon: "👷" },
  { slug: "otro_servicio", label: "Otro servicio (especificar)", group: "servicios", icon: "➕" },
];

const BY_SLUG = new Map(COMPANY_TRADES.map((t) => [t.slug, t]));

export function tradeBySlug(slug: string): CompanyTrade | undefined {
  return BY_SLUG.get(String(slug || "").toLowerCase());
}

export function tradeLabel(slug: string): string {
  return tradeBySlug(slug)?.label ?? slug;
}

export function tradeIcon(slug: string): string {
  return tradeBySlug(slug)?.icon ?? "•";
}

export function tradesInGroup(group: TradeGroup): CompanyTrade[] {
  return COMPANY_TRADES.filter((t) => t.group === group);
}

export const KNOWN_TRADE_SLUGS = new Set(COMPANY_TRADES.map((t) => t.slug));

/** Legacy aliases → canonical slug */
const ALIASES: Record<string, string> = {
  electricos: "electrico",
  plomeria: "sanitario",
  aluminio: "ferreteria",
  ceramico: "ceramicos",
};

export function normalizeTradeSlug(raw: string): string | null {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  if (!s) return null;
  const mapped = ALIASES[s] || s;
  return KNOWN_TRADE_SLUGS.has(mapped) ? mapped : null;
}

export function parseTradesInput(
  body: any,
): { trades: string[]; customTrades: string[]; speciality: string | null } {
  const rawList: unknown[] = Array.isArray(body?.trades)
    ? body.trades
    : Array.isArray(body?.categories)
      ? body.categories
      : body?.speciality || body?.rubro
        ? [body.speciality || body.rubro]
        : [];
  const trades: string[] = [];
  for (const item of rawList) {
    const n = normalizeTradeSlug(String(item));
    if (n && !trades.includes(n)) trades.push(n);
  }
  const customRaw: unknown[] = Array.isArray(body?.customTrades)
    ? body.customTrades
    : body?.customTrade
      ? [body.customTrade]
      : [];
  const customTrades = customRaw
    .map((x) => String(x || "").trim())
    .filter((x) => x.length >= 2 && x.length <= 80)
    .slice(0, 5);
  // If they typed custom but didn't pick otro_servicio, add the slug
  if (customTrades.length && !trades.includes("otro_servicio")) {
    trades.push("otro_servicio");
  }
  const speciality = trades[0] || null;
  return { trades, customTrades, speciality };
}

export const SERVICE_UNITS = [
  { value: "m2", label: "m²" },
  { value: "m", label: "m lineal" },
  { value: "hora", label: "hora" },
  { value: "dia", label: "día" },
  { value: "unidad", label: "unidad" },
  { value: "servicio", label: "servicio" },
  { value: "plano", label: "plano" },
  { value: "kg", label: "kg" },
  { value: "otro", label: "otro" },
];
