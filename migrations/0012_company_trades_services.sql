-- Two-level trades (materiales + servicios) and priced services for companies.
-- Additive only. No drops, no overwrites of existing prices/names/phones.

-- Free-text extras when company picks "otro_servicio"
ALTER TABLE supplier_companies
  ADD COLUMN IF NOT EXISTS custom_trades text[];

COMMENT ON COLUMN supplier_companies.custom_trades IS
  'Free-text service trades when slug otro_servicio is selected (multi).';

COMMENT ON COLUMN supplier_companies.categories IS
  'Trade slugs (materiales + servicios). Multi-select. speciality kept as primary (categories[1]).';

-- Priced services (router per m², hour rates, etc.) — parallel to material prices
CREATE TABLE IF NOT EXISTS company_service_prices (
  id serial PRIMARY KEY,
  supplier_id integer NOT NULL REFERENCES supplier_companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit text,
  price numeric(12, 4) NOT NULL,
  currency text NOT NULL DEFAULT 'BOB',
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_service_prices_supplier_idx
  ON company_service_prices (supplier_id)
  WHERE is_active;

COMMENT ON TABLE company_service_prices IS
  'Free-text priced services for service-trade companies (e.g. corte router Bs/m²).';
