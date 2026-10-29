/**
 * Company feature flags / plan.
 * Beta free until 2027-01-31: Destacada (and all features) ON when profile is complete
 * (logo + description + ≥1 material or service price). From Feb 2027 flags can be flipped per company.
 */
import { sql } from "drizzle-orm";
import { db } from "./db";

export const BETA_UNTIL = new Date("2027-01-31T23:59:59-04:00");

export type CompanyFeatureKey =
  | "destacada"
  | "featured_prices"
  | "wa_button"
  | "stats"
  | "suggested";

export const ALL_FEATURES: CompanyFeatureKey[] = [
  "destacada",
  "featured_prices",
  "wa_button",
  "stats",
  "suggested",
];

const rows = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);

export function isBetaPeriod(now = new Date()): boolean {
  return now.getTime() <= BETA_UNTIL.getTime();
}

/** Profile complete = logo + description (≥20 chars) + ≥1 public price. */
export function isProfileComplete(company: {
  logoUrl?: string | null;
  description?: string | null;
  priceCount?: number;
}): boolean {
  const hasLogo = !!(company.logoUrl && String(company.logoUrl).trim());
  const hasDesc = !!(company.description && String(company.description).trim().length >= 20);
  const hasPrice = (company.priceCount ?? 0) > 0;
  return hasLogo && hasDesc && hasPrice;
}

/**
 * Resolve whether a feature is active for a company.
 * During beta: all features ON iff profile complete (unless explicitly false in features jsonb).
 * After beta: only ON if features[key] === true (or Destacada paid plan).
 */
export function featureOn(
  company: {
    features?: Record<string, boolean> | null;
    isFeatured?: boolean | null;
    featuredUntil?: Date | string | null;
    logoUrl?: string | null;
    description?: string | null;
    priceCount?: number;
    profileCompletedAt?: Date | string | null;
  },
  key: CompanyFeatureKey,
  now = new Date(),
): boolean {
  const flags = (company.features || {}) as Record<string, boolean>;
  if (flags[key] === false) return false;
  if (flags[key] === true) return true;

  const complete =
    company.profileCompletedAt != null ||
    isProfileComplete(company);

  if (isBetaPeriod(now)) {
    return complete;
  }

  // Post-beta: Destacada requires is_featured + valid until (or explicit flag)
  if (key === "destacada" || key === "featured_prices" || key === "suggested") {
    const until = company.featuredUntil ? new Date(company.featuredUntil as any) : null;
    return !!(company.isFeatured && (!until || until > now));
  }
  // wa_button + stats stay free after beta for any registered company
  return true;
}

export async function countCompanyPrices(companyId: number): Promise<number> {
  const r = rows(
    await db.execute(sql`
      select (
        (select count(*)::int from user_material_prices u
          where u.supplier_company_id = ${companyId} and u.is_public)
        + (select count(*)::int from material_supplier_prices m
          where m.supplier_id = ${companyId} and m.is_active)
        + (select count(*)::int from company_service_prices s
          where s.supplier_id = ${companyId} and s.is_active)
      ) as n`),
  );
  return Number(r[0]?.n || 0);
}

/** Recompute Destacada + profile_completed_at from current data. Call after logo/desc/price changes. */
export async function refreshCompanyFeatureState(companyId: number): Promise<{
  complete: boolean;
  destacada: boolean;
}> {
  const r = rows(
    await db.execute(sql`
      select id, logo_url as "logoUrl", description, features, is_featured as "isFeatured",
             featured_until as "featuredUntil", profile_completed_at as "profileCompletedAt"
      from supplier_companies where id = ${companyId} limit 1`),
  );
  const c = r[0];
  if (!c) return { complete: false, destacada: false };
  const priceCount = await countCompanyPrices(companyId);
  const complete = isProfileComplete({
    logoUrl: c.logoUrl,
    description: c.description,
    priceCount,
  });
  const destacada = featureOn({ ...c, priceCount, profileCompletedAt: complete ? c.profileCompletedAt || new Date() : null }, "destacada");

  await db.execute(sql`
    update supplier_companies set
      profile_completed_at = case
        when ${complete} then coalesce(profile_completed_at, now())
        else null
      end,
      is_featured = ${destacada},
      ad_plan = case when ${destacada} then coalesce(nullif(ad_plan,''), 'beta') else ad_plan end,
      featured_until = case
        when ${destacada} and ${isBetaPeriod()} then timestamptz '2027-01-31 23:59:59-04'
        when ${destacada} then featured_until
        else featured_until
      end,
      updated_at = now()
    where id = ${companyId}`);

  return { complete, destacada };
}

export function waMeLink(
  phoneNormalized: string | null | undefined,
  companyName: string,
  opts?: { materialName?: string; context?: string },
): string | null {
  const p = (phoneNormalized || "").replace(/\D/g, "");
  if (!/^591[67]\d{7}$/.test(p)) return null;
  const parts = [
    `Hola ${companyName}, te contacto desde MICAA (micaa.site).`,
  ];
  if (opts?.materialName) parts.push(`Consulto por: ${opts.materialName}.`);
  if (opts?.context) parts.push(opts.context);
  parts.push("¿Me podés ayudar?");
  const text = encodeURIComponent(parts.join(" "));
  return `https://wa.me/${p}?text=${text}`;
}

/** Boot-time additive ensure (safe if migration already applied). */
export async function ensureCompanyProfileSchema(): Promise<void> {
  try {
    await db.execute(sql`
      ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS email text;
      ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS instagram text;
      ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS opening_hours text;
      ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS delivery_info text;
      ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS nit text;
      ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS products_services text;
      ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS logo_format text;
      ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS logo_thumb_url text;
      ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS logo_quality_warn boolean DEFAULT false;
      ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS wa_price_reminders boolean DEFAULT true;
      ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS last_price_reminder_at timestamptz;
      ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS profile_completed_at timestamptz;
      ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS features jsonb DEFAULT '{}'::jsonb;
    `);
  } catch (e: any) {
    // Some drivers reject multi-statement; fall back one-by-one
    const stmts = [
      `ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS email text`,
      `ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS instagram text`,
      `ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS opening_hours text`,
      `ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS delivery_info text`,
      `ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS nit text`,
      `ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS products_services text`,
      `ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS logo_format text`,
      `ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS logo_thumb_url text`,
      `ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS logo_quality_warn boolean DEFAULT false`,
      `ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS wa_price_reminders boolean DEFAULT true`,
      `ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS last_price_reminder_at timestamptz`,
      `ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS profile_completed_at timestamptz`,
      `ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS features jsonb DEFAULT '{}'::jsonb`,
    ];
    for (const s of stmts) {
      try {
        await db.execute(sql.raw(s));
      } catch (err: any) {
        console.warn("[company-features] ensure skip:", err?.message || err);
      }
    }
  }
}

/** Ensure claim/contacts columns exist (additive). */
export async function ensureCompanyClaimSchema(): Promise<void> {
  const stmts = [
    `ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS claim_status text`,
    `ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS claimed_at timestamptz`,
    `ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS claimed_by_user_id integer`,
    `ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS contacts jsonb DEFAULT '[]'::jsonb`,
    `ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS micaa_created boolean DEFAULT false`,
    `ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS pending_owner_phone text`,
    `ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS pending_owner_phone_at timestamptz`,
    `ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS pending_owner_phone_from text`,
  ];
  for (const s of stmts) {
    try {
      await db.execute(sql.raw(s));
    } catch (err: any) {
      console.warn("[company-features] claim ensure skip:", err?.message || err);
    }
  }
}
