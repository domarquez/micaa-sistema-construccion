/**
 * Guía de empresas unificada: supplier_companies es la tabla única de proveedores.
 * Precios enlazados: user_material_prices.supplier_company_id (públicos) + material_supplier_prices.
 */
import type { Express, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "./db";

export const HIDDEN_STATUSES = ["no_contactar", "wa_inexistente"];

export function normalizeCompanyName(s: string | null | undefined): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(s\.?r\.?l\.?|ltda\.?|s\.?a\.?|sociedad|comercial|empresa|ferreteria|import export|bolivia)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const AREA: Record<string, string> = { "santa cruz": "3", "la paz": "2", "el alto": "2", cochabamba: "4" };

/** Teléfono boliviano a 591XXXXXXXX (8 dígitos); fijo de 7 dígitos usa código de área por ciudad. */
export function normalizeBoPhone(raw: unknown, city?: string | null): string | null {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("591")) d = d.slice(3);
  if (d.length === 8 && /^[2-467]/.test(d)) return "591" + d;
  if (d.length === 7) return "591" + (AREA[(city || "").toLowerCase()] || "3") + d;
  return null;
}

const rows = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);

/** Busca empresa por teléfono (principal o sucursal) y luego por nombre normalizado; si no existe, crea una sin verificar. */
export async function resolveSupplierCompany(opts: {
  name?: string | null;
  phone?: string | null;
  city?: string | null;
  userId: number;
  autoCreate?: boolean;
}): Promise<number | null> {
  const phone = normalizeBoPhone(opts.phone, opts.city);
  const base = normalizeCompanyName(String(opts.name || "").split(/[·(—/]/)[0]);
  if (phone) {
    const r = rows(
      await db.execute(sql`select id from supplier_companies
        where phone_normalized = ${phone}
           or exists (select 1 from jsonb_array_elements(coalesce(branches,'[]'::jsonb)) b where b->>'phone' = ${phone})
        order by id limit 1`),
    );
    if (r[0]) return Number(r[0].id);
  }
  if (base.length > 2) {
    const r = rows(await db.execute(sql`select id from supplier_companies where normalized_name = ${base} order by id limit 1`));
    if (r[0]) return Number(r[0].id);
  }
  if (!opts.autoCreate || (!phone && base.length <= 2)) return null;
  const display = String(opts.name || "").split(/[·(—]/)[0].trim() || phone!;
  const r = rows(
    await db.execute(sql`insert into supplier_companies
      (user_id, company_name, city, phone, whatsapp, is_active, is_verified, normalized_name, phone_normalized, source, contact_status, branches, categories)
      values (${opts.userId}, ${display}, ${opts.city ?? null}, ${phone}, ${phone && /^591[67]/.test(phone) ? phone : null},
              true, false, ${normalizeCompanyName(display)}, ${phone}, 'extractor', 'respondio', '[]'::jsonb, '{}'::text[])
      returning id`),
  );
  return r[0] ? Number(r[0].id) : null;
}

async function listSuppliers(req: Request, res: Response) {
  try {
    const city = typeof req.query.city === "string" && req.query.city ? req.query.city : null;
    const r = rows(
      await db.execute(sql`
        select s.id, s.company_name as "companyName", s.business_type as "businessType", s.speciality, s.description,
               s.address, s.city, s.phone, s.whatsapp, s.website, s.facebook, s.logo_url as "logoUrl", s.logo_thumb_url as "logoThumbUrl", s.logo_format as "logoFormat",
               s.membership_type as "membershipType", s.is_verified as "isVerified", s.rating, s.review_count as "reviewCount",
               s.source, s.categories, s.custom_trades as "customTrades", s.associations, s.branches, s.price_list_url as "priceListUrl", s.phone_normalized as "phoneNormalized",
               coalesce(s.is_featured, false) as "isFeatured", s.featured_until as "featuredUntil", s.ad_plan as "adPlan",
               (select count(*) from user_material_prices u where u.supplier_company_id = s.id and u.is_public)::int
             + (select count(*) from material_supplier_prices m where m.supplier_id = s.id and m.is_active)::int
             + (select count(*) from company_service_prices csp where csp.supplier_id = s.id and csp.is_active)::int as "priceCount",
               (coalesce(s.is_featured, false) and (s.featured_until is null or s.featured_until > now())) as "featuredActive"
        from supplier_companies s
        where s.is_active and coalesce(s.contact_status,'') not in ('no_contactar','wa_inexistente')
          and (${city}::text is null or s.city = ${city})
        order by "featuredActive" desc, s.created_at desc nulls last, "priceCount" desc, s.is_verified desc, s.company_name`),
    );
    res.json(r);
  } catch (e) {
    console.error("Error fetching suppliers guide:", e);
    res.status(500).json({ message: "No se pudo cargar la guía de empresas" });
  }
}

async function supplierPrices(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "id inválido" });
  try {
    const r = rows(
      await db.execute(sql`
        select * from (
          select u.material_id as "materialId", coalesce(m.name, u.original_material_name) as "materialName",
                 u.price::float as price, u.unit, u.city, coalesce(u.updated_at, u.created_at) as "updatedAt", 'cotizacion' as kind
          from user_material_prices u left join materials m on m.id = u.material_id
          where u.supplier_company_id = ${id} and u.is_public
          union all
          select p.material_id, m.name, p.price::float, m.unit, null, p.last_updated, 'lista'
          from material_supplier_prices p join materials m on m.id = p.material_id
          where p.supplier_id = ${id} and p.is_active
          union all
          select null::int, s.name, s.price::float, s.unit, null, s.updated_at, 'servicio'
          from company_service_prices s
          where s.supplier_id = ${id} and s.is_active
        ) x order by "updatedAt" desc nulls last limit 200`),
    );
    res.json(r);
  } catch (e) {
    console.error("Error fetching supplier prices:", e);
    res.status(500).json({ message: "No se pudieron cargar los precios" });
  }
}

async function materialSuppliers(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "id inválido" });
  try {
    const r = rows(
      await db.execute(sql`
        select s.id, s.company_name as "companyName", s.city, s.whatsapp, s.phone_normalized as "phoneNormalized",
               s.logo_url as "logoUrl", s.logo_thumb_url as "logoThumbUrl",
               s.is_verified as "isVerified",
               coalesce(s.is_featured, false) as "isFeatured",
               (coalesce(s.is_featured, false) and (s.featured_until is null or s.featured_until > now())) as "featuredActive",
               x.price, x.unit, x."updatedAt"
        from (
          (select distinct on (u.supplier_company_id) u.supplier_company_id as sid, u.price::float as price, u.unit,
                 coalesce(u.updated_at, u.created_at) as "updatedAt"
          from user_material_prices u where u.material_id = ${id} and u.is_public and u.supplier_company_id is not null
          order by u.supplier_company_id, coalesce(u.updated_at, u.created_at) desc)
          union all
          select p.supplier_id, p.price::float, null, p.last_updated from material_supplier_prices p
          where p.material_id = ${id} and p.is_active
        ) x join supplier_companies s on s.id = x.sid
        where s.is_active and coalesce(s.contact_status,'') not in ('no_contactar','wa_inexistente')
        order by "featuredActive" desc, x.price asc`),
    );
    res.json(r);
  } catch (e) {
    console.error("Error fetching material suppliers:", e);
    res.status(500).json({ message: "No se pudieron cargar los proveedores" });
  }
}

export async function setFeatured(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "id inválido" });
  const { isFeatured, featuredUntil, adPlan } = req.body ?? {};
  try {
    const featured = Boolean(isFeatured);
    const until = featuredUntil ? new Date(featuredUntil) : null;
    const plan = typeof adPlan === "string" ? adPlan : featured ? "destacado" : null;
    const r = rows(
      await db.execute(sql`
        update supplier_companies
        set is_featured = ${featured},
            featured_until = ${until},
            ad_plan = ${plan},
            membership_type = case when ${featured} then 'premium' else coalesce(membership_type, 'free') end,
            membership_expires_at = coalesce(${until}, membership_expires_at),
            updated_at = now()
        where id = ${id}
        returning id, company_name as "companyName", is_featured as "isFeatured",
                  featured_until as "featuredUntil", ad_plan as "adPlan"`),
    );
    if (!r[0]) return res.status(404).json({ message: "Empresa no encontrada" });
    res.json(r[0]);
  } catch (e) {
    console.error("Error set featured:", e);
    res.status(500).json({ message: "No se pudo actualizar el destacado" });
  }
}

export function registerSupplierGuideRoutes(app: Express) {
  app.get("/api/public/suppliers", listSuppliers);
  app.get("/api/supplier-companies", listSuppliers);
  app.get("/api/public/suppliers/:id/prices", supplierPrices);
  app.get("/api/public/materials/:id/suppliers", materialSuppliers);
}
