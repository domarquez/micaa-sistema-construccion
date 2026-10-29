/**
 * Proveedores sugeridos en presupuestos: empresas Destacada/activas que venden
 * materiales del presupuesto en la ciudad del usuario.
 */
import type { Express, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { waMeLink } from "./company-features";

const rows = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);

export function registerSuggestedSuppliersRoutes(app: Express) {
  app.get("/api/public/suggested-suppliers", async (req: Request, res: Response) => {
    try {
      const city = typeof req.query.city === "string" ? req.query.city.trim() : "";
      const rawIds = typeof req.query.materialIds === "string" ? req.query.materialIds : "";
      const rawActs = typeof req.query.activityIds === "string" ? req.query.activityIds : "";
      let materialIds = rawIds
        .split(",")
        .map((x) => Number(x.trim()))
        .filter((n) => Number.isFinite(n) && n > 0)
        .slice(0, 80);
      const activityIds = rawActs
        .split(",")
        .map((x) => Number(x.trim()))
        .filter((n) => Number.isFinite(n) && n > 0)
        .slice(0, 80);
      if (!materialIds.length && activityIds.length) {
        const actList = sql.join(activityIds.map((id) => sql`${id}`), sql`, `);
        const mats = rows(
          await db.execute(sql`
            select distinct material_id as id
            from activity_compositions
            where type = 'material' and material_id is not null
              and activity_id in (${actList})
            limit 80`),
        );
        materialIds = mats.map((m: any) => Number(m.id)).filter((n: number) => n > 0);
      }
      if (!materialIds.length) return res.json([]);

      const idList = sql.join(materialIds.map((id) => sql`${id}`), sql`, `);
      const r = rows(
        await db.execute(sql`
          select s.id, s.company_name as "companyName", s.city,
                 s.logo_url as "logoUrl", s.logo_thumb_url as "logoThumbUrl",
                 s.phone_normalized as "phoneNormalized", s.whatsapp,
                 (coalesce(s.is_featured, false) and (s.featured_until is null or s.featured_until > now())) as "featuredActive",
                 count(distinct x.mid)::int as "matchedMaterials"
          from (
            select u.supplier_company_id as sid, u.material_id as mid
            from user_material_prices u
            where u.is_public and u.material_id in (${idList}) and u.supplier_company_id is not null
            union
            select p.supplier_id, p.material_id
            from material_supplier_prices p
            where p.is_active and p.material_id in (${idList})
          ) x
          join supplier_companies s on s.id = x.sid
          where s.is_active
            and coalesce(s.contact_status,'') not in ('no_contactar','wa_inexistente')
            and (${city || null}::text is null or ${city || null}::text = '' or s.city = ${city || null})
          group by s.id
          order by "featuredActive" desc, "matchedMaterials" desc, s.company_name
          limit 12`),
      );

      res.json(
        r.map((s) => ({
          ...s,
          waLink: waMeLink(s.phoneNormalized || s.whatsapp, s.companyName, {
            context: "Vi tus precios en un presupuesto de MICAA.",
          }),
        })),
      );
    } catch (e) {
      console.error("suggested-suppliers:", e);
      res.status(500).json({ message: "No se pudieron cargar proveedores sugeridos" });
    }
  });
}
