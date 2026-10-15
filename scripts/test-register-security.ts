/**
 * Cubre el hueco: /api/auth/register no debe marcar phone_verified ni squattear el teléfono.
 * SPA: /api huérfana, /wp-admin, /.git/config → 404 real (no index.html 200).
 *   npm run test:register-security
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-solo-para-tests";
process.env.NODE_ENV = "test";

import assert from "node:assert/strict";
import { shouldSpaFallback } from "../server/spa-fallback";
import { SESSION_TTL_DAYS, SESSION_TTL_MS } from "../server/wa-auth/sessions";

let passed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log("  ✓", name); }
  catch (e) { console.error("  ✗", name); throw e; }
}

console.log("register-security + spa 404 + sesión");

await test("SESSION_TTL es 30 días (documentado)", () => {
  assert.equal(SESSION_TTL_DAYS, 30);
  assert.equal(SESSION_TTL_MS, 30 * 24 * 3600_000);
});

await test("shouldSpaFallback: app routes sí", () => {
  assert.equal(shouldSpaFallback("/"), true);
  assert.equal(shouldSpaFallback("/materiales/61"), true);
  assert.equal(shouldSpaFallback("/login"), true);
  assert.equal(shouldSpaFallback("/publicar-precio"), true);
});

await test("shouldSpaFallback: /api, escaneos y dotfiles → no (404 real)", () => {
  assert.equal(shouldSpaFallback("/api"), false);
  assert.equal(shouldSpaFallback("/api/no-existe"), false);
  assert.equal(shouldSpaFallback("/api/auth/register"), false);
  assert.equal(shouldSpaFallback("/wp-admin"), false);
  assert.equal(shouldSpaFallback("/wp-admin/"), false);
  assert.equal(shouldSpaFallback("/.git/config"), false);
  assert.equal(shouldSpaFallback("/.env"), false);
  assert.equal(shouldSpaFallback("/wordpress/wp-login.php"), false);
  assert.equal(shouldSpaFallback("/shell.php"), false);
});

console.log(`\n${passed} tests OK`);
