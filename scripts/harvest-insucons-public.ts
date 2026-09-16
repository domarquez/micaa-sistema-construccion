/**
 * Cosecha curada (whitelist) de precios públicos Insucons por ciudad.
 * Escribe scripts/data/fresh-prices-2026-09.json (no dump mayorista).
 *
 * Uso: npx tsx scripts/harvest-insucons-public.ts
 *      npx tsx scripts/harvest-insucons-public.ts --out scripts/data/fresh-prices-2026-09.json
 *
 * Endpoint público: POST /insumos/set_ciudad/{id} + POST /insumos/json_datos/mat (grupoid=categoría).
 * Si Insucons bloquea, el JSON starter del repo sigue siendo usable.
 */
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const BASE = "https://www.insucons.com";
const CITIES: Record<number, string> = {
  1: "Santa Cruz",
  2: "Cochabamba",
  3: "La Paz",
};

/** Categorías Insucons relevantes (evitar "Todos"/grupoid=1 — rompe SQL del grid). */
const GROUPS = [5, 6, 7, 11, 13, 14, 17, 23, 29, 30, 33, 38, 41];

const ALLOW: RegExp[] = [
  /^Cemento portland IP-30$/i,
  /^Cemento blanco$/i,
  /^Arena Fina$/i,
  /^Ripio chancado$/i,
  /^Ripio bruto$/i,
  /^Hormig[oó]n premezclado/i,
  /^Corrugado 1\/2 plg/i,
  /^Corrugado 3\/8 plg/i,
  /^Corrugado 5\/8 plg/i,
  /^Corrugado 3\/4 plg/i,
  /^Corrugado 5\/16 plg/i,
  /^Corrugado 1\/4 plg/i,
  /^Corrugado 1 plg/i,
  /^Alambre de amarre$/i,
  /^Alambre Galvanizado # 12$/i,
  /^Alambre Galvanizado # 8$/i,
  /^Ladrillo adobito$/i,
  /^Ladrillo Ceramico de 6 H/i,
  /^Ladrillo Ceramico de 21 H/i,
  /^bloque prefabricado$/i,
  /^Yeso$/i,
  /^Pintura latex$/i,
  /^Tubo de PVC de 4 pulg L=4/i,
  /^Tubo de PVC de 1 1\/2 pulg$/i,
  /^Clavos de 2 pulg$/i,
  /^Clavos de 3 pulg$/i,
  /^Madera tajibo$/i,
  /^Machimbre tajibo$/i,
  /^Marco de 2x4 tajibo$/i,
  /^Estuco$/i,
];

type Item = {
  name: string;
  unit: string;
  city: string;
  price: number;
  source: string;
  collectedAt: string;
  matchHint: string;
};

function matchHint(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("corrug")) return "corrugado";
  if (n.includes("arena fina")) return "arena fina";
  if (n.includes("ripio")) return "ripio";
  if (n.includes("cemento portland")) return "cemento portland";
  if (n.includes("alambre de amarre")) return "alambre amarre";
  if (n.includes("alambre galvanizado")) return "alambre galvanizado";
  if (n.includes("ladrillo")) return "ladrillo";
  if (n.includes("bloque")) return "bloque";
  if (n.includes("yeso")) return "yeso";
  if (n.includes("pintura")) return "pintura latex";
  if (n.includes("pvc") && n.includes("4")) return "pvc 4";
  if (n.includes("pvc")) return "pvc";
  if (n.includes("clavo")) return "clavo";
  if (n.includes("machimbre")) return "machimbre tajibo";
  if (n.includes("tajibo")) return "tajibo";
  if (n.includes("hormig")) return "hormigon";
  if (n.includes("estuco")) return "estuco";
  if (n.includes("cemento")) return "cemento";
  return "other";
}

function allowed(name: string): boolean {
  return ALLOW.some((re) => re.test(name.trim()));
}

async function main() {
  const outArgIdx = process.argv.indexOf("--out");
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outPath =
    outArgIdx >= 0 && process.argv[outArgIdx + 1]
      ? process.argv[outArgIdx + 1]
      : join(__dirname, "data", "fresh-prices-2026-09.json");

  const jar = new Map<string, string>();
  const collectedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  async function http(
    method: string,
    url: string,
    body?: string,
  ): Promise<string> {
    const headers: Record<string, string> = {
      "User-Agent": "MICAA-harvest/1.0 (+https://micaa.site)",
      Referer: `${BASE}/insumos/materiales`,
      "X-Requested-With": "XMLHttpRequest",
    };
    if (jar.size) {
      headers.Cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    }
    if (body != null) {
      headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
    }
    const res = await fetch(url, { method, headers, body });
    const setCookie = res.headers.getSetCookie?.() || [];
    for (const c of setCookie) {
      const [nv] = c.split(";");
      const eq = nv.indexOf("=");
      if (eq > 0) jar.set(nv.slice(0, eq), nv.slice(eq + 1));
    }
    // Fallback: single set-cookie
    const sc = res.headers.get("set-cookie");
    if (sc) {
      const [nv] = sc.split(";");
      const eq = nv.indexOf("=");
      if (eq > 0) jar.set(nv.slice(0, eq), nv.slice(eq + 1));
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${method} ${url} -> ${res.status}: ${text.slice(0, 200)}`);
    }
    return await res.text();
  }

  console.log("Init session…");
  await http("GET", `${BASE}/insumos/materiales`);

  const items: Item[] = [];
  const errors: string[] = [];

  for (const [cidStr, city] of Object.entries(CITIES)) {
    const cid = Number(cidStr);
    try {
      await http("POST", `${BASE}/insumos/set_ciudad/${cid}`);
    } catch (e: any) {
      errors.push(`set_ciudad ${city}: ${e.message}`);
      continue;
    }
    for (const gid of GROUPS) {
      try {
        const raw = await http(
          "POST",
          `${BASE}/insumos/json_datos/mat`,
          `grupoid=${gid}&page=1&rows=200&sidx=insumo:descripcion&sord=asc&_search=false`,
        );
        const data = JSON.parse(raw) as {
          rows?: { cell: (string | number)[] }[];
        };
        for (const row of data.rows || []) {
          const cell = row.cell;
          const name = String(cell[2]).trim();
          const unit = String(cell[3]).trim();
          const price = Number(cell[4]);
          if (!allowed(name) || !Number.isFinite(price)) continue;
          items.push({
            name,
            unit,
            city,
            price,
            source: "insucons-public",
            collectedAt,
            matchHint: matchHint(name),
          });
        }
        await new Promise((r) => setTimeout(r, 120));
      } catch (e: any) {
        errors.push(`${city} g${gid}: ${e.message}`);
      }
    }
  }

  // Deduplicar
  const seen = new Set<string>();
  const uniq: Item[] = [];
  for (const it of items) {
    const k = `${it.name.toLowerCase()}|${it.unit.toLowerCase()}|${it.city}`;
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(it);
  }
  uniq.sort((a, b) => a.name.localeCompare(b.name) || a.city.localeCompare(b.city));

  const payload = {
    _comment:
      "Cotizaciones públicas curadas (whitelist) desde Insucons materiales por ciudad. No es dump mayorista.",
    _contextNotes: [
      "Fuente: https://www.insucons.com/insumos/materiales",
      "Ciudades via POST insumos/set_ciudad/{1|2|3} + json_datos/mat con grupoid de categoría",
      "CBDI/noticias: solo contexto macro, no precios por SKU",
    ],
    collectedAt,
    errors,
    items: uniq,
  };

  writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(
    JSON.stringify(
      {
        outPath,
        items: uniq.length,
        skus: new Set(uniq.map((i) => i.name)).size,
        errors: errors.length,
        byCity: Object.fromEntries(
          Object.values(CITIES).map((c) => [c, uniq.filter((i) => i.city === c).length]),
        ),
      },
      null,
      2,
    ),
  );
  if (uniq.length === 0) {
    console.error(
      "Harvest vacío (posible bloqueo). Conservar el JSON starter del repo y reintentar más tarde.",
    );
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
