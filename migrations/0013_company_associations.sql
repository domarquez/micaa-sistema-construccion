-- Gremio / asociación badges for supplier companies (e.g. Asociado CADECOCRUZ).
-- Additive only. No drops, no overwrites of existing data.

ALTER TABLE supplier_companies
  ADD COLUMN IF NOT EXISTS associations text[];

COMMENT ON COLUMN supplier_companies.associations IS
  'Membership / gremio badges (e.g. Asociado CADECOCRUZ). Multi. Additive only.';
