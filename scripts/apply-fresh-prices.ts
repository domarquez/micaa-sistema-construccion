/**
 * Aplica cotizaciones públicas del JSON curado a user_material_prices (isPublic=true)
 * atribuidas al usuario sistema `micaa_market` (bot de datos).
 *
 * Dry-run: npx tsx scripts/apply-fresh-prices.ts
 * Apply:   npx tsx scripts/apply-fresh-prices.ts --apply
 * Opcional: --update-base  → también materials.rebasedPrice + priceOrigin=mercado
 *
 * No pisa materiales no matcheados. No modifica search/city selector.
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { db } from "../server/db";
import { materials, users, userMaterialPrices } from "../shared/schema";
import { and, eq } from "drizzle-orm";

type FreshItem = {
  name: string;
  unit: string;
  city: string;
  price: number;
  source?: string;
  collectedAt?: string;
  matchHint?: string;
};

type FreshFile = {
  items: FreshItem[];
  collectedAt?: string;
};

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\\'/g, "'")
    .replace(/['"`´′″‘’“”]+/g, "")
    .replace(/plg\.?/g, "")
    .replace(/pulg\.?/g, "")
    .replace(/[^a-z0-9\s\/x#]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function softMatch(refName: string, dbName: string): boolean {
  const a = norm(refName);
  const b = norm(dbName);
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const tokens = a.split(" ").filter((t) => t.length >= 2);
  if (tokens.length === 0) return false;
  const hit = tokens.filter((t) => b.includes(t)).length;
  return hit >= Math.ceil(tokens.length * 0.7);
}

function unitSoftEqual(a: string, b: string): boolean {
  const map: Record<string, string> = {
    kg: "kg",
    kgr: "kg",
    m3: "m3",
    "m³": "m3",
    m2: "m2",
    barra: "barra",
    bar: "barra",
    brra: "barra",
    bolsa: "bolsa",
    blsa: "bolsa",
    pza: "pza",
    pieza: "pza",
    m: "m",
    ml: "m",
    lt: "lt",
    l: "lt",
    gal: "gal",
    p2: "p2",
  };
  const na = map[a.normalize("NFKC").toLowerCase().replace(/\.+$/, "").trim()] ||
    a.normalize("NFKC").toLowerCase().replace(/\.+$/, "").trim();
  const nb = map[b.normalize("NFKC").toLowerCase().replace(/\.+$/, "").trim()] ||
    b.normalize("NFKC").toLowerCase().replace(/\.+$/, "").trim();
  return na === nb || na.includes(nb) || nb.includes(na);
}

const MARKET_USER = {
  username: "micaa_market",
  email: "micaa_market@micaa.local",
  firstName: "MICAA",
  lastName: "Market Bot",
  role: "user",
  userType: "supplier" as const,
};

async function ensureMarketUser(): Promise<number> {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.username, MARKET_USER.username))
    .limit(1);
  if (existing[0]) return existing[0].id;

  // Cuenta bot de datos: hash aleatorio (no login humano previsto).
  const randomPass = `bot-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const bcrypt = await import("bcryptjs");
  const hash = await bcrypt.default.hash(randomPass, 10);
  const inserted = await db
    .insert(users)
    .values({
      username: MARKET_USER.username,
      email: MARKET_USER.email,
      password: hash,
      firstName: MARKET_USER.firstName,
      lastName: MARKET_USER.lastName,
      role: MARKET_USER.role,
      userType: "supplier",
      isActive: true,
      city: "Santa Cruz",
      country: "Bolivia",
    })
    .returning({ id: users.id });
  console.log(
    `Created data-bot user #${inserted[0].id} username=${MARKET_USER.username} (random bcrypt hash; not for interactive login)`,
  );
  return inserted[0].id;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const updateBase = process.argv.includes("--update-base");
  console.log(
    apply ? "MODE: --apply" : "MODE: dry-run",
    updateBase ? "+ --update-base" : "",
  );

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const jsonPath = join(__dirname, "data", "fresh-prices-2026-09.json");
  const file = JSON.parse(readFileSync(jsonPath, "utf8")) as FreshFile;
  const items = file.items || [];
  console.log(`Fresh items: ${items.length} (collectedAt=${file.collectedAt || "?"})`);

  const dbMats = await db.select().from(materials);
  // Prefer keepers not marked duplicado
  const candidates = dbMats.filter(
    (m) =>
      !m.name.startsWith("[DUPLICADO") &&
      (m.priceOrigin || "").toLowerCase() !== "duplicado",
  );

  const report = {
    mode: apply ? "apply" : "dry-run",
    matched: [] as any[],
    unmatched: [] as any[],
    upserted: 0,
    baseUpdated: 0,
    marketUserId: null as number | null,
  };

  let marketUserId: number | null = null;
  if (apply) {
    marketUserId = await ensureMarketUser();
    report.marketUserId = marketUserId;
  }

  for (const item of items) {
    // Prefer same unit when several soft matches
    const soft = candidates.filter((m) => softMatch(item.name, m.name));
    let match =
      soft.find((m) => unitSoftEqual(item.unit, m.unit)) || soft[0] || null;

    // matchHint boost: prefer names containing hint tokens
    if (soft.length > 1 && item.matchHint) {
      const hintTok = norm(item.matchHint).split(" ").filter(Boolean);
      const ranked = [...soft].sort((a, b) => {
        const sa = hintTok.filter((t) => norm(a.name).includes(t)).length;
        const sb = hintTok.filter((t) => norm(b.name).includes(t)).length;
        if (sb !== sa) return sb - sa;
        const ua = unitSoftEqual(item.unit, a.unit) ? 1 : 0;
        const ub = unitSoftEqual(item.unit, b.unit) ? 1 : 0;
        return ub - ua;
      });
      match = ranked[0];
    }

    if (!match) {
      report.unmatched.push({
        name: item.name,
        unit: item.unit,
        city: item.city,
        price: item.price,
      });
      continue;
    }

    const source = item.source || "insucons-public";
    const dateLabel = (item.collectedAt || file.collectedAt || "").slice(0, 10);
    const reason = `Cotización pública ${source} ${dateLabel}`.trim();
    const priceStr = Number(item.price).toFixed(2);

    report.matched.push({
      json: { name: item.name, unit: item.unit, city: item.city, price: item.price },
      materialId: match.id,
      materialName: match.name,
      materialUnit: match.unit,
    });

    if (!apply || marketUserId == null) continue;

    // Upsert: same user + material + city + public → update price; else insert
    const existing = await db
      .select()
      .from(userMaterialPrices)
      .where(
        and(
          eq(userMaterialPrices.userId, marketUserId),
          eq(userMaterialPrices.materialId, match.id),
          eq(userMaterialPrices.city, item.city),
          eq(userMaterialPrices.isPublic, true),
        ),
      )
      .limit(1);

    if (existing[0]) {
      await db
        .update(userMaterialPrices)
        .set({
          price: priceStr,
          unit: item.unit,
          customMaterialName: item.name,
          originalMaterialName: match.name,
          reason,
          updatedAt: new Date(),
        })
        .where(eq(userMaterialPrices.id, existing[0].id));
    } else {
      await db.insert(userMaterialPrices).values({
        userId: marketUserId,
        materialId: match.id,
        originalMaterialName: match.name,
        customMaterialName: item.name,
        price: priceStr,
        unit: item.unit,
        reason,
        city: item.city,
        isPublic: true,
      });
    }
    report.upserted++;

    if (updateBase) {
      await db
        .update(materials)
        .set({
          rebasedPrice: priceStr,
          rebasedAt: new Date(),
          priceOrigin: "mercado",
          lastUpdated: new Date(),
        })
        .where(eq(materials.id, match.id));
      report.baseUpdated++;
    }
  }

  console.log(JSON.stringify(report, null, 2));
  console.log(
    `\nSummary: matched=${report.matched.length} unmatched=${report.unmatched.length} upserted=${report.upserted}`,
  );
  if (!apply) {
    console.log("Dry-run complete. Re-run with --apply to write public quotes.");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
