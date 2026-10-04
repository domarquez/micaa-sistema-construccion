/**
 * Evaluador SEGURO de fórmulas de plantillas de proyecto (sin eval / new Function).
 *
 * Gramática (recursive descent):
 *   expr   := term (('+'|'-') term)*
 *   term   := unary (('*'|'/') unary)*
 *   unary  := ('-'|'+') unary | power
 *   power  := atom ('^' unary)?
 *   atom   := NUMBER | IDENT | IDENT '(' args ')' | '(' expr ')'
 * Funciones permitidas: ceil, floor, min, max, sqrt, round, abs.
 * Identificadores: solo [A-Za-z_][A-Za-z0-9_]*, que deben existir en el mapa de variables
 * (se busca con hasOwnProperty, así que "constructor" o "__proto__" no resuelven).
 */
export type Vars = Record<string, number>;

const FUNCS: Record<string, { min: number; max: number; fn: (...a: number[]) => number }> = {
  ceil: { min: 1, max: 1, fn: (x) => Math.ceil(x) },
  floor: { min: 1, max: 1, fn: (x) => Math.floor(x) },
  sqrt: { min: 1, max: 1, fn: (x) => { if (x < 0) throw new FormulaError("sqrt de número negativo"); return Math.sqrt(x); } },
  round: { min: 1, max: 1, fn: (x) => Math.round(x) },
  abs: { min: 1, max: 1, fn: (x) => Math.abs(x) },
  min: { min: 1, max: 20, fn: (...a) => Math.min(...a) },
  max: { min: 1, max: 20, fn: (...a) => Math.max(...a) },
};
export const ALLOWED_FUNCTIONS = Object.keys(FUNCS);
const MAX_LEN = 500;

export class FormulaError extends Error {}

type Tok = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string };

function tokenize(src: string): Tok[] {
  if (typeof src !== "string") throw new FormulaError("La fórmula debe ser texto");
  if (src.length > MAX_LEN) throw new FormulaError("Fórmula demasiado larga");
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === " " || ch === "\t" || ch === "\n") { i++; continue; }
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      const m = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i));
      if (!m) throw new FormulaError(`Número inválido en posición ${i}`);
      out.push({ t: "num", v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))!;
      out.push({ t: "id", v: m[0] });
      i += m[0].length;
      continue;
    }
    if ("+-*/^(),".includes(ch)) { out.push({ t: "op", v: ch }); i++; continue; }
    throw new FormulaError(`Carácter no permitido "${ch}" en posición ${i}`);
  }
  return out;
}

type Node =
  | { k: "num"; v: number }
  | { k: "var"; name: string }
  | { k: "neg"; a: Node }
  | { k: "bin"; op: string; a: Node; b: Node }
  | { k: "call"; fn: string; args: Node[] };

export function parseFormula(src: string): Node {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => peek()?.t === "op" && (peek() as any).v === v;
  const expect = (v: string) => { if (!isOp(v)) throw new FormulaError(`Se esperaba "${v}"`); p++; };
  let depth = 0;
  const expr = (): Node => {
    if (++depth > 100) throw new FormulaError("Fórmula demasiado anidada");
    let n = term();
    while (isOp("+") || isOp("-")) { const op = (toks[p++] as any).v; n = { k: "bin", op, a: n, b: term() }; }
    depth--;
    return n;
  };
  const term = (): Node => {
    let n = unary();
    while (isOp("*") || isOp("/")) { const op = (toks[p++] as any).v; n = { k: "bin", op, a: n, b: unary() }; }
    return n;
  };
  const unary = (): Node => {
    if (isOp("-")) { p++; return { k: "neg", a: unary() }; }
    if (isOp("+")) { p++; return unary(); }
    return power();
  };
  const power = (): Node => {
    const a = atom();
    if (isOp("^")) { p++; return { k: "bin", op: "^", a, b: unary() }; }
    return a;
  };
  const atom = (): Node => {
    const t = peek();
    if (!t) throw new FormulaError("Fin inesperado de la fórmula");
    if (t.t === "num") { p++; return { k: "num", v: t.v }; }
    if (t.t === "id") {
      p++;
      if (isOp("(")) {
        if (!Object.prototype.hasOwnProperty.call(FUNCS, t.v)) throw new FormulaError(`Función no permitida: ${t.v}`);
        p++;
        const args: Node[] = [];
        if (!isOp(")")) { args.push(expr()); while (isOp(",")) { p++; args.push(expr()); } }
        expect(")");
        const f = FUNCS[t.v];
        if (args.length < f.min || args.length > f.max) throw new FormulaError(`${t.v}: número de argumentos inválido`);
        return { k: "call", fn: t.v, args };
      }
      return { k: "var", name: t.v };
    }
    if (t.t === "op" && t.v === "(") { p++; const n = expr(); expect(")"); return n; }
    throw new FormulaError(`Token inesperado "${(t as any).v}"`);
  };
  const n = expr();
  if (p !== toks.length) throw new FormulaError(`Token sobrante "${(toks[p] as any).v}"`);
  return n;
}

function evalNode(n: Node, vars: Vars): number {
  switch (n.k) {
    case "num": return n.v;
    case "var": {
      if (!Object.prototype.hasOwnProperty.call(vars, n.name)) throw new FormulaError(`Variable desconocida: ${n.name}`);
      const v = vars[n.name];
      if (typeof v !== "number" || !Number.isFinite(v)) throw new FormulaError(`Variable no numérica: ${n.name}`);
      return v;
    }
    case "neg": return -evalNode(n.a, vars);
    case "call": return FUNCS[n.fn].fn(...n.args.map((a) => evalNode(a, vars)));
    case "bin": {
      const a = evalNode(n.a, vars), b = evalNode(n.b, vars);
      switch (n.op) {
        case "+": return a + b;
        case "-": return a - b;
        case "*": return a * b;
        case "/": if (b === 0) throw new FormulaError("División por cero"); return a / b;
        case "^": return Math.pow(a, b);
      }
    }
  }
  throw new FormulaError("Nodo inválido");
}

/** Identificadores (variables) que usa la fórmula. */
export function formulaVariables(src: string): string[] {
  const out = new Set<string>();
  const walk = (n: Node) => {
    if (n.k === "var") out.add(n.name);
    else if (n.k === "neg") walk(n.a);
    else if (n.k === "bin") { walk(n.a); walk(n.b); }
    else if (n.k === "call") n.args.forEach(walk);
  };
  walk(parseFormula(src));
  return Array.from(out);
}

export function evaluateFormula(src: string, vars: Vars): number {
  const v = evalNode(parseFormula(src), vars);
  if (!Number.isFinite(v)) throw new FormulaError("Resultado no finito");
  return v;
}

// ---------------------------------------------------------------------------
// Plantillas
// ---------------------------------------------------------------------------
export interface TemplateParamDef { default: number; min: number; max: number; unit?: string; label?: string }
export type TemplateParamsSchema = Record<string, TemplateParamDef>;
export interface TemplateDerived { name: string; expr: string; label?: string }
export interface TemplateItemDef { id?: number; phaseId: number; activityId: number | null; quantityFormula: string; breakdown?: string | null; sortOrder?: number }

export function validateParams(schema: TemplateParamsSchema, input: Record<string, unknown> | null | undefined): Vars {
  const out: Vars = {};
  const errors: string[] = [];
  for (const [k, def] of Object.entries(schema)) {
    const raw = input && Object.prototype.hasOwnProperty.call(input, k) ? input[k] : def.default;
    const v = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
    if (typeof v !== "number" || !Number.isFinite(v)) { errors.push(`${k}: debe ser numérico`); continue; }
    if (v < def.min || v > def.max) { errors.push(`${k}: fuera de rango (${def.min}–${def.max})`); continue; }
    out[k] = v;
  }
  if (input) for (const k of Object.keys(input)) if (!Object.prototype.hasOwnProperty.call(schema, k)) errors.push(`${k}: parámetro desconocido`);
  if (errors.length) throw new FormulaError(errors.join("; "));
  return out;
}

export function evaluateTemplate<T extends TemplateItemDef>(
  schema: TemplateParamsSchema,
  derived: TemplateDerived[],
  items: T[],
  input?: Record<string, unknown> | null,
): { params: Vars; vars: Vars; items: Array<T & { quantity: number }> } {
  const params = validateParams(schema, input);
  const vars: Vars = { ...params };
  for (const d of derived) {
    if (Object.prototype.hasOwnProperty.call(schema, d.name)) throw new FormulaError(`Derivada "${d.name}" pisa un parámetro`);
    vars[d.name] = evaluateFormula(d.expr, vars);
  }
  const out = items.map((it) => {
    const q = evaluateFormula(it.quantityFormula, vars);
    return { ...it, quantity: Math.round(Math.max(0, q) * 1000) / 1000 };
  });
  return { params, vars, items: out };
}
