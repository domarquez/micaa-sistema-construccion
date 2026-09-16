-- Railway / Neon: run once before using POST /api/ingest/whatsapp-price
CREATE TABLE IF NOT EXISTS price_ingest_keys (
  idempotency_key text PRIMARY KEY,
  quote_id integer,
  payload_hash text,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS price_ingest_keys_quote_id_idx
  ON price_ingest_keys (quote_id);

CREATE INDEX IF NOT EXISTS price_ingest_keys_created_at_idx
  ON price_ingest_keys (created_at);
