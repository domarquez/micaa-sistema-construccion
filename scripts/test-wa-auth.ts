/**
 * Tests básicos del login por WhatsApp (Evolution MOCKEADO, stores en memoria, sin DB ni envíos reales).
 *   npm run test:wa-auth
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-solo-para-tests";
process.env.MICAA_WA_WEBHOOK_TOKEN = "hook-test-token";
process.env.EVOLUTION_INSTANCE = "precios-ferreterias";

import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { registerWaAuthRoutes } from "../server/wa-auth/routes";
import { createMemoryOtpStore, createMemorySessionStore, createMemoryUserStore } from "../server/wa-auth/memory-stores";
import { normalizePhoneE164 } from "../server/wa-auth/phone";
import { isLoginRequestText } from "../server/wa-auth/webhook";
import { EvolutionError, type WaSender } from "../server/wa-auth/evolution";

let clock = new Date("2026-10-04T12:00:00Z").getTime();
const now = () => new Date(clock);
const advance = (ms: number) => { clock += ms; };

const sent: { to: string; text: string }[] = [];
let failNext = false;
const sender: WaSender = {
  isConfigured: () => true,
  getInstanceNumber: async () => "+59178732644",
  async sendText(to, text) {
    if (failNext) { failNext = false; throw new EvolutionError("Evolution respondió 500", 500); }
    sent.push({ to, text });
    return { messageId: "MOCK" + sent.length };
  },
};
const logs: string[] = [];

const otp = createMemoryOtpStore();
const users = createMemoryUserStore([
  { id: 1, username: "diego", email: "diego@example.com", role: "user", isActive: true, phone: null },
  { id: 50, username: "legacy", email: "legacy@example.com", role: "user", isActive: true, phone: "+59176666666", phoneVerified: false },
]);
const sessions = createMemorySessionStore();

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
registerWaAuthRoutes(app, { otp, users, sessions, sender, now, log: (m) => logs.push(m) });
// Ruta "existente" que usa el Bearer como los handlers actuales de routes.ts
import jwt from "jsonwebtoken";
app.get("/api/legacy-protected", (req, res) => {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return res.status(401).json({ message: "Token requerido" });
  try { const d: any = jwt.verify(h.slice(7), process.env.JWT_SECRET!); res.json({ userId: d.userId }); }
  catch { res.status(401).json({ message: "Token inválido" }); }
});

const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

async function call(method: string, path: string, body?: any, headers: Record<string, string> = {}) {
  const r = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, setCookie: r.headers.getSetCookie?.() || [] };
}
const codeFromLastMessage = () => /(\d{6})/.exec(sent[sent.length - 1].text)![1];
const ip = (n: number) => ({ "X-Forwarded-For": `10.0.0.${n}` });

let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try { await fn(); passed++; console.log("  ✓", name); }
  catch (e) { console.error("  ✗", name); throw e; }
}

(async () => {
  console.log("wa-auth tests");

  await test("normaliza teléfonos a E.164 (+591 por defecto)", async () => {
    assert.equal(normalizePhoneE164("7123 4567"), "+59171234567");
    assert.equal(normalizePhoneE164("071234567"), "+59171234567");
    assert.equal(normalizePhoneE164("591-71234567"), "+59171234567");
    assert.equal(normalizePhoneE164("+591 (712) 34567"), "+59171234567");
    assert.equal(normalizePhoneE164("0059171234567"), "+59171234567");
    assert.equal(normalizePhoneE164("59171234567@s.whatsapp.net"), "+59171234567");
    assert.equal(normalizePhoneE164("+54 9 11 2345 6789"), "+5491123456789");
    assert.equal(normalizePhoneE164("1234"), null);
    assert.equal(normalizePhoneE164("+591 5123456"), null);
    assert.equal(normalizePhoneE164("abc"), null);
  });

  await test("texto de pedido por WhatsApp", async () => {
    assert.ok(isLoginRequestText("Quiero mi código MICAA"));
    assert.ok(isLoginRequestText("quiero mi codigo micaa!"));
    assert.ok(!isLoginRequestText("precio del cemento"));
  });

  await test("GET config devuelve link wa.me con el texto", async () => {
    const r = await call("GET", "/api/auth/wa/config");
    assert.equal(r.status, 200);
    assert.equal(r.json.waLink, "https://wa.me/59178732644?text=Quiero%20mi%20c%C3%B3digo%20MICAA");
  });

  let token = "";
  let cookie = "";
  await test("request envía código (mensaje exacto, sin links) y no lo devuelve", async () => {
    const r = await call("POST", "/api/auth/wa/request", { phone: "7123 4567" }, ip(1));
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
    assert.equal(sent.length, 1);
    assert.ok(!JSON.stringify(r.json).includes(codeFromLastMessage()), "la respuesta no debe incluir el código");
    assert.equal(sent[0].to, "+59171234567");
    assert.match(sent[0].text, /^Tu código MICAA es \d{6}\. Vence en 5 minutos\. Si no lo pediste, ignóralo\.$/);
    assert.ok(!/http/i.test(sent[0].text));
    const stored = otp.rows[0];
    assert.notEqual(stored.codeHash, codeFromLastMessage(), "el código se guarda hasheado");
    assert.ok(!stored.codeHash.includes(codeFromLastMessage()));
    assert.ok(logs.every((l) => !l.includes(codeFromLastMessage())), "logs sin el código");
  });

  await test("cooldown de 60 s por número", async () => {
    const r = await call("POST", "/api/auth/wa/request", { phone: "71234567" }, ip(1));
    assert.equal(r.status, 429);
    assert.equal(r.json.code, "COOLDOWN");
    assert.equal(sent.length, 1);
  });

  await test("verify: código incorrecto -> 400 genérico", async () => {
    const wrong = codeFromLastMessage() === "000000" ? "111111" : "000000";
    const r = await call("POST", "/api/auth/wa/verify", { phone: "71234567", code: wrong }, ip(1));
    assert.equal(r.status, 400);
    assert.equal(r.json.code, "INVALID_CODE");
  });

  await test("verify correcto: crea cuenta, emite JWT + cookie httpOnly 1 año", async () => {
    const r = await call("POST", "/api/auth/wa/verify", { phone: "+591 71234567", code: codeFromLastMessage() }, { ...ip(1), "User-Agent": "Mozilla/5.0 (Linux; Android 14) Chrome/120.0" });
    assert.equal(r.status, 200);
    assert.equal(r.json.isNewUser, true);
    assert.equal(r.json.user.phoneVerified, true, "cuenta creada por WhatsApp = teléfono verificado");
    assert.ok(r.json.token);
    const sc = r.setCookie.find((c: string) => c.startsWith("micaa_session="))!;
    assert.ok(sc, "cookie de sesión");
    assert.match(sc, /HttpOnly/i);
    assert.match(sc, /Max-Age=31536000/);
    assert.match(sc, /SameSite=Lax/i);
    cookie = sc.split(";")[0];
    token = r.json.token;
    const decoded: any = jwt.decode(token);
    assert.ok(decoded.sid);
    assert.equal(users.users.find((u) => u.phone === "+59171234567")?.id, r.json.user.id);
    assert.equal(sessions.rows[0].deviceName, "Chrome en Android");
  });

  await test("el código no se puede reutilizar", async () => {
    const r = await call("POST", "/api/auth/wa/verify", { phone: "71234567", code: codeFromLastMessage() }, ip(1));
    assert.equal(r.status, 400);
  });

  await test("dispositivo recordado: solo cookie (sin Bearer) autentica rutas existentes", async () => {
    const r = await call("GET", "/api/legacy-protected", undefined, { Cookie: cookie });
    assert.equal(r.status, 200);
    assert.equal(r.json.userId, users.users.find((u) => u.phone === "+59171234567")!.id);
  });

  await test("renovación deslizante: tras 2 h de uso se extiende expires_at", async () => {
    const before = sessions.rows[0].expiresAt.getTime();
    advance(2 * 3600_000);
    const r = await call("GET", "/api/legacy-protected", undefined, { Cookie: cookie });
    assert.equal(r.status, 200);
    assert.ok(sessions.rows[0].expiresAt.getTime() > before);
    assert.ok(r.setCookie.some((c: string) => c.startsWith("micaa_session=")), "cookie re-emitida");
  });

  await test("mis dispositivos + cerrar sesión en todos revoca JWT y cookie", async () => {
    const list = await call("GET", "/api/auth/devices", undefined, { Authorization: `Bearer ${token}` });
    assert.equal(list.status, 200);
    assert.equal(list.json.devices.length, 1);
    assert.equal(list.json.devices[0].current, true);
    const out = await call("POST", "/api/auth/logout-all", {}, { Authorization: `Bearer ${token}` });
    assert.equal(out.status, 200);
    assert.equal((await call("GET", "/api/legacy-protected", undefined, { Authorization: `Bearer ${token}` })).status, 401);
    assert.equal((await call("GET", "/api/legacy-protected", undefined, { Cookie: cookie })).status, 401);
  });

  await test("máximo 3 envíos por número por hora", async () => {
    // ya hubo 1 envío a este número en la última hora (hace 2 h -> no cuenta); hacemos 3 nuevos
    for (let i = 0; i < 3; i++) {
      advance(61_000);
      const r = await call("POST", "/api/auth/wa/request", { phone: "76543210" }, ip(2));
      assert.equal(r.status, 200, `envío ${i + 1}`);
    }
    advance(61_000);
    const r = await call("POST", "/api/auth/wa/request", { phone: "76543210" }, ip(2));
    assert.equal(r.status, 429);
    assert.equal(r.json.code, "RATE_LIMITED");
  });

  await test("5 intentos por código", async () => {
    advance(3600_000);
    await call("POST", "/api/auth/wa/request", { phone: "60000001" }, ip(3));
    const good = codeFromLastMessage();
    const bad = good === "999999" ? "888888" : "999999";
    for (let i = 0; i < 4; i++) {
      assert.equal((await call("POST", "/api/auth/wa/verify", { phone: "60000001", code: bad }, ip(3))).status, 400);
    }
    assert.equal((await call("POST", "/api/auth/wa/verify", { phone: "60000001", code: bad }, ip(3))).status, 429);
    assert.equal((await call("POST", "/api/auth/wa/verify", { phone: "60000001", code: good }, ip(3))).status, 429, "agotado aunque luego acierte");
  });

  await test("código vence a los 5 min", async () => {
    advance(61_000);
    await call("POST", "/api/auth/wa/request", { phone: "60000002" }, ip(4));
    const c = codeFromLastMessage();
    advance(5 * 60_000 + 1000);
    assert.equal((await call("POST", "/api/auth/wa/verify", { phone: "60000002", code: c }, ip(4))).status, 400);
  });

  await test("máximo 10 envíos por IP por hora", async () => {
    advance(3600_000);
    for (let i = 0; i < 10; i++) {
      const r = await call("POST", "/api/auth/wa/request", { phone: `6100000${i}` }, ip(5));
      assert.equal(r.status, 200, `ip envío ${i + 1}`);
    }
    const r = await call("POST", "/api/auth/wa/request", { phone: "61000010" }, ip(5));
    assert.equal(r.status, 429);
  });

  await test("si Evolution falla -> 502 con mensaje claro", async () => {
    advance(3600_000);
    failNext = true;
    const r = await call("POST", "/api/auth/wa/request", { phone: "62000000" }, ip(6));
    assert.equal(r.status, 502);
    assert.equal(r.json.code, "WA_SEND_FAILED");
    assert.match(r.json.message, /WhatsApp/);
  });

  await test("teléfono inválido -> 400", async () => {
    const r = await call("POST", "/api/auth/wa/request", { phone: "123" }, ip(6));
    assert.equal(r.status, 400);
  });

  await test("webhook Evolution: 'Quiero mi código MICAA' (LID) responde con código al mismo número", async () => {
    advance(3600_000);
    const nowS = Math.floor(Date.now() / 1000);
    const payload = {
      event: "messages.upsert",
      instance: "precios-ferreterias",
      data: {
        key: { remoteJid: "163114402197598@lid", remoteJidAlt: "59177000111@s.whatsapp.net", fromMe: false, id: "ABC" },
        message: { conversation: "Quiero mi código MICAA" },
        messageType: "conversation",
        messageTimestamp: nowS,
      },
    };
    assert.equal((await call("POST", "/api/webhooks/evolution", payload)).status, 401, "sin token");
    const n = sent.length;
    const r = await call("POST", "/api/webhooks/evolution?token=hook-test-token", payload);
    assert.equal(r.status, 200);
    assert.equal(sent.length, n + 1);
    assert.equal(sent[sent.length - 1].to, "+59177000111");
    const v = await call("POST", "/api/auth/wa/verify", { phone: "77000111", code: codeFromLastMessage() }, ip(7));
    assert.equal(v.status, 200);
  });

  await test("webhook ignora grupos, fromMe y otros textos", async () => {
    const n = sent.length;
    const nowS = Math.floor(Date.now() / 1000);
    for (const data of [
      { key: { remoteJid: "120363360597848065@g.us", fromMe: false, participantAlt: "59170000001@s.whatsapp.net" }, message: { conversation: "Quiero mi código MICAA" }, messageTimestamp: nowS },
      { key: { remoteJid: "59170000002@s.whatsapp.net", fromMe: true }, message: { conversation: "Quiero mi código MICAA" }, messageTimestamp: nowS },
      { key: { remoteJid: "59170000003@s.whatsapp.net", fromMe: false }, message: { conversation: "Hola, precio del fierro" }, messageTimestamp: nowS },
    ]) {
      await call("POST", "/api/webhooks/evolution?token=hook-test-token", { event: "messages.upsert", instance: "precios-ferreterias", data });
    }
    assert.equal(sent.length, n);
  });

  await test("vincular WhatsApp a cuenta existente con correo/contraseña", async () => {
    const legacy = jwt.sign({ userId: 1, username: "diego", email: "diego@example.com", role: "user" }, process.env.JWT_SECRET!, { expiresIn: "24h" });
    advance(61_000);
    const rq = await call("POST", "/api/auth/wa/link/request", { phone: "79999999" }, { Authorization: `Bearer ${legacy}`, ...ip(8) });
    assert.equal(rq.status, 200);
    const lv = await call("POST", "/api/auth/wa/link/verify", { phone: "79999999", code: codeFromLastMessage() }, { Authorization: `Bearer ${legacy}`, ...ip(8) });
    assert.equal(lv.status, 200);
    assert.equal(users.users[0].phone, "+59179999999");
    // ahora login por WhatsApp entra a la MISMA cuenta
    advance(61_000);
    await call("POST", "/api/auth/wa/request", { phone: "79999999" }, ip(8));
    const v = await call("POST", "/api/auth/wa/verify", { phone: "79999999", code: codeFromLastMessage() }, ip(8));
    assert.equal(v.status, 200);
    assert.equal(v.json.user.id, 1);
    assert.equal(v.json.isNewUser, false);
    // JWT legacy sigue funcionando
    assert.equal((await call("GET", "/api/legacy-protected", undefined, { Authorization: `Bearer ${legacy}` })).status, 200);
  });

  await test("no revela si el número existe (misma respuesta)", async () => {
    advance(3600_000);
    const a = await call("POST", "/api/auth/wa/request", { phone: "79999999" }, ip(9)); // existe
    const b = await call("POST", "/api/auth/wa/request", { phone: "79999998" }, ip(9)); // no existe
    assert.equal(a.status, b.status);
    assert.deepEqual(Object.keys(a.json).sort(), Object.keys(b.json).sort());
    assert.equal(a.json.message, b.json.message);
  });

  await test("login por WhatsApp de cuenta existente con teléfono sin verificar → queda verificado", async () => {
    advance(3600_000);
    const q = await call("POST", "/api/auth/wa/request", { phone: "76666666" }, ip(20));
    assert.equal(q.status, 200);
    const v = await call("POST", "/api/auth/wa/verify", { phone: "76666666", code: codeFromLastMessage() }, ip(20));
    assert.equal(v.status, 200);
    assert.equal(v.json.user.id, 50);
    assert.equal(v.json.user.phoneVerified, true);
    assert.equal(users.users.find((u) => u.id === 50)?.phoneVerified, true);
  });

  await test("logs sin códigos", async () => {
    const codes = sent.map((s) => /(\d{6})/.exec(s.text)![1]);
    for (const l of logs) for (const c of codes) assert.ok(!l.includes(c), `log contiene código: ${l}`);
  });

  server.close();
  console.log(`\n${passed} tests OK`);
})().catch((e) => {
  console.error(e);
  server.close();
  process.exit(1);
});
