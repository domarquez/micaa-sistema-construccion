-- Claim flow for MICAA-seeded company profiles (additive).
ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS claim_status text;
  -- null | pending_claim | claimed
ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS claimed_by_user_id integer;
ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS contacts jsonb DEFAULT '[]'::jsonb;
  -- [{phone, name?, role: 'sales'|'owner'|'marketing'|'other', isPrimary?: bool}]
ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS micaa_created boolean DEFAULT false;

COMMENT ON COLUMN supplier_companies.claim_status IS
  'pending_claim = created/marked by MICAA awaiting WhatsApp OTP claim; claimed = owner took over';
