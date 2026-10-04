/** PWA: registro del service worker y captura temprana de `beforeinstallprompt` (para el botón "Instalar app"). */
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const EVT = "micaa-installable";

export function initPwa() {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event(EVT));
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    window.dispatchEvent(new Event(EVT));
  });
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;
  window.addEventListener("load", async () => {
    try {
      // El SW antiguo (/service-worker.js, cache-first) podía servir un index.html viejo: fuera.
      for (const reg of await navigator.serviceWorker.getRegistrations()) {
        const url = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || "";
        if (url.endsWith("/service-worker.js")) await reg.unregister();
      }
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    } catch (err) {
      console.warn("SW no registrado:", err);
    }
  });
}

export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(() => !!deferred);
  useEffect(() => {
    const sync = () => setCanInstall(!!deferred);
    window.addEventListener(EVT, sync);
    sync();
    return () => window.removeEventListener(EVT, sync);
  }, []);
  const install = async () => {
    if (!deferred) return false;
    const e = deferred;
    await e.prompt();
    const { outcome } = await e.userChoice;
    deferred = null;
    window.dispatchEvent(new Event(EVT));
    return outcome === "accepted";
  };
  return { canInstall, install };
}
