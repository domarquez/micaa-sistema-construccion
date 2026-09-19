/**
 * Rebase familia ACERO / PLANCHAS desde anclas corrugado (provider/WA).
 *
 * From ≥1 same-city (or any) provider/WA quote on corrugado anchors
 * (prefer materials 61=3/8 and 62=1/2 with weightKg), compute:
 *   P_kg = price / weightKg
 * Multiple anchors/quotes → average P_kg.
 * minQuotes = 1 (one Monterrey / any-city quote is enough).
 *
 * Writes materials.rebasedPrice / rebasedAt / priceOrigin=red_acero.
 * Does NOT overwrite materials.price.
 *
 * Dry-run: npx tsx scripts/rebase-steel-from-anchors.ts
 * Apply:   npx tsx scripts/rebase-steel-from-anchors.ts --apply
 *
 * Options:
 *   --city=Monterrey   prefer same-city quotes (falls back to any)
 *   --min-quotes=1     default 1
 *   --anchor-ids=61,62 prefer these material ids (default 61,62; fallback 59–65)
 */
import { db } from "../server/db";
import {
  materials,
  materialCategories,
  userMaterialPrices,
  materialSupplierPrices,
  supplierCompanies,
  users,
} from "../shared/schema";
import { and, eq, inArray, desc } from "drizzle-orm";

/** Prefer 3/8 and 1/2 corrugado barra 12m (Diego-approved keepers). */
const DEFAULT_ANCHOR_IDS = [61, 62];
/** Broader corrugado CA-50 keepers if prefer-ids lack quotes. */
const FALLBACK_ANCHOR_IDS = [59, 60, 61, 62, 63, 64, 65];

const MIN_QUOTES_DEFAULT = 1;
const PRICE_ORIGIN = "red_acero";

/**
 * Theoretical kg per sales unit for common corrugado CA-50 barra 12 m
 * (ASTM/metric approx). Used only when materials.weightKg is null.
 * Prefer DB weightKg when present.
 */
const STEEL_UNIT_WEIGHTS: { pattern: RegExp; weightKg: number; note: string }[] =
  [
    { pattern: /\bcorrugad\w*.*\b6\s*mm\b|\b6\s*mm\b.*\bcorrugad/i, weightKg: 2.664, note: "Ø6mm×12m ≈0.222 kg/m" },
    { pattern: /\bcorrugad\w*.*\b8\s*mm\b|\b8\s*mm\b.*\bcorrugad/i, weightKg: 4.74, note: "Ø8mm×12m ≈0.395 kg/m" },
    { pattern: /\bcorrugad\w*.*\b3\s*\/\s*8\b|\b3\s*\/\s*8\b.*\bcorrugad|\b9\.?5\s*mm\b.*\bcorrugad/i, weightKg: 6.72, note: "Ø3/8×12m ≈0.560 kg/m" },
    { pattern: /\bcorrugad\w*.*\b1\s*\/\s*2\b|\b1\s*\/\s*2\b.*\bcorrugad|\b12\.?7\s*mm\b.*\bcorrugad/i, weightKg: 11.928, note: "Ø1/2×12m ≈0.994 kg/m" },
    { pattern: /\bcorrugad\w*.*\b5\s*\/\s*8\b|\b5\s*\/\s*8\b.*\bcorrugad|\b15\.?9\s*mm\b.*\bcorrugad/i, weightKg: 18.624, note: "Ø5/8×12m ≈1.552 kg/m" },
    { pattern: /\bcorrugad\w*.*\b3\s*\/\s*4\b|\b3\s*\/\s*4\b.*\bcorrugad|\b19\s*mm\b.*\bcorrugad/i, weightKg: 26.82, note: "Ø3/4×12m ≈2.235 kg/m" },
    { pattern: /\bcorrugad\w*.*\b1\s*(?:\"|''|pulg)\b|\b1\s*(?:\"|''|pulg)\b.*\bcorrugad|\b25\s*mm\b.*\bcorrugad/i, weightKg: 47.676, note: "Ø1\"×12m ≈3.973 kg/m" },
  ];

const CITY_ALIASES: Record<string, string[]> = {
  beni: ["beni", "trinidad"],
  pando: ["pando", "cobija"],
  "potosí": ["potosí", "potosi"],
  potosi: ["potosí", "potosi"],
  "santa cruz": ["santa cruz", "santa cruz de la sierra"],
};

function num(v: unknown, fallback = NaN): number {
  if (v == null || v === "") return fallback;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

function optionalPositive(v: unknown): number | null {
  const n = num(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function normalizeCityKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function cityKeys(ciudad: string): string[] {
  const key = normalizeCityKey(ciudad);
  for (const [canon, list] of Object.entries(CITY_ALIASES)) {
    const canonN = normalizeCityKey(canon);
    const listN = list.map(normalizeCityKey);
    if (canonN === key || listN.includes(key)) {
      return [...new Set([canonN, ...listN, key])];
    }
  }
  return [key];
}

function citiesMatch(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const A = new Set(cityKeys(a));
  return cityKeys(b).some((k) => A.has(k));
}

function isSteelCategory(name: string | null | undefined): boolean {
  const n = (name || "").toUpperCase();
  return n.includes("ACERO") || n.includes("PLANCHAS");
}

function isDeactivated(m: { name: string; priceOrigin?: string | null }): boolean {
  return (
    m.name.startsWith("[DUPLICADO") ||
    (m.priceOrigin || "").toLowerCase() === "duplicado"
  );
}

function theoreticalWeightKg(name: string): number | null {
  for (const row of STEEL_UNIT_WEIGHTS) {
    if (row.pattern.test(name)) return row.weightKg;
  }
  return null;
}

function resolveWeightKg(
  materialWeight: unknown,
  quoteWeight: unknown,
  materialName: string,
): { weightKg: number | null; source: string | null } {
  const fromQuote = optionalPositive(quoteWeight);
  if (fromQuote != null) return { weightKg: fromQuote, source: "quote" };
  const fromMat = optionalPositive(materialWeight);
  if (fromMat != null) return { weightKg: fromMat, source: "material" };
  const theo = theoreticalWeightKg(materialName);
  if (theo != null) return { weightKg: theo, source: "theoretical" };
  return { weightKg: null, source: null };
}

function parseArgs(argv: string[]) {
  const apply = argv.includes("--apply");
  let city: string | null = null;
  let minQuotes = MIN_QUOTES_DEFAULT;
  let preferIds = [...DEFAULT_ANCHOR_IDS];
  for (const a of argv) {
    if (a.startsWith("--city=")) city = a.slice("--city=".length).trim() || null;
    if (a.startsWith("--min-quotes=")) {
      const n = parseInt(a.slice("--min-quotes=".length), 10);
      if (Number.isFinite(n) && n >= 1) minQuotes = n;
    }
    if (a.startsWith("--anchor-ids=")) {
      const ids = a
        .slice("--anchor-ids=".length)
        .split(",")
        .map((x) => parseInt(x.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (ids.length) preferIds = ids;
    }
  }
  return { apply, city, minQuotes, preferIds };
}

type AnchorQuote = {
  materialId: number;
  materialName: string;
  source: "whatsapp" | "provider" | "supplier";
  city: string | null;
  price: number;
  weightKg: number;
  weightSource: string;
  pKg: number;
  sameCity: boolean;
  label: string;
};

function isWaQuote(
  ump: { reason?: string | null },
  username?: string | null,
): boolean {
  const reason = (ump.reason || "").toUpperCase();
  if (username === "micaa_whatsapp") return true;
  if (reason.startsWith("WA")) return true;
  return false;
}

function isMarketBot(
  ump: { reason?: string | null },
  username?: string | null,
): boolean {
  const reason = (ump.reason || "").toUpperCase();
  if (username === "micaa_market") return true;
  if (reason.startsWith("MARKET")) return true;
  return false;
}

async function loadSteelMaterials() {
  const rows = await db
    .select({
      material: materials,
      categoryName: materialCategories.name,
    })
    .from(materials)
    .leftJoin(
      materialCategories,
      eq(materials.categoryId, materialCategories.id),
    );

  return rows.filter(
    (r) =>
      isSteelCategory(r.categoryName) && !isDeactivated(r.material),
  );
}

async function collectAnchorQuotes(
  anchorIds: number[],
  matById: Map<
    number,
    { material: typeof materials.$inferSelect; categoryName: string | null }
  >,
  preferCity: string | null,
): Promise<AnchorQuote[]> {
  const out: AnchorQuote[] = [];
  if (anchorIds.length === 0) return out;

  // WA / person public quotes (exclude market bot)
  const personRows = await db
    .select({
      ump: userMaterialPrices,
      user: users,
    })
    .from(userMaterialPrices)
    .leftJoin(users, eq(userMaterialPrices.userId, users.id))
    .where(
      and(
        inArray(userMaterialPrices.materialId, anchorIds),
        eq(userMaterialPrices.isPublic, true),
      ),
    )
    .orderBy(desc(userMaterialPrices.updatedAt));

  for (const row of personRows) {
    if (row.ump.materialId == null) continue;
    if (isMarketBot(row.ump, row.user?.username)) continue;
    // Provider/WA only: require WA signal (micaa_whatsapp or reason WA|…)
    if (!isWaQuote(row.ump, row.user?.username)) continue;
    const mat = matById.get(row.ump.materialId);
    if (!mat) continue;
    const price = optionalPositive(row.ump.price);
    if (price == null) continue;
    const { weightKg, source: wSrc } = resolveWeightKg(
      mat.material.weightKg,
      row.ump.weightKg,
      mat.material.name,
    );
    if (weightKg == null || !wSrc) continue;
    const pKg = price / weightKg;
    if (!(pKg > 0) || !Number.isFinite(pKg)) continue;
    const qCity = row.ump.city || row.user?.city || null;
    out.push({
      materialId: row.ump.materialId,
      materialName: mat.material.name,
      source: "whatsapp",
      city: qCity,
      price,
      weightKg,
      weightSource: wSrc,
      pKg: round4(pKg),
      sameCity: preferCity ? citiesMatch(qCity, preferCity) : true,
      label:
        row.ump.supplierName ||
        row.user?.username ||
        "whatsapp",
    });
  }

  // Supplier company quotes
  const supplierRows = await db
    .select({
      msp: materialSupplierPrices,
      supplier: supplierCompanies,
    })
    .from(materialSupplierPrices)
    .innerJoin(
      supplierCompanies,
      eq(materialSupplierPrices.supplierId, supplierCompanies.id),
    )
    .where(
      and(
        inArray(materialSupplierPrices.materialId, anchorIds),
        eq(materialSupplierPrices.isActive, true),
        eq(supplierCompanies.isActive, true),
      ),
    )
    .orderBy(desc(materialSupplierPrices.lastUpdated));

  for (const row of supplierRows) {
    const mat = matById.get(row.msp.materialId);
    if (!mat) continue;
    const price = optionalPositive(row.msp.price);
    if (price == null) continue;
    const { weightKg, source: wSrc } = resolveWeightKg(
      mat.material.weightKg,
      null,
      mat.material.name,
    );
    if (weightKg == null || !wSrc) continue;
    const pKg = price / weightKg;
    if (!(pKg > 0) || !Number.isFinite(pKg)) continue;
    const qCity = row.supplier.city || null;
    out.push({
      materialId: row.msp.materialId,
      materialName: mat.material.name,
      source: "supplier",
      city: qCity,
      price,
      weightKg,
      weightSource: wSrc,
      pKg: round4(pKg),
      sameCity: preferCity ? citiesMatch(qCity, preferCity) : true,
      label: row.supplier.companyName,
    });
  }

  return out;
}

function selectQuotes(
  all: AnchorQuote[],
  minQuotes: number,
  preferCity: string | null,
): { quotes: AnchorQuote[]; scope: "same-city" | "any-city" | "none" } {
  if (preferCity) {
    const same = all.filter((q) => q.sameCity);
    if (same.length >= minQuotes) {
      return { quotes: same, scope: "same-city" };
    }
  }
  if (all.length >= minQuotes) {
    return { quotes: all, scope: "any-city" };
  }
  return { quotes: [], scope: "none" };
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

async function main() {
  const { apply, city, minQuotes, preferIds } = parseArgs(process.argv.slice(2));
  console.log(
    apply ? "MODE: --apply" : "MODE: dry-run",
    city ? `city=${city}` : "city=any",
    `minQuotes=${minQuotes}`,
    `preferAnchors=${preferIds.join(",")}`,
  );

  const steelRows = await loadSteelMaterials();
  const matById = new Map(steelRows.map((r) => [r.material.id, r]));

  // Try prefer anchors first; expand to fallback corrugado keepers if needed
  let anchorIds = preferIds.filter((id) => matById.has(id));
  if (anchorIds.length === 0) {
    anchorIds = FALLBACK_ANCHOR_IDS.filter((id) => matById.has(id));
  }

  let quotes = await collectAnchorQuotes(anchorIds, matById, city);
  let selected = selectQuotes(quotes, minQuotes, city);

  if (selected.scope === "none") {
    // Expand to full corrugado keepers
    const expanded = [
      ...new Set([...preferIds, ...FALLBACK_ANCHOR_IDS]),
    ].filter((id) => matById.has(id));
    if (expanded.length > anchorIds.length) {
      anchorIds = expanded;
      quotes = await collectAnchorQuotes(anchorIds, matById, city);
      selected = selectQuotes(quotes, minQuotes, city);
    }
  }

  if (selected.scope === "none" || selected.quotes.length < minQuotes) {
    console.log(
      JSON.stringify(
        {
          mode: apply ? "apply" : "dry-run",
          ok: false,
          error: `Need ≥${minQuotes} provider/WA quote(s) on corrugado anchors with weightKg (found ${selected.quotes.length})`,
          preferCity: city,
          anchorIdsTried: anchorIds,
          quotesSeen: quotes.map((q) => ({
            materialId: q.materialId,
            source: q.source,
            city: q.city,
            price: q.price,
            weightKg: q.weightKg,
            pKg: q.pKg,
            sameCity: q.sameCity,
            label: q.label,
          })),
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  const used = selected.quotes;
  const pKgAvg = avg(used.map((q) => q.pKg));
  if (pKgAvg == null || !(pKgAvg > 0)) {
    console.error("Failed to compute P_kg average");
    process.exit(1);
  }
  const P_kg = round4(pKgAvg);

  // Old baseline P_kg from anchors' previous rebasedPrice (or catalog price)
  const baselineSamples: number[] = [];
  for (const id of [...new Set(used.map((q) => q.materialId))]) {
    const row = matById.get(id);
    if (!row) continue;
    const w = resolveWeightKg(row.material.weightKg, null, row.material.name);
    if (w.weightKg == null) continue;
    const prev =
      optionalPositive(row.material.rebasedPrice) ??
      optionalPositive(row.material.price);
    if (prev == null) continue;
    baselineSamples.push(prev / w.weightKg);
  }
  const oldPKg = avg(baselineSamples);
  const scaleFactor =
    oldPKg != null && oldPKg > 0 ? P_kg / oldPKg : null;

  // Per-anchor average quote price (for direct update)
  const anchorQuoteAvg = new Map<number, number>();
  const byMat = new Map<number, number[]>();
  for (const q of used) {
    if (!byMat.has(q.materialId)) byMat.set(q.materialId, []);
    byMat.get(q.materialId)!.push(q.price);
  }
  for (const [id, prices] of byMat) {
    const a = avg(prices);
    if (a != null) anchorQuoteAvg.set(id, round2(a));
  }

  type PlanRow = {
    id: number;
    name: string;
    category: string | null;
    unit: string;
    method: "anchor_quote" | "p_kg_x_weight" | "proportional_scale" | "skip";
    weightKg: number | null;
    weightSource: string | null;
    oldRebased: number | null;
    catalogPrice: number;
    newRebased: number | null;
    reason?: string;
  };

  const plan: PlanRow[] = [];
  const skipped: PlanRow[] = [];

  for (const row of steelRows) {
    const m = row.material;
    const catalogPrice = optionalPositive(m.price) ?? 0;
    const oldRebased = optionalPositive(m.rebasedPrice);
    const wRes = resolveWeightKg(m.weightKg, null, m.name);

    // Anchors that contributed quotes → set toward quote avg (or P_kg * w)
    if (anchorQuoteAvg.has(m.id)) {
      const quoteAvg = anchorQuoteAvg.get(m.id)!;
      const fromPkg =
        wRes.weightKg != null ? round2(P_kg * wRes.weightKg) : null;
      const newRebased = quoteAvg > 0 ? quoteAvg : fromPkg;
      const item: PlanRow = {
        id: m.id,
        name: m.name,
        category: row.categoryName,
        unit: m.unit,
        method: "anchor_quote",
        weightKg: wRes.weightKg,
        weightSource: wRes.source,
        oldRebased,
        catalogPrice,
        newRebased,
      };
      if (newRebased == null || !(newRebased > 0)) {
        item.method = "skip";
        item.reason = "anchor quote avg invalid";
        skipped.push(item);
      } else {
        plan.push(item);
      }
      continue;
    }

    if (wRes.weightKg != null) {
      const newRebased = round2(P_kg * wRes.weightKg);
      plan.push({
        id: m.id,
        name: m.name,
        category: row.categoryName,
        unit: m.unit,
        method: "p_kg_x_weight",
        weightKg: wRes.weightKg,
        weightSource: wRes.source,
        oldRebased,
        catalogPrice,
        newRebased,
      });
      continue;
    }

    // No weight: proportional from previous rebased (or catalog) vs old P_kg baseline
    const base = oldRebased ?? (catalogPrice > 0 ? catalogPrice : null);
    if (base != null && scaleFactor != null && scaleFactor > 0) {
      plan.push({
        id: m.id,
        name: m.name,
        category: row.categoryName,
        unit: m.unit,
        method: "proportional_scale",
        weightKg: null,
        weightSource: null,
        oldRebased,
        catalogPrice,
        newRebased: round2(base * scaleFactor),
        reason: `scale=${round4(scaleFactor)} from oldPKg=${oldPKg != null ? round4(oldPKg) : "?"}`,
      });
      continue;
    }

    skipped.push({
      id: m.id,
      name: m.name,
      category: row.categoryName,
      unit: m.unit,
      method: "skip",
      weightKg: null,
      weightSource: null,
      oldRebased,
      catalogPrice,
      newRebased: null,
      reason:
        base == null
          ? "no weightKg and no previous price to scale"
          : "no old P_kg baseline from anchors",
    });
  }

  const report = {
    mode: apply ? "apply" : "dry-run",
    ok: true,
    preferCity: city,
    quoteScope: selected.scope,
    minQuotes,
    P_kg,
    oldBaselineP_kg: oldPKg != null ? round4(oldPKg) : null,
    scaleFactor: scaleFactor != null ? round4(scaleFactor) : null,
    priceOrigin: PRICE_ORIGIN,
    touchesMaterialsPrice: false,
    anchorsUsed: [...new Set(used.map((q) => q.materialId))],
    quotesUsed: used.map((q) => ({
      materialId: q.materialId,
      materialName: q.materialName,
      source: q.source,
      city: q.city,
      label: q.label,
      price: q.price,
      weightKg: q.weightKg,
      weightSource: q.weightSource,
      pKg: q.pKg,
      sameCity: q.sameCity,
    })),
    plannedUpdates: plan.length,
    skipped: skipped.length,
    samplePlan: plan.slice(0, 30),
    skippedSample: skipped.slice(0, 20),
    written: 0,
  };

  if (!apply) {
    console.log(JSON.stringify(report, null, 2));
    console.log(
      `\nDry-run: P_kg=${P_kg} updates=${plan.length} skipped=${skipped.length}. Re-run with --apply to write rebasedPrice (origin=${PRICE_ORIGIN}).`,
    );
    process.exit(0);
  }

  let written = 0;
  const now = new Date();
  for (const item of plan) {
    if (item.newRebased == null || !(item.newRebased > 0)) continue;
    await db
      .update(materials)
      .set({
        rebasedPrice: item.newRebased.toFixed(2),
        rebasedAt: now,
        priceOrigin: PRICE_ORIGIN,
        // intentionally NOT touching materials.price
      })
      .where(eq(materials.id, item.id));
    written++;
  }

  report.written = written;
  console.log(JSON.stringify(report, null, 2));
  console.log(
    `\nApply done: written=${written} skipped=${skipped.length} P_kg=${P_kg} origin=${PRICE_ORIGIN}`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
