-- MICAA · Login por WhatsApp (código de 6 dígitos) + dispositivos recordados
-- Migración 100 % ADITIVA e idempotente (IF NOT EXISTS). No borra ni modifica datos existentes.
-- NO usar `npm run db:push`.
-- Aplicar manualmente en Neon:  psql "$DATABASE_URL" -f migrations/0002_wa_otp_login.sql
-- Antes de aplicarla: el login viejo (usuario + contraseña) sigue funcionando igual; las rutas /api/auth/wa/* responden 500.

BEGIN;

-- 1) users.phone: único y nullable (E.164, p.ej. +59171234567).
--    En producción la columna ya existe (todas NULL, sin índice único); esto la crea si falta y agrega el índice.
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique ON users (phone);

-- 2) Códigos OTP (hasheados con HMAC-SHA256; nunca en claro)
CREATE TABLE IF NOT EXISTS auth_otp_codes (
  id                  serial PRIMARY KEY,
  phone               text NOT NULL,
  code_hash           text NOT NULL,
  purpose             text NOT NULL DEFAULT 'login' CHECK (purpose IN ('login','link')),
  channel             text NOT NULL DEFAULT 'outbound' CHECK (channel IN ('outbound','inbound')),
  user_id             integer NULL REFERENCES users(id) ON DELETE CASCADE,
  request_ip          text NULL,
  attempts            integer NOT NULL DEFAULT 0,
  max_attempts        integer NOT NULL DEFAULT 5,
  send_status         text NOT NULL DEFAULT 'pending' CHECK (send_status IN ('pending','sent','failed')),
  provider_message_id text NULL,
  expires_at          timestamptz NOT NULL,
  consumed_at         timestamptz NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_otp_codes_phone_created_idx ON auth_otp_codes (phone, created_at DESC);
CREATE INDEX IF NOT EXISTS auth_otp_codes_ip_created_idx ON auth_otp_codes (request_ip, created_at DESC) WHERE request_ip IS NOT NULL;

-- 3) Dispositivos recordados (sesión 1 año, deslizante; cookie httpOnly guarda el token, aquí solo su sha256)
CREATE TABLE IF NOT EXISTS user_sessions (
  id            text PRIMARY KEY,
  user_id       integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    text NOT NULL UNIQUE,
  device_name   text NULL,
  user_agent    text NULL,
  ip            text NULL,
  auth_method   text NOT NULL DEFAULT 'whatsapp',
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz NULL
);
CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON user_sessions (user_id, last_seen_at DESC);

COMMIT;

-- Limpieza opcional (no necesaria para funcionar), p.ej. en un cron semanal:
--   DELETE FROM auth_otp_codes WHERE created_at < now() - interval '7 days';
