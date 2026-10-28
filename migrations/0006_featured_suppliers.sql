-- Destacados / planes de publicidad en la guía (aditivo, idempotente). NO usar db:push.
ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;
ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS featured_until timestamp;
ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS ad_plan text;
-- ad_plan: free | destacado | material | banner (nullable = free)
