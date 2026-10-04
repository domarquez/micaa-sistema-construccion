/**
 * Tests de plantillas de proyecto (sin DB).
 *   npx tsx scripts/test-project-templates.ts
 */
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { evaluateFormula, evaluateTemplate, formulaVariables, FormulaError, validateParams } from "../shared/template-formula";
import { buildTemplatePreview, canUseTemplate } from "../shared/project-templates";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}
const throwsFormula = (fn: () => unknown, re?: RegExp) =>
  assert.throws(fn, (e: any) => e instanceof FormulaError && (!re || re.test(e.message)));

// ---------- evaluador ----------
test("precedencia, paréntesis, unario y potencia", () => {
  assert.equal(evaluateFormula("2+3*4", {}), 14);
  assert.equal(evaluateFormula("(2+3)*4", {}), 20);
  assert.equal(evaluateFormula("-2*-3", {}), 6);
  assert.equal(evaluateFormula("2^3^2", {}), 512);
  assert.equal(evaluateFormula("10/4", {}), 2.5);
  assert.equal(evaluateFormula(".5+1.5e1", {}), 15.5);
});
test("funciones whitelisted y variables", () => {
  assert.equal(evaluateFormula("ceil(P/3)+2", { P: 84 }), 30);
  assert.equal(evaluateFormula("max(1, min(A, 3), 2)", { A: 10 }), 3);
  assert.equal(evaluateFormula("sqrt(A*10/6)", { A: 60 }), 10);
  assert.equal(evaluateFormula("floor(2.7)+round(2.5)+abs(-1)", {}), 6);
  assert.deepEqual(formulaVariables("Lm*0.4*0.5+ceil(Ncol)").sort(), ["Lm", "Ncol"]);
});
test("rechaza código / identificadores peligrosos", () => {
  throwsFormula(() => evaluateFormula("process.exit(1)", {}), /no permitido/);
  throwsFormula(() => evaluateFormula("constructor", {}), /desconocida/);
  throwsFormula(() => evaluateFormula("__proto__", {}), /desconocida/);
  throwsFormula(() => evaluateFormula("toString(1)", {}), /no permitida/);
  throwsFormula(() => evaluateFormula("eval(1)", {}), /no permitida/);
  throwsFormula(() => evaluateFormula("'a'", {}), /no permitido/);
  throwsFormula(() => evaluateFormula("a[0]", { a: 1 }), /no permitido/);
  throwsFormula(() => evaluateFormula("x=1", {}), /no permitido/);
  throwsFormula(() => evaluateFormula("1/0", {}), /cero/);
  throwsFormula(() => evaluateFormula("(1+2", {}));
  throwsFormula(() => evaluateFormula("1 2", {}), /sobrante/);
  throwsFormula(() => evaluateFormula("sqrt(-1)", {}), /negativo/);
  throwsFormula(() => evaluateFormula("1".repeat(600), {}), /larga/);
  throwsFormula(() => evaluateFormula("(".repeat(150) + "1" + ")".repeat(150), {}), /anidada/);
});
test("validación de params: rango, desconocidos, defaults", () => {
  const s = { A: { default: 60, min: 36, max: 120 }, H: { default: 2.6, min: 2.4, max: 3 } };
  assert.deepEqual(validateParams(s, null), { A: 60, H: 2.6 });
  assert.deepEqual(validateParams(s, { A: "80" }), { A: 80, H: 2.6 });
  throwsFormula(() => validateParams(s, { A: 500 }), /fuera de rango/);
  throwsFormula(() => validateParams(s, { A: "abc" }), /numérico/);
  throwsFormula(() => validateParams(s, { Z: 1 }), /desconocido/);
});

// ---------- plantillas del JSON ----------
const J = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "data/project-templates.json"), "utf8"));
test(`16 plantillas: cantidades por defecto = JSON y total = diseño (PU SCZ)`, () => {
  assert.equal(J.templates.length, 16);
  for (const t of J.templates) {
    const ev = evaluateTemplate(t.params, t.derived, t.items, null);
    let total = 0;
    ev.items.forEach((it: any, k: number) => {
      const exp = Math.max(0, t.items[k].defaultQuantity);
      assert.ok(Math.abs(it.quantity - exp) <= 0.0015, `${t.slug} #${it.sortOrder}: ${it.quantity} ≠ ${exp}`);
      total += it.quantity * t.items[k].designUnitPriceSCZ;
    });
    assert.ok(Math.abs(total - t.designTotalSCZ) / t.designTotalSCZ < 0.001, `${t.slug}: total ${total} vs ${t.designTotalSCZ}`);
  }
});
test("parámetros escalables: casa 90 m² > 60 m²; muro 2 caras > 1 cara", () => {
  const casa = J.templates.find((t: any) => t.slug === "casa-economica-1p-60");
  const q = (p: any) => evaluateTemplate(casa.params, casa.derived, casa.items, p).items;
  const sum = (items: any[], id: number) => items.filter((i) => i.activityId === id).reduce((s, i) => s + i.quantity, 0);
  assert.ok(sum(q({ A: 90 }), 527) > sum(q({ A: 60 }), 527), "muro 6H escala con A");
  assert.equal(sum(q({ A: 90 }), 518), 90);
  const muro = J.templates.find((t: any) => t.slug === "muro-perimetral-lote");
  const m1 = evaluateTemplate(muro.params, muro.derived, muro.items, { CARAS: 1 }).items;
  const m2 = evaluateTemplate(muro.params, muro.derived, muro.items, { CARAS: 2 }).items;
  assert.ok(Math.abs(sum(m2, 533) - 2 * sum(m1, 533)) < 0.01);
});
test("las derivadas no pueden pisar un parámetro", () => {
  throwsFormula(() => evaluateTemplate({ A: { default: 1, min: 0, max: 2 } }, [{ name: "A", expr: "2" }], [], null), /pisa/);
});

// ---------- preview + premium ----------
test("preview: precios, faltantes, omite cantidad 0, costo por unidad", () => {
  const pv = buildTemplatePreview(
    { A: { default: 10, min: 1, max: 100 }, X: { default: 0, min: 0, max: 1 } }, [], "A",
    [
      { sortOrder: 1, phaseId: 3, activityId: 527, quantityFormula: "A*2" },
      { sortOrder: 2, phaseId: 1, activityId: 518, quantityFormula: "A" },
      { sortOrder: 3, phaseId: 6, activityId: null, missingKey: "F_TOMA", missingName: "TOMA", quantityFormula: "3" },
      { sortOrder: 4, phaseId: 5, activityId: 547, quantityFormula: "X" },
    ],
    { A: 10 },
    new Map<number, any>([[527, { unitPrice: 131.32, name: "MURO", unit: "m2" }], [518, { unitPrice: 11.4, name: "REPLANTEO", unit: "m2" }]]),
  );
  assert.equal(pv.lines.length, 3);
  assert.equal(pv.lines[0].activityId, 518); // ordenado por fase
  assert.equal(pv.total, 2626.4 + 114);
  assert.equal(pv.missingCount, 1);
  assert.equal(pv.costPerRefUnit, 274.04);
  assert.equal(pv.byPhase[3], 2626.4);
});
test("premium: flag apagado = gratis; encendido exige entitlement vigente", () => {
  const base = { templateIsPremium: true, isAdmin: false, entitlements: [], templateId: 5 };
  assert.equal(canUseTemplate({ ...base, premiumEnabled: false }), true);
  assert.equal(canUseTemplate({ ...base, premiumEnabled: true }), false);
  assert.equal(canUseTemplate({ ...base, premiumEnabled: true, isAdmin: true }), true);
  assert.equal(canUseTemplate({ ...base, premiumEnabled: true, templateIsPremium: false }), true);
  assert.equal(canUseTemplate({ ...base, premiumEnabled: true, entitlements: [{ templateId: null, expiresAt: null }] }), true);
  assert.equal(canUseTemplate({ ...base, premiumEnabled: true, entitlements: [{ templateId: 6, expiresAt: null }] }), false);
  assert.equal(canUseTemplate({ ...base, premiumEnabled: true, entitlements: [{ templateId: 5, expiresAt: "2020-01-01" }] }), false);
});

console.log(`\n${passed} tests OK`);
