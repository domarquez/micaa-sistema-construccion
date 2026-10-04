/**
 * Webhook de Evolution API (evento messages.upsert) para el flujo "Abrir WhatsApp":
 * el usuario manda "Quiero mi código MICAA" al número de la instancia y respondemos con su código.
 * Ignora grupos, canales, estados, mensajes propios y mensajes viejos (re-sync al reconectar).
 */
import { createHash, timingSafeEqual } from "crypto";
import { normalizePhoneE164 } from "./phone";
import { refFromText } from "./login-refs";

export const LOGIN_REQUEST_TEXT = "Quiero mi código MICAA";
const MAX_AGE_S = 10 * 60;

export function isLoginRequestText(text: string): boolean {
  const t = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  return /\bquiero (mi |el |un )?codigo (de )?micaa\b/.test(t);
}

function textOf(m: any): string {
  const msg = m?.message || {};
  if (typeof msg.conversation === "string") return msg.conversation;
  if (msg.extendedTextMessage?.text) return String(msg.extendedTextMessage.text);
  return "";
}

function pickMessages(payload: any): any[] {
  const data = payload?.data ?? payload;
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.messages)) return data.messages;
  if (data.key || data.message) return [data];
  return [];
}

/** Teléfono E.164 del remitente de un chat 1:1 (soporta direccionamiento LID de WhatsApp). */
export function senderPhone(m: any): string | null {
  const key = m?.key || {};
  const candidates = [key.remoteJid, key.remoteJidAlt, key.senderPn, m?.senderPn, key.participantAlt];
  for (const c of candidates) {
    if (typeof c === "string" && c.endsWith("@s.whatsapp.net")) {
      const p = normalizePhoneE164("+" + c.replace(/@.*$/, "").replace(/:\d+$/, ""));
      if (p) return p;
    }
  }
  return null;
}

export type InboundLoginRequest = { phone: string; messageId: string | null; ref: string | null };

export function extractLoginRequests(payload: any, opts: { instance?: string; nowS?: number } = {}): { requests: InboundLoginRequest[]; skipped: string[] } {
  const skipped: string[] = [];
  const event = String(payload?.event || "").toLowerCase().replace(/_/g, ".");
  if (event && event !== "messages.upsert") return { requests: [], skipped: ["event:" + event] };
  if (opts.instance && payload?.instance && payload.instance !== opts.instance) return { requests: [], skipped: ["other_instance"] };
  const nowS = opts.nowS ?? Math.floor(Date.now() / 1000);
  const requests: InboundLoginRequest[] = [];
  for (const m of pickMessages(payload)) {
    const key = m?.key || {};
    const jid = String(key.remoteJid || "");
    if (key.fromMe === true) { skipped.push("from_me"); continue; }
    if (/@g\.us$|@newsletter$|@broadcast$/.test(jid)) { skipped.push("not_dm"); continue; }
    const ts = Number(m?.messageTimestamp || 0);
    if (ts && nowS - ts > MAX_AGE_S) { skipped.push("old"); continue; }
    const text = textOf(m);
    if (!isLoginRequestText(text)) { skipped.push("other_text"); continue; }
    const phone = senderPhone(m);
    if (!phone) { skipped.push("no_phone"); continue; }
    requests.push({ phone, messageId: key.id ? String(key.id) : null, ref: refFromText(text) });
  }
  return { requests, skipped };
}

export function webhookTokenOk(given: unknown, expected: string | undefined): boolean {
  if (!expected) return false;
  if (typeof given !== "string" || !given) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
