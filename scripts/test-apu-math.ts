/**
 * Tests de la matemática pura del APU (sin DB).
 *   npx tsx scripts/test-apu-math.ts
 */
import assert from "node:assert/strict";
import {
  computeApuTotals,
  effectiveQuantity,
  unitsLookIncoherent,
  APU_DEFAULT_PERCENTAGES,
  type ApuPercentages,
} from "../shared/apu";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}

const pct55: ApuPercentages = { ...APU_DEFAULT_PERCENTAGES, socialCharges: 55 };

test("ejemplo del diagnóstico §4.7 (muro 6H, CS 55 %) ≈ 117.7 Bs/m²", () => {
  // Materiales 49.64 · MO 22.60 (maestro 0.8 h × 18.75 + peón 0.4 h × 19)
  const t = computeApuTotals(
    [
      { inputType: "material", subtotal: 49.64 },
      { inputType: "labor", subtotal: 0.8 * 18.75 },
      { inputType: "labor", subtotal: 0.4 * 19 },
    ],
    pct55,
  );
  assert.equal(t.laborTotal, 22.6);
  assert.equal(t.laborFinal, 40.26);
  assert.equal(t.tools, 2.01); // 5 % de la MO final, no del equipo
  assert.ok(Math.abs(t.directCost - 91.91) <= 0.02, `directo ${t.directCost}`);
  assert.ok(Math.abs(t.totalUnitPrice - 117.7) < 0.1, `total ${t.totalUnitPrice}`);
});

test("herramientas menores = % de MO aunque no haya equipo", () => {
  const t = computeApuTotals([{ inputType: "labor", subtotal: 100 }], { ...pct55, minorTools: 5 });
  assert.equal(t.equipmentTotal, 0);
  assert.ok(t.tools > 0);
  assert.equal(t.equipmentWithTools, t.tools);
});

test("porcentajes del proyecto (CS 71.18 %) suben el total", () => {
  const rows = [
    { inputType: "material" as const, subtotal: 49.64 },
    { inputType: "labor" as const, subtotal: 22.6 },
  ];
  const a = computeApuTotals(rows, pct55);
  const b = computeApuTotals(rows, APU_DEFAULT_PERCENTAGES);
  assert.ok(b.totalUnitPrice > a.totalUnitPrice);
  assert.ok(Math.abs(b.totalUnitPrice - 123) < 1, `total ${b.totalUnitPrice}`);
});

test("desperdicio por composición", () => {
  assert.ok(Math.abs(effectiveQuantity(24, 5) - 25.2) < 1e-9);
  assert.equal(effectiveQuantity(10, null), 10);
  assert.equal(effectiveQuantity(10, 0), 10);
});

test("aviso de unidades incoherentes", () => {
  assert.equal(unitsLookIncoherent("kg", "bolsa"), true);
  assert.equal(unitsLookIncoherent("lt", "m"), true);
  assert.equal(unitsLookIncoherent("ml", "m"), false);
  assert.equal(unitsLookIncoherent("hr", "hora"), false);
  assert.equal(unitsLookIncoherent("M3", "m3"), false);
});

test("sin filas → 0", () => {
  assert.equal(computeApuTotals([], APU_DEFAULT_PERCENTAGES).totalUnitPrice, 0);
});

console.log(`\n${passed} tests OK`);
