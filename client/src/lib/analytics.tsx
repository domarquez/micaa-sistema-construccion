/**
 * Analytics propio de MICAA (ligero, sin IPs).
 * Excluye bots y al usuario dmarquez en el cliente.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { useLocation } from "wouter";

const VISITOR_KEY = "micaa_vid";
const SESSION_KEY = "micaa_sid";
const SESSION_START_KEY = "micaa_sstart";
const QUEUE_FLUSH_MS = 2500;

export type AnalyticsEventType =
  | "page_view"
  | "page_duration"
  | "session_duration"
  | "material_search"
  | "view_material"
  | "ver_proveedores"
  | "company_view"
  | "budget_created"
  | "pdf_exported"
  | "login"
  | "registration"
  | "whatsapp_click"
  | "anunciar_view";

type EventPayload = {
  visitorId: string;
  sessionId: string;
  userId?: number | null;
  path: string;
  eventType: AnalyticsEventType | string;
  eventData?: Record<string, unknown>;
  referrer?: string | null;
  device?: string | null;
  city?: string | null;
  durationMs?: number | null;
};

let cachedUserId: number | null = null;
let cachedUsername: string | null = null;
let queue: EventPayload[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let pageEnteredAt = Date.now();
let currentPath = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
let lastSearchTracked = "";

function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id || id.length < 8) {
      id = uuid();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return uuid();
  }
}

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id || id.length < 8) {
      id = uuid();
      sessionStorage.setItem(SESSION_KEY, id);
      sessionStorage.setItem(SESSION_START_KEY, String(Date.now()));
    }
    return id;
  } catch {
    return uuid();
  }
}

function sessionStart(): number {
  try {
    const v = Number(sessionStorage.getItem(SESSION_START_KEY) || 0);
    if (v > 0) return v;
    const now = Date.now();
    sessionStorage.setItem(SESSION_START_KEY, String(now));
    return now;
  } catch {
    return Date.now();
  }
}

function deviceKind(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent || "";
  if (/bot|crawl|spider/i.test(ua)) return "bot";
  if (/Mobi|Android|iPhone|iPad/i.test(ua)) return "mobile";
  if (/Tablet|iPad/i.test(ua)) return "tablet";
  return "desktop";
}

function isBotClient(): boolean {
  if (typeof navigator === "undefined") return true;
  if ((navigator as any).webdriver) return true;
  return /bot|crawl|spider|slurp|headless/i.test(navigator.userAgent || "");
}

function shouldSkip(): boolean {
  if (typeof window === "undefined") return true;
  if (isBotClient()) return true;
  if (cachedUsername && cachedUsername.toLowerCase() === "dmarquez") return true;
  return false;
}

function readCity(): string | null {
  try {
    const c = localStorage.getItem("micaa_city");
    return c && c.trim() ? c.trim().slice(0, 80) : null;
  } catch {
    return null;
  }
}

/** Llamar cuando cambie la sesión (login/logout). */
export function setAnalyticsUser(user: { id?: number; username?: string } | null) {
  cachedUserId = user?.id ?? null;
  cachedUsername = user?.username ?? null;
}

function enqueue(ev: EventPayload) {
  if (shouldSkip()) return;
  queue.push(ev);
  if (queue.length >= 12) {
    flush(false);
    return;
  }
  if (!flushTimer) {
    flushTimer = setTimeout(() => flush(false), QUEUE_FLUSH_MS);
  }
}

function flush(useBeacon: boolean) {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!queue.length || shouldSkip()) {
    queue = [];
    return;
  }
  const batch = queue.splice(0, 25);
  const body = JSON.stringify({ events: batch });
  try {
    if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/analytics/events", blob);
      return;
    }
    void fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => {});
  } catch {
    // silencioso
  }
}

export function track(
  eventType: AnalyticsEventType | string,
  eventData?: Record<string, unknown>,
  opts?: { path?: string; durationMs?: number | null },
) {
  if (shouldSkip()) return;
  const path = opts?.path ?? (typeof window !== "undefined" ? window.location.pathname + window.location.search : "/");
  enqueue({
    visitorId: getVisitorId(),
    sessionId: getSessionId(),
    userId: cachedUserId,
    path,
    eventType,
    eventData: eventData || {},
    referrer: typeof document !== "undefined" ? document.referrer || null : null,
    device: deviceKind(),
    city: readCity(),
    durationMs: opts?.durationMs ?? null,
  });
}

function sendPageDuration(path: string) {
  const ms = Date.now() - pageEnteredAt;
  if (ms < 800) return;
  track("page_duration", {}, { path, durationMs: Math.min(ms, 30 * 60_000) });
}

function sendSessionDuration(useBeacon: boolean) {
  const ms = Date.now() - sessionStart();
  if (ms < 1000) return;
  enqueue({
    visitorId: getVisitorId(),
    sessionId: getSessionId(),
    userId: cachedUserId,
    path: currentPath,
    eventType: "session_duration",
    eventData: {},
    referrer: null,
    device: deviceKind(),
    city: readCity(),
    durationMs: Math.min(ms, 4 * 60 * 60_000),
  });
  flush(useBeacon);
}

function onRoute(path: string) {
  if (shouldSkip()) return;
  if (path !== currentPath) {
    sendPageDuration(currentPath);
  }
  currentPath = path;
  pageEnteredAt = Date.now();
  track("page_view", {}, { path });

  if (path.startsWith("/anunciar")) {
    track("anunciar_view", {}, { path });
  }
  const mat = path.match(/^\/materiales\/(\d+)/);
  if (mat) {
    track("view_material", { materialId: Number(mat[1]) }, { path });
  }
  try {
    const q = new URLSearchParams(path.includes("?") ? path.split("?")[1] : "").get("q");
    if (q && q.trim().length >= 2) {
      const key = q.trim().toLowerCase();
      if (key !== lastSearchTracked) {
        lastSearchTracked = key;
        track("material_search", { q: q.trim().slice(0, 120) }, { path });
      }
    }
  } catch {
    // ignore
  }
}

/** Provider: page_view + duración + heartbeat. Montar una vez en App. */
export function AnalyticsProvider({ children }: { children?: ReactNode }) {
  const [location] = useLocation();
  const started = useRef(false);

  useEffect(() => {
    setAnalyticsUser(null);
    try {
      // hidratar user desde localStorage si existe (useAuth lo actualizará)
      const raw = localStorage.getItem("user");
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.username || u?.id) setAnalyticsUser(u);
      }
    } catch {
      // ignore
    }

    const path = window.location.pathname + window.location.search;
    onRoute(path);
    started.current = true;

    const onVis = () => {
      if (document.visibilityState === "hidden") {
        sendPageDuration(currentPath);
        sendSessionDuration(true);
      } else {
        pageEnteredAt = Date.now();
      }
    };
    const onHide = () => {
      sendPageDuration(currentPath);
      sendSessionDuration(true);
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);

    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        // no envía; solo mantiene session start
        sessionStart();
      }
    }, 60_000);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
      window.clearInterval(heartbeat);
      sendPageDuration(currentPath);
      flush(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!started.current) return;
    const path = location.includes("?")
      ? location
      : location + (typeof window !== "undefined" ? window.location.search : "");
    // wouter location a veces no trae search; preferir window
    const full =
      typeof window !== "undefined" ? window.location.pathname + window.location.search : location;
    onRoute(full || path);
  }, [location]);

  return children ? <>{children}</> : null;
}
