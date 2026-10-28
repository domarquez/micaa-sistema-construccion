/** Idempotent: columnas de publicidad destacada. Seguro llamar en cada boot. */
import { sql } from "drizzle-orm";
import { db } from "./db";

export async function ensureFeaturedSupplierColumns(): Promise<void> {
  try {
    await db.execute(sql`ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false`);
    await db.execute(sql`ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS featured_until timestamp`);
    await db.execute(sql`ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS ad_plan text`);
    console.log("[migrate] supplier_companies featured columns OK");
  } catch (e) {
    console.error("[migrate] featured columns failed (non-fatal):", e);
  }
}
