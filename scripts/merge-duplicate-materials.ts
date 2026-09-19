/**
 * Fusiona materiales duplicados (misma clave normalizada nombre+unidad) de forma segura.
 *
 * Dry-run: npx tsx scripts/merge-duplicate-materials.ts
 * Apply:   npx tsx scripts/merge-duplicate-materials.ts --apply
 *
 * --apply:
 *  1) Reasigna FKs de losers → keeper
 *  2) DELETE loser si no quedan refs; si falla, renombra [DUPLICADO #id→keeperId] y priceOrigin=duplicado
 *  3) Normaliza el nombre del keeper a forma canónica limpia
 */
import { db } from "../server/db";
import {
  materials,
  userMaterialPrices,
  materialSupplierPrices,
  materialListItems,
  activityCompositions,
  userActivityCompositions,
  customActivityCompositions,
} from "../shared/schema";
import { eq } from "drizzle-orm";

export type Mat = typeof materials.$inferSelect;

const UNIT_MAP: Record<string, string> = {
  kg: "kg",
  kilos: "kg",
  kilogramo: "kg",
  kilogramos: "kg",
  kgr: "kg",
  m2: "m2",
  "m²": "m2",
  mt2: "m2",
  m3: "m3",
  "m³": "m3",
  mt3: "m3",
  pza: "pza",
  pieza: "pza",
  piezas: "pza",
  und: "pza",
  u: "pza",
  unidad: "pza",
  unidades: "pza",
  bolsa: "bolsa",
  bolsas: "bolsa",
  blsa: "bolsa",
  gal: "gal",
  galon: "gal",
  galón: "gal",
  lt: "lt",
  l: "lt",
  litro: "lt",
  m: "m",
  ml: "m",
  metro: "m",
  metros: "m",
  rollo: "rollo",
  plancha: "plancha",
  barra: "barra",
  bar: "barra",
  brra: "barra",
  p2: "p2",
};

function stripAccents(s: string): string {
  return s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

/** Unidad canónica (minúsculas, sin punto final). */
export function normalizeUnit(unit: string): string {
  let u = stripAccents(unit.normalize("NFKC")).toLowerCase().trim();
  u = u.replace(/\s+/g, " ").replace(/\.+$/, "");
  u = u.replace(/roilo|roila/g, "rollo");
  return UNIT_MAP[u] || u;
}

/**
 * Clave fuerte de dedupe: NFKC, lower, sin acentos, unifica comillas a ",
 * colapsa espacios/puntuación menor; incluye unidad.
 */
export function dedupeKey(name: string, unit: string): string {
  let s = name.normalize("NFKC");
  s = stripAccents(s).toLowerCase();
  // Unescape imports tipo \' \'
  s = s.replace(/\\'/g, "'").replace(/\\"/g, '"');
  // Cualquier corrida de comillas tipográficas / dobles simples → "
  s = s.replace(/['"`´′″‘’“”]+/g, '"');
  // Quitar puntuación menor excepto / " # -
  s = s.replace(/[^\w\s/"#-]+/g, " ");
  s = s.replace(/#\s+/g, "#");
  s = s.replace(/\s+/g, " ").trim();
  return `${s}||${normalizeUnit(unit)}`;
}

/** Nombre canónico legible (Title Case suave + " de pulgada). */
export function canonicalName(name: string): string {
  let s = name.normalize("NFKC").replace(/\s+/g, " ").trim();
  s = s.replace(/\\'/g, "'").replace(/\\"/g, '"');
  s = s.replace(/['"`´′″‘’“”]+/g, '"');
  // CORRUGADO 1/2" (12 mm.) BAR 12 m. → Corrugado 1/2" (12 mm) barra 12 m
  s = s.replace(/\bBAR\b/gi, "barra");
  s = s.replace(/\bmm\./gi, "mm");
  s = s.replace(/\bm\./gi, "m");
  s = s.replace(/\s+\./g, "");
  // Title-case words except units / numbers / inch marks
  const keepLower = new Set(["de", "x", "mm", "m", "kg", "m2", "m3", "barra", "pulg"]);
  s = s
    .split(" ")
    .map((w, i) => {
      if (/^\d/.test(w) || w.includes('"') || w.includes("/")) return w;
      const low = w.toLowerCase();
      if (i > 0 && keepLower.has(low)) return low;
      return low.charAt(0).toUpperCase() + low.slice(1);
    })
    .join(" ");
  return s;
}

function scoreKeeper(m: Mat): number {
  // Prefer non-pendiente / non-duplicado origins
  const origin = (m.priceOrigin || "").toLowerCase();
  let score = 0;
  if (origin && origin !== "pendiente" && origin !== "duplicado") score += 100;
  if (origin === "importado" || origin === "mixto" || origin === "nacional" || origin === "mercado")
    score += 20;
  // Title Case / mixed case cleaner than ALL CAPS
  const letters = m.name.replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ]/g, "");
  const upper = (letters.match(/[A-ZÁÉÍÓÚÑ]/g) || []).length;
  const lower = (letters.match(/[a-záéíóúñ]/g) || []).length;
  if (lower > 0 && upper > 0) score += 15; // mixed
  else if (lower > upper) score += 10;
  // More recent lastUpdated
  if (m.lastUpdated) score += Math.min(50, new Date(m.lastUpdated).getTime() / 1e12);
  // Lower id as weak tiebreak (subtract so lower id wins)
  score -= m.id * 1e-6;
  return score;
}

function pickKeeper(group: Mat[]): Mat {
  return [...group].sort((a, b) => scoreKeeper(b) - scoreKeeper(a))[0];
}

export const FK_TABLES: { label: string; table: any; col: any }[] = [
  { label: "user_material_prices", table: userMaterialPrices, col: userMaterialPrices.materialId },
  { label: "material_supplier_prices", table: materialSupplierPrices, col: materialSupplierPrices.materialId },
  { label: "material_list_items", table: materialListItems, col: materialListItems.materialId },
  { label: "activity_compositions", table: activityCompositions, col: activityCompositions.materialId },
  { label: "user_activity_compositions", table: userActivityCompositions, col: userActivityCompositions.materialId },
  { label: "custom_activity_compositions", table: customActivityCompositions, col: customActivityCompositions.materialId },
];

export async function countRefs(materialId: number): Promise<number> {
  let total = 0;
  for (const fk of FK_TABLES) {
    const rows = await db.select({ id: fk.col }).from(fk.table).where(eq(fk.col, materialId));
    total += rows.length;
  }
  return total;
}

export async function reassignFks(loserId: number, keeperId: number): Promise<Record<string, number>> {
  const moved: Record<string, number> = {};
  for (const fk of FK_TABLES) {
    const result = await db.update(fk.table).set({ materialId: keeperId }).where(eq(fk.col, loserId));
    // drizzle neon may not return rowCount consistently; recount delta
    moved[fk.label] = (result as any)?.rowCount ?? -1;
  }
  return moved;
}


/** Soft-deactivate: [DUPLICADO …] + priceOrigin=duplicado (hidden by public search). */
export async function deactivateMaterial(
  loser: Mat,
  opts: { keeperId?: number; reason?: string } = {},
): Promise<{ action: string; newName: string }> {
  const arrow = opts.keeperId != null ? `→${opts.keeperId}` : "";
  const newName = `[DUPLICADO #${loser.id}${arrow}] ${loser.name}`.slice(0, 240);
  const description =
    opts.reason ||
    (opts.keeperId != null
      ? `Duplicado de material #${opts.keeperId}`
      : "Desactivado (priceOrigin=duplicado)");
  await db
    .update(materials)
    .set({
      name: newName,
      priceOrigin: "duplicado",
      description: description.slice(0, 500),
      lastUpdated: new Date(),
    })
    .where(eq(materials.id, loser.id));
  return { action: "deactivated", newName };
}

/** Prefer catalog names starting with "Corrugado …" over WA "Fierro corrugado …". */
export function preferCorrugadoCatalogName(keeperName: string, loserName?: string): string {
  const kCanon = canonicalName(keeperName);
  const lCanon = loserName ? canonicalName(loserName) : "";
  if (/^corrugado\b/i.test(kCanon)) return kCanon;
  if (lCanon && /^corrugado\b/i.test(lCanon)) return lCanon;
  return kCanon;
}

export async function getMaterialById(id: number): Promise<Mat | null> {
  const rows = await db.select().from(materials).where(eq(materials.id, id)).limit(1);
  return rows[0] || null;
}

export type MergePairResult = {
  keeperId: number;
  loserId: number;
  action: string;
  moved?: Record<string, number>;
  weightKgCopied?: string | null;
  keeperName?: string;
  remaining?: number;
  error?: string;
};

/**
 * Merge one loser into keeper (pair mode):
 * - reassign FKs
 * - copy weightKg → keeper only if keeper.weightKg is null
 * - NEVER overwrite materials.price
 * - prefer Corrugado catalog name on keeper
 * - delete loser if 0 refs, else soft-deactivate
 */
export async function mergeLoserIntoKeeper(
  loser: Mat,
  keeper: Mat,
  opts: { preferCorrugadoName?: boolean } = {},
): Promise<MergePairResult> {
  const preferCorrugado = opts.preferCorrugadoName !== false;
  const desiredName = preferCorrugado
    ? preferCorrugadoCatalogName(keeper.name, loser.name)
    : canonicalName(keeper.name);
  const unitCanon = normalizeUnit(keeper.unit);

  const patch: Record<string, unknown> = { lastUpdated: new Date() };
  if (desiredName !== keeper.name) patch.name = desiredName;
  if (unitCanon !== keeper.unit) patch.unit = unitCanon;

  let weightKgCopied: string | null = null;
  const keeperW =
    keeper.weightKg != null && String(keeper.weightKg).trim() !== ""
      ? String(keeper.weightKg)
      : null;
  const loserW =
    loser.weightKg != null && String(loser.weightKg).trim() !== ""
      ? String(loser.weightKg)
      : null;
  if (!keeperW && loserW) {
    patch.weightKg = loserW;
    weightKgCopied = loserW;
  }

  if (Object.keys(patch).length > 1) {
    await db.update(materials).set(patch).where(eq(materials.id, keeper.id));
  }

  try {
    const moved = await reassignFks(loser.id, keeper.id);
    const remaining = await countRefs(loser.id);
    if (remaining === 0) {
      try {
        await db.delete(materials).where(eq(materials.id, loser.id));
        return {
          keeperId: keeper.id,
          loserId: loser.id,
          action: "deleted",
          moved,
          weightKgCopied,
          keeperName: desiredName,
        };
      } catch (delErr: any) {
        await deactivateMaterial(loser, {
          keeperId: keeper.id,
          reason: `Duplicado de material #${keeper.id}; delete falló: ${String(delErr?.message || delErr).slice(0, 180)}`,
        });
        return {
          keeperId: keeper.id,
          loserId: loser.id,
          action: "renamed-after-delete-fail",
          moved,
          weightKgCopied,
          keeperName: desiredName,
          error: String(delErr?.message || delErr),
        };
      }
    }
    await deactivateMaterial(loser, {
      keeperId: keeper.id,
      reason: `Duplicado de #${keeper.id}; refs restantes=${remaining}`,
    });
    return {
      keeperId: keeper.id,
      loserId: loser.id,
      action: "renamed-refs-remain",
      remaining,
      moved,
      weightKgCopied,
      keeperName: desiredName,
    };
  } catch (err: any) {
    return {
      keeperId: keeper.id,
      loserId: loser.id,
      action: "skipped",
      error: String(err?.message || err),
    };
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(apply ? "MODE: --apply" : "MODE: dry-run");

  const rows = await db.select().from(materials);
  console.log(`Materials: ${rows.length}`);

  const groups = new Map<string, Mat[]>();
  for (const row of rows) {
    // Skip already retired duplicates
    if (row.name.startsWith("[DUPLICADO")) continue;
    if ((row.priceOrigin || "").toLowerCase() === "duplicado") continue;
    const key = dedupeKey(row.name, row.unit);
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }

  const dupes = [...groups.entries()].filter(([, list]) => list.length > 1);

  const report = {
    mode: apply ? "apply" : "dry-run",
    materialCount: rows.length,
    dupGroupCount: dupes.length,
    groups: [] as any[],
    keep: [] as any[],
    merge: [] as any[],
    skipped: [] as any[],
  };

  for (const [key, list] of dupes.sort((a, b) => a[0].localeCompare(b[0]))) {
    const keeper = pickKeeper(list);
    const losers = list.filter((m) => m.id !== keeper.id);
    const canon = canonicalName(keeper.name);
    const unitCanon = normalizeUnit(keeper.unit);

    const groupInfo = {
      key,
      keep: {
        id: keeper.id,
        name: keeper.name,
        unit: keeper.unit,
        priceOrigin: keeper.priceOrigin,
        canonicalName: canon,
        canonicalUnit: unitCanon,
      },
      losers: losers.map((l) => ({
        id: l.id,
        name: l.name,
        unit: l.unit,
        priceOrigin: l.priceOrigin,
      })),
    };
    report.groups.push(groupInfo);
    report.keep.push(groupInfo.keep);

    if (!apply) {
      report.merge.push({
        keeperId: keeper.id,
        loserIds: losers.map((l) => l.id),
        planned: "reassign-fks-then-delete-or-rename",
      });
      continue;
    }

    // Normalize keeper name/unit
    if (canon !== keeper.name || unitCanon !== keeper.unit) {
      await db
        .update(materials)
        .set({
          name: canon,
          unit: unitCanon,
          lastUpdated: new Date(),
        })
        .where(eq(materials.id, keeper.id));
    }

    for (const loser of losers) {
      try {
        const moved = await reassignFks(loser.id, keeper.id);
        const remaining = await countRefs(loser.id);
        if (remaining === 0) {
          try {
            await db.delete(materials).where(eq(materials.id, loser.id));
            report.merge.push({
              keeperId: keeper.id,
              loserId: loser.id,
              action: "deleted",
              moved,
            });
          } catch (delErr: any) {
            const newName = `[DUPLICADO #${loser.id}→${keeper.id}] ${loser.name}`.slice(0, 240);
            await db
              .update(materials)
              .set({
                name: newName,
                priceOrigin: "duplicado",
                description: `Duplicado de material #${keeper.id}; delete falló: ${String(delErr?.message || delErr).slice(0, 180)}`,
                lastUpdated: new Date(),
              })
              .where(eq(materials.id, loser.id));
            report.merge.push({
              keeperId: keeper.id,
              loserId: loser.id,
              action: "renamed-after-delete-fail",
              moved,
              error: String(delErr?.message || delErr),
            });
          }
        } else {
          const newName = `[DUPLICADO #${loser.id}→${keeper.id}] ${loser.name}`.slice(0, 240);
          await db
            .update(materials)
            .set({
              name: newName,
              priceOrigin: "duplicado",
              description: `Duplicado de #${keeper.id}; refs restantes=${remaining}`,
              lastUpdated: new Date(),
            })
            .where(eq(materials.id, loser.id));
          report.merge.push({
            keeperId: keeper.id,
            loserId: loser.id,
            action: "renamed-refs-remain",
            remaining,
            moved,
          });
        }
      } catch (err: any) {
        report.skipped.push({
          keeperId: keeper.id,
          loserId: loser.id,
          reason: String(err?.message || err),
        });
      }
    }
  }

  console.log(JSON.stringify(report, null, 2));
  if (!apply) {
    console.log(
      `\nDry-run: ${report.dupGroupCount} grupos duplicados. Re-ejecutar con --apply para fusionar.`,
    );
  } else {
    console.log(
      `\nApply done: merged=${report.merge.length} skipped=${report.skipped.length}`,
    );
  }
  process.exit(0);
}

const isDirect =
  typeof process !== "undefined" &&
  !!process.argv[1] &&
  /merge-duplicate-materials\.(ts|js)$/.test(process.argv[1].replace(/\\/g, "/"));

if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}