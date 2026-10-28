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
} from "../shared/schema";
import { normalizeBoPhone, normalizeCompanyName } from "./supplier-guide";

export const BETA_UNTIL = new Date("2027-01-31T23:59:59.000-04:00");
export const BETA_AD_PLAN = "beta";

const RUBROS = new Set([
  "acero",
  "cemento",
  "ferreteria",
  "construccion_seco",
  "aridos",
  "aislamiento",
  "electrico",
  "sanitario",
  "maderas",
  "pinturas",
  "ceramicos",
  "vidrios",
  "agua",
  "quincalleria",
  "herramientas",
  "general",
  "pasto_sintetico",
]);

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

function publicCompany(row: any) {
  return {
    id: row.id,
    companyName: row.companyName ?? row.company_name,
    businessType: row.businessType ?? row.business_type,
    speciality: row.speciality,
    description: row.description,
    address: row.address,
    city: row.city,
    phone: row.phone,
    whatsapp: row.whatsapp,
    website: row.website,
    facebook: row.facebook,
    logoUrl: row.logoUrl ?? row.logo_url,
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
    betaUntil: BETA_UNTIL.toISOString(),
  };
}

async function findMine(userId: number) {
  const r = await db
    .select()
    .from(supplierCompanies)
    .where(and(eq(supplierCompanies.userId, userId), eq(supplierCompanies.isActive, true)))
    .limit(1);
  return r[0] ?? null;
}

function parseBody(body: any) {
  const companyName = String(body?.companyName ?? "").trim();
  const city = String(body?.city ?? "").trim();
  const specialityRaw = String(body?.speciality ?? body?.rubro ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  const speciality = specialityRaw || null;
  const phoneRaw = body?.phone ?? body?.whatsapp ?? null;
  const description =
    body?.description != null ? String(body.description).trim() || null : undefined;
  const address = body?.address != null ? String(body.address).trim() || null : undefined;
  const website = body?.website != null ? String(body.website).trim() || null : undefined;
  return { companyName, city, speciality, phoneRaw, description, address, website };
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

    const { companyName, city, speciality, phoneRaw, description, address, website } = parseBody(
      req.body,
    );
    if (companyName.length < 2) {
      return res.status(400).json({ message: "El nombre de la empresa es obligatorio" });
    }
    if (!city || !CITIES.has(city)) {
      return res
        .status(400)
        .json({ message: "Elegí una ciudad válida (Santa Cruz, La Paz, Cochabamba…)" });
    }
    if (speciality && !RUBROS.has(speciality)) {
      return res.status(400).json({ message: "Elegí un rubro de la lista" });
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
        speciality: speciality || "general",
        description: description ?? null,
        address: address ?? null,
        city,
        phone: phoneNorm,
        whatsapp: wa,
        website: website ?? null,
        membershipType: "free",
        membershipExpiresAt: BETA_UNTIL,
        isFeatured: true,
        featuredUntil: BETA_UNTIL,
        adPlan: BETA_AD_PLAN,
        isActive: true,
        isVerified: false,
        normalizedName: normalizeCompanyName(companyName),
        phoneNormalized: phoneNorm,
        source: "manual",
        categories: speciality ? [speciality] : ["general"],
        contactStatus: "respondio",
        branches: [],
      })
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

    const { companyName, city, speciality, phoneRaw, description, address, website } = parseBody(
      req.body,
    );
    if (companyName && companyName.length < 2) {
      return res.status(400).json({ message: "El nombre de la empresa es obligatorio" });
    }
    if (city && !CITIES.has(city)) {
      return res.status(400).json({ message: "Elegí una ciudad válida" });
    }
    if (speciality && !RUBROS.has(speciality)) {
      return res.status(400).json({ message: "Elegí un rubro de la lista" });
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
    if (speciality) {
      patch.speciality = speciality;
      patch.categories = [speciality];
    }
    if (description !== undefined) patch.description = description;
    if (address !== undefined) patch.address = address;
    if (website !== undefined) patch.website = website;
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

    res.json(publicCompany(updated[0]));
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
      const mine = await findMine(req.user!.id);
      if (!mine) return res.status(404).json({ message: "Todavía no registraste tu empresa" });
      res.json(publicCompany(mine));
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

      res.status(201).json(row);
    } catch (e) {
      console.error("POST my-supplier-company/prices:", e);
      res.status(500).json({ message: "No se pudo guardar el precio" });
    }
  });
}
