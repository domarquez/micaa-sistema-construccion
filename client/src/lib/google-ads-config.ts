/**
 * Google AdSense para MICAA.
 * Apagado por defecto: solo se activa si VITE_ADSENSE_CLIENT=ca-pub-XXXXXXXX está en el build.
 * No inventar publisher IDs. Diego debe crear la cuenta AdSense y pasar el pub ID.
 */

export function getAdSenseClient(): string | null {
  const v = (import.meta as any).env?.VITE_ADSENSE_CLIENT as string | undefined;
  if (!v || !/^ca-pub-\d+$/.test(v.trim())) return null;
  return v.trim();
}

export function getAdSenseSlot(kind: "banner" | "sidebar" | "square" | "mobile" | "responsive" = "responsive"): string | null {
  if (!getAdSenseClient()) return null;
  const map: Record<string, string | undefined> = {
    banner: (import.meta as any).env?.VITE_ADSENSE_SLOT_BANNER,
    sidebar: (import.meta as any).env?.VITE_ADSENSE_SLOT_SIDEBAR,
    square: (import.meta as any).env?.VITE_ADSENSE_SLOT_SQUARE,
    mobile: (import.meta as any).env?.VITE_ADSENSE_SLOT_MOBILE,
    responsive: (import.meta as any).env?.VITE_ADSENSE_SLOT,
  };
  const s = map[kind];
  return typeof s === "string" && s.trim() ? s.trim() : null;
}

export const setupInstructions = `
1. Creá una cuenta en google.com/adsense y agregá micaa.site
2. Copiá tu Publisher ID (ca-pub-…)
3. En Railway (o el build de Vite) seteá VITE_ADSENSE_CLIENT=ca-pub-…
4. Opcional: VITE_ADSENSE_SLOT y VITE_ADSENSE_SLOT_* para unidades
5. Redeploy. Sin esa variable, no se carga ningún anuncio.
`;
