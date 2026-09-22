/**
 * Cerámica Norte — type parents (sin marca) + cotizaciones CN + merge dupes internos.
 *
 * Product model (Diego): ceramic materials are TYPE parents by size/spec
 * (e.g. "Ladrillo 6 huecos 15x25" ≠ "Ladrillo 6 huecos 18x25"). Brand offers
 * (Cerámica Norte, later Serpas) live ONLY as quotes under the parent.
 *
 * Confirmed 2026-09-21: CN code 2 (@1.60) and code 28 (@1.15) are BOTH quotes
 * under the same parent "Ladrillo 6 huecos 18x25" (two SKUs / price points).
 *
 * Reuses helpers from merge-duplicate-materials.ts.
 *
 * Dry-run: npx tsx scripts/merge-ceramica-norte-canonicos.ts
 * Apply:   npx tsx scripts/merge-ceramica-norte-canonicos.ts --apply
 *
 * Railway:
 *   railway run --service micaa-sistema -- npx tsx scripts/merge-ceramica-norte-canonicos.ts
 *   railway run --service micaa-sistema -- npx tsx scripts/merge-ceramica-norte-canonicos.ts --apply
 *
 * Never overwrite materials.price; optional rebasedPrice only.
 * Soft-deactivate: [DUPLICADO #id→keeper] + priceOrigin=duplicado.
 * Display order stays: base → real providers → Market Bot (untouched here).
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { db } from "../server/db";
import {
  materials,
  materialCategories,
  materialSupplierPrices,
  supplierCompanies,
  users,
} from "../shared/schema";
import { and, eq, ilike, sql } from "drizzle-orm";
import {
  deactivateMaterial,
  getMaterialById,
  mergeLoserIntoKeeper,
  type Mat,
} from "./merge-duplicate-materials";

const PRICE_ORIGIN = "red_ceramica_norte";
const QUOTE_PROVENANCE = "CN_APP_2026-09-21";
const SUPPLIER_NAME = "Cerámica Norte";
const SUPPLIER_CITY = "Santa Cruz";
const SUPPLIER_USERNAME = "ceramica_norte";
const SUPPLIER_EMAIL = "ceramica_norte@catalog.micaa.local";
const SUPPLIER_WEBSITE = "https://ceramicanorte.com";

type CnProduct = {
  id: number;
  code: string;
  name: string;
  description: string;
  price_bs: number;
  brand: string | null;
  dimensions: string | null;
  weight: string | null;
  is_active: boolean;
  categories: string[];
};

type ParentSpec = {
  name: string;
  /** Preferred category names in order (resolved against DB). */
  categories: string[];
  unit: string;
  /** CN product codes that become quotes under this parent. */
  cnCodes: string[];
  note?: string;
};

/** Explicit internal dupe merges (no CN quotes). */
const MERGE_PAIRS: { loserId: number; keeperId: number; note: string }[] = [
  {
    loserId: 1705,
    keeperId: 1206,
    note: "LADRILLO 6H 24x15x11.5cm → #1206",
  },
  {
    loserId: 1712,
    keeperId: 1205,
    note: "LADRILLO CELOSIA 12x16x16cm → #1205",
  },
  {
    loserId: 1711,
    keeperId: 1204,
    note: "LADRILLO GAMBOTE 18H 25x12x6.5cm → #1204",
  },
];

/** Optional gentle rename of internal keepers after merge. */
const RENAME_KEEPERS: { id: number; targetName: string; note: string }[] = [
  {
    id: 1206,
    targetName: "Ladrillo 6H 24x15x11.5",
    note: "normalize ALL-CAPS keeper name",
  },
  {
    id: 1205,
    targetName: "Ladrillo celosía 12x16x16",
    note: "normalize ALL-CAPS keeper name",
  },
  {
    id: 1204,
    targetName: "Ladrillo gambote 18H 25x12x6.5",
    note: "normalize ALL-CAPS keeper name",
  },
];

/**
 * TYPE parents for all CN MURO/TECHO/PISO lines.
 * 15x25 and 18x25 are SEPARATE parents (Diego 2026-09-21).
 * Code 2 and 28 share parent "Ladrillo 6 huecos 18x25".
 */
const TYPE_PARENTS: ParentSpec[] = [
  // MURO
  {
    name: "Ladrillo 6 huecos 15x25",
    categories: ["LADRILLOS"],
    unit: "pza",
    cnCodes: ["1"],
  },
  {
    name: "Ladrillo 6 huecos 18x25",
    categories: ["LADRILLOS"],
    unit: "pza",
    cnCodes: ["2", "28"],
    note: "two CN price points: #2 @1.60 and #28 @1.15",
  },
  {
    name: "Ladrillo 6 huecos 18x33",
    categories: ["LADRILLOS"],
    unit: "pza",
    cnCodes: ["3"],
  },
  {
    name: "Ladrillo 9 huecos",
    categories: ["LADRILLOS"],
    unit: "pza",
    cnCodes: ["4"],
  },
  {
    name: "Ladrillo 18 huecos",
    categories: ["LADRILLOS"],
    unit: "pza",
    cnCodes: ["14"],
    note: "NOT merge into #1204 (dims differ)",
  },
  {
    name: "Ladrillo 3 huecos",
    categories: ["LADRILLOS"],
    unit: "pza",
    cnCodes: ["15"],
    note: "do not reuse #899",
  },
  {
    name: "Mitad 6 huecos 15x25",
    categories: ["LADRILLOS"],
    unit: "pza",
    cnCodes: ["6"],
  },
  {
    name: "Mitad 6 huecos 18x25",
    categories: ["LADRILLOS"],
    unit: "pza",
    cnCodes: ["7"],
  },
  {
    name: "Mitad 6 huecos 18x33",
    categories: ["LADRILLOS"],
    unit: "pza",
    cnCodes: ["8"],
  },
  {
    name: "Mitad 3 huecos",
    categories: ["LADRILLOS"],
    unit: "pza",
    cnCodes: ["9"],
  },
  {
    name: "Parasol reticulado",
    categories: ["LADRILLOS"],
    unit: "pza",
    cnCodes: ["19"],
    note: "NOT #1205 celosía",
  },
  {
    name: "Parasol 45 grados",
    categories: ["LADRILLOS"],
    unit: "pza",
    cnCodes: ["20"],
  },
  // TECHO / complemento
  {
    name: "Ladrillo complemento (techo)",
    categories: ["LADRILLOS", "TEJAS"],
    unit: "pza",
    cnCodes: ["5", "22"],
    note: "CN 42x10 and 42x12 both @3.00",
  },
  {
    name: "Teja cerámica normal",
    categories: ["TEJAS"],
    unit: "pza",
    cnCodes: ["10"],
  },
  {
    name: "Teja canal con trabe",
    categories: ["TEJAS"],
    unit: "pza",
    cnCodes: ["11"],
  },
  {
    name: "Teja canal con hueco",
    categories: ["TEJAS"],
    unit: "pza",
    cnCodes: ["12"],
  },
  {
    name: "Teja tapa con hueco",
    categories: ["TEJAS"],
    unit: "pza",
    cnCodes: ["13"],
  },
  {
    name: "Teja fibrocemento 1.83x1.10 m",
    categories: ["CUBIERTAS", "TEJAS"],
    unit: "plancha",
    cnCodes: ["29"],
  },
  {
    name: "Teja fibrocemento 2.44x1.10 m",
    categories: ["CUBIERTAS", "TEJAS"],
    unit: "plancha",
    cnCodes: ["30"],
  },
  {
    name: "Cumbrera fibrocemento 1.10 m",
    categories: ["CUBIERTAS", "TEJAS"],
    unit: "pza",
    cnCodes: ["31"],
  },
  {
    name: "Teja fibrocemento top confort 1.83x1.10",
    categories: ["CUBIERTAS", "TEJAS"],
    unit: "plancha",
    cnCodes: ["32"],
  },
  {
    name: "Teja fibrocemento top confort 2.44x1.10",
    categories: ["CUBIERTAS", "TEJAS"],
    unit: "plancha",
    cnCodes: ["33"],
  },
  {
    name: "Cumbrera fibrocemento top confort",
    categories: ["CUBIERTAS", "TEJAS"],
    unit: "pza",
    cnCodes: ["47"],
  },
  {
    name: "Teja fibrotex 1.22x0.50 m",
    categories: ["CUBIERTAS", "TEJAS"],
    unit: "plancha",
    cnCodes: ["34"],
  },
  {
    name: "Teja fibrotex 2.44x0.50 m",
    categories: ["CUBIERTAS", "TEJAS"],
    unit: "plancha",
    cnCodes: ["35"],
  },
  // PISO
  {
    name: "Piso cerámico 20x20",
    categories: ["PISOS", "AZULEJOS Y CERAMICOS"],
    unit: "pza",
    cnCodes: ["16"],
  },
  {
    name: "Adoquín peatonal",
    categories: ["ADOQUINES"],
    unit: "pza",
    cnCodes: ["17"],
    note: "do not map onto #338 ADOQUIN COMANCHE",
  },
  {
    name: "Adoquín alto tráfico",
    categories: ["ADOQUINES"],
    unit: "pza",
    cnCodes: ["18"],
  },
  {
    name: "Adoquín con drenaje",
    categories: ["ADOQUINES"],
    unit: "pza",
    cnCodes: ["25"],
  },
];

function isDeactivated(m: { name: string; priceOrigin?: string | null }): boolean {
  return (
    m.name.startsWith("[DUPLICADO") ||
    (m.priceOrigin || "").toLowerCase() === "duplicado"
  );
}

function optionalPositive(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function loadCnCatalog(): Map<string, CnProduct> {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = join(here, "data", "cn-products-clean.json");
  const raw = JSON.parse(readFileSync(path, "utf8")) as CnProduct[];
  const map = new Map<string, CnProduct>();
  for (const p of raw) {
    if (!p.is_active) continue;
    map.set(String(p.code), p);
  }
  return map;
}

function quoteDescription(cn: CnProduct): string {
  const dims = cn.dimensions ? ` ${cn.dimensions}` : "";
  return `${QUOTE_PROVENANCE} CN#${cn.code}${dims} | ${cn.name}`.slice(0, 500);
}

function quoteMarker(code: string): string {
  return `CN#${code}`;
}

async function resolveCategory(
  preferred: string[],
): Promise<{ id: number; name: string } | null> {
  const cats = await db.select().from(materialCategories);
  const byUpper = new Map(cats.map((c) => [c.name.toUpperCase(), c]));
  for (const name of preferred) {
    const hit = byUpper.get(name.toUpperCase());
    if (hit) return { id: hit.id, name: hit.name };
  }
  // Fuzzy contains
  for (const name of preferred) {
    const key = name.toUpperCase().split(/\s+/)[0];
    for (const c of cats) {
      if (c.name.toUpperCase().includes(key)) {
        return { id: c.id, name: c.name };
      }
    }
  }
  return null;
}

async function findMaterialByExactName(name: string): Promise<Mat | null> {
  const rows = await db
    .select()
    .from(materials)
    .where(eq(materials.name, name))
    .limit(5);
  const active = rows.find((r) => !isDeactivated(r));
  return active || null;
}

async function ensureSupplier(
  apply: boolean,
): Promise<{
  id: number | null;
  companyName: string;
  city: string | null;
  created: boolean;
  userCreated: boolean;
  planned: boolean;
  note?: string;
}> {
  const existing = await db
    .select()
    .from(supplierCompanies)
    .where(ilike(supplierCompanies.companyName, SUPPLIER_NAME))
    .limit(1);

  if (existing[0]) {
    return {
      id: existing[0].id,
      companyName: existing[0].companyName,
      city: existing[0].city,
      created: false,
      userCreated: false,
      planned: false,
      note: "already exists",
    };
  }

  // Also try accent-insensitive / spacing variants
  const loose = await db.execute(sql`
    SELECT id, company_name, city FROM supplier_companies
    WHERE lower(regexp_replace(company_name, '[^a-z0-9]', '', 'g'))
       = lower(regexp_replace(${SUPPLIER_NAME}, '[^a-z0-9]', '', 'g'))
    LIMIT 1
  `);
  const looseRow = (loose as any).rows?.[0] || (loose as any)[0];
  if (looseRow) {
    return {
      id: Number(looseRow.id),
      companyName: String(looseRow.company_name),
      city: looseRow.city ?? null,
      created: false,
      userCreated: false,
      planned: false,
      note: "already exists (loose match)",
    };
  }

  if (!apply) {
    return {
      id: null,
      companyName: SUPPLIER_NAME,
      city: SUPPLIER_CITY,
      created: false,
      userCreated: false,
      planned: true,
      note: "would create supplier + catalog user",
    };
  }

  // Ensure catalog user (1:1 with supplier_companies)
  let userCreated = false;
  let userId: number;
  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.username, SUPPLIER_USERNAME))
    .limit(1);
  if (userRows[0]) {
    userId = userRows[0].id;
  } else {
    const inserted = await db
      .insert(users)
      .values({
        username: SUPPLIER_USERNAME,
        email: SUPPLIER_EMAIL,
        // Unusable placeholder — catalog-only account (no login intended)
        password: "!catalog-disabled-ceramica-norte!",
        firstName: "Cerámica",
        lastName: "Norte",
        role: "user",
        userType: "supplier",
        isActive: true,
        city: SUPPLIER_CITY,
        country: "Bolivia",
      })
      .returning();
    userId = inserted[0].id;
    userCreated = true;
  }

  const created = await db
    .insert(supplierCompanies)
    .values({
      userId,
      companyName: SUPPLIER_NAME,
      businessType: "manufacturer",
      speciality: "ceramicos",
      description:
        "Catálogo Cerámica Norte (Santa Cruz). Cotizaciones ingest CN_APP. Warehouses: Banzer, Santos Dumont, 4to Anillo, Virgen de Luján, Cotoca, Montero.",
      city: SUPPLIER_CITY,
      country: "Bolivia",
      website: SUPPLIER_WEBSITE,
      membershipType: "free",
      isActive: true,
      isVerified: false,
    })
    .returning();

  return {
    id: created[0].id,
    companyName: created[0].companyName,
    city: created[0].city,
    created: true,
    userCreated,
    planned: false,
  };
}

async function findExistingQuote(
  materialId: number,
  supplierId: number,
  code: string,
): Promise<{ id: number; price: string } | null> {
  const marker = quoteMarker(code);
  const rows = await db
    .select()
    .from(materialSupplierPrices)
    .where(
      and(
        eq(materialSupplierPrices.materialId, materialId),
        eq(materialSupplierPrices.supplierId, supplierId),
        eq(materialSupplierPrices.isActive, true),
      ),
    );
  const hit = rows.find((r) => (r.description || "").includes(marker));
  if (!hit) return null;
  return { id: hit.id, price: String(hit.price) };
}

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(apply ? "MODE: --apply" : "MODE: dry-run");

  const cnByCode = loadCnCatalog();
  console.log(`CN catalog loaded: ${cnByCode.size} active SKUs`);

  const report: {
    mode: string;
    productModel: string;
    supplier: any;
    parents: any[];
    quotes: any[];
    merges: any[];
    renames: any[];
    rebases: any[];
    skipped: any[];
    blockers: any[];
    summary: Record<string, number | string>;
  } = {
    mode: apply ? "apply" : "dry-run",
    productModel:
      "Ceramic materials are TYPE parents (by size/spec, no brand); Cerámica Norte lives only as quotes. Display: base → real providers → Market Bot.",
    supplier: null,
    parents: [],
    quotes: [],
    merges: [],
    renames: [],
    rebases: [],
    skipped: [],
    blockers: [],
    summary: {},
  };

  // Validate all mapped codes exist in catalog
  const allCodes = new Set(TYPE_PARENTS.flatMap((p) => p.cnCodes));
  for (const code of allCodes) {
    if (!cnByCode.has(code)) {
      report.blockers.push({
        code,
        reason: "CN code mapped in TYPE_PARENTS but missing from cn-products-clean.json",
      });
    }
  }
  for (const code of cnByCode.keys()) {
    if (!allCodes.has(code)) {
      report.blockers.push({
        code,
        reason: "CN SKU in catalog not mapped to any TYPE parent",
        name: cnByCode.get(code)?.name,
      });
    }
  }

  // --- 1) Supplier ---
  const supplierInfo = await ensureSupplier(apply);
  report.supplier = supplierInfo;
  if (!supplierInfo.id && !supplierInfo.planned) {
    report.blockers.push({ reason: "could not resolve Cerámica Norte supplier" });
  }

  // --- 2) Create type parents + quotes ---
  let parentsCreated = 0;
  let parentsExisting = 0;
  let quotesCreated = 0;
  let quotesSkipped = 0;

  for (const spec of TYPE_PARENTS) {
    const cat = await resolveCategory(spec.categories);
    if (!cat) {
      report.blockers.push({
        parent: spec.name,
        reason: `no category matched: ${spec.categories.join(", ")}`,
      });
      report.skipped.push({ parent: spec.name, reason: "category missing" });
      continue;
    }

    // Interim catalog price = first CN quote (lowest code order as listed)
    const firstCn = cnByCode.get(spec.cnCodes[0]);
    const interimPrice = firstCn ? round2(firstCn.price_bs) : null;
    if (interimPrice == null) {
      report.blockers.push({
        parent: spec.name,
        reason: `no CN price for codes ${spec.cnCodes.join(",")}`,
      });
      continue;
    }

    let mat = await findMaterialByExactName(spec.name);
    let parentAction: string;

    if (mat) {
      parentsExisting++;
      parentAction = "exists";
      report.parents.push({
        id: mat.id,
        name: mat.name,
        unit: mat.unit,
        categoryId: mat.categoryId,
        category: cat.name,
        action: "exists",
        note: spec.note || null,
        willTouchPrice: false,
      });
    } else if (!apply) {
      parentsCreated++;
      parentAction = "would-create";
      report.parents.push({
        id: null,
        name: spec.name,
        unit: spec.unit,
        categoryId: cat.id,
        category: cat.name,
        interimPrice,
        action: "would-create",
        note: spec.note || null,
        willTouchPrice: false,
      });
    } else {
      const inserted = await db
        .insert(materials)
        .values({
          categoryId: cat.id,
          name: spec.name,
          unit: spec.unit,
          price: interimPrice.toFixed(2),
          description: `Padre tipo (sin marca). Cotizaciones Cerámica Norte. ${QUOTE_PROVENANCE}${
            spec.note ? ` — ${spec.note}` : ""
          }`.slice(0, 500),
          priceOrigin: "nacional",
          rebasedPrice: interimPrice.toFixed(2),
          rebasedAt: new Date(),
          lastUpdated: new Date(),
          weightKg: firstCn?.weight
            ? optionalPositive(firstCn.weight)?.toFixed(4) ?? null
            : null,
        })
        .returning();
      mat = inserted[0];
      parentsCreated++;
      parentAction = "created";
      report.parents.push({
        id: mat.id,
        name: mat.name,
        unit: mat.unit,
        categoryId: mat.categoryId,
        category: cat.name,
        interimPrice,
        action: "created",
        note: spec.note || null,
        willTouchPrice: false,
      });
    }

    // Quotes under parent
    for (const code of spec.cnCodes) {
      const cn = cnByCode.get(code);
      if (!cn) {
        report.skipped.push({
          parent: spec.name,
          code,
          reason: "CN product missing",
        });
        continue;
      }
      const price = round2(cn.price_bs);
      const desc = quoteDescription(cn);
      const weightKg = optionalPositive(cn.weight);

      if (!mat || !supplierInfo.id) {
        // dry-run without real ids
        quotesCreated++;
        report.quotes.push({
          parentName: spec.name,
          parentId: mat?.id ?? null,
          parentAction,
          cnCode: code,
          cnName: cn.name,
          price,
          unit: spec.unit,
          city: SUPPLIER_CITY,
          description: desc,
          weightKg,
          action: apply ? "blocked-no-parent-or-supplier" : "would-create",
        });
        continue;
      }

      const existing = await findExistingQuote(mat.id, supplierInfo.id, code);
      if (existing) {
        quotesSkipped++;
        report.quotes.push({
          parentName: spec.name,
          parentId: mat.id,
          cnCode: code,
          cnName: cn.name,
          price,
          existingPrice: existing.price,
          mspId: existing.id,
          action: "exists-skip",
        });
        continue;
      }

      if (!apply) {
        quotesCreated++;
        report.quotes.push({
          parentName: spec.name,
          parentId: mat.id,
          cnCode: code,
          cnName: cn.name,
          price,
          unit: spec.unit,
          city: SUPPLIER_CITY,
          description: desc,
          action: "would-create",
        });
        continue;
      }

      const inserted = await db
        .insert(materialSupplierPrices)
        .values({
          materialId: mat.id,
          supplierId: supplierInfo.id,
          price: price.toFixed(4),
          currency: "BOB",
          minimumQuantity: "1.00",
          leadTimeDays: 0,
          description: desc,
          isActive: true,
          lastUpdated: new Date(),
        })
        .returning();
      quotesCreated++;
      report.quotes.push({
        parentName: spec.name,
        parentId: mat.id,
        cnCode: code,
        cnName: cn.name,
        price,
        mspId: inserted[0].id,
        action: "created",
        weightKg,
      });
    }

    // Optional rebasedPrice from CN quotes (never touch materials.price)
    {
      const quotePrices = spec.cnCodes
        .map((c) => cnByCode.get(c)?.price_bs)
        .map(optionalPositive)
        .filter((n): n is number => n != null);
      const newRebased = avg(quotePrices);
      if (newRebased != null) {
        const rounded = round2(newRebased);
        const oldRebased = mat ? optionalPositive(mat.rebasedPrice) : null;
        const planned = {
          id: mat?.id ?? null,
          name: mat?.name ?? spec.name,
          oldRebased,
          catalogPrice: mat ? optionalPositive(mat.price) : interimPrice,
          newRebased: rounded,
          method: quotePrices.length === 1 ? "single_cn_quote" : "avg_cn_quotes",
          priceOrigin: PRICE_ORIGIN,
          willTouchMaterialsPrice: false,
        };
        // New parents already get rebasedPrice on INSERT; still report.
        if (parentAction === "created") {
          report.rebases.push({ ...planned, action: "set-on-insert" });
        } else if (parentAction === "would-create") {
          report.rebases.push({ ...planned, planned: "set-on-insert" });
        } else if (
          mat &&
          oldRebased != null &&
          Math.abs(oldRebased - rounded) < 0.005 &&
          (mat.priceOrigin || "") === PRICE_ORIGIN
        ) {
          report.rebases.push({ ...planned, action: "already-set" });
        } else if (!apply || !mat) {
          report.rebases.push({ ...planned, planned: "set-rebasedPrice" });
        } else {
          await db
            .update(materials)
            .set({
              rebasedPrice: rounded.toFixed(2),
              rebasedAt: new Date(),
              priceOrigin: PRICE_ORIGIN,
              // intentionally NOT touching materials.price
            })
            .where(eq(materials.id, mat.id));
          report.rebases.push({ ...planned, action: "written" });
        }
      }
    }
  }

  // --- 3) Internal merges ---
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
    if (isDeactivated(loser)) {
      report.skipped.push({ ...pair, reason: "loser already deactivated" });
      continue;
    }

    const planned = {
      loserId: loser.id,
      loserName: loser.name,
      keeperId: keeper.id,
      keeperName: keeper.name,
      note: pair.note,
      willTouchPrice: false,
    };

    if (!apply) {
      report.merges.push({
        ...planned,
        planned: "merge-fks-deactivate-or-delete-source",
      });
      continue;
    }

    const result = await mergeLoserIntoKeeper(loser, keeper, {
      preferCorrugadoName: false,
    });
    report.merges.push({ ...planned, ...result });
  }

  // --- 4) Rename internal keepers (gentle) ---
  for (const item of RENAME_KEEPERS) {
    const mat = await getMaterialById(item.id);
    if (!mat) {
      report.skipped.push({ id: item.id, reason: "rename keeper not found" });
      continue;
    }
    if (isDeactivated(mat)) {
      report.skipped.push({ id: item.id, reason: "rename keeper deactivated" });
      continue;
    }
    const changed = mat.name.trim() !== item.targetName;
    if (!changed) {
      report.renames.push({
        id: mat.id,
        from: mat.name,
        to: item.targetName,
        changed: false,
        applied: false,
        note: item.note,
      });
      continue;
    }
    if (!apply) {
      report.renames.push({
        id: mat.id,
        from: mat.name,
        to: item.targetName,
        changed: true,
        applied: false,
        note: item.note,
      });
      continue;
    }
    await db
      .update(materials)
      .set({ name: item.targetName, lastUpdated: new Date() })
      .where(eq(materials.id, mat.id));
    report.renames.push({
      id: mat.id,
      from: mat.name,
      to: item.targetName,
      changed: true,
      applied: true,
      note: item.note,
    });
  }

  // Sanity: 15x25 vs 18x25 separation + dual quotes under 18x25
  const p15 = TYPE_PARENTS.find((p) => p.name === "Ladrillo 6 huecos 15x25");
  const p18 = TYPE_PARENTS.find((p) => p.name === "Ladrillo 6 huecos 18x25");
  const sanity = {
    separateParents15vs18: p15 != null && p18 != null && p15.name !== p18.name,
    parent18codes: p18?.cnCodes || [],
    expectsBoth160and115:
      !!p18 &&
      p18.cnCodes.includes("2") &&
      p18.cnCodes.includes("28") &&
      cnByCode.get("2")?.price_bs === 1.6 &&
      cnByCode.get("28")?.price_bs === 1.15,
  };

  report.summary = {
    parentsPlannedOrCreated: parentsCreated,
    parentsExisting,
    parentsTotal: TYPE_PARENTS.length,
    quotesPlannedOrCreated: quotesCreated,
    quotesSkippedExisting: quotesSkipped,
    merges: report.merges.length,
    renames: report.renames.filter((r) => r.changed).length,
    rebases: report.rebases.length,
    blockers: report.blockers.length,
    skipped: report.skipped.length,
    sanitySeparate15vs18: sanity.separateParents15vs18 ? "yes" : "NO",
    sanity18has160and115: sanity.expectsBoth160and115 ? "yes" : "NO",
  };

  console.log(JSON.stringify(report, null, 2));
  console.log(
    `\nSummary: parents_new=${parentsCreated} parents_existing=${parentsExisting}/${TYPE_PARENTS.length} quotes_new=${quotesCreated} quotes_skip=${quotesSkipped} merges=${report.merges.length} renames=${report.renames.filter((r) => r.changed).length} blockers=${report.blockers.length}`,
  );
  console.log(
    `Sanity: 15x25≠18x25 → ${sanity.separateParents15vs18}; 18x25 has CN#2@1.60 + CN#28@1.15 → ${sanity.expectsBoth160and115}`,
  );
  if (!apply) {
    console.log("\nDry-run only. Re-run with --apply to write (after Diego approves PR).");
  }
  process.exit(report.blockers.length > 0 ? 2 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
