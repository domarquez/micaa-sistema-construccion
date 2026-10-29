-- Pending responsible-person WhatsApp (from company reply or admin), awaiting admin approval.
ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS pending_owner_phone text;
ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS pending_owner_phone_at timestamptz;
ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS pending_owner_phone_from text; -- 'whatsapp_reply' | 'admin'
