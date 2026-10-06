/**
 * Tests de la búsqueda de actividades (sin BD): npx tsx scripts/test-activity-search.ts
 */
import assert from "node:assert/strict";
import { buildSearchGroups, matchesSearch, normalizeSearchText } from "../shared/activity-search";

const N = {
  m6h: "MURO DE LADRILLO CERAMICO DE 6H",
  m527: "MURO DE LADRILLO 6H 12X18X25 DE SOGA E=12 CM, MORTERO 1:5",
  m21: "MURO VISTO LADRILLO CERAMICO 21 HUECOS 0.15",
  pint: "PINTURA LATEX EN MUROS (INTERIORES)",
  cp: "CONTRAPISO DE HORMIGÓN E=8 CM SOBRE EMPEDRADO E=15 CM",
  rev: "REVOQUE GRUESO INTERIOR DE CEMENTO 1:5",
  enl: "ENLUCIDO INTERIOR DE ESTUCO/YESO E=2-3 MM",
  cielo: "CIELO FALSO DE YESO APRENSADO",
  perch: "PERCHERO",
  bano: "ACCESORIOS DE BAÑO",
};
let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log("ok -", name); };

t("normaliza mayúsculas y acentos", () => {
  assert.equal(normalizeSearchText("Contrapiso de HORMIGÓN"), "contrapiso de hormigon");
  assert.equal(normalizeSearchText("BAÑO"), "bano");
});
t("muro (minúsculas) encuentra MURO…", () => {
  assert.ok(matchesSearch(N.m6h, "muro"));
  assert.ok(matchesSearch(N.m527, "Muro"));
  assert.ok(!matchesSearch(N.perch, "muro"));
});
t("muro hueco ↔ 6H / 21 huecos", () => {
  assert.ok(matchesSearch(N.m6h, "muro hueco"));
  assert.ok(matchesSearch(N.m527, "muro hueco"));
  assert.ok(matchesSearch(N.m21, "muro hueco"));
  assert.ok(!matchesSearch(N.pint, "muro hueco"));
});
t("ladrillo hueco y plural", () => {
  assert.ok(matchesSearch(N.m6h, "ladrillos huecos"));
  assert.ok(matchesSearch(N.m527, "LADRILLO HUECO"));
});
t("pared / tabique ↔ muro", () => {
  assert.ok(matchesSearch(N.m6h, "pared"));
  assert.ok(matchesSearch(N.m6h, "tabique ladrillo"));
});
t("drywall ↔ yeso", () => {
  assert.ok(matchesSearch(N.cielo, "drywall"));
});
t("revoque ↔ enlucido", () => {
  assert.ok(matchesSearch(N.enl, "revoque"));
  assert.ok(matchesSearch(N.rev, "enlucido"));
});
t("contrapiso de hormigon sin acento", () => {
  assert.ok(matchesSearch(N.cp, "contrapiso hormigon"));
});
t("baño sin tilde", () => {
  assert.ok(matchesSearch(N.bano, "accesorios bano"));
});
t("multi-token = AND", () => {
  assert.equal(buildSearchGroups("muro de ladrillo hueco").length, 3);
  assert.ok(!matchesSearch(N.cp, "contrapiso ladrillo"));
});
t("palabras cortas = inicio de palabra (gas ≠ vigas/omegas)", () => {
  assert.ok(matchesSearch("PUNTO DE GAS NATURAL DOMICILIARIO", "gas"));
  assert.ok(!matchesSearch("VIGAS DE H°A°", "gas"));
  assert.ok(!matchesSearch("CIELO SOBRE OMEGAS GALVANIZADAS", "gas"));
});
console.log(`\n${n} tests OK`);
