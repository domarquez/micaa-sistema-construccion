-- MICAA · Plantillas de proyecto predeterminadas
-- Migración 100 % ADITIVA e idempotente (IF NOT EXISTS). No borra ni modifica datos existentes.
-- NO usar `npm run db:push`. Aplicar manualmente en Neon:
--   psql "$DATABASE_URL" -f migrations/0003_project_templates.sql
-- (0002 está reservada por migrations/0002_wa_otp_login.sql de feat/wa-otp-login.)
-- El código funciona ANTES de aplicarla: /api/project-templates responde { available: false }.

BEGIN;

-- 1) Cabecera de plantilla (parámetros escalables + flag premium)
CREATE TABLE IF NOT EXISTS project_templates (
  id                   serial PRIMARY KEY,
  slug                 text NOT NULL UNIQUE,
  name                 text NOT NULL,
  category             text NOT NULL,
  description          text,
  cover_image_url      text,
  unit_ref             text NOT NULL DEFAULT 'm2',
  ref_quantity_formula text NOT NULL DEFAULT '1',
  params_schema        jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {A:{default,min,max,unit,label}, …}
  derived              jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{name,expr,label}] en orden de evaluación
  default_city         text NOT NULL DEFAULT 'Santa Cruz',
  is_premium           boolean NOT NULL DEFAULT false,
  price_bs             numeric(10,2) NULL,
  is_active            boolean NOT NULL DEFAULT false,        -- el seed solo activa plantillas sin actividades faltantes
  inactive_reason      text NULL,
  version              integer NOT NULL DEFAULT 1,
  sort_order           integer NOT NULL DEFAULT 0,
  created_by           integer NULL REFERENCES users(id),
  created_at           timestamp DEFAULT now(),
  updated_at           timestamp DEFAULT now()
);

-- 2) Líneas: actividad + fórmula de cantidad
CREATE TABLE IF NOT EXISTS project_template_items (
  id               serial PRIMARY KEY,
  template_id      integer NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE,
  phase_id         integer NOT NULL REFERENCES construction_phases(id),
  activity_id      integer NULL REFERENCES activities(id),     -- NULL mientras la actividad sea "faltante"
  missing_key      text NULL,                                   -- p.ej. 'F_TOMA', 'C36'
  missing_name     text NULL,
  quantity_formula text NOT NULL,
  default_quantity numeric(12,3) NOT NULL DEFAULT 0,
  breakdown        text NULL,
  is_optional      boolean NOT NULL DEFAULT false,
  sort_order       integer NOT NULL DEFAULT 0,
  CONSTRAINT project_template_items_activity_or_missing CHECK (activity_id IS NOT NULL OR missing_key IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS project_template_items_template_idx ON project_template_items (template_id, sort_order);

-- 3) Trazabilidad del proyecto creado desde plantilla (nullable: no afecta proyectos existentes)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS template_id integer NULL REFERENCES project_templates(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS template_params jsonb NULL;

-- 4) Derechos de uso (para cobrar más adelante). template_id NULL = todas las plantillas (plan).
CREATE TABLE IF NOT EXISTS user_template_entitlements (
  id          serial PRIMARY KEY,
  user_id     integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id integer NULL REFERENCES project_templates(id) ON DELETE CASCADE,
  source      text NOT NULL DEFAULT 'purchase' CHECK (source IN ('purchase','plan','promo','admin')),
  expires_at  timestamp NULL,
  created_at  timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_template_entitlements_uniq
  ON user_template_entitlements (user_id, COALESCE(template_id, 0));

-- 5) Flag global premium APAGADO: con 'false' todas las plantillas son gratis aunque is_premium = true
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES ('templates_premium_enabled', 'false', 'Si es true, las plantillas con is_premium requieren entitlement (user_template_entitlements)')
ON CONFLICT (setting_key) DO NOTHING;

COMMIT;

-- Rollback (solo si hiciera falta):
-- DELETE FROM system_settings WHERE setting_key = 'templates_premium_enabled';
-- ALTER TABLE projects DROP COLUMN IF EXISTS template_params, DROP COLUMN IF EXISTS template_id;
-- DROP TABLE IF EXISTS user_template_entitlements;
-- DROP TABLE IF EXISTS project_template_items;
-- DROP TABLE IF EXISTS project_templates;
