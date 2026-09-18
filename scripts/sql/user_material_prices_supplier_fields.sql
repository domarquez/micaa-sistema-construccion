-- Railway / Neon: run once — additive provenance fields for WA/market quotes
-- Does NOT touch materials.price or rebase formulas.

ALTER TABLE user_material_prices
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ADD COLUMN IF NOT EXISTS supplier_phone text;

COMMENT ON COLUMN user_material_prices.supplier_name IS
  'Supplier/company display name from WA/market ingest (nullable)';
COMMENT ON COLUMN user_material_prices.supplier_phone IS
  'Supplier phone from WA/market ingest (nullable)';
