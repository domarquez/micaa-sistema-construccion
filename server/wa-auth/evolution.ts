/**
 * Cliente mínimo de Evolution API v2 (misma instancia que usa el agente EXTRACTOR: `precios-ferreterias`).
 * Variables (mismos nombres que ya usa time-tracker-app en Railway):
 *   EVOLUTION_BASE_URL  (alias aceptado: EVOLUTION_API_URL)
 *   EVOLUTION_API_KEY
 *   EVOLUTION_INSTANCE  (default: precios-ferreterias)
 *   MICAA_WA_LOGIN_NUMBER (opcional; número público de la instancia para el link wa.me. Si falta se consulta a Evolution)
 * Nunca se loguea el texto del mensaje (contiene el código).
 */
import { e164ToDigits, normalizePhoneE164 } from "./phone";

export interface WaSender {
  /** Envía un texto. Lanza Error si Evolution falla. */
  sendText(toE164: string, text: string): Promise<{ messageId?: string }>;
  /** Número E.164 de la instancia (para wa.me) o null si no se pudo determinar. */
  getInstanceNumber(): Promise<string | null>;
  isConfigured(): boolean;
}

export class EvolutionError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "EvolutionError";
  }
}

export function evolutionConfig() {
  const baseUrl = (process.env.EVOLUTION_BASE_URL || process.env.EVOLUTION_API_URL || "").trim().replace(/\/+$/, "");
  const apiKey = (process.env.EVOLUTION_API_KEY || "").trim();
  const instance = (process.env.EVOLUTION_INSTANCE || "precios-ferreterias").trim();
  return { baseUrl, apiKey, instance };
}

export function createEvolutionSender(fetchImpl: typeof fetch = fetch): WaSender {
  let cachedNumber: string | null | undefined;
  let cachedAt = 0;

  return {
    isConfigured() {
      const c = evolutionConfig();
      return !!(c.baseUrl && c.apiKey && c.instance);
    },

    async sendText(toE164, text) {
      const { baseUrl, apiKey, instance } = evolutionConfig();
      if (!baseUrl || !apiKey) throw new EvolutionError("Evolution API no configurada");
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10_000);
      try {
        const r = await fetchImpl(`${baseUrl}/message/sendText/${encodeURIComponent(instance)}`, {
          method: "POST",
          headers: { apikey: apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ number: e164ToDigits(toE164), text, linkPreview: false }),
          signal: ctrl.signal,
        });
        if (!r.ok) {
          // No incluimos el cuerpo de la petición (tiene el código) en el error.
          let detail = "";
          try { detail = (await r.text()).slice(0, 200); } catch {}
          throw new EvolutionError(`Evolution respondió ${r.status}${detail ? `: ${detail}` : ""}`, r.status);
        }
        let messageId: string | undefined;
        try {
          const j: any = await r.json();
          messageId = j?.key?.id;
        } catch {}
        return { messageId };
      } catch (e: any) {
        if (e instanceof EvolutionError) throw e;
        throw new EvolutionError(e?.name === "AbortError" ? "Evolution no respondió (timeout)" : `Error de red con Evolution: ${e?.message || e}`);
      } finally {
        clearTimeout(t);
      }
    },

    async getInstanceNumber() {
      const fromEnv = normalizePhoneE164(process.env.MICAA_WA_LOGIN_NUMBER || "");
      if (fromEnv) return fromEnv;
      if (cachedNumber !== undefined && Date.now() - cachedAt < 6 * 3600_000) return cachedNumber;
      const { baseUrl, apiKey, instance } = evolutionConfig();
      if (!baseUrl || !apiKey) return null;
      try {
        const r = await fetchImpl(`${baseUrl}/instance/fetchInstances?instanceName=${encodeURIComponent(instance)}`, {
          headers: { apikey: apiKey },
        });
        if (!r.ok) throw new Error(String(r.status));
        const j: any = await r.json();
        const inst = Array.isArray(j) ? j[0] : j;
        const owner = inst?.ownerJid || inst?.instance?.owner || inst?.owner || null;
        cachedNumber = owner ? normalizePhoneE164(String(owner)) : null;
      } catch {
        cachedNumber = null;
      }
      cachedAt = Date.now();
      return cachedNumber;
    },
  };
}
