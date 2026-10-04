/**
 * Referencias cortas del flujo "Abrir WhatsApp".
 *
 * El navegador pide una ref (POST /api/auth/wa/start) y la manda dentro del texto prellenado
 * ("Quiero mi código MICAA (ref K7P2Q)"). Cuando llega el mensaje, el webhook asocia la ref al número
 * REAL del remitente. Así, si el usuario escribió un número en el formulario pero mandó el mensaje desde
 * otro WhatsApp (otra cuenta, WhatsApp Business, PC vinculada a otro número…), el verify sabe a qué número
 * se envió el código en lugar de responder "incorrecto o vencido" (bug 2026-10-04).
 *
 * En memoria (TTL 15 min): si el server se reinicia, se pierde la ref y el flujo vuelve al comportamiento
 * anterior (verifica contra el número escrito).
 */
import { randomInt } from "crypto";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I/L
export const REF_LEN = 5;
export const REF_TTL_MS = 15 * 60_000;
const MAX_REFS = 20_000;

export interface LoginRefStore {
  create(now: Date): string;
  /** Asocia la ref al remitente. Solo refs emitidas por el server, vigentes y sin remitente previo. */
  bind(ref: string, phone: string, now: Date): boolean;
  senderOf(ref: string, now: Date): string | null;
}

export function normalizeRef(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const r = v.trim().toUpperCase();
  return new RegExp(`^[${ALPHABET}]{${REF_LEN}}$`).test(r) ? r : null;
}

/** Busca "ref XXXXX" en el texto del mensaje. */
export function refFromText(text: string): string | null {
  const m = /\bref\s*[:#]?\s*([A-Za-z0-9]{5})\b/i.exec(text || "");
  return m ? normalizeRef(m[1]) : null;
}

export function createMemoryRefStore(): LoginRefStore {
  const refs = new Map<string, { at: number; phone: string | null }>();
  const prune = (t: number) => {
    refs.forEach((v, k) => { if (t - v.at > REF_TTL_MS) refs.delete(k); });
    while (refs.size > MAX_REFS) refs.delete(refs.keys().next().value!);
  };
  return {
    create(now) {
      const t = now.getTime();
      if (refs.size > MAX_REFS / 2) prune(t);
      let ref = "";
      do {
        ref = Array.from({ length: REF_LEN }, () => ALPHABET[randomInt(0, ALPHABET.length)]).join("");
      } while (refs.has(ref));
      refs.set(ref, { at: t, phone: null });
      return ref;
    },
    bind(ref, phone, now) {
      const e = refs.get(ref);
      if (!e || now.getTime() - e.at > REF_TTL_MS || e.phone) return false;
      e.phone = phone;
      return true;
    },
    senderOf(ref, now) {
      const e = refs.get(ref);
      if (!e || now.getTime() - e.at > REF_TTL_MS) return null;
      return e.phone;
    },
  };
}
