/**
 * Normalización de teléfonos a E.164 (+<código país><número>), con Bolivia (+591) por defecto.
 * - "7123 4567", "71234567", "071234567"  -> +59171234567
 * - "591 71234567", "+591-7123-4567", "0059171234567" -> +59171234567
 * - "+54 9 11 2345 6789" -> +5491123456789 (otros países: se respeta el código si viene con + o 00)
 * Devuelve null si el número no es válido.
 */
export const DEFAULT_COUNTRY_CODE = "591";

export function normalizePhoneE164(input: unknown, defaultCountryCode = DEFAULT_COUNTRY_CODE): string | null {
  if (typeof input !== "string" && typeof input !== "number") return null;
  let raw = String(input).trim();
  if (!raw) return null;
  // JID de WhatsApp: 59171234567@s.whatsapp.net  /  59171234567:12@s.whatsapp.net
  raw = raw.replace(/@.*$/, "").replace(/:\d+$/, "");
  if (/[a-z]/i.test(raw)) return null;

  let international = false;
  if (raw.startsWith("+")) {
    international = true;
    raw = raw.slice(1);
  }
  let digits = raw.replace(/[\s().\-\/]/g, "");
  if (!/^\d+$/.test(digits)) return null;
  if (!international && digits.startsWith("00")) {
    international = true;
    digits = digits.slice(2);
  }

  if (!international) {
    if (defaultCountryCode === "591") {
      if (digits.length === 9 && digits.startsWith("0")) digits = digits.slice(1); // 071234567
      if (digits.length === 8) digits = "591" + digits;
      else if (!(digits.length === 11 && digits.startsWith("591"))) return null;
    } else {
      digits = digits.replace(/^0+/, "");
      if (!digits.startsWith(defaultCountryCode)) digits = defaultCountryCode + digits;
    }
  }

  if (digits.startsWith("0")) return null;
  if (digits.length < 8 || digits.length > 15) return null;
  // Bolivia: exactamente 8 dígitos nacionales (móviles 6/7, fijos 2/3/4).
  if (digits.startsWith("591")) {
    const national = digits.slice(3);
    if (!/^[234679]\d{7}$/.test(national)) return null;
  }
  return "+" + digits;
}

/** E.164 -> dígitos para Evolution (`number`) y wa.me. */
export function e164ToDigits(e164: string): string {
  return e164.replace(/^\+/, "");
}

/** Enmascara para logs: +591******67 */
export function maskPhone(e164: string | null | undefined): string {
  if (!e164) return "(sin número)";
  const d = e164.replace(/^\+/, "");
  if (d.length <= 5) return "+" + "*".repeat(d.length);
  return "+" + d.slice(0, 3) + "*".repeat(d.length - 5) + d.slice(-2);
}
