/** Tests de divulgación progresiva (client/src/lib/disclosure.ts). npx tsx scripts/test-disclosure.ts */
import assert from "node:assert/strict";
import { computeDisclosureLevel, canAccess, featureForPath, LEVEL, MAX_LEVEL } from "../client/src/lib/disclosure";

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log("  ✓", name); };

t("niveles: visitante 0, sin WhatsApp 0, verificado 1, admin máximo", () => {
  assert.equal(computeDisclosureLevel(null), LEVEL.MATERIALS);
  assert.equal(computeDisclosureLevel({ role: "user", phoneVerified: false }), LEVEL.MATERIALS);
  assert.equal(computeDisclosureLevel({ role: "supplier" }), LEVEL.MATERIALS);
  assert.equal(computeDisclosureLevel({ role: "user", phoneVerified: true }), LEVEL.ENROLLED);
  assert.equal(computeDisclosureLevel({ role: "admin", phoneVerified: false }), MAX_LEVEL);
});

t("features: materiales siempre; proyectos/plantillas desde nivel 1; admin todo", () => {
  for (const u of [null, { role: "user" }]) {
    assert.equal(canAccess(u, "materials"), true);
    for (const f of ["projects", "templates", "catalog", "pdf", "schedules"] as const) assert.equal(canAccess(u, f), false, f);
  }
  for (const f of ["materials", "projects", "templates", "catalog", "pdf", "schedules"] as const) {
    assert.equal(canAccess({ role: "user", phoneVerified: true }, f), true, f);
    assert.equal(canAccess({ role: "admin" }, f), true, f);
  }
});

t("rutas: se bloquean proyectos/plantillas/catálogo; materiales, cuenta y admin no", () => {
  assert.equal(featureForPath("/budgets"), "projects");
  assert.equal(featureForPath("/budgets/12"), "projects");
  assert.equal(featureForPath("/budgets/new?x=1"), "projects");
  assert.equal(featureForPath("/dashboard"), "projects");
  assert.equal(featureForPath("/plantillas"), "templates");
  assert.equal(featureForPath("/activities"), "catalog");
  assert.equal(featureForPath("/marketplace"), "catalog");
  for (const p of ["/", "/materiales", "/materiales/5", "/lista", "/publicar-precio", "/materials", "/account-settings", "/login", "/inscribete", "/admin/materials", "/supplier-dashboard", "/budgetsx"])
    assert.equal(featureForPath(p), null, p);
});

console.log(`\n${n} tests OK`);
