/** Tests de agrupación por fase de la vista de presupuesto. npx tsx scripts/test-budget-phase-groups.ts */
import assert from "node:assert/strict";
import { groupBudgetItemsByPhase } from "../client/src/lib/budget-phase-groups";

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log("  ✓", name); };

const phases = [
  { id: 1, name: "Obras preliminares", sortOrder: 10, isActive: true },
  { id: 34, name: "Carpintería", sortOrder: 110, isActive: true },
  { id: 5, name: "Instalaciones sanitarias", sortOrder: 120, isActive: true },
  { id: 6, name: "Instalaciones eléctricas", sortOrder: 130, isActive: true },
  { id: 3, name: "OBRA GRUESA", sortOrder: 903, isActive: false },
  { id: 4, name: "OBRA FINA", sortOrder: 904, isActive: false },
];
const P = (id: number) => phases.find((p) => p.id === id)!;

t("agrupa por la fase actual de la actividad, en orden constructivo (ítem guardado en fase inactiva)", () => {
  const g = groupBudgetItemsByPhase([
    { id: 51, phaseId: 5, subtotal: "10", activity: { phaseId: 6, phase: P(6) } },
    { id: 47, phaseId: 4, subtotal: "5", activity: { phaseId: 34, phase: P(34) } },
    { id: 44, phaseId: 1, subtotal: "1", activity: { phaseId: 1, phase: P(1) } },
    { id: 49, phaseId: 5, subtotal: "2.5", activity: { phaseId: 5, phase: P(5) } },
  ], phases);
  assert.deepEqual(g.map((x) => x.phaseId), [1, 34, 5, 6]);
  assert.equal(g[3].total, 10);
  assert.ok(g.every((x) => x.isActive));
});

t("actividad en fase inactiva → usa la fase activa guardada en el ítem", () => {
  const g = groupBudgetItemsByPhase([{ id: 1, phaseId: 5, subtotal: 3, activity: { phaseId: 3, phase: P(3) } }], phases);
  assert.equal(g[0].phaseId, 5);
});

t("ninguna fase activa → se muestra igual, al final, con su nombre", () => {
  const g = groupBudgetItemsByPhase([
    { id: 2, phaseId: 4, subtotal: 1, activity: { phaseId: 3, phase: P(3) } },
    { id: 1, phaseId: 1, subtotal: 1, activity: { phaseId: 1, phase: P(1) } },
  ], phases);
  assert.deepEqual(g.map((x) => [x.phaseId, x.name, x.isActive]), [[1, "Obras preliminares", true], [3, "OBRA GRUESA", false]]);
});

t("sin actividad ni fase / fase desconocida / sin lista de fases → no rompe", () => {
  const g = groupBudgetItemsByPhase([
    { id: 1, subtotal: null, activity: null },
    { id: 2, phaseId: 99, subtotal: "x" },
    { id: 3, activity: { phaseId: 1, phase: { id: 1, name: "Obras preliminares", sortOrder: 10, isActive: true } } },
  ]);
  assert.deepEqual(g.map((x) => x.phaseId), [1, 99, 0]);
  assert.equal(g[2].name, "Sin fase");
  assert.equal(g[1].total, 0);
  assert.deepEqual(groupBudgetItemsByPhase(undefined), []);
});

console.log(`\n${n} tests OK`);
