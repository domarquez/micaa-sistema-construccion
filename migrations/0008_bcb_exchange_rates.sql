-- Tipo de cambio oficial BCB (TCO) diario. Aditivo, idempotente. NO usar db:push.
-- Fuente: https://www.bcb.gob.bo/bcb_tco_publico_ultima_cotizacion.php

CREATE TABLE IF NOT EXISTS exchange_rates (
  id bigserial PRIMARY KEY,
  rate_date date NOT NULL,
  rate numeric(12, 4) NOT NULL,
  source text NOT NULL DEFAULT 'bcb_tco',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exchange_rates_rate_date_unique UNIQUE (rate_date)
);

CREATE INDEX IF NOT EXISTS exchange_rates_fetched_at_idx ON exchange_rates (fetched_at DESC);

-- Provenance FX en cotizaciones WhatsApp (precio guardado siempre en BOB).
ALTER TABLE user_material_prices
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'BOB';
ALTER TABLE user_material_prices
  ADD COLUMN IF NOT EXISTS original_currency text;
ALTER TABLE user_material_prices
  ADD COLUMN IF NOT EXISTS original_amount numeric(14, 4);
ALTER TABLE user_material_prices
  ADD COLUMN IF NOT EXISTS fx_rate numeric(12, 4);
