/**
 * Read-only verification: live APU unit prices by city (SCZ / LP / CBBA).
 * Uses Neon WS (local node-postgres to Supabase pooler times out).
 * Mirrors listing path: Base MICAA × city factors + default APU markups; no project overrides.
 *
 * Usage: DATABASE_URL=... npx tsx scripts/verify-live-activity-prices-by-city.ts
 */
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import {
  APU_DEFAULT_PERCENTAGES,
  computeApuTotals,
  effectiveQuantity,
} from "../shared/apu";

neonConfig.webSocketConstructor = ws as any;

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

async function livePu(
  pool: Pool,
  activityId: number,
  city: string,
  factors: { materials: number; labor: number; equipment: number },
) {
  const comps = (
    await pool.query(`SELECT * FROM activity_compositions WHERE activity_id = $1 ORDER BY id`, [
      activityId,
    ])
  ).rows;

  const laborIds = [...new Set(comps.map((c: any) => c.labor_id).filter(Boolean))];
  const toolIds = [...new Set(comps.map((c: any) => c.tool_id).filter(Boolean))];
  const matIds = [...new Set(comps.map((c: any) => c.material_id).filter(Boolean))];

  const laborMap = new Map<number, any>();
  if (laborIds.length) {
    const r = await pool.query(`SELECT * FROM labor_categories WHERE id = ANY($1::int[])`, [laborIds]);
    for (const row of r.rows) laborMap.set(row.id, row);
  }
  const toolMap = new Map<number, any>();
  if (toolIds.length) {
    const r = await pool.query(`SELECT * FROM tools WHERE id = ANY($1::int[])`, [toolIds]);
    for (const row of r.rows) toolMap.set(row.id, row);
  }
  const matMap = new Map<number, any>();
  if (matIds.length) {
    const r = await pool.query(
      `SELECT id, name, price::float, rebased_price::float FROM materials WHERE id = ANY($1::int[])`,
      [matIds],
    );
    for (const row of r.rows) matMap.set(row.id, row);
  }

  const rows: { inputType: "material" | "labor" | "equipment"; subtotal: number; inputId: number | null; unitPrice: number; name: string }[] = [];
  let cement: { unitPrice: number; base: number } | null = null;

  for (const c of comps) {
    const t = String(c.type || "").toLowerCase();
    const inputType: "material" | "labor" | "equipment" | null =
      t.startsWith("mat") || t === "material" || t === "m"
        ? "material"
        : t.startsWith("lab") || t === "labor" || t === "mo" || t === "mano"
          ? "labor"
          : t.startsWith("eq") || t.startsWith("tool") || t === "equipment" || t === "e"
            ? "equipment"
            : null;
    if (!inputType) continue;
    const qty = effectiveQuantity(num(c.quantity), num(c.waste_pct, 0));
    let unitPrice = num(c.unit_cost);
    let name = c.description;
    let inputId: number | null = null;

    if (inputType === "material" && c.material_id != null) {
      inputId = c.material_id;
      const m = matMap.get(inputId);
      if (m) {
        name = m.name;
        const base = m.rebased_price != null ? num(m.rebased_price) : num(m.price);
        unitPrice = factors.materials !== 1 ? round2(base * factors.materials) : base;
        if (inputId === 2114) cement = { unitPrice, base };
      }
    } else if (inputType === "labor" && c.labor_id != null) {
      inputId = c.labor_id;
      const l = laborMap.get(inputId);
      if (l) {
        name = l.name;
        unitPrice = round2(num(l.hourly_rate) * factors.labor);
      }
    } else if (inputType === "equipment" && c.tool_id != null) {
      inputId = c.tool_id;
      const tool = toolMap.get(inputId);
      if (tool) {
        name = tool.name;
        unitPrice = round2(num(tool.unit_price) * factors.equipment);
      }
    }
    rows.push({ inputType, subtotal: qty * unitPrice, inputId, unitPrice, name });
  }

  const totals = computeApuTotals(rows, { ...APU_DEFAULT_PERCENTAGES });
  return { totals, cement, city };
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const actId = 526; // HORMIGÓN SIMPLE H21 — alto cemento
    const act = (
      await pool.query(`SELECT id, name, unit_price::float AS stored FROM activities WHERE id=$1`, [actId])
    ).rows[0];
    console.log(`Activity #${act.id}: ${act.name}`);
    console.log(`Stored unit_price (cache): ${act.stored}`);

    const factorRows = (
      await pool.query(
        `SELECT city, materials_factor::float AS m, labor_factor::float AS l, equipment_factor::float AS e
         FROM city_price_factors
         WHERE city IN ('Santa Cruz','La Paz','Cochabamba')
         ORDER BY city`,
      )
    ).rows;
    const byCity = Object.fromEntries(factorRows.map((r: any) => [r.city, r]));

    const cities = ["Santa Cruz", "La Paz", "Cochabamba"] as const;
    const results: Record<string, number> = {};
    for (const city of cities) {
      const f = byCity[city];
      if (!f) throw new Error(`Missing city_price_factors for ${city}`);
      const { totals, cement } = await livePu(pool, actId, city, {
        materials: f.m,
        labor: f.l,
        equipment: f.e,
      });
      results[city] = totals.totalUnitPrice;
      console.log(
        `\n${city}: P.U. en vivo=${totals.totalUnitPrice}  factors m/l/e=${f.m}/${f.l}/${f.e}`,
      );
      if (cement) {
        console.log(`  cemento #2114: base=${cement.base} → unitPrice ciudad=${cement.unitPrice}`);
      }
    }

    const scz = results["Santa Cruz"];
    const lp = results["La Paz"];
    const cbba = results["Cochabamba"];
    if (!(lp > scz)) {
      console.error("FAIL: La Paz debe ser > Santa Cruz (materials 1.15, labor 1.2)");
      process.exit(1);
    }
    if (!(cbba < scz)) {
      console.error("FAIL: Cochabamba debe ser < Santa Cruz (materials 0.95)");
      process.exit(1);
    }
    console.log("\nOK: SCZ vs LP vs CBBA difieren según city_price_factors.");
    console.log(
      JSON.stringify(
        {
          activityId: actId,
          stored: act.stored,
          live: results,
          deltaVsScz: {
            "La Paz": round2(lp - scz),
            Cochabamba: round2(cbba - scz),
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
