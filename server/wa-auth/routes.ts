/**
 * Rutas de login por WhatsApp + dispositivos recordados.
 *   GET  /api/auth/wa/config
 *   POST /api/auth/wa/request        {phone}            (fallback "Enviarme el código")
 *   POST /api/auth/wa/verify         {phone, code, deviceName?}
 *   POST /api/auth/wa/link/request   {phone}            (auth; "Vincular WhatsApp")
 *   POST /api/auth/wa/link/verify    {phone, code}      (auth)
 *   POST /api/webhooks/evolution?token=...              (Evolution messages.upsert)
 *   GET  /api/auth/devices                              (auth)
 *   POST /api/auth/devices/:id/revoke                   (auth)
 *   POST /api/auth/logout                               (este dispositivo)
 *   POST /api/auth/logout-all                           (auth; todos)
 *   PATCH /api/auth/profile          {firstName?, lastName?} (auth; nombre opcional)
 */
import type { Express, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { OtpStore, SessionStore, UserStore, AuthUser } from "./types";
import { createEvolutionSender, evolutionConfig, type WaSender } from "./evolution";
import { createOtpService, OTP_COOLDOWN_MS, OTP_TTL_MS } from "./otp";
import { createSessionService, clearSessionCookies, clientIp, jwtSecret, parseCookies, sha256, SESSION_COOKIE, type SessionService } from "./sessions";
import { e164ToDigits, maskPhone, normalizePhoneE164 } from "./phone";
import { extractLoginRequests, LOGIN_REQUEST_TEXT, webhookTokenOk } from "./webhook";

export interface WaAuthDeps {
  otp: OtpStore;
  users: UserStore;
  sessions: SessionStore;
  sender?: WaSender;
  now?: () => Date;
  log?: (m: string) => void;
}

export function publicUser(u: AuthUser) {
  return {
    id: u.id, username: u.username, email: u.email, firstName: u.firstName ?? null, lastName: u.lastName ?? null,
    role: u.role, userType: u.userType ?? null, city: u.city ?? null, country: u.country ?? null,
    phone: u.phone ?? null, isActive: u.isActive,
  };
}

const INVALID_PHONE = { ok: false, code: "INVALID_PHONE", message: "Número no válido. Escribe tu número de WhatsApp (ej. 71234567 o +591 71234567)." };
const INVALID_CODE = { ok: false, code: "INVALID_CODE", message: "Código incorrecto o vencido." };
const TOO_MANY = { ok: false, code: "TOO_MANY_ATTEMPTS", message: "Demasiados intentos. Pide un código nuevo." };

export function registerWaAuthRoutes(app: Express, deps: WaAuthDeps): { sessions: SessionService } {
  const sender = deps.sender || createEvolutionSender();
  const log = deps.log || ((m: string) => console.log(m));
  const otp = createOtpService({ store: deps.otp, sender, now: deps.now, log });
  const sessions = createSessionService({ sessions: deps.sessions, users: deps.users, now: deps.now });

  // Debe ir antes de cualquier ruta /api para que los handlers existentes vean el Bearer inyectado.
  app.use("/api", sessions.bridge);

  // Límite simple en memoria para /verify por IP (los intentos por código ya están en DB).
  const verifyHits = new Map<string, number[]>();
  function verifyRateOk(ip: string): boolean {
    const t = Date.now();
    const list = (verifyHits.get(ip) || []).filter((x) => t - x < 10 * 60_000);
    list.push(t);
    verifyHits.set(ip, list);
    if (verifyHits.size > 10000) verifyHits.delete(verifyHits.keys().next().value!);
    return list.length <= 30;
  }

  async function currentUser(req: Request): Promise<AuthUser | null> {
    const h = req.headers.authorization;
    if (!h || !h.startsWith("Bearer ")) return null;
    try {
      const d: any = jwt.verify(h.slice(7), jwtSecret());
      const u = await deps.users.getById(Number(d.userId));
      return u && u.isActive ? u : null;
    } catch {
      return null;
    }
  }
  const requireUser = async (req: Request, res: Response, next: NextFunction) => {
    const u = await currentUser(req);
    if (!u) return res.status(401).json({ message: "Inicia sesión" });
    (req as any).waUser = u;
    next();
  };

  function issueErrorResponse(res: Response, r: any) {
    if (r.reason === "send_failed") {
      return res.status(502).json({
        ok: false, code: "WA_SEND_FAILED",
        message: "No pudimos enviar el código por WhatsApp ahora. Intenta en unos minutos o usa “Abrir WhatsApp”.",
      });
    }
    res.setHeader("Retry-After", String(r.retryAfterSeconds));
    const message = r.reason === "cooldown"
      ? `Espera ${r.retryAfterSeconds} s antes de pedir otro código.`
      : "Pediste demasiados códigos. Intenta más tarde o usa “Abrir WhatsApp”.";
    return res.status(429).json({ ok: false, code: r.reason === "cooldown" ? "COOLDOWN" : "RATE_LIMITED", message, retryAfterSeconds: r.retryAfterSeconds });
  }

  app.get("/api/auth/wa/config", async (_req, res) => {
    const enabled = sender.isConfigured();
    const num = enabled ? await sender.getInstanceNumber() : null;
    const digits = num ? e164ToDigits(num) : null;
    res.json({
      enabled,
      waNumber: digits,
      requestText: LOGIN_REQUEST_TEXT,
      waLink: digits ? `https://wa.me/${digits}?text=${encodeURIComponent(LOGIN_REQUEST_TEXT)}` : null,
      codeTtlSeconds: OTP_TTL_MS / 1000,
      cooldownSeconds: OTP_COOLDOWN_MS / 1000,
    });
  });

  async function handleRequest(req: Request, res: Response, purpose: "login" | "link", userId: number | null) {
    const phone = normalizePhoneE164(req.body?.phone);
    if (!phone) return res.status(400).json(INVALID_PHONE);
    if (!sender.isConfigured()) {
      return res.status(503).json({ ok: false, code: "WA_NOT_CONFIGURED", message: "El envío por WhatsApp no está disponible en este momento." });
    }
    const r = await otp.issue({ phone, ip: clientIp(req), purpose, channel: "outbound", userId });
    if (!r.ok) return issueErrorResponse(res, r);
    // Misma respuesta exista o no la cuenta (no revelamos si el número está registrado).
    return res.json({ ok: true, phone, message: "Te enviamos un código por WhatsApp.", expiresInSeconds: OTP_TTL_MS / 1000, cooldownSeconds: OTP_COOLDOWN_MS / 1000 });
  }

  app.post("/api/auth/wa/request", async (req, res) => {
    try { await handleRequest(req, res, "login", null); }
    catch (e) { console.error("[wa-auth] request error", e); res.status(500).json({ ok: false, message: "Error al pedir el código" }); }
  });

  app.post("/api/auth/wa/verify", async (req, res) => {
    try {
      if (!verifyRateOk(clientIp(req))) return res.status(429).json(TOO_MANY);
      const phone = normalizePhoneE164(req.body?.phone);
      const code = String(req.body?.code ?? "").replace(/\D/g, "");
      if (!phone) return res.status(400).json(INVALID_PHONE);
      const v = await otp.verify(phone, code);
      if (!v.ok) return res.status(v.reason === "too_many_attempts" ? 429 : 400).json(v.reason === "too_many_attempts" ? TOO_MANY : INVALID_CODE);

      let user = await deps.users.findByPhone(phone);
      let isNewUser = false;
      if (!user) {
        user = await deps.users.createForPhone(phone);
        isNewUser = true;
        log(`[wa-auth] cuenta creada user=${user.id} phone=${maskPhone(phone)}`);
      }
      if (!user.isActive) return res.status(403).json({ ok: false, message: "Cuenta desactivada. Contacta al administrador." });
      await deps.users.touchLastLogin(user.id);
      const { token } = await sessions.start(req, res, user, "whatsapp", req.body?.deviceName);
      res.json({ success: true, ok: true, token, user: publicUser(user), isNewUser });
    } catch (e) {
      console.error("[wa-auth] verify error", e);
      res.status(500).json({ ok: false, message: "Error al verificar el código" });
    }
  });

  app.post("/api/auth/wa/link/request", requireUser, async (req, res) => {
    try { await handleRequest(req, res, "link", (req as any).waUser.id); }
    catch (e) { console.error("[wa-auth] link request error", e); res.status(500).json({ ok: false, message: "Error al pedir el código" }); }
  });

  app.post("/api/auth/wa/link/verify", requireUser, async (req, res) => {
    try {
      if (!verifyRateOk(clientIp(req))) return res.status(429).json(TOO_MANY);
      const me: AuthUser = (req as any).waUser;
      const phone = normalizePhoneE164(req.body?.phone);
      const code = String(req.body?.code ?? "").replace(/\D/g, "");
      if (!phone) return res.status(400).json(INVALID_PHONE);
      const v = await otp.verify(phone, code);
      if (!v.ok) return res.status(v.reason === "too_many_attempts" ? 429 : 400).json(v.reason === "too_many_attempts" ? TOO_MANY : INVALID_CODE);
      // Aquí el usuario ya demostró que controla el número, así que sí podemos decir que está en uso.
      const r = await deps.users.setPhone(me.id, phone);
      if (r === "taken") return res.status(409).json({ ok: false, code: "PHONE_TAKEN", message: "Ese número ya está vinculado a otra cuenta MICAA." });
      log(`[wa-auth] número vinculado user=${me.id} phone=${maskPhone(phone)}`);
      res.json({ ok: true, phone });
    } catch (e) {
      console.error("[wa-auth] link verify error", e);
      res.status(500).json({ ok: false, message: "Error al vincular WhatsApp" });
    }
  });

  // Webhook Evolution. Siempre 200 (evita reintentos en bucle); nunca devuelve ni loguea el código.
  app.post("/api/webhooks/evolution", async (req, res) => {
    const token = (req.query?.token as string) || (req.headers["x-micaa-webhook-token"] as string);
    if (!webhookTokenOk(token, process.env.MICAA_WA_WEBHOOK_TOKEN)) return res.status(401).json({ ok: false });
    try {
      const { requests, skipped } = extractLoginRequests(req.body, { instance: evolutionConfig().instance });
      const results: string[] = [];
      for (const r of requests.slice(0, 5)) {
        // Mismos límites por número que el fallback (protege el número de bloqueos); sin IP (viene de Evolution).
        const out = await otp.issue({ phone: r.phone, ip: null, purpose: "login", channel: "inbound" });
        results.push(out.ok ? "sent" : out.reason);
        if (!out.ok) log(`[wa-auth] inbound ${maskPhone(r.phone)} no enviado: ${out.reason}`);
      }
      res.json({ ok: true, processed: requests.length, results, skipped: skipped.length });
    } catch (e) {
      console.error("[wa-auth] webhook error", e);
      res.json({ ok: false });
    }
  });

  // Nombre opcional (cuentas creadas por WhatsApp no lo tienen)
  app.patch("/api/auth/profile", requireUser, async (req, res) => {
    const me: AuthUser = (req as any).waUser;
    const clean = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 80) : null);
    await deps.users.updateName(me.id, clean(req.body?.firstName), clean(req.body?.lastName));
    res.json({ ok: true });
  });

  app.get("/api/auth/devices", requireUser, async (req, res) => {
    const me: AuthUser = (req as any).waUser;
    const current = sessions.currentSessionId(req);
    const list = await sessions.list(me.id);
    res.json({
      devices: list.map((s) => ({
        id: s.id, deviceName: s.deviceName, authMethod: s.authMethod,
        createdAt: s.createdAt, lastSeenAt: s.lastSeenAt, expiresAt: s.expiresAt, current: s.id === current,
      })),
    });
  });

  app.post("/api/auth/devices/:id/revoke", requireUser, async (req, res) => {
    const me: AuthUser = (req as any).waUser;
    const ok = await sessions.revoke(me.id, String(req.params.id));
    if (sessions.currentSessionId(req) === req.params.id) clearSessionCookies(req, res);
    res.status(ok ? 200 : 404).json({ ok });
  });

  // Cerrar sesión en este dispositivo: funciona aunque el JWT ya no sea válido (usa la cookie).
  app.post("/api/auth/logout", async (req, res) => {
    try {
      let sid = sessions.currentSessionId(req);
      let uid: number | null = null;
      const u = await currentUser(req);
      if (u) uid = u.id;
      if (!sid) {
        const ck = parseCookies(req.headers.cookie)[SESSION_COOKIE];
        if (ck) {
          const s = await deps.sessions.findByTokenHash(sha256(ck));
          if (s) { sid = s.id; uid = s.userId; }
        }
      }
      if (sid && uid != null) await sessions.revoke(uid, sid);
    } catch (e) {
      console.error("[wa-auth] logout error", e);
    }
    clearSessionCookies(req, res);
    res.json({ ok: true });
  });

  app.post("/api/auth/logout-all", requireUser, async (req, res) => {
    const me: AuthUser = (req as any).waUser;
    const n = await sessions.revokeAll(me.id);
    clearSessionCookies(req, res);
    res.json({ ok: true, revoked: n });
  });

  return { sessions };
}
