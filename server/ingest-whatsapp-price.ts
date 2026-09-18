/**
 * POST /api/ingest/whatsapp-price
 * Ingest ferretería prices from WhatsApp into user_material_prices (system user micaa_whatsapp).
 * Auth: header X-Micaa-Ingest-Key === process.env.MICAA_INGEST_API_KEY (no JWT).
 */
import { Request, Response } from "express";
import { createHash, randomBytes } from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  materials,
  materialCategories,
  userMaterialPrices,
  priceIngestKeys,
} from "../shared/schema";

const UNIT_MAP: Record<string, string> = {
  m2: "m2",
  "m²": "m2",
  mt2: "m2",
  mts2: "m2",
  metro2: "m2",
  "metro cuadrado": "m2",
  m3: "m3",
  "m³": "m3",
  mt3: "m3",
  "metro cubico": "m3",
  "metro cúbico": "m3",
  kg: "kg",
  kilos: "kg",
  kilogramo: "kg",
  kilogramos: "kg",
  pza: "pza",
  pieza: "pza",
  piezas: "pza",
  und: "pza",
  u: "pza",
  unidad: "pza",
  unidades: "pza",
  bolsa: "bolsa",
  bolsas: "bolsa",
  bol: "bolsa",
  gal: "gal",
  galon: "gal",
  galón: "gal",
  galones: "gal",
  lt: "lt",
  l: "lt",
  litro: "lt",
  litros: "lt",
  m: "m",
  ml: "m",
  metro: "m",
  metros: "m",
  rollo: "rollo",
  plancha: "plancha",
  balde: "balde",
  par: "par",
  juego: "juego",
  globo: "globo",
};

const ALLOWED_CITIES = [
  "Santa Cruz",
  "Cochabamba",
  "La Paz",
  "Sucre",
  "Tarija",
  "Beni",
  "Pando",
  "Oruro",
  "Potosí",
] as const;

const CITY_ALIASES: Record<string, string> = {
  trinidad: "Beni",
  cobija: "Pando",
  "santa cruz de la sierra": "Santa Cruz",
  potosi: "Potosí",
};

const CONFIDENCE_VALUES = ["visto", "whatsapp", "factura", "estimado"] as const;

type Confidence = (typeof CONFIDENCE_VALUES)[number];

export type IngestSuccessBody = {
  ok: true;
  action: "inserted" | "updated" | "idempotent_replay";
  quoteId: number;
  materialId: number;
  materialName: string;
  matchedBy: "materialId" | "name_unit" | "stub_created";
  city: string;
  price: number;
  unit: string;
  isPublic: boolean;
  idempotencyKey: string;
};

export type IngestErrorBody = {
  ok: false;
  error: string;
  code?: string;
  candidates?: { id: number; name: string; unit: string }[];
  details?: unknown;
};

type ParsedItem = {
  idempotencyKey: string;
  materialId: number | null;
  name: string | null;
  unit: string;
  price: number;
  currency: string;
  city: string;
  isPublic: boolean;
  collectedAt: string;
  source: string;
  reason?: string;
  supplierName?: string;
  phone?: string;
  confidence: Confidence;
  specialty?: string;
  categoryHint?: string;
  notes?: string;
  createStubIfMissing: boolean;
  whatsappMessageId?: string;
  chatJid?: string;
  instanceName?: string;
  rawExcerpt?: string;
};

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

function unifyQuotes(s: string): string {
  return s.replace(/[“”„‟«»]/g, '"').replace(/[‘’‚‛]/g, "'");
}

export function normalizeMatchText(s: string): string {
  return stripAccents(unifyQuotes(s))
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeUnit(unit: string): string {
  const key = normalizeMatchText(unit);
  return UNIT_MAP[key] || unit.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function resolveCity(raw: string): string | null {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;
  const key = normalizeMatchText(trimmed);
  if (CITY_ALIASES[key]) return CITY_ALIASES[key];
  const hit = ALLOWED_CITIES.find((c) => normalizeMatchText(c) === key);
  return hit || null;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max);
}

function payloadHash(item: ParsedItem): string {
  const stable = {
    idempotencyKey: item.idempotencyKey,
    materialId: item.materialId,
    name: item.name,
    unit: item.unit,
    price: item.price,
    currency: item.currency,
    city: item.city,
    isPublic: item.isPublic,
    collectedAt: item.collectedAt,
    source: item.source,
    confidence: item.confidence,
    createStubIfMissing: item.createStubIfMissing,
    supplierName: item.supplierName ?? null,
    phone: item.phone ?? null,
  };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

function buildReason(item: ParsedItem): string {
  const parts: string[] = ["WA"];
  if (item.supplierName) parts.push(item.supplierName);
  parts.push(item.confidence);
  parts.push(item.collectedAt);
  if (item.reason) parts.push(item.reason);
  if (item.notes) parts.push(`notes=${truncate(item.notes, 120)}`);
  if (item.specialty) parts.push(`spec=${item.specialty}`);
  if (item.whatsappMessageId) parts.push(`msgId=${item.whatsappMessageId}`);
  if (item.chatJid) parts.push(`jid=${item.chatJid}`);
  if (item.instanceName) parts.push(`inst=${item.instanceName}`);
  if (item.rawExcerpt) parts.push(`excerpt=${truncate(item.rawExcerpt, 200)}`);
  parts.push(`idem=${item.idempotencyKey}`);
  return truncate(parts.join(" | "), 2000);
}

function parseItem(raw: unknown): { ok: true; item: ParsedItem } | { ok: false; error: IngestErrorBody } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      error: { ok: false, error: "Item must be an object", code: "invalid_item" },
    };
  }
  const b = raw as Record<string, unknown>;

  const schema = typeof b.$schema === "string" ? b.$schema : "";
  if (
    schema &&
    !schema.includes("whatsapp-price") &&
    schema !== "micaa.ingest.whatsapp-price.v1"
  ) {
    // Liberal: only reject clearly wrong schemas when present
    if (schema.includes("batch")) {
      return {
        ok: false,
        error: { ok: false, error: "Nested batch not allowed", code: "invalid_schema" },
      };
    }
  }

  const idempotencyKey = String(b.idempotencyKey ?? "").trim();
  if (!idempotencyKey || idempotencyKey.length > 128) {
    return {
      ok: false,
      error: {
        ok: false,
        error: "idempotencyKey required (max 128)",
        code: "validation_error",
      },
    };
  }

  let materialId: number | null = null;
  if (b.materialId != null && b.materialId !== "") {
    const n = typeof b.materialId === "number" ? b.materialId : parseInt(String(b.materialId), 10);
    if (!Number.isFinite(n) || n <= 0) {
      return {
        ok: false,
        error: { ok: false, error: "materialId invalid", code: "validation_error" },
      };
    }
    materialId = n;
  }

  const name =
    typeof b.name === "string" && b.name.trim() ? b.name.trim() : null;
  if (materialId == null && !name) {
    return {
      ok: false,
      error: {
        ok: false,
        error: "name required when materialId is null",
        code: "validation_error",
      },
    };
  }

  const unitRaw = typeof b.unit === "string" ? b.unit.trim() : "";
  if (!unitRaw) {
    return {
      ok: false,
      error: { ok: false, error: "unit required", code: "validation_error" },
    };
  }

  const price =
    typeof b.price === "number" ? b.price : parseFloat(String(b.price ?? ""));
  if (!Number.isFinite(price) || price <= 0) {
    return {
      ok: false,
      error: { ok: false, error: "price must be a number > 0", code: "validation_error" },
    };
  }

  const currency = String(b.currency ?? "BOB").trim().toUpperCase() || "BOB";
  if (currency !== "BOB") {
    return {
      ok: false,
      error: { ok: false, error: "Only BOB currency supported", code: "validation_error" },
    };
  }

  const city = resolveCity(String(b.city ?? ""));
  if (!city) {
    return {
      ok: false,
      error: {
        ok: false,
        error: `city required; allowed: ${ALLOWED_CITIES.join(", ")}`,
        code: "validation_error",
      },
    };
  }

  const collectedAt = String(b.collectedAt ?? "").trim();
  if (!collectedAt || Number.isNaN(Date.parse(collectedAt))) {
    return {
      ok: false,
      error: {
        ok: false,
        error: "collectedAt required ISO string",
        code: "validation_error",
      },
    };
  }

  let confidence: Confidence = "whatsapp";
  if (b.confidence != null && String(b.confidence).trim()) {
    const c = String(b.confidence).trim().toLowerCase();
    if (!(CONFIDENCE_VALUES as readonly string[]).includes(c)) {
      return {
        ok: false,
        error: {
          ok: false,
          error: `confidence must be one of: ${CONFIDENCE_VALUES.join("|")}`,
          code: "validation_error",
        },
      };
    }
    confidence = c as Confidence;
  }

  const isPublic =
    b.isPublic === undefined || b.isPublic === null
      ? true
      : b.isPublic === true || b.isPublic === "true" || b.isPublic === 1;

  const createStubIfMissing =
    b.createStubIfMissing === true ||
    b.createStubIfMissing === "true" ||
    b.createStubIfMissing === 1;

  const rawExcerpt =
    typeof b.rawExcerpt === "string"
      ? truncate(b.rawExcerpt, 500)
      : undefined;

  return {
    ok: true,
    item: {
      idempotencyKey,
      materialId,
      name,
      unit: normalizeUnit(unitRaw),
      price,
      currency,
      city,
      isPublic,
      collectedAt,
      source: typeof b.source === "string" && b.source.trim() ? b.source.trim() : "whatsapp",
      reason: typeof b.reason === "string" ? b.reason : undefined,
      supplierName: typeof b.supplierName === "string" ? b.supplierName : undefined,
      phone: typeof b.phone === "string" ? b.phone : undefined,
      confidence,
      specialty: typeof b.specialty === "string" ? b.specialty : undefined,
      categoryHint: typeof b.categoryHint === "string" ? b.categoryHint : undefined,
      notes: typeof b.notes === "string" ? b.notes : undefined,
      createStubIfMissing,
      whatsappMessageId:
        typeof b.whatsappMessageId === "string" ? b.whatsappMessageId : undefined,
      chatJid: typeof b.chatJid === "string" ? b.chatJid : undefined,
      instanceName: typeof b.instanceName === "string" ? b.instanceName : undefined,
      rawExcerpt,
    },
  };
}

async function ensureSystemUser(): Promise<number> {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.username, "micaa_whatsapp"))
    .limit(1);
  if (existing.length > 0) return existing[0].id;

  const bcrypt = await import("bcryptjs");
  const randomPw = randomBytes(24).toString("hex");
  const hashed = await bcrypt.default.hash(randomPw, 10);

  try {
    const inserted = await db
      .insert(users)
      .values({
        username: "micaa_whatsapp",
        email: "micaa_whatsapp@system.micaa.local",
        password: hashed,
        firstName: "MICAA",
        lastName: "WhatsApp",
        role: "user",
        userType: "supplier",
        isActive: true,
        city: "Santa Cruz",
        country: "Bolivia",
      })
      .returning();
    return inserted[0].id;
  } catch (err) {
    // Race: another request created it
    const again = await db
      .select()
      .from(users)
      .where(eq(users.username, "micaa_whatsapp"))
      .limit(1);
    if (again.length > 0) return again[0].id;
    throw err;
  }
}

async function findCategoryId(hint?: string): Promise<number | null> {
  if (!hint || !hint.trim()) return null;
  const cats = await db.select().from(materialCategories);
  const want = normalizeMatchText(hint);
  const exact = cats.find((c) => normalizeMatchText(c.name) === want);
  if (exact) return exact.id;
  const fuzzy = cats.find((c) => {
    const n = normalizeMatchText(c.name);
    return n.includes(want) || want.includes(n);
  });
  return fuzzy ? fuzzy.id : null;
}

async function softMatchMaterials(
  name: string,
  unit: string,
): Promise<{ id: number; name: string; unit: string }[]> {
  const nKey = normalizeMatchText(name);
  const uKey = normalizeMatchText(normalizeUnit(unit));
  // Broad fetch then filter in JS (accent-safe). Catalog size is modest.
  const rows = await db
    .select({ id: materials.id, name: materials.name, unit: materials.unit })
    .from(materials);
  return rows.filter(
    (r) =>
      normalizeMatchText(r.name) === nKey &&
      normalizeMatchText(normalizeUnit(r.unit)) === uKey,
  );
}

async function resolveMaterial(
  item: ParsedItem,
): Promise<
  | {
      ok: true;
      materialId: number;
      materialName: string;
      unit: string;
      matchedBy: IngestSuccessBody["matchedBy"];
    }
  | { ok: false; status: number; body: IngestErrorBody }
> {
  if (item.materialId != null) {
    const rows = await db
      .select()
      .from(materials)
      .where(eq(materials.id, item.materialId))
      .limit(1);
    if (rows.length === 0) {
      return {
        ok: false,
        status: 404,
        body: {
          ok: false,
          error: "Material not found",
          code: "material_not_found",
        },
      };
    }
    return {
      ok: true,
      materialId: rows[0].id,
      materialName: rows[0].name,
      unit: item.unit || rows[0].unit,
      matchedBy: "materialId",
    };
  }

  const matches = await softMatchMaterials(item.name!, item.unit);
  if (matches.length === 1) {
    return {
      ok: true,
      materialId: matches[0].id,
      materialName: matches[0].name,
      unit: item.unit || matches[0].unit,
      matchedBy: "name_unit",
    };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      status: 409,
      body: {
        ok: false,
        error: "Ambiguous material match",
        code: "ambiguous_match",
        candidates: matches.slice(0, 5).map((m) => ({
          id: m.id,
          name: m.name,
          unit: m.unit,
        })),
      },
    };
  }

  // 0 matches
  if (!item.createStubIfMissing) {
    return {
      ok: false,
      status: 404,
      body: {
        ok: false,
        error: "No material match; set createStubIfMissing to create a stub",
        code: "material_not_found",
      },
    };
  }

  const categoryId = await findCategoryId(item.categoryHint);
  if (categoryId == null) {
    return {
      ok: false,
      status: 422,
      body: {
        ok: false,
        error:
          "Cannot create stub without a resolvable categoryHint matching material_categories",
        code: "stub_category_required",
      },
    };
  }

  // NEVER overwrite materials.price — this is insert-only stub
  const stub = await db
    .insert(materials)
    .values({
      categoryId,
      name: item.name!,
      unit: item.unit,
      price: item.price.toFixed(2),
      description: "stub",
      priceOrigin: "pendiente",
      lastUpdated: new Date(),
    })
    .returning();

  return {
    ok: true,
    materialId: stub[0].id,
    materialName: stub[0].name,
    unit: stub[0].unit,
    matchedBy: "stub_created",
  };
}

async function replayOrConflict(
  item: ParsedItem,
  hash: string,
): Promise<IngestSuccessBody | IngestErrorBody | null> {
  const existing = await db
    .select()
    .from(priceIngestKeys)
    .where(eq(priceIngestKeys.idempotencyKey, item.idempotencyKey))
    .limit(1);
  if (existing.length === 0) return null;

  if (existing[0].payloadHash && existing[0].payloadHash !== hash) {
    return {
      ok: false,
      error: "Idempotency key reused with different payload",
      code: "idempotency_conflict",
    };
  }

  const quoteId = existing[0].quoteId;
  if (quoteId == null) {
    return {
      ok: false,
      error: "Idempotency record missing quote_id",
      code: "idempotency_corrupt",
    };
  }

  const quotes = await db
    .select()
    .from(userMaterialPrices)
    .where(eq(userMaterialPrices.id, quoteId))
    .limit(1);
  if (quotes.length === 0) {
    return {
      ok: false,
      error: "Idempotent quote no longer exists",
      code: "idempotency_orphan",
    };
  }
  const q = quotes[0];
  return {
    ok: true,
    action: "idempotent_replay",
    quoteId: q.id,
    materialId: q.materialId!,
    materialName: q.originalMaterialName,
    matchedBy: "materialId",
    city: q.city || item.city,
    price: parseFloat(String(q.price)),
    unit: q.unit,
    isPublic: !!q.isPublic,
    idempotencyKey: item.idempotencyKey,
  };
}

async function persistQuote(
  systemUserId: number,
  item: ParsedItem,
  resolved: {
    materialId: number;
    materialName: string;
    unit: string;
    matchedBy: IngestSuccessBody["matchedBy"];
  },
): Promise<IngestSuccessBody> {
  const reason = buildReason(item);
  const hash = payloadHash(item);

  const existing = await db
    .select()
    .from(userMaterialPrices)
    .where(
      and(
        eq(userMaterialPrices.userId, systemUserId),
        eq(userMaterialPrices.materialId, resolved.materialId),
        eq(userMaterialPrices.city, item.city),
      ),
    )
    .limit(1);

  let quoteId: number;
  let action: "inserted" | "updated";

  if (existing.length > 0) {
    const updated = await db
      .update(userMaterialPrices)
      .set({
        price: item.price.toFixed(2),
        unit: resolved.unit,
        customMaterialName: resolved.materialName,
        originalMaterialName: resolved.materialName,
        reason,
        supplierName: item.supplierName ?? null,
        supplierPhone: item.phone ?? null,
        isPublic: item.isPublic,
        updatedAt: new Date(),
      })
      .where(eq(userMaterialPrices.id, existing[0].id))
      .returning();
    quoteId = updated[0].id;
    action = "updated";
  } else {
    const inserted = await db
      .insert(userMaterialPrices)
      .values({
        userId: systemUserId,
        materialId: resolved.materialId,
        originalMaterialName: resolved.materialName,
        customMaterialName: resolved.materialName,
        price: item.price.toFixed(2),
        unit: resolved.unit,
        reason,
        supplierName: item.supplierName ?? null,
        supplierPhone: item.phone ?? null,
        city: item.city,
        isPublic: item.isPublic,
      })
      .returning();
    quoteId = inserted[0].id;
    action = "inserted";
  }

  try {
    await db.insert(priceIngestKeys).values({
      idempotencyKey: item.idempotencyKey,
      quoteId,
      payloadHash: hash,
      createdAt: new Date(),
    });
  } catch (err) {
    // Concurrent insert of same key — treat as replay if hash matches
    const replay = await replayOrConflict(item, hash);
    if (replay && "ok" in replay && replay.ok) return replay;
    throw err;
  }

  return {
    ok: true,
    action,
    quoteId,
    materialId: resolved.materialId,
    materialName: resolved.materialName,
    matchedBy: resolved.matchedBy,
    city: item.city,
    price: item.price,
    unit: resolved.unit,
    isPublic: item.isPublic,
    idempotencyKey: item.idempotencyKey,
  };
}

async function processOneItem(
  item: ParsedItem,
  systemUserId: number,
): Promise<{ status: number; body: IngestSuccessBody | IngestErrorBody }> {
  const hash = payloadHash(item);
  const replay = await replayOrConflict(item, hash);
  if (replay) {
    if (replay.ok) return { status: 200, body: replay };
    return { status: 409, body: replay };
  }

  const resolved = await resolveMaterial(item);
  if (!resolved.ok) {
    return { status: resolved.status, body: resolved.body };
  }

  const body = await persistQuote(systemUserId, item, resolved);
  return { status: 200, body };
}

function checkAuth(req: Request): { ok: true } | { ok: false; status: number; body: IngestErrorBody } {
  const expected = process.env.MICAA_INGEST_API_KEY;
  if (!expected || !String(expected).trim()) {
    return {
      ok: false,
      status: 503,
      body: {
        ok: false,
        error: "Ingest API key not configured",
        code: "ingest_key_unset",
      },
    };
  }
  const provided = req.header("X-Micaa-Ingest-Key") || req.header("x-micaa-ingest-key");
  if (!provided || provided !== expected) {
    return {
      ok: false,
      status: 401,
      body: {
        ok: false,
        error: "Invalid or missing X-Micaa-Ingest-Key",
        code: "unauthorized",
      },
    };
  }
  return { ok: true };
}

/**
 * Express handler for POST /api/ingest/whatsapp-price
 */
export async function handleWhatsappPriceIngest(req: Request, res: Response) {
  try {
    const auth = checkAuth(req);
    if (!auth.ok) {
      return res.status(auth.status).json(auth.body);
    }

    const body = req.body;
    if (!body || typeof body !== "object") {
      return res.status(400).json({
        ok: false,
        error: "JSON body required",
        code: "validation_error",
      } satisfies IngestErrorBody);
    }

    const schema = typeof body.$schema === "string" ? body.$schema : "";
    const isBatch =
      Array.isArray(body.items) ||
      schema.includes("whatsapp-price.batch") ||
      schema === "micaa.ingest.whatsapp-price.batch.v1";

    const systemUserId = await ensureSystemUser();

    if (isBatch) {
      const items = Array.isArray(body.items) ? body.items : null;
      if (!items) {
        return res.status(400).json({
          ok: false,
          error: "Batch requires items array",
          code: "validation_error",
        } satisfies IngestErrorBody);
      }
      if (items.length === 0) {
        return res.status(400).json({
          ok: false,
          error: "items must not be empty",
          code: "validation_error",
        } satisfies IngestErrorBody);
      }
      if (items.length > 50) {
        return res.status(400).json({
          ok: false,
          error: "Batch limited to 50 items",
          code: "validation_error",
        } satisfies IngestErrorBody);
      }

      const results: (IngestSuccessBody | IngestErrorBody)[] = [];
      for (const raw of items) {
        const parsed = parseItem(raw);
        if (!parsed.ok) {
          results.push(parsed.error);
          continue;
        }
        try {
          const r = await processOneItem(parsed.item, systemUserId);
          results.push(r.body);
        } catch (err) {
          console.error("ingest item error:", err);
          results.push({
            ok: false,
            error: err instanceof Error ? err.message : "Internal error",
            code: "internal_error",
          });
        }
      }

      const allOk = results.every((r) => r.ok);
      return res.status(200).json({ ok: allOk, results });
    }

    // Single object (with or without $schema)
    const parsed = parseItem(body);
    if (!parsed.ok) {
      return res.status(400).json(parsed.error);
    }
    const r = await processOneItem(parsed.item, systemUserId);
    return res.status(r.status).json(r.body);
  } catch (error) {
    console.error("WhatsApp price ingest error:", error);
    // Table missing?
    const msg = error instanceof Error ? error.message : String(error);
    if (/price_ingest_keys|relation .* does not exist/i.test(msg)) {
      return res.status(503).json({
        ok: false,
        error:
          "price_ingest_keys table missing — run SQL migration from PR description",
        code: "migration_required",
        details: msg,
      } satisfies IngestErrorBody);
    }
    return res.status(500).json({
      ok: false,
      error: "Internal server error",
      code: "internal_error",
    } satisfies IngestErrorBody);
  }
}

