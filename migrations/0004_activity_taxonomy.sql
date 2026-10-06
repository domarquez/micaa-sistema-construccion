-- MICAA · Taxonomía de actividades: orden y estado de fases, familias/subfamilias, orden/sinónimos/estado de actividades.
-- Migración 100 % ADITIVA e idempotente (IF NOT EXISTS). No borra ni modifica datos existentes.
-- NO usar `npm run db:push`. Aplicar en Neon ANTES de desplegar el código que la usa
-- (script: /workspace/micaa-scripts/fases-audit/apply-0004.ts, o psql "$DATABASE_URL" -f migrations/0004_activity_taxonomy.sql).

BEGIN;

-- 1) Fases: slug, orden constructivo y estado (las fases antiguas se desactivan, nunca se borran:
--    budget_items / budgets / plantillas las siguen referenciando).
ALTER TABLE construction_phases ADD COLUMN IF NOT EXISTS slug text NULL;
ALTER TABLE construction_phases ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE construction_phases ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
CREATE UNIQUE INDEX IF NOT EXISTS construction_phases_slug_uq ON construction_phases (slug) WHERE slug IS NOT NULL;

-- 2) Familias por fase (parent_id = subfamilia; se usa para agrupar variantes: «Ver variantes»)
CREATE TABLE IF NOT EXISTS activity_families (
  id          serial PRIMARY KEY,
  phase_id    integer NOT NULL REFERENCES construction_phases(id),
  parent_id   integer NULL REFERENCES activity_families(id),
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamp DEFAULT now(),
  updated_at  timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activity_families_phase_idx ON activity_families (phase_id, sort_order);
CREATE INDEX IF NOT EXISTS activity_families_parent_idx ON activity_families (parent_id);

-- 3) Actividades: familia, orden dentro de la familia, sinónimos de búsqueda y estado (soft-deactivate).
--    replaced_by_id: sobreviviente cuando la actividad se desactiva por duplicada (las referencias se remapean a él).
ALTER TABLE activities ADD COLUMN IF NOT EXISTS family_id integer NULL REFERENCES activity_families(id);
ALTER TABLE activities ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS synonyms text NULL;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS replaced_by_id integer NULL REFERENCES activities(id);
CREATE INDEX IF NOT EXISTS activities_family_idx ON activities (family_id, sort_order);
CREATE INDEX IF NOT EXISTS activities_phase_active_idx ON activities (phase_id) WHERE is_active;

COMMIT;
