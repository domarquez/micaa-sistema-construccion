/**
 * Tests de la matemática pura de transporte por distancia (sin DB ni red).
 *   npx tsx scripts/test-transport.ts
 */
import assert from "node:assert/strict";
import {
  TRANSPORT,
  cityKmZero,
  computeTransport,
  extraKmFromDistance,
  faresPerDay,
  haversineKm,
  markupFactor,
  materialsPct,
} from "../shared/transport";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}
const near = (a: number, b: number, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);
const pct = { administrative: 8, utility: 15, tax: 3.09 };

test("km cero por ciudad (SCZ 5 km, LP 10, CBBA 6; alias y vacío → SCZ)", () => {
  assert.equal(cityKmZero("Santa Cruz")!.radiusKm, 5);
  assert.equal(cityKmZero("santa cruz de la sierra")!.city, "Santa Cruz");
  assert.equal(cityKmZero("")!.city, "Santa Cruz");
  assert.equal(cityKmZero("La Paz")!.radiusKm, 10);
  assert.equal(cityKmZero("Cochabamba")!.radiusKm, 6);
  assert.equal(cityKmZero("Potosi")!.city, "Potosí");
  assert.equal(cityKmZero("Beni")!.city, "Trinidad");
  assert.equal(cityKmZero("Mordor"), null);
});

test("extra_km = max(0, distancia − radio), con tolerancia < 1 km → 0", () => {
  assert.equal(extraKmFromDistance(4.5, 5), 0);
  assert.equal(extraKmFromDistance(5.8, 5), 0); // 4º anillo este ≈ 5.8 km por calle
  assert.equal(extraKmFromDistance(6.0, 5), 1);
  assert.equal(extraKmFromDistance(31.1, 5), 26.1); // Warnes
  assert.equal(extraKmFromDistance(20.67, 5), 15.7); // Cotoca
  assert.equal(extraKmFromDistance(500, 5), TRANSPORT.maxExtraKm);
});

test("materiales: 0.25 %/km × transport_factor, tope 12.5 %", () => {
  near(materialsPct(26.1, 1), 6.525, 1e-9);
  near(materialsPct(10, 1.25), 3.125, 1e-9);
  assert.equal(materialsPct(80, 1), 12.5);
  assert.equal(materialsPct(0, 1.6), 0);
});

test("pasajes por día = ceil(extra/5)", () => {
  assert.equal(faresPerDay(0), 0);
  assert.equal(faresPerDay(1), 1);
  assert.equal(faresPerDay(5), 1);
  assert.equal(faresPerDay(5.1), 2);
  assert.equal(faresPerDay(26.1), 6);
  assert.equal(faresPerDay(15.7), 4);
});

test("markup GG/U/IT (defaults) = 1.08 × 1.15 × 1.0309", () => {
  near(markupFactor(pct), 1.08 * 1.15 * 1.0309, 1e-9);
});

test("km cero → línea 0", () => {
  const r = computeTransport({ materials: 100000, laborHours: 2000, extraKm: 0, transportFactor: 1, fareBs: 3.5, percentages: pct });
  assert.equal(r.total, 0);
  assert.equal(r.faresPerDay, 0);
});

test("casa 60 m² en Warnes (26.1 km extra): mat 98 407, 1 930 h", () => {
  const r = computeTransport({ materials: 98407, laborHours: 1930, extraKm: 26.1, transportFactor: 1, fareBs: 3.5, percentages: pct });
  near(r.materialsCost, 98407 * 0.06525);
  near(r.workerDays, 241.3, 0.05);
  assert.equal(r.laborPerDay, 21);
  near(r.laborCost, (1930 / 8) * 21);
  near(r.total, (98407 * 0.06525 + (1930 / 8) * 21) * markupFactor(pct), 0.02);
});

test("haversine plaza SCZ → Warnes ≈ 30 km en línea recta", () => {
  const d = haversineKm({ lat: -17.78328, lng: -63.18212 }, { lat: -17.51008, lng: -63.16472 });
  assert.ok(d > 29 && d < 32, String(d));
});

console.log(`\n${passed} tests OK`);
