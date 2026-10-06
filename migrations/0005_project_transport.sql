-- MICAA · Transporte y movilización por distancia
-- Migración 100 % ADITIVA e idempotente. No borra ni modifica datos existentes.
-- NO usar `npm run db:push`. Aplicar con: npx tsx scripts/apply-migration-0005.ts --apply
-- Proyectos existentes quedan con extra_km NULL → recargo 0.

BEGIN;

-- 1) Ubicación y distancia del proyecto
ALTER TABLE projects ADD COLUMN IF NOT EXISTS latitude numeric(9,6) NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS longitude numeric(9,6) NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS distance_km numeric(7,2) NULL;      -- por calle desde el km cero (plaza)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS extra_km numeric(7,2) NULL;         -- max(0, distancia − radio km cero)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS transport_method text NULL;         -- osrm | straight_x1.3 | preset | manual | none
ALTER TABLE projects ADD COLUMN IF NOT EXISTS transport_zone text NULL;           -- clave de zona (si method = preset)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS geo_source text NULL;               -- nominatim | pin
ALTER TABLE projects ADD COLUMN IF NOT EXISTS geocoded_address text NULL;         -- display_name devuelto por Nominatim
ALTER TABLE projects ADD COLUMN IF NOT EXISTS geocoded_query text NULL;           -- "dirección|ciudad" usada (detecta cambios)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS transport_updated_at timestamp NULL;

-- 2) Línea "Transporte y movilización" del presupuesto (snapshot de parámetros)
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS transport_cost numeric(12,2) NULL;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS transport_snapshot jsonb NULL;

-- 3) Caché persistente de geocodificación (Nominatim)
CREATE TABLE IF NOT EXISTS geocode_cache (
  query        text PRIMARY KEY,
  latitude     numeric(9,6) NULL,           -- NULL = sin resultado (caché negativa)
  longitude    numeric(9,6) NULL,
  display_name text NULL,
  provider     text NOT NULL DEFAULT 'nominatim',
  created_at   timestamp NOT NULL DEFAULT now()
);

COMMIT;
