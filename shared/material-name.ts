/**
 * Limpia marcas de pulgada mal escapadas que quedaron de dumps MySQL
 * (p. ej. 1/2\'\' → 1/2") y unifica tipografía de comillas.
 */
export function cleanMaterialName(raw?: string | null): string {
  if (raw == null) return "";
  let s = String(raw);
  // MySQL-style \'\' / \' → inch mark "
  s = s.replace(/(?:\\')+/g, '"');
  s = s.replace(/\\+"/g, '"');
  s = s.replace(/\\/g, "");
  // tipográficas → ASCII
  s = s.replace(/[“”„‟«»]/g, '"').replace(/[‘’‚‛]/g, "'");
  // espacios alrededor de x entre medidas
  s = s.replace(/(")\s*x\s*/gi, '" x ');
  s = s.replace(/(\d)\s*x\s*(\d)/gi, "$1 x $2");
  // espacio tras " antes de letra: 3/16"BAR → 3/16" BAR
  s = s.replace(/"([A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/g, '" $1');
  s = s.replace(/\s+/g, " ").trim();
  return s;
}
