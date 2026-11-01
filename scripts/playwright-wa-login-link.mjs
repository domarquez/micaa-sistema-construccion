/**
 * Verifica que el botón principal de login abra wa.me/59176105183 con el texto
 * «Quiero mi código MICAA» (con o sin ref).
 *   BASE_URL=https://micaa.site node scripts/playwright-wa-login-link.mjs
 */
import { chromium } from "playwright";

const BASE = (process.env.BASE_URL || "https://micaa.site").replace(/\/+$/, "");
const EXPECT_NUM = process.env.MICAA_WA_LOGIN_NUMBER || "59176105183";
const EXPECT_TEXT = "Quiero mi código MICAA";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60_000 });
  const link = page.locator('[data-testid="button-wa-open"]');
  await link.waitFor({ state: "visible", timeout: 30_000 });
  const href = await link.getAttribute("href");
  if (!href) throw new Error("button-wa-open sin href");
  const u = new URL(href);
  if (u.protocol !== "https:" || u.hostname !== "wa.me") {
    throw new Error(`host inesperado: ${href}`);
  }
  if (u.pathname.replace(/^\//, "") !== EXPECT_NUM) {
    throw new Error(`número inesperado: ${u.pathname} (esperaba /${EXPECT_NUM})`);
  }
  const text = decodeURIComponent(u.searchParams.get("text") || "");
  if (!text.startsWith(EXPECT_TEXT)) {
    throw new Error(`texto inesperado: ${JSON.stringify(text)}`);
  }
  // No debe quedar el botón outbound
  const outbound = await page.locator('[data-testid="button-wa-send"]').count();
  if (outbound > 0) throw new Error("button-wa-send (outbound) sigue visible");
  console.log("OK", href);
} finally {
  await browser.close();
}
