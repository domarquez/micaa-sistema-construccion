/**
 * Cemento por calidad (padres sin marca) + merge áridos duplicados.
 *
 * Product model (Diego): cement materials are quality parents; brand offers
 * (Itacamba/Camba, etc.) live only as quotes under the parent.
 *
 * Reuses helpers from merge-duplicate-materials.ts.
 *
 * Dry-run: npx tsx scripts/merge-cement-aridos-canonicos.ts
 * Apply:   npx tsx scripts/merge-cement-aridos-canonicos.ts --apply
 *
 * Map:
 *   KEEP / rename quality parents:
 *     2114 IP-30 → Cemento Portland IP-30 bolsa 50 kg
 *     2153 IM-40 → Cemento Portland IM-40 bolsa 50 kg (strip Camba)
 *     1 Tipo I, 104 Tipo V, 105 Blanco bolsa — keep (normalize if messy)
 *   MERGE → 2114 then deactivate/delete source: 2154, 2155, 2
 *   DEACTIVATE only: 1562, 1563, 1648, 570
 *   REMAP category: 2073 Cemento cola ACERO → ADHESIVOS (fallback CEMENTOS)
 *   ÁRIDOS MERGE: 94 → 5 Arena Fina; 96 → 7 Grava 3/4
 *   After merges: set rebasedPrice on 2114/2153 from ≥1 provider quote
 *     (priceOrigin=red_cemento); NEVER overwrite materials.price.
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
import { and, eq, desc } from "drizzle-orm";
import {
  deactivateMaterial,
  getMaterialById,
  mergeLoserIntoKeeper,
  type Mat,
} from "./merge-duplicate-materials";

const PRICE_ORIGIN = "red_cemento";

/** Quality-parent keepers with optional target catalog name (null = keep as-is). */
const RENAME_KEEPERS: {
  id: number;
  targetName: string | null;
  note: string;
}[] = [
  {
    id: 2114,
    targetName: "Cemento Portland IP-30 bolsa 50 kg",
    note: "IP-30 quality parent",
  },
  {
    id: 2153,
    targetName: "Cemento Portland IM-40 bolsa 50 kg",
    note: "IM-40 quality parent — strip Camba brand from name",
  },
  {
    id: 1,
    targetName: null,
    note: "Tipo I — keep (no forced rename)",
  },
  {
    id: 104,
    targetName: null,
    note: "Tipo V — keep (no forced rename)",
  },
  {
    id: 105,
    targetName: null, // set dynamically if messy
    note: "Blanco bolsa — keep; normalize only if messy",
  },
];

/** Heuristic: ALL CAPS / brand stubs / escaped junk → clean Blanco parent name. */
function blancoTargetIfMessy(current: string): string | null {
  const t = current.normalize("NFKC").replace(/\s+/g, " ").trim();
  const upperRatio = (() => {
    const letters = t.replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ]/g, "");
    if (!letters) return 0;
    const up = (letters.match(/[A-ZÁÉÍÓÚÑ]/g) || []).length;
    return up / letters.length;
  })();
  const messy =
    upperRatio > 0.85 ||
    /\\['"]/.test(current) ||
    /\b(tolteca|fancesa|viacha|itacamba|camba)\b/i.test(t) ||
    /cemento\s+blanco\s*$/i.test(t);
  if (!messy) return null;
  // Prefer bolsa form if unit/name already hints bolsa/50kg
  if (/bolsa|50\s*kg/i.test(t)) return "Cemento Blanco bolsa 50 kg";
  return "Cemento Blanco bolsa 50 kg";
}

/** Explicit merge pairs: loser → keeper */
const MERGE_PAIRS: { loserId: number; keeperId: number; note: string }[] = [
  {
    loserId: 2154,
    keeperId: 2114,
    note: "Cemento Camba IF 30 → IP-30 (move WA quotes)",
  },
  {
    loserId: 2155,
    keeperId: 2114,
    note: "Cemento Camba recibo → IP-30",
  },
  {
    loserId: 2,
    keeperId: 2114,
    note: "Cemento Portland Tipo Ip → IP-30",
  },
  {
    loserId: 94,
    keeperId: 5,
    note: "ARENA FINA LAVADA → Arena Fina",
  },
  {
    loserId: 96,
    keeperId: 7,
    note: 'GRAVA 3/4" → Grava 3/4',
  },
];

/** Soft-deactivate only — do not merge FKs into a keeper */
const DEACTIVATE_ONLY: { id: number; note: string }[] = [
  { id: 1562, note: "CEMENTO BLANCO kg — deactivate only" },
  { id: 1563, note: "FANCESA kg — deactivate only" },
  { id: 1648, note: "VIACHA kg — deactivate only" },
  { id: 570, note: "CEMENTO BLANCO TOLTECA — deactivate only" },
];

/** Remap misclassified cement adhesive out of ACERO */
const REMAP_CATEGORY: {
  materialId: number;
  preferredCategories: string[];
  note: string;
} = {
  materialId: 2073,
  preferredCategories: ["ADHESIVOS", "CEMENTOS"],
  note: "Cemento cola out of ACERO → adhesives (or CEMENTOS fallback)",
};

/** Parents that need rebasedPrice from quotes after merges */
const REBASE_PARENTS: {
  id: number;
  note: string;
  fallbackToCatalog: boolean;
}[] = [
  {
    id: 2114,
    note: "IP-30 ← avg/latest WA/provider quote (expect ~77 Itacamba)",
    fallbackToCatalog: false,
  },
  {
    id: 2153,
    note: "IM-40 ← catalog/quote ~82; else materials.price interim",
    fallbackToCatalog: true,
  },
];

const KEEP_IDS = RENAME_KEEPERS.map((r) => r.id);

function isDeactivated(m: { name: string; priceOrigin?: string | null }): boolean {
  return (
    m.name.startsWith("[DUPLICADO") ||
    (m.priceOrigin || "").toLowerCase() === "duplicado"
  );
}

function optionalPositive(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

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

type QuoteHit = {
  source: "whatsapp" | "supplier";
  price: number;
  label: string;
  city: string | null;
  updatedAt: Date | null;
};

async function collectProviderQuotes(materialId: number): Promise<QuoteHit[]> {
  const out: QuoteHit[] = [];

  const personRows = await db
    .select({ ump: userMaterialPrices, user: users })
    .from(userMaterialPrices)
    .leftJoin(users, eq(userMaterialPrices.userId, users.id))
    .where(
      and(
        eq(userMaterialPrices.materialId, materialId),
        eq(userMaterialPrices.isPublic, true),
      ),
    )
    .orderBy(desc(userMaterialPrices.updatedAt));

  for (const row of personRows) {
    if (isMarketBot(row.ump, row.user?.username)) continue;
    if (!isWaQuote(row.ump, row.user?.username)) continue;
    const price = optionalPositive(row.ump.price);
    if (price == null) continue;
    out.push({
      source: "whatsapp",
      price,
      label: row.ump.supplierName || row.user?.username || "whatsapp",
      city: row.ump.city || row.user?.city || null,
      updatedAt: row.ump.updatedAt ? new Date(row.ump.updatedAt) : null,
    });
  }

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
        eq(materialSupplierPrices.materialId, materialId),
        eq(materialSupplierPrices.isActive, true),
        eq(supplierCompanies.isActive, true),
      ),
    )
    .orderBy(desc(materialSupplierPrices.lastUpdated));

  for (const row of supplierRows) {
    const price = optionalPositive(row.msp.price);
    if (price == null) continue;
    out.push({
      source: "supplier",
      price,
      label: row.supplier.companyName,
      city: row.supplier.city || null,
      updatedAt: row.msp.lastUpdated ? new Date(row.msp.lastUpdated) : null,
    });
  }

  return out;
}

/** Prefer average of all quotes; if none, null. Also expose latest for report. */
function pickRebasedFromQuotes(quotes: QuoteHit[]): {
  rebased: number | null;
  method: string | null;
  latest: QuoteHit | null;
} {
  if (quotes.length === 0) {
    return { rebased: null, method: null, latest: null };
  }
  const sorted = [...quotes].sort((a, b) => {
    const ta = a.updatedAt?.getTime() ?? 0;
    const tb = b.updatedAt?.getTime() ?? 0;
    return tb - ta;
  });
  const mean = avg(quotes.map((q) => q.price));
  if (mean == null || !(mean > 0)) {
    return { rebased: null, method: null, latest: sorted[0] };
  }
  return {
    rebased: round2(mean),
    method: quotes.length === 1 ? "single_quote" : "avg_quotes",
    latest: sorted[0],
  };
}

async function resolveAdhesivesCategory(): Promise<{
  id: number | null;
  name: string | null;
  tried: string[];
}> {
  const cats = await db.select().from(materialCategories);
  const byName = new Map(cats.map((c) => [c.name.toUpperCase(), c]));
  const tried = REMAP_CATEGORY.preferredCategories;
  for (const name of tried) {
    const hit = byName.get(name.toUpperCase());
    if (hit) return { id: hit.id, name: hit.name, tried };
  }
  // Fuzzy: name contains adhesiv / pegament / cementos
  for (const c of cats) {
    const u = c.name.toUpperCase();
    if (u.includes("ADHESIV") || u.includes("PEGAMENT")) {
      return { id: c.id, name: c.name, tried: [...tried, `fuzzy:${c.name}`] };
    }
  }
  for (const c of cats) {
    if (c.name.toUpperCase().includes("CEMENT")) {
      return { id: c.id, name: c.name, tried: [...tried, `fuzzy:${c.name}`] };
    }
  }
  return { id: null, name: null, tried };
}

async function renameKeeper(
  mat: Mat,
  targetName: string,
  apply: boolean,
): Promise<{ id: number; from: string; to: string; changed: boolean; applied: boolean }> {
  const changed = mat.name.trim() !== targetName;
  if (apply && changed) {
    await db
      .update(materials)
      .set({ name: targetName, lastUpdated: new Date() })
      .where(eq(materials.id, mat.id));
  }
  return {
    id: mat.id,
    from: mat.name,
    to: targetName,
    changed,
    applied: apply && changed,
  };
}

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(apply ? "MODE: --apply" : "MODE: dry-run");

  const report: {
    mode: string;
    productModel: string;
    keep: number[];
    renames: any[];
    merges: any[];
    deactivations: any[];
    categoryRemaps: any[];
    rebases: any[];
    skipped: any[];
  } = {
    mode: apply ? "apply" : "dry-run",
    productModel:
      "Cement materials are quality parents (no brand in name); brands live as quotes under parent",
    keep: KEEP_IDS,
    renames: [],
    merges: [],
    deactivations: [],
    categoryRemaps: [],
    rebases: [],
    skipped: [],
  };

  // --- 1) Rename quality parents ---
  for (const item of RENAME_KEEPERS) {
    const mat = await getMaterialById(item.id);
    if (!mat) {
      report.skipped.push({ id: item.id, reason: "keeper not found (rename)" });
      continue;
    }
    if (isDeactivated(mat)) {
      report.skipped.push({ id: item.id, reason: "keeper already deactivated" });
      continue;
    }

    let target = item.targetName;
    if (item.id === 105 && !target) {
      target = blancoTargetIfMessy(mat.name);
    }

    if (!target) {
      report.renames.push({
        id: mat.id,
        from: mat.name,
        to: mat.name,
        changed: false,
        applied: false,
        note: item.note,
      });
      continue;
    }

    const result = await renameKeeper(mat, target, apply);
    report.renames.push({ ...result, note: item.note });
  }

  // --- 2) Merges (cement + áridos) ---
  for (const pair of MERGE_PAIRS) {
    const loser = await getMaterialById(pair.loserId);
    const keeper = await getMaterialById(pair.keeperId);
    if (!loser) {
      report.skipped.push({ ...pair, reason: `loser #${pair.loserId} not found` });
      continue;
    }
    if (!keeper) {
      report.skipped.push({ ...pair, reason: `keeper #${pair.keeperId} not found` });
      continue;
    }
    if (isDeactivated(loser)) {
      report.skipped.push({ ...pair, reason: "loser already deactivated" });
      continue;
    }

    const planned = {
      loserId: loser.id,
      loserName: loser.name,
      loserUnit: loser.unit,
      keeperId: keeper.id,
      keeperName: keeper.name,
      keeperUnit: keeper.unit,
      note: pair.note,
      willTouchPrice: false,
    };

    if (!apply) {
      report.merges.push({
        ...planned,
        planned: "merge-fks-deactivate-or-delete-source",
      });
      continue;
    }

    // preferCorrugadoName:false → use canonicalName path; we re-apply
    // quality-parent target names after merges so brands stay off the name.
    const result = await mergeLoserIntoKeeper(loser, keeper, {
      preferCorrugadoName: false,
    });
    report.merges.push({ ...planned, ...result });
  }

  // Re-apply quality-parent names after merges (canonicalName may Title-Case oddly)
  if (apply) {
    for (const item of RENAME_KEEPERS) {
      if (!item.targetName) continue;
      const mat = await getMaterialById(item.id);
      if (!mat || isDeactivated(mat)) continue;
      if (mat.name.trim() !== item.targetName) {
        const result = await renameKeeper(mat, item.targetName, true);
        report.renames.push({ ...result, note: `${item.note} (post-merge)` });
      }
    }
  }

  // --- 3) Deactivate only ---
  for (const item of DEACTIVATE_ONLY) {
    const mat = await getMaterialById(item.id);
    if (!mat) {
      report.skipped.push({ id: item.id, reason: "not found" });
      continue;
    }
    if (isDeactivated(mat)) {
      report.skipped.push({ id: item.id, reason: "already deactivated" });
      continue;
    }

    const planned = {
      id: mat.id,
      name: mat.name,
      unit: mat.unit,
      note: item.note,
    };

    if (!apply) {
      report.deactivations.push({
        ...planned,
        planned: "deactivate-only-priceOrigin=duplicado",
      });
      continue;
    }

    const result = await deactivateMaterial(mat, {
      reason: `${item.note}; priceOrigin=duplicado`,
    });
    report.deactivations.push({ ...planned, ...result });
  }

  // --- 4) Remap 2073 Cemento cola out of ACERO ---
  {
    const mat = await getMaterialById(REMAP_CATEGORY.materialId);
    const catInfo = await resolveAdhesivesCategory();
    if (!mat) {
      report.skipped.push({
        id: REMAP_CATEGORY.materialId,
        reason: "Cemento cola not found",
      });
    } else {
      const cats = await db
        .select()
        .from(materialCategories)
        .where(eq(materialCategories.id, mat.categoryId));
      const fromName = cats[0]?.name || `categoryId=${mat.categoryId}`;
      const planned = {
        id: mat.id,
        name: mat.name,
        from: fromName,
        fromCategoryId: mat.categoryId,
        to: catInfo.name,
        toCategoryId: catInfo.id,
        tried: catInfo.tried,
        note: REMAP_CATEGORY.note,
      };

      if (!catInfo.id) {
        report.categoryRemaps.push({
          ...planned,
          action: "skipped-no-adhesives-or-cementos-category",
          documented:
            "No ADHESIVOS / CEMENTOS category in DB — left category unchanged",
        });
      } else if (mat.categoryId === catInfo.id) {
        report.categoryRemaps.push({
          ...planned,
          action: "already-correct",
        });
      } else if (!apply) {
        report.categoryRemaps.push({
          ...planned,
          planned: "update-categoryId",
        });
      } else {
        await db
          .update(materials)
          .set({
            categoryId: catInfo.id,
            lastUpdated: new Date(),
          })
          .where(eq(materials.id, mat.id));
        report.categoryRemaps.push({
          ...planned,
          action: "remapped",
        });
      }
    }
  }

  // --- 5) rebasedPrice on cement parents (never touch materials.price) ---
  for (const item of REBASE_PARENTS) {
    const mat = await getMaterialById(item.id);
    if (!mat) {
      report.skipped.push({ id: item.id, reason: "rebase parent not found" });
      continue;
    }
    if (isDeactivated(mat)) {
      report.skipped.push({ id: item.id, reason: "rebase parent deactivated" });
      continue;
    }

    const quotes = await collectProviderQuotes(item.id);
    const picked = pickRebasedFromQuotes(quotes);
    let newRebased = picked.rebased;
    let method = picked.method;
    let origin = PRICE_ORIGIN;

    if (newRebased == null && item.fallbackToCatalog) {
      const catalog = optionalPositive(mat.price);
      if (catalog != null) {
        newRebased = round2(catalog);
        method = "catalog_price_interim";
        origin = PRICE_ORIGIN;
      }
    }

    const planned = {
      id: mat.id,
      name: mat.name,
      note: item.note,
      quotesFound: quotes.length,
      quotesSample: quotes.slice(0, 5).map((q) => ({
        source: q.source,
        price: q.price,
        label: q.label,
        city: q.city,
      })),
      latestQuote: picked.latest
        ? {
            source: picked.latest.source,
            price: picked.latest.price,
            label: picked.latest.label,
          }
        : null,
      oldRebased: optionalPositive(mat.rebasedPrice),
      catalogPrice: optionalPositive(mat.price),
      newRebased,
      method,
      priceOrigin: origin,
      willTouchMaterialsPrice: false,
    };

    if (newRebased == null || !(newRebased > 0)) {
      report.rebases.push({
        ...planned,
        action: "skipped-no-quote-and-no-fallback",
      });
      continue;
    }

    if (!apply) {
      report.rebases.push({ ...planned, planned: "set-rebasedPrice" });
      continue;
    }

    await db
      .update(materials)
      .set({
        rebasedPrice: newRebased.toFixed(2),
        rebasedAt: new Date(),
        priceOrigin: origin,
        // intentionally NOT touching materials.price
      })
      .where(eq(materials.id, mat.id));
    report.rebases.push({ ...planned, action: "written" });
  }

  console.log(JSON.stringify(report, null, 2));
  if (!apply) {
    console.log(
      `\nDry-run: renames=${report.renames.length} merges=${report.merges.length} deactivations=${report.deactivations.length} remaps=${report.categoryRemaps.length} rebases=${report.rebases.length}. Re-run with --apply.`,
    );
  } else {
    console.log(
      `\nApply done: renames=${report.renames.filter((r) => r.applied).length} merges=${report.merges.length} deactivations=${report.deactivations.length} remaps=${report.categoryRemaps.length} rebases=${report.rebases.filter((r) => r.action === "written").length} skipped=${report.skipped.length}`,
    );
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
