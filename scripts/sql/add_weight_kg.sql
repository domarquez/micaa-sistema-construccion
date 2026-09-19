-- Railway / Neon: run once — additive weight_kg (kg por unidad de venta)
-- Does NOT touch materials.price or rebase formulas.

ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS weight_kg numeric(12, 4);

ALTER TABLE user_material_prices
  ADD COLUMN IF NOT EXISTS weight_kg numeric(12, 4);

COMMENT ON COLUMN materials.weight_kg IS
  'Weight in kg per sales unit (nullable; fill-only from ingest)';
COMMENT ON COLUMN user_material_prices.weight_kg IS
  'Weight in kg per sales unit reported on quote (nullable)';
