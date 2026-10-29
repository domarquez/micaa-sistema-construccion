/** wa.me link with prefilled message saying contact came from MICAA. */
export function waMicaaLink(
  phone: string | null | undefined,
  companyName: string,
  opts?: { materialName?: string; context?: string },
): string | null {
  const p = String(phone || "").replace(/\D/g, "");
  if (!/^591[67]\d{7}$/.test(p)) return null;
  const parts = [`Hola ${companyName}, te contacto desde MICAA (micaa.site).`];
  if (opts?.materialName) parts.push(`Consulto por: ${opts.materialName}.`);
  if (opts?.context) parts.push(opts.context);
  parts.push("¿Me podés ayudar?");
  return `https://wa.me/${p}?text=${encodeURIComponent(parts.join(" "))}`;
}
