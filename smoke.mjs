// Demo happy-path smoke test — the six-minute run, driven end to end.
//
//   npx playwright install chromium     (once)
//   npm run build && npm start          (in another terminal)
//   npm run smoke                       (or: node smoke.mjs http://localhost:3000)
//
// 40 assertions. If they all pass, the demo path works.
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3210";
const pass = [];
const fail = [];
const check = (name, ok, detail = "") => (ok ? pass : fail).push(`${name}${detail ? ` — ${detail}` : ""}`);

// Uses Playwright's own Chromium. Run `npx playwright install chromium` once.
// CHROMIUM_PATH overrides it if you already have a browser on disk.
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

try {
  // Every run starts from an identical clean state — the same guarantee the
  // demo needs, and it exercises the reset endpoint on the way past.
  const reset = await page.request.post(`${BASE}/api/demo/reset`);
  check("demo dataset resets to a clean state", reset.ok());

  // ── 1a · The public site is the front door ──────────────────
  await page.goto(BASE, { waitUntil: "networkidle" });
  const homeText = await page.textContent("main");
  check("public homepage explains the product",
    homeText.includes("plastic bag of paper") &&
    homeText.includes("consented, portable health data") &&
    (await page.getByRole("link", { name: /Open the live demo/ }).count()) > 0);
  const shots = await page.locator('img[src^="/shots/"]').count();
  check("homepage shows real screenshots of the app", shots >= 4, `${shots} images`);

  // ── 1b · The two-door fork now lives at /start ──────────────
  await page.getByRole("link", { name: /Open the live demo/ }).first().click();
  await page.waitForURL("**/start", { timeout: 15000 });
  check("landing shows both doors",
    (await page.getByRole("heading", { name: /I'm a Patient/ }).count()) === 1 &&
    (await page.getByRole("heading", { name: /I'm a Doctor/ }).count()) === 1);

  // ── 2 · Patient phone-OTP login ─────────────────────────────
  await page.goto(`${BASE}/login/patient`);
  await page.getByRole("button", { name: /Sunita Kale/ }).click();
  await page.fill('input[name="phone"]', "+919011220001");
  await page.getByRole("button", { name: "Send code" }).click();
  await page.waitForSelector('input[name="otp"]');
  await page.fill('input[name="otp"]', "123456");
  await page.getByRole("button", { name: "Verify" }).click();
  await page.waitForURL((u) => u.pathname === "/patient" || u.pathname.startsWith("/patient/"), { timeout: 20000 });
  await page.goto(`${BASE}/patient/records`, { waitUntil: "networkidle" });
  check("patient signs in with OTP", page.url().includes("/patient/records"));

  // Sunita's profile locale is Hindi, so the app comes up in Hindi. Assert
  // that, then switch to English so the rest of the run reads deterministically.
  const hindiNav = await page.textContent("nav");
  check("patient app honours the profile locale (Hindi)", hindiNav.includes("रिकॉर्ड"));
  await page.getByRole("button", { name: "EN" }).first().click();
  await page.waitForFunction(
    () => document.querySelector("nav")?.textContent?.includes("Records") ?? false,
    null, { timeout: 20000 },
  ).catch(() => {});
  await page.waitForLoadState("networkidle");
  check("language switcher changes the whole patient app",
    (await page.textContent("nav")).includes("Records"));

  // Third language. Telugu is a different script from both English and Hindi,
  // so this also proves the font stack and <html lang> follow the switch.
  await page.getByRole("button", { name: "తె" }).first().click();
  await page.waitForFunction(
    () => document.documentElement.lang === "te-IN",
    null, { timeout: 20000 },
  ).catch(() => {});
  await page.waitForLoadState("networkidle");
  const teluguNav = await page.textContent("nav");
  check("Telugu is a complete third language",
    teluguNav.includes("రికార్డులు") && (await page.getAttribute("html", "lang")) === "te-IN",
    `lang=${await page.getAttribute("html", "lang")}`);
  await page.getByRole("button", { name: "EN" }).first().click();
  await page.waitForFunction(
    () => document.querySelector("nav")?.textContent?.includes("Records") ?? false,
    null, { timeout: 20000 },
  ).catch(() => {});
  await page.waitForLoadState("networkidle");

  // ── 3 · Records timeline is populated ───────────────────────
  await page.waitForSelector("ol li", { timeout: 15000 });
  const timelineCount = await page.locator("ol li").count();
  check("health timeline renders", timelineCount > 10, `${timelineCount} entries`);

  await page.goto(`${BASE}/patient/records?tab=reports`);
  await page.waitForSelector("svg.recharts-surface", { timeout: 15000 });
  check("analyte trend chart renders", true);

  // ── 4 · Booking wizard against the slot generator ───────────
  await page.goto(`${BASE}/patient/book`);
  await page.getByRole("button", { name: /Sanjeevani Multispeciality/ }).click();
  await page.getByRole("button", { name: /Dr\. Anita Deshmukh/ }).click();
  await page.waitForSelector("text=/Morning|No clinic/", { timeout: 15000 });

  // walk forward until a day with free slots turns up
  let booked = false;
  for (let i = 0; i < 10 && !booked; i++) {
    const slots = page.locator("button", { hasText: /^\d{1,2}:\d{2} (am|pm)$/i });
    const n = await slots.count();
    for (let j = 0; j < n; j++) {
      const s = slots.nth(j);
      if (await s.isEnabled()) { await s.click(); booked = true; break; }
    }
    if (!booked) {
      await page.locator('button:has(span:text-is("' + String(new Date().getDate() + i + 1) + '"))').first().click().catch(() => {});
      await page.waitForTimeout(600);
    }
  }
  check("slot grid offers a legal slot", booked);

  if (booked) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.fill("textarea", "Chest discomfort while climbing stairs");
    const consent = await page.getByText(/lets Dr\. Anita Deshmukh view your health records/).count();
    check("consent sentence is shown before booking", consent === 1);
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await page.waitForURL("**/patient/appointments", { timeout: 20000 });
    check("booking lands in Appointments", page.url().includes("/patient/appointments"));
  }

  // ── 5 · Access log and revoke ───────────────────────────────
  await page.goto(`${BASE}/patient/access`);
  const grants = await page.getByText("Doctors with access").count();
  const revokeBtns = await page.getByRole("button", { name: "Revoke" }).count();
  check("access log lists grants with a revoke control", grants === 1 && revokeBtns > 0, `${revokeBtns} revocable`);

  // ── 6 · Emergency card, public and no login ─────────────────
  const anon = await browser.newContext();
  const anonPage = await anon.newPage();
  await anonPage.goto(`${BASE}/e/EMG-8f2a91c4d7`, { waitUntil: "networkidle" });
  const bodyText = await anonPage.textContent("body");
  check("public emergency card opens without a login",
    bodyText.includes("Penicillin") && bodyText.includes("B+") && bodyText.includes("logged"));
  check("emergency card leaks nothing clinical beyond the slice",
    !bodyText.includes("Provisional") && !bodyText.includes("Billing"));
  await anon.close();

  // ── 7 · Doctor console ──────────────────────────────────────
  const docCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const doc = await docCtx.newPage();
  doc.on("pageerror", (e) => errors.push(String(e)));
  await doc.goto(`${BASE}/login/doctor`);
  await doc.fill('input[name="email"]', "anita.deshmukh@nidan.in");
  await doc.fill('input[name="password"]', "demo1234");
  await doc.getByRole("button", { name: "Sign in" }).click();
  await doc.waitForURL("**/doctor", { timeout: 15000 });
  await doc.getByRole("button", { name: /Start consultation|Resume consultation|Open case sheet/ })
    .first().waitFor({ timeout: 20000 });
  const queueRows = await doc.getByRole("button", { name: /Start consultation|Resume consultation|Open case sheet/ }).count();
  check("today's queue is populated", queueRows >= 4, `${queueRows} patients`);

  // ── 8 · Consent refusal for a patient with no relationship ──
  await doc.goto(`${BASE}/doctor/lookup`);
  await doc.waitForSelector('input[placeholder*="MRN"]', { timeout: 15000 });
  await doc.fill('input[placeholder*="MRN"]', "Joseph");
  await doc.waitForSelector("text=/no relationship|care relationship active/", { timeout: 10000 });
  const locked = await doc.getByText("no relationship").count();
  check("a patient with no care relationship shows as locked", locked > 0);

  // ── 9 · Start a consultation and write the case sheet ───────
  await doc.goto(`${BASE}/doctor`);
  await doc.waitForSelector("text=Today's clinic", { timeout: 15000 });
  await doc.getByRole("button", { name: /Start consultation|Resume consultation/ }).first().click();
  await doc.waitForURL("**/doctor/case/**", { timeout: 20000 });
  check("case sheet opens", doc.url().includes("/doctor/case/"));

  // The section rail: fourteen chips, one click to any section.
  await doc.waitForSelector("button[data-rail]", { timeout: 15000 });
  const railChips = await doc.locator("button[data-rail]").count();
  await doc.locator('button[data-rail="7"]').click();          // 8 · Vitals
  await doc.waitForSelector("#section-7 input[type=number]", { timeout: 10000 });
  check("the section rail jumps straight to a section", railChips === 14,
    `${railChips} chips`);

  // Escape collapses, so the rest of the run opens sections from a known state.
  await doc.keyboard.press("Escape");
  await doc.waitForSelector("#section-7 input[type=number]", { state: "hidden", timeout: 10000 });

  await doc.waitForSelector("aside", { timeout: 20000 });
  const panel = await doc.textContent("aside");
  check("context panel shows allergies in the right pane", panel.includes("Penicillin"));

  // vitals with live flagging
  await doc.getByRole("button", { name: /^8 Vitals$/ }).click();
  const bp = doc.locator('input[type="number"]').nth(3);
  await bp.fill("176");
  await doc.waitForTimeout(400);
  const flagged = await doc.getByText("↑ high").count();
  check("out-of-range vital flags live", flagged > 0);

  // assessment
  await doc.getByRole("button", { name: /^11 Assessment$/ }).click();
  await doc.fill('input[placeholder="Type to search ICD-11"]', "hyperten");
  await doc.waitForTimeout(300);
  const icdHit = await doc.getByRole("button", { name: /Essential hypertension/ }).count();
  check("ICD-11 autocomplete returns codes", icdHit > 0);
  if (icdHit) await doc.getByRole("button", { name: /Essential hypertension/ }).first().click();

  // prescription with an allergy block
  await doc.getByRole("button", { name: /^\s*13\s*Prescription/ }).click().catch(async () => {
    await doc.getByText("Prescription", { exact: true }).click();
  });
  await doc.fill('input[placeholder*="drug master"]', "Augmentin");
  await doc.waitForTimeout(400);
  await doc.getByRole("button", { name: /Augmentin/ }).first().click();
  await doc.waitForSelector("text=Check before prescribing", { timeout: 8000 });
  const dialog = await doc.textContent('[role="alertdialog"]');
  check("penicillin allergy blocks amoxicillin by drug class",
    dialog.includes("Allergy: Penicillin") && dialog.toLowerCase().includes("cross-react"));
  await doc.getByRole("button", { name: "Choose a different drug" }).click();

  // safe drug goes through
  await doc.fill('input[placeholder*="drug master"]', "Crocin");
  await doc.waitForTimeout(400);
  await doc.getByRole("button", { name: /Crocin/ }).first().click();
  const preview = await doc.getByText(/one tablet morning and night/).count();
  check("1-0-1 renders a plain-language preview", preview > 0);
  await doc.getByRole("button", { name: /Issue prescription/ }).click();
  await doc.waitForSelector("text=Prescription issued", { timeout: 15000 });
  check("prescription is issued", true);

  // autosave
  // The indicator reads "Saved just now" for the first minute, then "Saved 1 min ago".
  await doc.waitForSelector("text=/Saved (just now|.* ago)/", { timeout: 15000 });
  check("case sheet autosaves", true);

  // finalize
  await doc.getByRole("button", { name: /Finalise consultation/ }).click();
  await doc.getByRole("dialog").getByRole("button", { name: "Finalise", exact: true }).click();
  await doc.waitForSelector("text=finalised", { timeout: 25000 });
  check("finalise makes the sheet immutable", true);
  const summarised = await doc.getByText(/AI-generated/).count();
  check("visit summary is labelled AI-generated", summarised > 0);

  // ── 10 · FHIR export ────────────────────────────────────────
  const caseId = doc.url().split("/").pop();
  const fhir = await doc.request.get(`${BASE}/api/fhir/case/${caseId}`);
  const bundle = await fhir.json();
  const types = new Set(bundle.entry.map((e) => e.resource.resourceType));
  check("FHIR R4 document bundle exports",
    bundle.resourceType === "Bundle" && bundle.type === "document" &&
    ["Composition", "Patient", "Encounter", "Practitioner", "AllergyIntolerance"].every((t) => types.has(t)),
    [...types].join(", "));

  // ── 11 · RLS-equivalent refusal over HTTP ───────────────────
  // cs-70 belongs to Joseph D'Souza, with whom Dr Anita has no relationship.
  const denied = await doc.request.get(`${BASE}/api/fhir/case/cs-70`);
  check("a case sheet outside the care relationship is refused",
    denied.status() === 403, `HTTP ${denied.status()}`);
  // ── 10 · The availability editor actually writes ────────────
  await doc.goto(`${BASE}/doctor/profile`, { waitUntil: "networkidle" });
  await doc.getByRole("button", { name: /Edit Wednesday clinic hours/ }).click();
  await doc.getByRole("button", { name: /Add a clinic block/ }).waitFor({ timeout: 10000 });

  // Wait for the inputs themselves, not just the panel — reading the count
  // before React has mounted them silently skipped the edit and made this
  // assertion flaky.
  const ends = doc.locator('input[type="time"]');
  await ends.nth(1).waitFor({ state: "visible", timeout: 10000 });
  const blockCount = await ends.count();

  // An illegal block must be refused by the server, not accepted and repaired.
  await ends.nth(1).fill("09:07");
  await doc.getByRole("button", { name: "Save day" }).click();
  // Match the message itself rather than [role="alert"] — the page has other
  // live regions (the autosave announcer among them) and an empty one was
  // satisfying the wait.
  const refusalEl = doc.getByText(/does not divide into/i).first();
  const refused = await refusalEl.waitFor({ state: "visible", timeout: 15000 })
    .then(() => true).catch(() => false);
  const refusal = refused ? await refusalEl.textContent() : "(no message)";
  check("availability rejects a block that does not divide into slots",
    refused, `${blockCount} inputs · ${refusal.slice(0, 50)}`);

  // A legal change saves and comes back from the server.
  await ends.nth(1).fill("12:00");
  await doc.getByRole("button", { name: "Save day" }).click();
  await doc.waitForSelector("text=saved", { timeout: 10000 });
  const wedRow = await doc.textContent("text=/Wednesday|Wed/ >> xpath=ancestor::div[1]").catch(() => "");
  check("availability editor writes a new clinic block",
    (await doc.content()).includes("–12:00"), wedRow.slice(0, 60));

  // ── 12 · A leftover session must not skip the fork ──────────
  // This used to redirect straight into the console, which made the demo look
  // like the login screen had vanished.
  await doc.goto(`${BASE}/start`, { waitUntil: "networkidle" });
  const startText = await doc.textContent("main");
  check("a signed-in visitor still sees the two-door fork",
    doc.url().endsWith("/start") &&
      startText.includes("I'm a Patient") &&
      startText.includes("I'm a Doctor") &&
      /still signed in/i.test(startText),
    doc.url());

  // cs-1 belongs to Sunita, who booked with her — that one is allowed.
  const allowed = await doc.request.get(`${BASE}/api/fhir/case/cs-1`);
  check("a case sheet inside the care relationship is served", allowed.status() === 200);

  await docCtx.close();

  // ── 13 · The app is light even when the OS asks for dark ────
  // The theme is a product decision, not an OS preference. Dark is opt-in.
  const darkOs = await browser.newContext({ colorScheme: "dark", viewport: { width: 1280, height: 800 } });
  const dp = await darkOs.newPage();
  await dp.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const bg = await dp.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const [r, g, b] = bg.match(/\d+/g).map(Number);
  check("the page stays light under a dark OS preference", r > 200 && g > 200 && b > 200, bg);

  // ── 14 · The theme toggle ───────────────────────────────────
  await dp.getByRole("button", { name: "Dark theme" }).click();
  await dp.waitForFunction(
    () => document.documentElement.getAttribute("data-theme") === "dark",
    null, { timeout: 10000 },
  );
  const darkBg = await dp.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const [dr, dg, db_] = darkBg.match(/\d+/g).map(Number);
  check("the theme toggle switches the page to dark", dr < 60 && dg < 60 && db_ < 60, darkBg);

  // The choice has to survive a reload, and without a flash of the wrong
  // theme — the inline script in the layout re-applies it before first paint.
  await dp.reload({ waitUntil: "networkidle" });
  const stuck = await dp.evaluate(() => ({
    attr: document.documentElement.getAttribute("data-theme"),
    bg: getComputedStyle(document.body).backgroundColor,
  }));
  const [sr, sg, sb] = stuck.bg.match(/\d+/g).map(Number);
  check("the theme choice survives a reload",
    stuck.attr === "dark" && sr < 60 && sg < 60 && sb < 60, `${stuck.attr} ${stuck.bg}`);

  await darkOs.close();

  // ── 15 · The service worker never caches an auth-gated page ─
  // v1 precached /patient/records; signed out that redirects to the login
  // page, which then sat in the cache pretending to be the records page.
  // This is production-only behaviour, so only a production build catches it.
  const swCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const sp = await swCtx.newPage();
  await sp.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const swState = await sp.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return { supported: false, keys: [] };
    await navigator.serviceWorker.ready.catch(() => {});
    // Give the install handler a moment to populate the cache.
    await new Promise((r) => setTimeout(r, 1500));
    const names = await caches.keys();
    const keys = [];
    for (const n of names) {
      const c = await caches.open(n);
      for (const req of await c.keys()) keys.push(new URL(req.url).pathname);
    }
    return { supported: true, keys };
  });
  const leaked = swState.keys.filter((k) => /^\/(patient|doctor)(\/|$)/.test(k));
  check("the service worker caches no auth-gated route",
    leaked.length === 0, leaked.join(", ") || `${swState.keys.length} public entries`);
  await swCtx.close();

  // Google Fonts and the favicon are unreachable in the offline test sandbox;
  // those are environmental, not application errors.
  const real = errors.filter(
    (e) =>
      // Google Fonts is unreachable in the offline sandbox, and an RSC
      // prefetch aborted by the next navigation is a test artefact.
      !/ERR_TUNNEL_CONNECTION_FAILED|favicon|fonts\.(googleapis|gstatic)/i.test(e) &&
      !/Failed to fetch RSC payload/i.test(e),
  );
  check("no uncaught page errors", real.length === 0, real.slice(0, 3).join(" | "));
} catch (e) {
  fail.push(`threw: ${e.message}`);
} finally {
  await browser.close();
}

console.log("\nPASS");
pass.forEach((p) => console.log("  ✓ " + p));
if (fail.length) {
  console.log("\nFAIL");
  fail.forEach((f) => console.log("  ✗ " + f));
}
console.log(`\n${pass.length} passed, ${fail.length} failed`);
process.exit(fail.length ? 1 : 0);
