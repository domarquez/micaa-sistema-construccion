/**
 * Unit tests for shared/steel-kg.ts (no DB).
 * Run: npx tsx scripts/test-steel-kg.ts
 */
import {
  classifySteelFamily,
  steelFamilyUsesLiveKg,
  canonSteelCity,
  robustMedianBskg,
  buildSteelKgRefMap,
  lookupSteelKgRef,
  steelBaseFromKg,
} from "../shared/steel-kg";

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("ok:", msg);
  }
}

assert(classifySteelFamily("Angular 1 1/2\" x 1/8\" x 6m") === "negro_perfil", "angular → negro_perfil");
assert(classifySteelFamily("CORRUGADO 1/2\" x 12m") === "corrugado", "corrugado");
assert(classifySteelFamily("Alambre de amarre N° 16") === "alambre", "alambre");
assert(classifySteelFamily("Electrodo 6013 1/8") === "electrodo", "electrodo");
assert(classifySteelFamily("Tubo PVC 1/2") === null, "PVC excluded");
assert(classifySteelFamily("Plancha inox AISI 304") === "inox", "inox");
assert(!steelFamilyUsesLiveKg("inox"), "inox not live-kg");
assert(steelFamilyUsesLiveKg("negro_perfil"), "negro live");

assert(canonSteelCity("Santa Cruz de la Sierra") === "Santa Cruz", "SCZ alias");
assert(canonSteelCity("El Alto") === "La Paz", "El Alto → LP");

// Outlier: one 100 shouldn't dominate when others ~15
const r = robustMedianBskg([14, 15, 14.5, 16, 100]);
assert(r.median != null && r.median < 20 && r.median > 13, `robust median ~15 got ${r.median}`);
assert(r.n === 4, `outlier dropped n=4 got ${r.n}`);
assert(r.rawN === 5, "rawN=5");

const map = buildSteelKgRefMap([
  { family: "negro_perfil", city: "Santa Cruz", bskg: 14 },
  { family: "negro_perfil", city: "Santa Cruz", bskg: 15 },
  { family: "negro_perfil", city: "Santa Cruz", bskg: 14.5 },
  { family: "negro_perfil", city: "Santa Cruz", bskg: 100 }, // outlier
  { family: "corrugado", city: "La Paz", bskg: 12 },
]);
const scz = lookupSteelKgRef(map, "negro_perfil", "Santa Cruz");
assert(!!scz && scz.note === "misma_ciudad" && scz.n === 3, `SCZ negro n=3 note misma got ${JSON.stringify(scz)}`);
const lp = lookupSteelKgRef(map, "negro_perfil", "La Paz");
assert(!!lp && lp.note === "fallback_SCZ" && lp.cityUsed === "Santa Cruz", `LP falls back SCZ got ${JSON.stringify(lp)}`);
const base = steelBaseFromKg(10.92, 14.54);
assert(Math.abs(base - 158.78) < 0.02, `10.92×14.54 ≈ 158.78 got ${base}`);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall passed");
