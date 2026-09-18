/**
 * Ensure materials exist for an ask-pack JSON (shared Extractor source of truth).
 *
 * Dry-run: npx tsx scripts/ensure-ask-pack-materials.ts [packId]
 * Apply:   npx tsx scripts/ensure-ask-pack-materials.ts [packId] --apply
 *
 * - Soft-matches existing materials (by materialId, name, aliases).
 * - With --apply, inserts missing stubs only (priceOrigin=pendiente).
 * - NEVER updates materials.price of existing rows.
 *
 * Default packId: acero_perfiles
 *
 * See docs/ask-packs.md — Extractor must load ask lines from JSON packs; never invent
 * vague placeholders like "medida a confirmar".
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { db } from "../server/db";
import { materials, materialCategories } from "../shared/schema";

type PackItem = {
  askLine: string;
  name: string;
  unit: string;
  categoryHint?: string;
  materialId?: number | null;
  estimatePrice?: number | null;
  aliases?: string[];
};

type AskPack = {
  id: string;
  version?: number;
  policy?: string;
  items: PackItem[];
};

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['"`´′″‘’“”]+/g, "")
    .replace(/×/g, "x")
    .replace(/[^a-z0-9áéíóúñü\s\/x]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Soft match: ref tokens mostly present in a DB name (or vice versa). */
function softMatch(refName: string, dbName: string): boolean {
  const a = norm(refName);
  const b = norm(dbName);
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const tokens = a.split(" ").filter((t) => t.length >= 2);
  if (tokens.length === 0) return false;
  const hit = tokens.filter((t) => b.includes(t)).length;
  return hit >= Math.ceil(tokens.length * 0.7);
}

function unitSoftEqual(a: string, b: string): boolean {
  const map: Record<string, string> = {
    barra: "barra",
    bar: "barra",
    brra: "barra",
    plancha: "plancha",
    hoja: "plancha",
    pza: "pza",
    pieza: "pza",
  };
  const na =
    map[a.normalize("NFKC").toLowerCase().replace(/\.+$/, "").trim()] ||
    a.normalize("NFKC").toLowerCase().replace(/\.+$/, "").trim();
  const nb =
    map[b.normalize("NFKC").toLowerCase().replace(/\.+$/, "").trim()] ||
    b.normalize("NFKC").toLowerCase().replace(/\.+$/, "").trim();
  return na === nb || na.includes(nb) || nb.includes(na);
}

function parseArgs(argv: string[]): { packId: string; apply: boolean } {
  const apply = argv.includes("--apply");
  const positional = argv.filter((a) => !a.startsWith("-"));
  // argv[0]=node argv[1]=script — tsx passes script path; filter it out
  const candidates = positional.filter(
    (a) => !a.includes("ensure-ask-pack-materials") && !a.endsWith(".ts"),
  );
  const packId = candidates[0] || "acero_perfiles";
  return { packId, apply };
}

async function main() {
  const { packId, apply } = parseArgs(process.argv.slice(1));
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const packPath = join(__dirname, "data", "ask-packs", `${packId}.json`);

  console.log(apply ? "MODE: --apply" : "MODE: dry-run");
  console.log(`Pack: ${packId} @ ${packPath}`);

  const pack = JSON.parse(readFileSync(packPath, "utf8")) as AskPack;
  const items = pack.items || [];
  console.log(`Items: ${items.length} (v${pack.version ?? "?"})`);
  if (pack.policy) console.log(`Policy: ${pack.policy}`);

  const dbMats = await db.select().from(materials);
  const cats = await db.select().from(materialCategories);
  const catByName = new Map(cats.map((c) => [c.name.toUpperCase(), c]));
  const byId = new Map(dbMats.map((m) => [m.id, m]));

  const matched: {
    askLine: string;
    name: string;
    materialId: number;
    dbName: string;
    how: string;
  }[] = [];
  const missing: PackItem[] = [];
  const inserted: { askLine: string; name: string; materialId: number }[] = [];

  for (const item of items) {
    let hit: (typeof dbMats)[0] | undefined;
    let how = "";

    if (item.materialId != null && byId.has(item.materialId)) {
      hit = byId.get(item.materialId);
      how = "pack.materialId";
    }

    if (!hit) {
      const names = [item.name, item.askLine, ...(item.aliases || [])];
      const soft = dbMats.filter((m) => names.some((n) => softMatch(n, m.name)));
      hit =
        soft.find((m) => unitSoftEqual(item.unit, m.unit)) ||
        soft[0] ||
        undefined;
      if (hit) how = "soft-match";
    }

    if (hit) {
      matched.push({
        askLine: item.askLine,
        name: item.name,
        materialId: hit.id,
        dbName: hit.name,
        how,
      });
    } else {
      missing.push(item);
    }
  }

  console.log(`\n=== Matched (${matched.length}) ===`);
  for (const m of matched) {
    console.log(
      `  OK ask="${m.askLine}" -> #${m.materialId} "${m.dbName}" [${m.how}]`,
    );
  }

  console.log(`\n=== Missing (${missing.length}) ===`);
  for (const m of missing) {
    console.log(
      `  - ${m.name} [${m.unit}] cat~${m.categoryHint || "?"} est=${m.estimatePrice ?? 0}`,
    );
  }

  if (!apply) {
    console.log(
      "\nDry-run complete. Re-run with --apply to insert stubs for missing items.",
    );
    console.log(
      "Reminder: never invent vague Extractor ask lines; load from ask-packs JSON.",
    );
    process.exit(0);
  }

  let insertCount = 0;
  for (const item of missing) {
    const hint = (item.categoryHint || "").toUpperCase();
    let cat = hint ? catByName.get(hint) : undefined;
    if (!cat) {
      cat = cats.find(
        (c) => hint && c.name.toUpperCase().includes(hint.split(" ")[0]),
      );
    }
    if (!cat) {
      console.warn(`SKIP (no category): ${item.name}`);
      continue;
    }

    const priceNum =
      item.estimatePrice != null && Number.isFinite(Number(item.estimatePrice))
        ? Number(item.estimatePrice)
        : 0;
    const price = priceNum.toFixed(2);

    const rows = await db
      .insert(materials)
      .values({
        categoryId: cat.id,
        name: item.name,
        unit: item.unit,
        price,
        description: "Ask-pack SKU MICAA",
        priceOrigin: "pendiente",
        rebasedPrice: priceNum > 0 ? price : null,
        rebasedAt: priceNum > 0 ? new Date() : null,
      })
      .returning({ id: materials.id });

    const newId = rows[0].id;
    insertCount++;
    inserted.push({ askLine: item.askLine, name: item.name, materialId: newId });
    console.log(
      `INSERT stub: #${newId} ${item.name} -> cat#${cat.id} ${cat.name} price=${price}`,
    );
  }

  console.log(`\n=== Report ===`);
  console.log(`Matched: ${matched.length}`);
  matched.forEach((m) =>
    console.log(`  ${m.askLine} -> materialId ${m.materialId}`),
  );
  console.log(`Inserted: ${insertCount}`);
  inserted.forEach((m) =>
    console.log(`  ${m.askLine} -> materialId ${m.materialId} (new stub)`),
  );
  console.log(
    "Done. Existing materials.price left untouched. Update pack materialId fields if desired.",
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
