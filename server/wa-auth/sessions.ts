/**
 * Dispositivos recordados: sesión de 1 año con renovación deslizante y cookie httpOnly persistente.
 *
 * Integración con el mecanismo actual (JWT Bearer en localStorage, verificado en muchos handlers):
 * `sessionBridge` corre antes de las rutas /api y
 *   - si el Bearer trae `sid` y esa sesión fue revocada/venció -> quita el header (el handler responde 401);
 *   - si no hay Bearer válido pero sí cookie de dispositivo válida -> inyecta un JWT nuevo (con `sid`)
 *     en `Authorization`, así TODOS los handlers existentes funcionan sin cambios;
 *   - renueva (desliza) `expires_at` y la cookie como máximo una vez por hora.
 * JWT legacy (sin `sid`, login viejo) siguen funcionando igual que antes.
 */
import { createHash, randomBytes, randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import type { AuthUser, SessionRow, SessionStore, UserStore } from "./types";

export const SESSION_COOKIE = "micaa_session";
/** Cookie NO httpOnly, sin secretos: solo le dice al frontend que vale la pena llamar /api/auth/me. */
export const HINT_COOKIE = "micaa_has_session";
export const SESSION_TTL_MS = 365 * 24 * 3600_000;
export const SLIDE_EVERY_MS = 3600_000;
const STATUS_CACHE_MS = 30_000;

export function jwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET must be set");
  return s;
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (!k || k in out) continue;
    try { out[k] = decodeURIComponent(v); } catch { out[k] = v; }
  }
  return out;
}

export function deviceNameFromUA(ua: string | undefined): string {
  if (!ua) return "Dispositivo desconocido";
  const os = /iPhone|iPad/i.test(ua) ? (/iPad/i.test(ua) ? "iPad" : "iPhone")
    : /Android/i.test(ua) ? "Android"
    : /Windows/i.test(ua) ? "Windows"
    : /Mac OS X|Macintosh/i.test(ua) ? "Mac"
    : /Linux/i.test(ua) ? "Linux" : "Otro";
  const br = /Edg\//.test(ua) ? "Edge"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /SamsungBrowser/.test(ua) ? "Samsung Internet"
    : /Firefox\//.test(ua) ? "Firefox"
    : /CriOS|Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari" : "Navegador";
  return `${br} en ${os}`;
}

export function signUserJwt(user: AuthUser, sid: string | null, expiresIn: string): string {
  const payload: Record<string, unknown> = { userId: user.id, username: user.username, email: user.email, role: user.role };
  if (sid) payload.sid = sid;
  return jwt.sign(payload, jwtSecret(), { expiresIn } as jwt.SignOptions);
}

function isSecure(req: Request): boolean {
  return process.env.NODE_ENV === "production" || req.secure || req.headers["x-forwarded-proto"] === "https";
}

export function setSessionCookies(req: Request, res: Response, token: string) {
  const secure = isSecure(req);
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: SESSION_TTL_MS });
  res.cookie(HINT_COOKIE, "1", { httpOnly: false, secure, sameSite: "lax", path: "/", maxAge: SESSION_TTL_MS });
}

export function clearSessionCookies(req: Request, res: Response) {
  const secure = isSecure(req);
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure, sameSite: "lax", path: "/" });
  res.clearCookie(HINT_COOKIE, { httpOnly: false, secure, sameSite: "lax", path: "/" });
}

/** Para peticiones que cambian estado autenticadas por cookie: exige mismo origen (defensa CSRF extra a SameSite=Lax). */
function sameOriginOk(req: Request): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;
  const sfs = req.headers["sec-fetch-site"];
  if (typeof sfs === "string") return sfs === "same-origin" || sfs === "none";
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin) {
    try { return new URL(origin).host === req.headers.host; } catch { return false; }
  }
  return true;
}

export function clientIp(req: Request): string {
  return (req.ip || req.socket?.remoteAddress || "unknown").replace(/^::ffff:/, "");
}

export interface SessionService {
  /** Crea sesión de dispositivo, pone cookies y devuelve el JWT para el cliente. */
  start(req: Request, res: Response, user: AuthUser, authMethod: string, deviceName?: string): Promise<{ token: string; sessionId: string }>;
  bridge: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  list(userId: number): Promise<SessionRow[]>;
  revoke(userId: number, id: string): Promise<boolean>;
  revokeAll(userId: number): Promise<number>;
  /** sid de la sesión actual (Bearer con sid o cookie), si existe. */
  currentSessionId(req: Request): string | null;
}

export function createSessionService(deps: { sessions: SessionStore; users: UserStore; now?: () => Date }): SessionService {
  const now = deps.now || (() => new Date());
  const statusCache = new Map<string, { row: SessionRow | null; at: number }>();
  const mintCache = new Map<string, { token: string; exp: number }>();

  async function getSession(id: string): Promise<SessionRow | null> {
    const c = statusCache.get(id);
    if (c && Date.now() - c.at < STATUS_CACHE_MS) return c.row;
    const row = await deps.sessions.findById(id);
    statusCache.set(id, { row, at: Date.now() });
    if (statusCache.size > 5000) statusCache.delete(statusCache.keys().next().value!);
    return row;
  }
  const valid = (s: SessionRow | null, t: Date) => !!s && !s.revokedAt && s.expiresAt > t;

  async function slide(req: Request, res: Response, s: SessionRow, cookieToken: string | null) {
    const t = now();
    if (t.getTime() - new Date(s.lastSeenAt).getTime() < SLIDE_EVERY_MS) return;
    const exp = new Date(t.getTime() + SESSION_TTL_MS);
    s.lastSeenAt = t;
    s.expiresAt = exp;
    try { await deps.sessions.touch(s.id, t, exp); } catch (e) { console.error("[wa-auth] touch session", e); }
    if (cookieToken) setSessionCookies(req, res, cookieToken);
  }

  function mint(user: AuthUser, sid: string): string {
    const c = mintCache.get(sid);
    if (c && c.exp - Date.now() > 10 * 60_000) return c.token;
    const token = signUserJwt(user, sid, "12h");
    mintCache.set(sid, { token, exp: Date.now() + 12 * 3600_000 });
    if (mintCache.size > 5000) mintCache.delete(mintCache.keys().next().value!);
    return token;
  }

  const svc: SessionService = {
    async start(req, res, user, authMethod, deviceName) {
      const t = now();
      const token = randomBytes(32).toString("base64url");
      const id = randomUUID();
      const ua = String(req.headers["user-agent"] || "").slice(0, 400) || null;
      const name = (typeof deviceName === "string" && deviceName.trim() ? deviceName.trim().slice(0, 80) : deviceNameFromUA(ua || undefined));
      await deps.sessions.create({
        id, userId: user.id, tokenHash: sha256(token), deviceName: name, userAgent: ua, ip: clientIp(req),
        authMethod, createdAt: t, lastSeenAt: t, expiresAt: new Date(t.getTime() + SESSION_TTL_MS), revokedAt: null,
      });
      setSessionCookies(req, res, token);
      (req as any).micaaSessionId = id;
      return { token: signUserJwt(user, id, "7d"), sessionId: id };
    },

    async bridge(req, res, next) {
      try {
        const t = now();
        const auth = req.headers.authorization;
        let bearerOk = false;
        if (auth && auth.startsWith("Bearer ")) {
          let decoded: any = null;
          try { decoded = jwt.verify(auth.slice(7), jwtSecret()); } catch {}
          if (decoded && decoded.sid) {
            const s = await getSession(String(decoded.sid));
            if (valid(s, t) && s!.userId === decoded.userId) {
              bearerOk = true;
              (req as any).micaaSessionId = s!.id;
              const ck = parseCookies(req.headers.cookie)[SESSION_COOKIE];
              await slide(req, res, s!, ck && sha256(ck) === s!.tokenHash ? ck : null);
            } else {
              delete req.headers.authorization; // sesión revocada/vencida: el handler verá 401
            }
          } else if (decoded) {
            bearerOk = true; // JWT legacy sin sid
          }
        }
        if (!bearerOk) {
          const cookieToken = parseCookies(req.headers.cookie)[SESSION_COOKIE];
          if (cookieToken) {
            const s = await deps.sessions.findByTokenHash(sha256(cookieToken));
            if (valid(s, t)) {
              if (sameOriginOk(req)) {
                const user = await deps.users.getById(s!.userId);
                if (user && user.isActive) {
                  const token = mint(user, s!.id);
                  req.headers.authorization = `Bearer ${token}`;
                  res.locals.micaaToken = token;
                  (req as any).micaaSessionId = s!.id;
                  await slide(req, res, s!, cookieToken);
                }
              }
            } else {
              clearSessionCookies(req, res);
            }
          }
        }
      } catch (e) {
        console.error("[wa-auth] session bridge error", e);
      }
      next();
    },

    list: (userId) => deps.sessions.listActiveForUser(userId, now()),

    async revoke(userId, id) {
      const ok = await deps.sessions.revoke(id, userId, now());
      statusCache.delete(id);
      mintCache.delete(id);
      return ok;
    },

    async revokeAll(userId) {
      const active = await deps.sessions.listActiveForUser(userId, now());
      const n = await deps.sessions.revokeAllForUser(userId, now());
      for (const s of active) { statusCache.delete(s.id); mintCache.delete(s.id); }
      return n;
    },

    currentSessionId(req) {
      return (req as any).micaaSessionId || null;
    },
  };
  return svc;
}
