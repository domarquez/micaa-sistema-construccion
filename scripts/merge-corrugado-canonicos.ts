/**
 * Merge canónico de Corrugado CA-50 (barra 12m) + deactivate de SKUs en kg.
 *
 * Reuses helpers from merge-duplicate-materials.ts.
 *
 * Dry-run: npx tsx scripts/merge-corrugado-canonicos.ts
 * Apply:   npx tsx scripts/merge-corrugado-canonicos.ts --apply
 *
 * Map (Diego-approved):
 *   KEEP: 59–65 (Corrugado … barra 12 m)
 *   MERGE: 2157 → 61, 2156 → 62  (move FKs, copy weightKg if keeper null, deactivate source)
 *   DEACTIVATE only (unit=kg; do not merge into barra): 1561, 9, 10, 11
 *   Do not touch angular/redondo/rejas.
 *
 * Never overwrites materials.price. Prefers survivor catalog name "Corrugado …".
 */
import {
  deactivateMaterial,
  getMaterialById,
  mergeLoserIntoKeeper,
} from "./merge-duplicate-materials";

/** Explicit merge pairs: loser → keeper */
const MERGE_PAIRS: { loserId: number; keeperId: number; note: string }[] = [
  { loserId: 2157, keeperId: 61, note: "Fierro corrugado 3/8 CA-50 → Corrugado 3/8 barra 12m" },
  { loserId: 2156, keeperId: 62, note: "Fierro corrugado 1/2 CA-50 → Corrugado 1/2 barra 12m" },
];

/** Deactivate only — unit is kg; must not merge into barra keepers */
const DEACTIVATE_ONLY: { id: number; note: string }[] = [
  { id: 1561, note: "FIERRO CORRUGADO (Kg.) — deactivate only" },
  { id: 9, note: "Fierro 8mm (kg) — deactivate only" },
  { id: 10, note: "Fierro 10mm (kg) — deactivate only" },
  { id: 11, note: "Fierro 12mm (kg) — deactivate only" },
];

/** Untouched keepers (documentation / dry-run report) */
const KEEP_IDS = [59, 60, 61, 62, 63, 64, 65];

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(apply ? "MODE: --apply" : "MODE: dry-run");

  const report: {
    mode: string;
    keep: number[];
    merges: any[];
    deactivations: any[];
    skipped: any[];
  } = {
    mode: apply ? "apply" : "dry-run",
    keep: KEEP_IDS,
    merges: [],
    deactivations: [],
    skipped: [],
  };

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
    if (loser.name.startsWith("[DUPLICADO") || (loser.priceOrigin || "").toLowerCase() === "duplicado") {
      report.skipped.push({ ...pair, reason: "loser already deactivated" });
      continue;
    }

    const planned = {
      loserId: loser.id,
      loserName: loser.name,
      loserUnit: loser.unit,
      loserWeightKg: loser.weightKg,
      keeperId: keeper.id,
      keeperName: keeper.name,
      keeperUnit: keeper.unit,
      keeperWeightKg: keeper.weightKg,
      note: pair.note,
      willCopyWeightKg: !keeper.weightKg && !!loser.weightKg,
      willTouchPrice: false,
    };

    if (!apply) {
      report.merges.push({ ...planned, planned: "merge-fks-copy-weightKg-deactivate-source" });
      continue;
    }

    const result = await mergeLoserIntoKeeper(loser, keeper, { preferCorrugadoName: true });
    report.merges.push({ ...planned, ...result });
  }

  for (const item of DEACTIVATE_ONLY) {
    const mat = await getMaterialById(item.id);
    if (!mat) {
      report.skipped.push({ id: item.id, reason: "not found" });
      continue;
    }
    if (mat.name.startsWith("[DUPLICADO") || (mat.priceOrigin || "").toLowerCase() === "duplicado") {
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
      report.deactivations.push({ ...planned, planned: "deactivate-only-no-merge" });
      continue;
    }

    const result = await deactivateMaterial(mat, {
      reason: `${item.note}; unidad kg — no fusionar a Corrugado barra 12m`,
    });
    report.deactivations.push({ ...planned, ...result });
  }

  console.log(JSON.stringify(report, null, 2));
  if (!apply) {
    console.log(
      `\nDry-run: ${report.merges.length} merges, ${report.deactivations.length} deactivations. Re-run with --apply.`,
    );
  } else {
    console.log(
      `\nApply done: merges=${report.merges.length} deactivations=${report.deactivations.length} skipped=${report.skipped.length}`,
    );
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});