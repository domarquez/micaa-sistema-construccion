import { MessageCircle } from "lucide-react";
import { useLocation } from "wouter";
import { micaaWaUrl, MICAA_WA_DEFAULT_MSG } from "@/lib/micaa-contact";
import { track } from "@/lib/analytics";

/** Botón flotante de WhatsApp de la marca MICAA (soporte / publicidad). */
export function MicaaWhatsAppFab() {
  const [location] = useLocation();
  // Ocultar en detalle de presupuesto: el sticky TOTAL del presupuesto ocupa el mismo borde inferior.
  if (/^\/budgets\/\d+(\/|$|\?)/.test(location) || /^\/budgets\/\d+$/.test(location)) {
    return null;
  }

  return (
    <a
      href={micaaWaUrl(MICAA_WA_DEFAULT_MSG)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribir a MICAA por WhatsApp"
      data-testid="fab-micaa-whatsapp"
      onClick={() => track("whatsapp_click", { source: "fab" })}
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105 hover:bg-[#1ebe57] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--micaa-accent)]"
    >
      <MessageCircle className="h-7 w-7" strokeWidth={2.2} />
    </a>
  );
}
