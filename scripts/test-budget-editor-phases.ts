/** Tests del estado del editor de presupuestos. npx tsx scripts/test-budget-editor-phases.ts */
import assert from "node:assert/strict";
import { buildEditorPhases, removeEditorItem, shouldHydrateEditor } from "../client/src/lib/budget-editor-phases";

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log("  ✓", name); };

// /api/construction-phases: solo activas, en orden constructivo
const phases = [{ id: 1, name: "Obras preliminares", sortOrder: 10 }, { id: 34, name: "Carpintería", sortOrder: 110 }, { id: 5, name: "Sanitarias", sortOrder: 120 }, { id: 6, name: "Eléctricas", sortOrder: 130 }];
const items = [
  { id: 51, phaseId: 5, activityId: 245, quantity: "2", unitPrice: "10.5", subtotal: "21", activity: { id: 245, phaseId: 6, name: "Cableado", phase: { id: 6 } } },
  { id: 47, phaseId: 4, activityId: 108, quantity: "1", unitPrice: "5", subtotal: "5", activity: { id: 108, phaseId: 34, name: "Puerta" } },
  { id: 44, phaseId: 1, activityId: 6, quantity: "3", unitPrice: "1", subtotal: "3", activity: { id: 6, phaseId: 1, name: "Entibado" } },
  { id: 60, phaseId: 5, activityId: 900, quantity: "1", unitPrice: "2", subtotal: "2", activity: { id: 900, phaseId: 3, name: "Custom en fase antigua" } },
];

t("carga: agrupa por fase actual de la actividad, en orden, con ids estables y fase guardada", () => {
  const p = buildEditorPhases(items, [{ id: 6, phaseId: 1 }], phases);
  assert.deepEqual(p.map((x) => x.phaseId), [1, 34, 5, 6]);
  const cab = p.find((x) => x.phaseId === 6)!.items[0];
  assert.equal(cab.id, "51"); assert.equal(cab.dbId, 51); assert.equal(cab.storedPhaseId, 5);
  assert.equal(cab.quantity, 2); assert.equal(cab.unitPrice, 10.5);
  // actividad en fase inactiva (3) → fase activa guardada (5)
  assert.deepEqual(p.find((x) => x.phaseId === 5)!.items.map((i) => i.dbId), [60]);
  assert.equal(p.find((x) => x.phaseId === 6)!.total, 21);
});

t("borrar: quita el ítem correcto y recalcula total; el último ítem quita la fase", () => {
  let p = buildEditorPhases([...items, { id: 52, phaseId: 6, activityId: 241, quantity: "1", unitPrice: "4", subtotal: "4", activity: { id: 241, phaseId: 6 } }], [], phases);
  p = removeEditorItem(p, 6, "51");
  assert.deepEqual(p.find((x) => x.phaseId === 6)!.items.map((i) => i.id), ["52"]);
  assert.equal(p.find((x) => x.phaseId === 6)!.total, 4);
  p = removeEditorItem(p, 6, "52");
  assert.equal(p.some((x) => x.phaseId === 6), false);
  assert.equal(p.length, 3);
});

t("hidratación: una sola vez por presupuesto (las ediciones locales no se pisan en cada render)", () => {
  assert.equal(shouldHydrateEditor(null, 61, false), false);
  assert.equal(shouldHydrateEditor(null, 61, true), true);
  assert.equal(shouldHydrateEditor(61, 61, true), false);
  assert.equal(shouldHydrateEditor(61, 62, true), true);
  assert.equal(shouldHydrateEditor(null, undefined, true), false);
});

t("simulación de renders: editar cantidad y borrar sobreviven a re-renders con nuevos arreglos de actividades", () => {
  let hydrated: number | null = null;
  let state = [] as ReturnType<typeof buildEditorPhases>;
  const render = () => { // equivalente al efecto, con un arreglo nuevo de actividades en cada render
    if (shouldHydrateEditor(hydrated, 61, true)) { hydrated = 61; state = buildEditorPhases(items, [...[]], phases); }
  };
  render();
  state = state.map((p) => ({ ...p, items: p.items.map((i) => (i.id === "44" ? { ...i, quantity: 7 } : i)) }));
  render();
  state = removeEditorItem(state, 34, "47");
  render(); render();
  assert.equal(state.find((x) => x.phaseId === 1)!.items[0].quantity, 7);
  assert.equal(state.some((x) => x.phaseId === 34), false);
});

console.log(`\n${n} tests OK`);
