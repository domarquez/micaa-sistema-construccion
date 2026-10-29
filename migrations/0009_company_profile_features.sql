-- Company profile enrichment + feature flags (beta free until 2027-01-31).
-- Additive only. Never overwrites materials.price.

ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS instagram text;
ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS opening_hours text;
ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS delivery_info text;
ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS nit text;
ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS products_services text;
ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS logo_format text; -- square | wide
ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS logo_thumb_url text;
ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS logo_quality_warn boolean DEFAULT false;
ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS wa_price_reminders boolean DEFAULT true;
ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS last_price_reminder_at timestamptz;
ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS profile_completed_at timestamptz;
-- Feature flags / plan: jsonb so we can flip individual features when charging starts Feb 2027.
-- During beta every feature is on for companies that meet Destacada criteria.
ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS features jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN supplier_companies.features IS
  'Plan/feature flags: {destacada, featured_prices, wa_button, stats, suggested}. Empty/default = beta (all on when profile complete).';
