import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const CLIENT = (import.meta as any).env?.VITE_ADSENSE_CLIENT as string | undefined;
const SLOT = (import.meta as any).env?.VITE_ADSENSE_SLOT as string | undefined;

/** True solo si hay publisher ID configurado (AdSense apagado por defecto). */
export function isAdSenseEnabled(): boolean {
  return Boolean(CLIENT && /^ca-pub-\d+$/.test(CLIENT.trim()));
}

/**
 * Slot discreto de AdSense. Solo carga si VITE_ADSENSE_CLIENT existe.
 * No se muestra a usuarios logueados en herramientas/presupuestos (caller decide).
 */
export function AdSenseSlot({
  className = "",
  format = "auto",
}: {
  className?: string;
  format?: string;
}) {
  const adRef = useRef<HTMLModElement>(null);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAdSenseEnabled() || isAuthenticated) return;
    if (typeof window === "undefined") return;
    const src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT!.trim()}`;
    if (!document.querySelector(`script[src*="googlesyndication.com"]`)) {
      const script = document.createElement("script");
      script.async = true;
      script.src = src;
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    }
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* ignore */
    }
  }, [isAuthenticated]);

  if (!isAdSenseEnabled() || isAuthenticated) return null;

  return (
    <div className={`ad-shell my-4 text-center ${className}`} data-testid="adsense-slot">
      <div className="mb-1 text-[10px] uppercase tracking-wide text-[var(--micaa-muted)]">Publicidad</div>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block", maxWidth: "100%", width: "100%" }}
        data-ad-client={CLIENT!.trim()}
        data-ad-slot={SLOT?.trim() || "0"}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}

/** Para páginas públicas (home, materiales, guía): muestra solo si AdSense está on y el visitante no está logueado. */
export function PublicAdSense({ className }: { className?: string }) {
  return <AdSenseSlot className={className} />;
}
