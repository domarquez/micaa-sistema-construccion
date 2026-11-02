import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Download,
  Smartphone,
  Share,
  PlusSquare,
  Copy,
  ExternalLink,
  X,
} from "lucide-react";
import {
  useInstallPrompt,
  isPwaInstalled,
  isMobileClient,
  isInAppBrowser,
  isIosSafariLike,
  isAndroid,
  chromeIntentUrl,
  wasDismissedRecently,
  dismissForThreeDays,
  PWA_INSTALLED_KEY,
} from "@/lib/pwa";

const SITE_URL = "https://micaa.site";

type Mode = "android" | "ios" | "inapp" | null;

/**
 * Aviso de instalación PWA en móvil.
 * - No se muestra en escritorio, ni si ya está instalada, ni tras “Ahora no” (3 días).
 * - En navegadores internos (WhatsApp, etc.) pide abrir en Chrome/Safari.
 * - Android/Chrome: un toque con beforeinstallprompt.
 * - iPhone: pasos Compartir › Agregar a inicio.
 */
export function PWAInstallPrompt() {
  const { canInstall, install } = useInstallPrompt();
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<Mode>(null);
  const [copied, setCopied] = useState(false);
  const [showIosSteps, setShowIosSteps] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isMobileClient()) return;
    if (isPwaInstalled()) return;
    if (wasDismissedRecently()) return;

    const inApp = isInAppBrowser();
    const ios = isIosSafariLike();
    setMode(inApp ? "inapp" : ios ? "ios" : "android");

    let shown = false;
    const reveal = () => {
      if (shown) return;
      if (isPwaInstalled() || wasDismissedRecently()) return;
      shown = true;
      setVisible(true);
    };

    const timer = window.setTimeout(reveal, 5000);
    const onInteract = () => reveal();
    window.addEventListener("pointerdown", onInteract, { once: true, passive: true });
    window.addEventListener("scroll", onInteract, { once: true, passive: true });
    window.addEventListener("touchstart", onInteract, { once: true, passive: true });

    const onInstalled = () => {
      setVisible(false);
      try {
        localStorage.setItem(PWA_INSTALLED_KEY, "1");
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("scroll", onInteract);
      window.removeEventListener("touchstart", onInteract);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    dismissForThreeDays();
    setVisible(false);
  };

  const handleInstall = async () => {
    if (mode === "ios") {
      setShowIosSteps(true);
      return;
    }
    if (canInstall) {
      try {
        const ok = await install();
        if (ok) setVisible(false);
      } catch (e) {
        console.error("Error installing PWA:", e);
      }
      return;
    }
    // Sin beforeinstallprompt (p. ej. Firefox / Playwright): pista del menú de Chrome
    setShowIosSteps(true);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(SITE_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = SITE_URL;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        /* ignore */
      }
      document.body.removeChild(ta);
    }
  };

  if (!visible || !mode) return null;

  return (
    <div
      className="fixed bottom-4 left-3 z-50 w-[min(100%-5.5rem,22rem)] max-w-[calc(100vw-5.5rem)]"
      role="dialog"
      aria-labelledby="pwa-install-title"
      data-testid="pwa-install-prompt"
      data-mode={mode}
    >
      <div className="rounded-xl border border-[var(--micaa-accent,#C2410C)]/30 bg-white p-3 shadow-xl shadow-orange-900/10">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--micaa-accent,#C2410C)] text-white">
            <Smartphone className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h2
                id="pwa-install-title"
                className="text-sm font-semibold leading-snug text-[var(--micaa-accent,#C2410C)]"
              >
                {mode === "inapp"
                  ? "Abrí micaa.site en Chrome o Safari"
                  : "Instalá MICAA en tu celular"}
              </h2>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={dismiss}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {mode === "inapp" ? (
              <>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">
                  Abrí micaa.site en Chrome o Safari para instalarla. Desde esta app no se puede.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={copyLink}
                    data-testid="pwa-copy-link"
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    {copied ? "Copiado" : "Copiar enlace"}
                  </Button>
                  {isAndroid() && (
                    <Button
                      size="sm"
                      className="h-8 bg-[var(--micaa-accent,#C2410C)] text-xs text-white hover:bg-[#9A3412]"
                      asChild
                    >
                      <a
                        href={chromeIntentUrl(SITE_URL)}
                        data-testid="pwa-open-chrome"
                      >
                        <ExternalLink className="mr-1 h-3.5 w-3.5" />
                        Abrir en Chrome
                      </a>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs"
                    onClick={dismiss}
                    data-testid="pwa-dismiss"
                  >
                    Ahora no
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">
                  Tenela siempre a mano. Es gratis, no ocupa espacio y no pide permisos: se
                  instala desde tu navegador.
                </p>

                {mode === "ios" && (
                  <ol className="mt-2 space-y-1.5 rounded-lg bg-orange-50/80 p-2 text-xs text-foreground" data-testid="pwa-ios-steps">
                    <li className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white shadow-sm">
                        <Share className="h-3.5 w-3.5 text-[var(--micaa-accent,#C2410C)]" />
                      </span>
                      Tocá <strong className="mx-0.5">Compartir</strong> en Safari
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white shadow-sm">
                        <PlusSquare className="h-3.5 w-3.5 text-[var(--micaa-accent,#C2410C)]" />
                      </span>
                      Elegí <strong className="mx-0.5">Agregar a inicio</strong>
                    </li>
                  </ol>
                )}

                {mode === "android" && showIosSteps && !canInstall && (
                  <p className="mt-2 rounded-lg bg-orange-50/80 p-2 text-xs text-foreground">
                    En Chrome: menú <strong>⋮</strong> → <strong>Instalar app</strong> o{" "}
                    <strong>Agregar a la pantalla de inicio</strong>.
                  </p>
                )}

                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="h-8 bg-[var(--micaa-accent,#C2410C)] text-xs text-white hover:bg-[#9A3412]"
                    onClick={handleInstall}
                    data-testid="pwa-install"
                  >
                    <Download className="mr-1 h-3.5 w-3.5" />
                    Instalar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs"
                    onClick={dismiss}
                    data-testid="pwa-dismiss"
                  >
                    Ahora no
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
