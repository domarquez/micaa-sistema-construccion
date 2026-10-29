/**
 * Autoservicio de empresa (beta gratis hasta 31 ene 2027):
 * crear/editar perfil y precios vinculados a la guía y a las fichas de material.
 * El WhatsApp verificado es la clave (sin contraseña).
 */
import type { Express, Request, Response, NextFunction } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import {
  materialSupplierPrices,
  materials,
  supplierCompanies,
  userMaterialPrices,
  users,
  companyServicePrices,
} from "../shared/schema";
import { normalizeBoPhone, normalizeCompanyName } from "./supplier-guide";
import {
  refreshCompanyFeatureState,
  featureOn,
  countCompanyPrices,
  waMeLink,
  BETA_UNTIL as FEATURES_BETA_UNTIL,
} from "./company-features";
import { parseTradesInput, KNOWN_TRADE_SLUGS } from "../shared/company-trades";

export const BETA_UNTIL = new Date("2027-01-31T23:59:59.000-04:00");
export const BETA_AD_PLAN = "beta";

/** @deprecated use KNOWN_TRADE_SLUGS from shared/company-trades */
const RUBROS = KNOWN_TRADE_SLUGS;

const CITIES = new Set([
  "Santa Cruz",
  "Cochabamba",
  "La Paz",
  "El Alto",
  "Sucre",
  "Tarija",
  "Beni",
  "Pando",
  "Oruro",
  "Potosí",
  "Trinidad",
  "Cobija",
]);

type AuthReq = Request & {
  user?: { id: number; phone?: string | null; phoneVerified?: boolean | null; role?: string };
};

function rows(r: unknown): any[] {
  return Array.isArray(r) ? r : (r as { rows?: any[] })?.rows ?? [];
}

function publicCompany(row: any, extras: { priceCount?: number } = {}) {
  const priceCount = extras.priceCount ?? 0;
  const base = {
    id: row.id,
    companyName: row.companyName ?? row.company_name,
    businessType: row.businessType ?? row.business_type,
    speciality: row.speciality,
    trades: (row.categories ?? row.trades ?? (row.speciality ? [row.speciality] : [])) as string[],
    customTrades: (row.customTrades ?? row.custom_trades ?? []) as string[],
    description: row.description,
    address: row.address,
    city: row.city,
    phone: row.phone,
    whatsapp: row.whatsapp,
    website: row.website,
    facebook: row.facebook,
    instagram: row.instagram,
    email: row.email,
    logoUrl: row.logoUrl ?? row.logo_url,
    logoThumbUrl: row.logoThumbUrl ?? row.logo_thumb_url,
    logoFormat: row.logoFormat ?? row.logo_format,
    logoQualityWarn: row.logoQualityWarn ?? row.logo_quality_warn,
    openingHours: row.openingHours ?? row.opening_hours,
    deliveryInfo: row.deliveryInfo ?? row.delivery_info,
    nit: row.nit,
    productsServices: row.productsServices ?? row.products_services,
    waPriceReminders: row.waPriceReminders ?? row.wa_price_reminders,
    membershipType: row.membershipType ?? row.membership_type,
    membershipExpiresAt: row.membershipExpiresAt ?? row.membership_expires_at,
    isFeatured: row.isFeatured ?? row.is_featured,
    featuredUntil: row.featuredUntil ?? row.featured_until,
    adPlan: row.adPlan ?? row.ad_plan,
    isActive: row.isActive ?? row.is_active,
    isVerified: row.isVerified ?? row.is_verified,
    categories: row.categories,
    source: row.source,
    phoneNormalized: row.phoneNormalized ?? row.phone_normalized,
    claimStatus: row.claimStatus ?? row.claim_status,
    micaaCreated: row.micaaCreated ?? row.micaa_created,
    contacts: row.contacts ?? [],
    features: row.features ?? {},
    profileCompletedAt: row.profileCompletedAt ?? row.profile_completed_at,
    priceCount,
    betaUntil: BETA_UNTIL.toISOString(),
  };
  const destacada = featureOn({ ...base, priceCount }, "destacada");
  const phone = base.phoneNormalized || base.whatsapp;
  return {
    ...base,
    featuredActive: destacada,
    destacada,
    waLink: waMeLink(phone, base.companyName),
    profileComplete: !!(base.profileCompletedAt) || (priceCount > 0 && !!base.logoUrl && (base.description || "").length >= 20),
  };
}

async function findMine(userId: number) {
  const r = await db
    .select()
    .from(supplierCompanies)
    .where(and(eq(supplierCompanies.userId, userId), eq(supplierCompanies.isActive, true)))
    .limit(1);
  if (r[0]) return r[0];
  return null;
}

/** If user WA matches sales/owner contact of a pending_claim MICAA-seeded company, attach them. */
async function claimPendingByPhone(userId: number, phoneRaw: string | null | undefined) {
  const phone = normalizeBoPhone(phoneRaw, "Santa Cruz");
  if (!phone || !/^591[67]/.test(phone)) return null;
  const found = rows(
    await db.execute(sql`
      select * from supplier_companies
      where is_active
        and coalesce(claim_status,'') = 'pending_claim'
        and (
          phone_normalized = ${phone}
          or whatsapp = ${phone}
          or exists (
            select 1 from jsonb_array_elements(coalesce(contacts,'[]'::jsonb)) c
            where c->>'phone' = ${phone}
              and coalesce(c->>'role','') in ('owner','sales','marketing')
          )
        )
      order by id
      limit 1`),
  );
  const co = found[0];
  if (!co) return null;
  // Only reassign user_id if still on seed/system user or already this user
  const updated = rows(
    await db.execute(sql`
      update supplier_companies set
        user_id = ${userId},
        claim_status = 'claimed',
        claimed_at = now(),
        claimed_by_user_id = ${userId},
        updated_at = now()
      where id = ${co.id}
        and coalesce(claim_status,'') = 'pending_claim'
      returning *`),
  );
  return updated[0] || null;
}

function parseBody(body: any) {
  const companyName = String(body?.companyName ?? "").trim();
  const city = String(body?.city ?? "").trim();
  const { trades, customTrades, speciality } = parseTradesInput(body);
  const phoneRaw = body?.phone ?? body?.whatsapp ?? null;
  const opt = (k: string) =>
    body?.[k] != null ? String(body[k]).trim() || null : undefined;
  return {
    companyName,
    city,
    speciality,
    trades,
    customTrades,
    phoneRaw,
    description: opt("description"),
    address: opt("address"),
    website: opt("website"),
    facebook: opt("facebook"),
    instagram: opt("instagram"),
    email: opt("email"),
    openingHours: opt("openingHours"),
    deliveryInfo: opt("deliveryInfo"),
    nit: opt("nit"),
    productsServices: opt("productsServices"),
    waPriceReminders:
      body?.waPriceReminders != null ? !!body.waPriceReminders : undefined,
  };
}

async function createCompany(req: AuthReq, res: Response) {
  try {
    const userId = req.user!.id;
    const existing = await findMine(userId);
    if (existing) {
      return res
        .status(409)
        .json({ message: "Ya tenés una empresa registrada", company: publicCompany(existing) });
    }

    const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = userRows[0];
    if (!user?.phoneVerified || !user.phone) {
      return res.status(403).json({
        message:
          "Primero verificá tu WhatsApp: ese número es tu clave para entrar y administrar la empresa.",
        code: "PHONE_REQUIRED",
      });
    }

    const parsed = parseBody(req.body);
    const {
      companyName, city, speciality, trades, customTrades, phoneRaw, description, address, website,
      facebook, instagram, email, openingHours, deliveryInfo, nit, productsServices,
      waPriceReminders,
    } = parsed;
    if (companyName.length < 2) {
      return res.status(400).json({ message: "El nombre de la empresa es obligatorio" });
    }
    if (!city || !CITIES.has(city)) {
      return res
        .status(400)
        .json({ message: "Elegí una ciudad válida (Santa Cruz, La Paz, Cochabamba…)" });
    }
    if (!trades.length) {
      return res.status(400).json({ message: "Elegí al menos un rubro (materiales y/o servicios)" });
    }
    if (trades.includes("otro_servicio") && !customTrades.length) {
      return res.status(400).json({ message: "Escribí el nombre de tu otro servicio" });
    }

    const phoneNorm =
      normalizeBoPhone(phoneRaw || user.phone, city) || normalizeBoPhone(user.phone, city);
    const wa = phoneNorm && /^591[67]/.test(phoneNorm) ? phoneNorm : null;

    const inserted = await db
      .insert(supplierCompanies)
      .values({
        userId,
        companyName,
        businessType: "retailer",
        speciality: speciality || trades[0] || "general",
        description: description ?? null,
        address: address ?? null,
        city,
        phone: phoneNorm,
        whatsapp: wa,
        website: website ?? null,
        membershipType: "free",
        membershipExpiresAt: BETA_UNTIL,
        isFeatured: false,
        featuredUntil: null,
        adPlan: BETA_AD_PLAN,
        isActive: true,
        isVerified: false,
        normalizedName: normalizeCompanyName(companyName),
        phoneNormalized: phoneNorm,
        source: "manual",
        categories: trades.length ? trades : ["general"],
        customTrades: customTrades.length ? customTrades : [],
        contactStatus: "respondio",
        branches: [],
        contacts: wa
          ? [{ phone: wa, role: "owner", name: "Responsable", isPrimary: true }]
          : [],
        claimStatus: "claimed",
        claimedAt: new Date(),
        claimedByUserId: userId,
        micaaCreated: false,
        features: {},
      } as any)
      .returning();

    await db
      .update(users)
      .set({ userType: "supplier", city: city || user.city })
      .where(eq(users.id, userId));

    res.status(201).json(publicCompany(inserted[0]));
  } catch (e) {
    console.error("POST my-supplier-company:", e);
    res.status(500).json({ message: "No se pudo registrar la empresa" });
  }
}

async function updateCompany(req: AuthReq, res: Response) {
  try {
    const mine = await findMine(req.user!.id);
    if (!mine) return res.status(404).json({ message: "Todavía no registraste tu empresa" });

    const idParam = req.params?.id;
    if (idParam != null && String(mine.id) !== String(idParam)) {
      return res.status(403).json({ message: "Solo podés editar tu propia empresa" });
    }

    const {
      companyName, city, speciality, trades, customTrades, phoneRaw, description, address, website,
      facebook, instagram, email, openingHours, deliveryInfo, nit, productsServices,
      waPriceReminders,
    } = parseBody(req.body);
    if (companyName && companyName.length < 2) {
      return res.status(400).json({ message: "El nombre de la empresa es obligatorio" });
    }
    if (city && !CITIES.has(city)) {
      return res.status(400).json({ message: "Elegí una ciudad válida" });
    }
    if (Array.isArray(req.body?.trades) || Array.isArray(req.body?.categories) || req.body?.speciality || req.body?.rubro) {
      if (!trades.length) {
        return res.status(400).json({ message: "Elegí al menos un rubro (materiales y/o servicios)" });
      }
      if (trades.includes("otro_servicio") && !customTrades.length) {
        return res.status(400).json({ message: "Escribí el nombre de tu otro servicio" });
      }
    }

    const nextCity = city || mine.city;
    const phoneNorm =
      phoneRaw != null
        ? normalizeBoPhone(phoneRaw, nextCity)
        : mine.phoneNormalized || normalizeBoPhone(mine.phone, nextCity);
    const wa = phoneNorm && /^591[67]/.test(phoneNorm) ? phoneNorm : mine.whatsapp;

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (companyName) {
      patch.companyName = companyName;
      patch.normalizedName = normalizeCompanyName(companyName);
    }
    if (city) patch.city = city;
    if (trades.length) {
      patch.speciality = speciality || trades[0];
      patch.categories = trades;
      patch.customTrades = customTrades;
    }
    if (description !== undefined) patch.description = description;
    if (address !== undefined) patch.address = address;
    if (website !== undefined) patch.website = website;
    if (facebook !== undefined) patch.facebook = facebook;
    if (instagram !== undefined) patch.instagram = instagram;
    if (email !== undefined) patch.email = email;
    if (openingHours !== undefined) patch.openingHours = openingHours;
    if (deliveryInfo !== undefined) patch.deliveryInfo = deliveryInfo;
    if (nit !== undefined) patch.nit = nit;
    if (productsServices !== undefined) patch.productsServices = productsServices;
    if (waPriceReminders !== undefined) patch.waPriceReminders = waPriceReminders;
    if (phoneNorm) {
      patch.phone = phoneNorm;
      patch.phoneNormalized = phoneNorm;
      patch.whatsapp = wa;
    }

    const updated = await db
      .update(supplierCompanies)
      .set(patch as any)
      .where(eq(supplierCompanies.id, mine.id))
      .returning();

    await refreshCompanyFeatureState(mine.id);
    const priceCount = await countCompanyPrices(mine.id);
    const fresh = (await db.select().from(supplierCompanies).where(eq(supplierCompanies.id, mine.id)).limit(1))[0];
    res.json(publicCompany(fresh || updated[0], { priceCount }));
  } catch (e) {
    console.error("PUT my-supplier-company:", e);
    res.status(500).json({ message: "No se pudo actualizar la empresa" });
  }
}

export function registerSupplierCompanySelfRoutes(
  app: Express,
  requireAuth: (req: Request, res: Response, next: NextFunction) => void,
) {
  app.get("/api/my-supplier-company", requireAuth, async (req: AuthReq, res: Response) => {
    try {
      let mine = await findMine(req.user!.id);
      if (!mine) {
        const userRows = await db.select().from(users).where(eq(users.id, req.user!.id)).limit(1);
        mine = await claimPendingByPhone(req.user!.id, userRows[0]?.phone || req.user!.phone);
      }
      if (!mine) return res.status(404).json({ message: "Todavía no registraste tu empresa" });
      const priceCount = await countCompanyPrices(mine.id);
      res.json(publicCompany(mine, { priceCount }));
    } catch (e) {
      console.error("GET my-supplier-company:", e);
      res.status(500).json({ message: "No se pudo cargar tu empresa" });
    }
  });

  app.post("/api/my-supplier-company", requireAuth, createCompany);
  app.post("/api/supplier-companies", requireAuth, createCompany);

  app.put("/api/my-supplier-company", requireAuth, updateCompany);
  app.put("/api/supplier-companies/:id", requireAuth, updateCompany);

  app.get("/api/my-supplier-company/prices", requireAuth, async (req: AuthReq, res: Response) => {
    try {
      const mine = await findMine(req.user!.id);
      if (!mine) return res.status(404).json({ message: "Todavía no registraste tu empresa" });
      const r = rows(
        await db.execute(sql`
          select * from (
            select u.id, u.material_id as "materialId",
                   coalesce(m.name, u.original_material_name) as "materialName",
                   u.price::float as price, u.unit, u.city,
                   coalesce(u.updated_at, u.created_at) as "updatedAt",
                   'cotizacion' as kind
            from user_material_prices u
            left join materials m on m.id = u.material_id
            where u.supplier_company_id = ${mine.id} and u.is_public
            union all
            select p.id, p.material_id, m.name, p.price::float, m.unit, null::text,
                   p.last_updated, 'lista'
            from material_supplier_prices p
            join materials m on m.id = p.material_id
            where p.supplier_id = ${mine.id} and p.is_active
            union all
            select s.id, null::int, s.name, s.price::float, s.unit, null::text,
                   s.updated_at, 'servicio'
            from company_service_prices s
            where s.supplier_id = ${mine.id} and s.is_active
          ) x
          order by "updatedAt" desc nulls last
          limit 200`),
      );
      res.json(r);
    } catch (e) {
      console.error("GET my-supplier-company/prices:", e);
      res.status(500).json({ message: "No se pudieron cargar tus precios" });
    }
  });

  app.post("/api/my-supplier-company/prices", requireAuth, async (req: AuthReq, res: Response) => {
    try {
      const mine = await findMine(req.user!.id);
      if (!mine) return res.status(404).json({ message: "Todavía no registraste tu empresa" });

      const materialId = Number(req.body?.materialId);
      const price = parseFloat(req.body?.price);
      const unit = typeof req.body?.unit === "string" ? req.body.unit.trim() : null;
      if (!Number.isFinite(materialId) || !price || price <= 0) {
        return res.status(400).json({ message: "Material y precio válidos son obligatorios" });
      }

      const mat = await db.select().from(materials).where(eq(materials.id, materialId)).limit(1);
      if (!mat[0]) return res.status(404).json({ message: "Material no encontrado" });

      const existing = await db
        .select()
        .from(materialSupplierPrices)
        .where(
          and(
            eq(materialSupplierPrices.supplierId, mine.id),
            eq(materialSupplierPrices.materialId, materialId),
            eq(materialSupplierPrices.isActive, true),
          ),
        )
        .limit(1);

      let row;
      if (existing[0]) {
        row = (
          await db
            .update(materialSupplierPrices)
            .set({
              price: price.toString(),
              lastUpdated: new Date(),
              description: unit || existing[0].description,
            })
            .where(eq(materialSupplierPrices.id, existing[0].id))
            .returning()
        )[0];
      } else {
        row = (
          await db
            .insert(materialSupplierPrices)
            .values({
              materialId,
              supplierId: mine.id,
              price: price.toString(),
              currency: "BOB",
              description: unit,
              isActive: true,
            })
            .returning()
        )[0];
      }

      const city = mine.city || "Santa Cruz";
      const ump = await db
        .select()
        .from(userMaterialPrices)
        .where(
          and(
            eq(userMaterialPrices.userId, req.user!.id),
            eq(userMaterialPrices.materialId, materialId),
          ),
        )
        .limit(1);
      if (ump[0]) {
        await db
          .update(userMaterialPrices)
          .set({
            price: price.toString(),
            isPublic: true,
            city,
            supplierCompanyId: mine.id,
            unit: unit || ump[0].unit || mat[0].unit,
            updatedAt: new Date(),
          })
          .where(eq(userMaterialPrices.id, ump[0].id));
      } else {
        await db.insert(userMaterialPrices).values({
          userId: req.user!.id,
          materialId,
          originalMaterialName: mat[0].name,
          customMaterialName: mat[0].name,
          price: price.toString(),
          unit: unit || mat[0].unit,
          reason: "precio_empresa",
          city,
          isPublic: true,
          supplierCompanyId: mine.id,
        });
      }

      await refreshCompanyFeatureState(mine.id);
      res.status(201).json(row);
    } catch (e) {
      console.error("POST my-supplier-company/prices:", e);
      res.status(500).json({ message: "No se pudo guardar el precio" });
    }
  });


  app.get("/api/my-supplier-company/services", requireAuth, async (req: AuthReq, res: Response) => {
    try {
      const mine = await findMine(req.user!.id);
      if (!mine) return res.status(404).json({ message: "Todavía no registraste tu empresa" });
      const r = rows(
        await db.execute(sql`
          select id, name, unit, price::float as price, currency, description,
                 updated_at as "updatedAt"
          from company_service_prices
          where supplier_id = ${mine.id} and is_active
          order by updated_at desc nulls last
          limit 200`),
      );
      res.json(r);
    } catch (e) {
      console.error("GET my-supplier-company/services:", e);
      res.status(500).json({ message: "No se pudieron cargar tus servicios" });
    }
  });

  app.post("/api/my-supplier-company/services", requireAuth, async (req: AuthReq, res: Response) => {
    try {
      const mine = await findMine(req.user!.id);
      if (!mine) return res.status(404).json({ message: "Todavía no registraste tu empresa" });
      const name = String(req.body?.name ?? "").trim();
      const unit = typeof req.body?.unit === "string" ? req.body.unit.trim() || null : null;
      const price = parseFloat(req.body?.price);
      const description =
        typeof req.body?.description === "string" ? req.body.description.trim() || null : null;
      if (name.length < 2 || !price || price <= 0) {
        return res.status(400).json({ message: "Nombre y precio válidos son obligatorios" });
      }
      const row = (
        await db
          .insert(companyServicePrices)
          .values({
            supplierId: mine.id,
            name: name.slice(0, 120),
            unit,
            price: price.toString(),
            currency: "BOB",
            description,
            isActive: true,
          })
          .returning()
      )[0];
      await refreshCompanyFeatureState(mine.id);
      res.status(201).json(row);
    } catch (e) {
      console.error("POST my-supplier-company/services:", e);
      res.status(500).json({ message: "No se pudo guardar el servicio" });
    }
  });

  app.delete("/api/my-supplier-company/services/:id", requireAuth, async (req: AuthReq, res: Response) => {
    try {
      const mine = await findMine(req.user!.id);
      if (!mine) return res.status(404).json({ message: "Todavía no registraste tu empresa" });
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "id inválido" });
      await db.execute(sql`
        update company_service_prices
        set is_active = false, updated_at = now()
        where id = ${id} and supplier_id = ${mine.id}`);
      await refreshCompanyFeatureState(mine.id);
      res.json({ ok: true });
    } catch (e) {
      console.error("DELETE service:", e);
      res.status(500).json({ message: "No se pudo eliminar" });
    }
  });

  // Stats 7d / 30d from analytics_events (PR #36)
  app.get("/api/my-supplier-company/stats", requireAuth, async (req: AuthReq, res: Response) => {
    try {
      const mine = await findMine(req.user!.id);
      if (!mine) return res.status(404).json({ message: "Todavía no registraste tu empresa" });
      const id = mine.id;
      const agg = rows(
        await db.execute(sql`
          select
            count(*) filter (where event_type = 'company_view'
              and created_at > now() - interval '7 days'
              and (event_data->>'supplierId')::int = ${id})::int as "profileViews7",
            count(*) filter (where event_type = 'company_view'
              and created_at > now() - interval '30 days'
              and (event_data->>'supplierId')::int = ${id})::int as "profileViews30",
            count(*) filter (where event_type in ('view_material','ver_proveedores')
              and created_at > now() - interval '7 days'
              and (event_data->>'supplierId')::int = ${id})::int as "priceViews7",
            count(*) filter (where event_type in ('view_material','ver_proveedores')
              and created_at > now() - interval '30 days'
              and (event_data->>'supplierId')::int = ${id})::int as "priceViews30",
            count(*) filter (where event_type = 'whatsapp_click'
              and created_at > now() - interval '7 days'
              and (event_data->>'supplierId')::int = ${id})::int as "waClicks7",
            count(*) filter (where event_type = 'whatsapp_click'
              and created_at > now() - interval '30 days'
              and (event_data->>'supplierId')::int = ${id})::int as "waClicks30"
          from analytics_events`),
      );
      res.json(agg[0] || {
        profileViews7: 0, profileViews30: 0,
        priceViews7: 0, priceViews30: 0,
        waClicks7: 0, waClicks30: 0,
      });
    } catch (e) {
      console.error("stats:", e);
      res.json({
        profileViews7: 0, profileViews30: 0,
        priceViews7: 0, priceViews30: 0,
        waClicks7: 0, waClicks30: 0,
        note: "analytics unavailable",
      });
    }
  });
}
