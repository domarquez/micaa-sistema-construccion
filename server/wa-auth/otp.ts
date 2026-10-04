/**
 * Códigos de 6 dígitos por WhatsApp: emisión con límites anti-bloqueo y verificación.
 * - Guardado como HMAC-SHA256(pepper, phone|code); comparación en tiempo constante.
 * - Caduca a los 5 min, 5 intentos por código, un solo código vigente por número.
 * - Límites de envío: 3/número/hora, 10/IP/hora, cooldown 60 s por número.
 * - Logs: nunca el código; teléfono enmascarado.
 */
import { createHmac, randomInt, timingSafeEqual } from "crypto";
import type { OtpChannel, OtpPurpose, OtpStore } from "./types";
import type { WaSender } from "./evolution";
import { maskPhone } from "./phone";

export const OTP_TTL_MS = 5 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_COOLDOWN_MS = 60_000;
export const OTP_MAX_PER_PHONE_HOUR = 3;
export const OTP_MAX_PER_IP_HOUR = 10;

export function otpMessage(code: string): string {
  return `Tu código MICAA es ${code}. Vence en 5 minutos. Si no lo pediste, ignóralo.`;
}

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function pepper(): string {
  const p = process.env.OTP_PEPPER || process.env.JWT_SECRET;
  if (!p) throw new Error("OTP_PEPPER o JWT_SECRET requerido");
  return p;
}

export function hashCode(phone: string, code: string): string {
  return createHmac("sha256", pepper()).update(`${phone}|${code}`).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ba.length !== bb.length || ba.length === 0) {
    // Mantener tiempo similar aunque las longitudes difieran
    timingSafeEqual(ba.length ? ba : Buffer.alloc(32), ba.length ? ba : Buffer.alloc(32));
    return false;
  }
  return timingSafeEqual(ba, bb);
}

export type IssueResult =
  | { ok: true; otpId: number }
  | { ok: false; reason: "cooldown" | "phone_limit" | "ip_limit"; retryAfterSeconds: number }
  | { ok: false; reason: "send_failed"; error: string };

export interface OtpService {
  issue(opts: { phone: string; ip: string | null; purpose: OtpPurpose; channel: OtpChannel; userId?: number | null }): Promise<IssueResult>;
  verify(phone: string, code: string): Promise<{ ok: true; otpId: number } | { ok: false; reason: "invalid" | "too_many_attempts" }>;
}

export function createOtpService(deps: { store: OtpStore; sender: WaSender; now?: () => Date; log?: (msg: string) => void }): OtpService {
  const now = deps.now || (() => new Date());
  const log = deps.log || ((m: string) => console.log(m));

  return {
    async issue({ phone, ip, purpose, channel, userId = null }) {
      const t = now();
      const hourAgo = new Date(t.getTime() - 3600_000);

      const last = await deps.store.lastCreatedAt(phone);
      if (last && t.getTime() - last.getTime() < OTP_COOLDOWN_MS) {
        return { ok: false, reason: "cooldown", retryAfterSeconds: Math.ceil((OTP_COOLDOWN_MS - (t.getTime() - last.getTime())) / 1000) };
      }
      if (ip && (await deps.store.countByIpSince(ip, hourAgo)) >= OTP_MAX_PER_IP_HOUR) {
        return { ok: false, reason: "ip_limit", retryAfterSeconds: 3600 };
      }
      if ((await deps.store.countByPhoneSince(phone, hourAgo)) >= OTP_MAX_PER_PHONE_HOUR) {
        return { ok: false, reason: "phone_limit", retryAfterSeconds: 3600 };
      }

      const code = generateCode();
      await deps.store.supersedeActive(phone, t);
      const otpId = await deps.store.insert({
        phone, codeHash: hashCode(phone, code), purpose, channel, userId, requestIp: ip,
        maxAttempts: OTP_MAX_ATTEMPTS, expiresAt: new Date(t.getTime() + OTP_TTL_MS), createdAt: t,
      });
      try {
        const r = await deps.sender.sendText(phone, otpMessage(code));
        await deps.store.markSend(otpId, "sent", r.messageId);
        log(`[wa-auth] código enviado otp=${otpId} to=${maskPhone(phone)} via=${channel}`);
        return { ok: true, otpId };
      } catch (e: any) {
        await deps.store.markSend(otpId, "failed");
        log(`[wa-auth] fallo envío otp=${otpId} to=${maskPhone(phone)}: ${e?.message || e}`);
        return { ok: false, reason: "send_failed", error: String(e?.message || e) };
      }
    },

    async verify(phone, code) {
      const t = now();
      const row = await deps.store.findActive(phone, t);
      const expected = row ? row.codeHash : hashCode("0", "000000"); // trabajo constante aunque no haya código
      const given = /^\d{6}$/.test(code) ? hashCode(phone, code) : hashCode("x", "x");
      if (!row) {
        safeEqualHex(expected, given);
        return { ok: false, reason: "invalid" };
      }
      const attempts = await deps.store.incrementAttempts(row.id);
      if (attempts === null) return { ok: false, reason: "too_many_attempts" };
      if (!safeEqualHex(expected, given)) {
        return { ok: false, reason: attempts >= row.maxAttempts ? "too_many_attempts" : "invalid" };
      }
      if (!(await deps.store.consume(row.id, t))) return { ok: false, reason: "invalid" };
      log(`[wa-auth] código verificado otp=${row.id} to=${maskPhone(phone)}`);
      return { ok: true, otpId: row.id };
    },
  };
}
