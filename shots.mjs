// Recaptures the five marketing screenshots in public/shots/ from the running app.
// Run against a fresh `npm start`: BASE=http://localhost:3111 node shots.mjs
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "public/shots";

const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await b.newContext({ viewport: { width: 1440, height: 940 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

await page.goto(`${BASE}/api/demo/reset`, { waitUntil: "networkidle" });

// ── patient side ───────────────────────────────────────────
await page.goto(`${BASE}/login/patient`);
await page.fill('input[name="phone"]', "+919011220001");
await page.getByRole("button", { name: /Send|code/i }).first().click();
await page.waitForTimeout(600);
await page.fill('input[name="otp"]', "123456");
await page.getByRole("button", { name: /Verify|Sign in|सत्यापित/i }).first().click();
await page.waitForURL((u) => u.pathname.startsWith("/patient"), { timeout: 15000 });

for (const [path, name] of [["/patient/records", "records"], ["/patient/billing", "billing"]]) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

// ── the public emergency card, on a phone, with no login ──
const phone = await b.newContext({ viewport: { width: 430, height: 1180 }, deviceScaleFactor: 2 });
const ph = await phone.newPage();
await ph.goto(`${BASE}/e/EMG-8f2a91c4d7`, { waitUntil: "networkidle" });
await ph.waitForTimeout(1200);
await ph.screenshot({ path: `${OUT}/emergency.png` });
await phone.close();

// ── doctor side ────────────────────────────────────────────
await ctx.clearCookies();
await page.goto(`${BASE}/login/doctor`);
await page.fill('input[name="email"]', "anita.deshmukh@nidan.in");
await page.fill('input[name="password"]', "demo1234");
await page.getByRole("button", { name: /Sign in/i }).first().click();
await page.waitForURL((u) => u.pathname.startsWith("/doctor"), { timeout: 15000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/queue.png` });

// open the first patient in today's queue, then the case sheet
await page.getByRole("button", { name: /Start consultation|Resume consultation/ }).first().click();
await page.waitForURL((u) => u.pathname.includes("/doctor/case/"), { timeout: 20000 });
await page.waitForSelector("aside", { timeout: 20000 });
await page.locator('button[data-rail="7"]').click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/casesheet.png` });

console.log("captured:", page.url());
await b.close();
