/**
 * Búsqueda de actividades: normalización (sin mayúsculas ni acentos), tokens y sinónimos.
 * Compartido entre servidor (construcción del WHERE) y tests.
 *
 * Regla: cada palabra de la consulta es un GRUPO de alternativas (palabra + sinónimos
 * + forma singular / raíz). Todas las palabras deben aparecer (AND); dentro de cada
 * grupo basta una alternativa (OR). Se compara contra ' ' || nombre_normalizado || ' '.
 */

const ACCENTS_FROM = "áàäâãéèëêíìïîóòöôõúùüûñç";
const ACCENTS_TO = "aaaaaeeeeiiiiooooouuuunc";

/** minúsculas + sin acentos + espacios simples (equivalente JS de la expresión SQL). */
export function normalizeSearchText(s: string): string {
  let out = (s || "").toLowerCase();
  out = out.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  out = out.replace(/[^a-z0-9°]+/g, " ").replace(/\s+/g, " ").trim();
  return out;
}

/** Expresión SQL (Postgres) que normaliza una columna igual que normalizeSearchText (sin depender de unaccent). */
export function sqlNormalizeExpr(column: string): string {
  // translate antes y después de lower: no depende de la collation ni de la extensión unaccent.
  const from = ACCENTS_FROM + ACCENTS_FROM.toUpperCase();
  const to = ACCENTS_TO + ACCENTS_TO;
  return `(' ' || regexp_replace(lower(translate(${column}, '${from}', '${to}')), '[^a-z0-9°]+', ' ', 'g') || ' ')`;
}

/** Grupos de sinónimos (todas las formas ya normalizadas). */
const SYNONYM_GROUPS: string[][] = [
  // ladrillo hueco ↔ 6H / 8H / 21H …
  ["hueco", "6h", "8h", "21h", "3h", "2h", "18h", "6 h", "8 h"],
  // pared / tabique ↔ muro
  ["muro", "pared", "tabique"],
  // drywall ↔ yeso / placa de yeso / en seco
  ["drywall", "yeso", "placa de yeso", "seco"],
  ["contrapiso", "contra piso"],
  // revoque ↔ enlucido / revestimiento
  ["revoque", "enlucido", "revestimiento"],
  ["hormigon", " ho ", "h°"],
  ["cielo raso", "cielo falso", "cielorraso"],
  ["luz", "iluminacion"],
  ["enchufe", "tomacorriente"],
  ["bloque", "block"],
  ["fibrocemento", "duralit", "eternit"],
  ["cementicia", "cementicio", "superboard"],
  ["steel", "steel frame", "metalframe"],
];

/** Tokens que se buscan con espacio a la izquierda (palabra completa) para evitar ruido. */
const WORD_START_TOKENS = new Set(["6h", "8h", "21h", "3h", "2h", "18h", "luz", "ho"]);

function singularForms(tok: string): string[] {
  const forms = new Set<string>([tok]);
  if (tok.length > 5 && tok.endsWith("es")) forms.add(tok.slice(0, -2)); // paredes → pared
  if (tok.length > 4 && tok.endsWith("s")) forms.add(tok.slice(0, -1)); // muros → muro, huecos → hueco
  // género: ceramica/ceramico → ceramic
  for (const f of Array.from(forms)) {
    if (f.length >= 6 && /[ao]$/.test(f)) forms.add(f.slice(0, -1));
  }
  return Array.from(forms);
}

export interface SearchGroup {
  token: string;
  alternatives: string[];
}

/** Convierte una consulta libre en grupos AND de alternativas OR. */
export function buildSearchGroups(query: string): SearchGroup[] {
  const norm = normalizeSearchText(query);
  if (!norm) return [];
  const stop = new Set(["de", "del", "la", "el", "los", "las", "y", "con", "en", "para", "a", "o", "e", "x"]);
  const tokens = norm.split(" ").filter((t) => t && !stop.has(t)).slice(0, 8);
  const groups: SearchGroup[] = [];
  for (const tok of tokens) {
    const alts = new Set<string>();
    for (const f of singularForms(tok)) {
      alts.add(f);
      for (const g of SYNONYM_GROUPS) {
        if (g.some((s) => s.trim() === f)) g.forEach((s) => alts.add(s));
      }
    }
    groups.push({
      token: tok,
      // Palabras cortas (≤3 letras, p. ej. «gas», «luz», «pvc») y tokens tipo 6h: inicio de palabra, para que
      // «gas» no encuentre «vigas»/«omegas».
      alternatives: Array.from(alts).map((a) =>
        (WORD_START_TOKENS.has(a.trim()) || /^[a-z]{1,3}$/.test(a)) && !a.startsWith(" ") ? ` ${a}` : a),
    });
  }
  return groups;
}

/** Evalúa en JS (para tests y para el filtrado del cliente). */
export function matchesSearch(name: string, query: string): boolean {
  const groups = buildSearchGroups(query);
  if (groups.length === 0) return true;
  const hay = ` ${normalizeSearchText(name)} `;
  return groups.every((g) => g.alternatives.some((a) => hay.includes(a)));
}

/** Escapa % _ \ para LIKE. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}
