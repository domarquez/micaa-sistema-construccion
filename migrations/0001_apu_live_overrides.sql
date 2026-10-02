-- MICAA · APU en vivo + overrides de precio por proyecto/ítem
-- Migración 100 % ADITIVA e idempotente (IF NOT EXISTS). No borra ni modifica datos.
-- NO usar `npm run db:push` (drizzle-kit quiere borrar columnas que no están en schema.ts, p.ej. users.email_verified).
-- Aplicar manualmente en Neon:  psql "$DATABASE_URL" -f migrations/0001_apu_live_overrides.sql
-- El código funciona ANTES de aplicarla (sin overrides, sin waste_pct, sin snapshot) y las activa al detectarlas.

BEGIN;

-- 1) Composiciones: desperdicio por fila y fuente del rendimiento
ALTER TABLE activity_compositions ADD COLUMN IF NOT EXISTS waste_pct numeric(6,2) NULL;   -- % (5 = 5 %); NULL = 0
ALTER TABLE activity_compositions ADD COLUMN IF NOT EXISTS source_ref text NULL;          -- "CAPECO …", URL Insucons/CYPE…

-- 2) Snapshot del APU con el que se preció cada ítem
ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS apu_snapshot jsonb NULL;
ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS apu_computed_at timestamp NULL;

-- 3) Overrides de precio por proyecto (budget_item_id NULL) o por ítem
CREATE TABLE IF NOT EXISTS project_price_overrides (
  id                serial PRIMARY KEY,
  project_id        integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  budget_item_id    integer NULL REFERENCES budget_items(id) ON DELETE CASCADE,
  input_type        text NOT NULL CHECK (input_type IN ('material','labor','equipment')),
  input_id          integer NOT NULL,
  source            text NOT NULL CHECK (source IN ('base','quote','market','manual')),
  quote_id          integer NULL REFERENCES user_material_prices(id) ON DELETE SET NULL,
  supplier_price_id integer NULL REFERENCES material_supplier_prices(id) ON DELETE SET NULL,
  manual_price      numeric(12,4) NULL CHECK (manual_price IS NULL OR manual_price >= 0),
  created_by        integer NULL REFERENCES users(id),
  created_at        timestamp DEFAULT now(),
  updated_at        timestamp DEFAULT now(),
  CONSTRAINT project_price_overrides_manual_chk CHECK (source <> 'manual' OR manual_price IS NOT NULL)
);

-- Único por (proyecto, ítem|NULL, tipo, insumo): NULL se trata como "proyecto"
CREATE UNIQUE INDEX IF NOT EXISTS project_price_overrides_uniq
  ON project_price_overrides (project_id, COALESCE(budget_item_id, 0), input_type, input_id);
CREATE INDEX IF NOT EXISTS project_price_overrides_item_idx
  ON project_price_overrides (budget_item_id) WHERE budget_item_id IS NOT NULL;

COMMIT;

-- Rollback (solo si hiciera falta; también aditivo-reversible):
-- DROP TABLE IF EXISTS project_price_overrides;
-- ALTER TABLE budget_items DROP COLUMN IF EXISTS apu_snapshot, DROP COLUMN IF EXISTS apu_computed_at;
-- ALTER TABLE activity_compositions DROP COLUMN IF EXISTS waste_pct, DROP COLUMN IF EXISTS source_ref;
