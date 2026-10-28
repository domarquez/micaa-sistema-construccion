/** Contacto oficial de la marca MICAA (no usar para cotizar a proveedores). */
export const MICAA_WHATSAPP_E164 = "59176105183";
export const MICAA_WHATSAPP_DISPLAY = "+591 76105183";

export function micaaWaUrl(prefilled: string): string {
  return `https://wa.me/${MICAA_WHATSAPP_E164}?text=${encodeURIComponent(prefilled)}`;
}

export const MICAA_WA_DEFAULT_MSG =
  "Hola MICAA, quiero más información sobre micaa.site";

export function micaaWaAdvertiseMsg(companyName?: string): string {
  const name = (companyName || "").trim();
  return name
    ? `Hola MICAA, quiero anunciar mi empresa "${name}" en micaa.site. ¿Me cuentan los planes?`
    : "Hola MICAA, quiero anunciar mi empresa en micaa.site. ¿Me cuentan los planes?";
}

/** Precios de planes editables vía VITE_AD_* (si no hay, se muestra "consultar"). */
export function adPlanPrice(envKey: string): string {
  const v = (import.meta as any).env?.[envKey];
  if (typeof v === "string" && v.trim()) return v.trim();
  return "consultar";
}
