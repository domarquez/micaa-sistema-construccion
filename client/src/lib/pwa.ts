/** PWA: registro del service worker y captura temprana de `beforeinstallprompt` (para el botón "Instalar app"). */
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const EVT = "micaa-installable";

export const PWA_DISMISS_KEY = "micaa-pwa-dismiss-until";
export const PWA_INSTALLED_KEY = "micaa-pwa-installed";
export const PWA_DISMISS_MS = 3 * 24 * 60 * 60 * 1000; // 3 días

export function initPwa() {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event(EVT));
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    try {
      localStorage.setItem(PWA_INSTALLED_KEY, "1");
      localStorage.removeItem(PWA_DISMISS_KEY);
    } catch {
      /* ignore */
    }
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

/** Ya está instalada / abierta como app (standalone). */
export function isPwaInstalled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem(PWA_INSTALLED_KEY) === "1") return true;
  } catch {
    /* ignore */
  }
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return false;
}

/** Viewport / UA de celular (no escritorio). */
export function isMobileClient(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/Mobi|Android|iPhone|iPod|iPad|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true;
  return window.matchMedia("(max-width: 768px)").matches;
}

/**
 * Navegador interno (WhatsApp, Instagram, Facebook, Gmail, WebView).
 * Ahí no se puede instalar una PWA.
 */
export function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /FBAN|FBAV|Instagram|WhatsApp|GSA|; wv\)|WebView/i.test(ua);
}

export function isIosSafariLike(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOS = /iPhone|iPad|iPod/i.test(ua);
  // Chrome/Firefox iOS también usan WebKit; el flujo de “Agregar a inicio” es el de Safari.
  return iOS && !isInAppBrowser();
}

export function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent || "");
}

export function chromeIntentUrl(url = "https://micaa.site"): string {
  // Abre la misma URL en Chrome (Android) desde un WebView / in-app browser.
  const withoutScheme = url.replace(/^https?:\/\//, "");
  return `intent://${withoutScheme}#Intent;scheme=https;package=com.android.chrome;end`;
}

export function wasDismissedRecently(): boolean {
  try {
    const until = Number(localStorage.getItem(PWA_DISMISS_KEY) || 0);
    return until > Date.now();
  } catch {
    return false;
  }
}

export function dismissForThreeDays(): void {
  try {
    localStorage.setItem(PWA_DISMISS_KEY, String(Date.now() + PWA_DISMISS_MS));
  } catch {
    /* ignore */
  }
}
