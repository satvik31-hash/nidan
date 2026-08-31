# Nidan — instructions for AI coding agents

Read this before changing anything. It is the source of truth for how this
codebase works and what must not break.

Nidan is a consent-aware clinical record and case-taking platform for Indian
hospitals, built for the Smart India Hackathon problem statement *Patient
Case-Taking Software*. It is a **finished, working, tested application** — not a
scaffold. 39 end-to-end tests pass. Treat existing code as deliberate.

---

## The one idea the whole app is built on

The patient dashboard is the **consumer surface**. The doctor's structured case
sheet is the **system of record**. Every patient tab is a read-view over data the
case sheet produced. Do not add features that write clinical data from the
patient side.

---

## Invariants — breaking any of these breaks the project

### 1. Consent is enforced at the data layer, never in the UI

A doctor does not "have access to patients". A doctor has access to *a specific
patient, for a bounded window, because a care relationship exists*.

- Every clinical read goes through `assertAccess()` in `src/lib/db/store.ts`.
- **Never** read `db.caseSheets`, `db.vitals`, `db.documents` etc. directly from
  a page, action or route handler. Use the gated accessors
  (`caseSheetsFor`, `vitalsFor`, `documentsFor`, …), which take an actor.
- The SQL equivalent is `has_care_access()` in
  `supabase/migrations/006_governance.sql`. If you change the access rule in one
  place, change it in both.
- Every access to another person's record writes an `access_audit` row. Do not
  add a read path that skips the audit.

### 2. Clinical records are append-only

Finalised case sheets are immutable. A correction creates a linked amendment
(`amends_id`), it never overwrites. There is no DELETE policy on any clinical
table, deliberately. Do not add one.

### 3. Time is IST wall-clock, stored as UTC

Clinic days, availability rules and "today's queue" are **Asia/Kolkata**
wall-clock. Stored instants are UTC.

- Always use `src/lib/tz.ts` — `istDay()`, `istWeekday()`, `istInstant()`,
  `addIstDays()`, `istHour()`.
- **Never** use `new Date().getHours()`, `.getDay()`, or
  `.toISOString().slice(0, 10)` for anything clinic-related. This bug was already
  found and fixed once; on a UTC server it silently turns a 9 a.m. clinic into a
  2:30 p.m. one.

### 4. The emergency card exposes exactly six things

`/e/[token]` is public, no login. It shows blood group, allergies, current
medications, chronic conditions, organ donor status, emergency contacts — and
nothing else, ever. Widening that slice defeats the entire consent model.
Every scan writes an audit row with `basis = 'emergency_override'` and notifies
the patient.

### 5. AI is assistive, labelled, and never autonomous

In `src/lib/ai.ts`:

- Every output is visibly labelled with `<AiLabel />` and requires doctor
  confirmation before entering the record.
- The model never prescribes, never diagnoses, never triages an emergency.
- Any red-flag symptom string short-circuits to the emergency screen *before* a
  request is made (`isRedFlag()` in `src/lib/clinical.ts`).
- Every AI function has an offline template fallback so the demo works with no
  API key. Keep that pattern for anything new.

### 6. Secrets never reach the browser

Anything prefixed `NEXT_PUBLIC_` is in the client bundle. The service-role key,
API keys and client secrets must never be prefixed. If a service-role key ever
reaches the browser, every RLS policy in this repo is decoration.

### 7. The mock store and the SQL describe the same world

`src/lib/db/seed.ts` and `supabase/seed.sql` use the **same UUIDs** and the same
people. `src/lib/db/store.ts` implements the same rules as the migrations: the
same access check, the same slot generator, the same double-booking rejection
(same `23P01` error code), the same append-only behaviour. Change one, change the
other.

`MOCK_DB=true` is the demo-day parachute. Never delete the mock store.

---

## Conventions

**Framework.** Next.js 15 App Router, React 19, TypeScript strict. Server
Components by default — add `"use client"` only when the component needs state,
effects or event handlers. Mutations are Server Actions in `src/app/actions/`.
Route handlers only where something external calls in or a secret is involved.

**Styling.** Tailwind v4. All colour, spacing and radius come from CSS custom
properties defined in `src/app/globals.css`. The app is **light by default and
does not follow `prefers-color-scheme`** — dark is opt-in via `<ThemeToggle />`,
which sets `data-theme="dark"` and stores `nidan-theme`. Do not reintroduce an
OS-preference media query for colour.

Two families of token exist precisely because `--color-ink` and `--color-paper`
swap between themes:

- `--color-chrome` / `--color-chrome-ink` — the doctor console bar and the
  doctor card on `/start`. These stay dark in **both** themes. Using
  `--color-ink` there turned the console header white in dark mode.
- `--color-on-brand` / `--color-on-critical` / `--color-on-good` — text that
  sits **on** a filled colour. Never write `bg-[var(--color-brand)] text-white`:
  the dark theme's brand is a pale blue where white text is about 1.9:1. Use `var(--color-brand)`,
`var(--color-ink-2)` and so on — **never hardcode a hex value** in a component.

**Semantic colour is reserved for clinical meaning.** `--color-critical` is for
allergies, emergencies, out-of-range vitals and destructive actions. If red
appears anywhere that is not a warning, the warning stops working. Never encode
status by colour alone — always pair with an icon or a text label.

**Charts** use the separate `--chart-1` … `--chart-6` palette, which was checked
for colourblind separation in both light and dark. Do not substitute other hues.

**i18n.** The patient surface is completely translated in `src/lib/i18n.ts`
(English, Hindi and Telugu), including clinical terms. Any new patient-facing
string must be added to **all three** catalogues — and to `FirstAid`, whose
content map is keyed by `Locale` and so will not compile if one is missing. Doctor-facing clinical vocabulary stays in
English on purpose — that is what Indian doctors actually use.

**Accessibility.** 44×44px minimum touch targets, 16px minimum body text on the
patient app, visible focus rings, ARIA live regions for save state. Skeleton
loaders, not spinners. Empty states carry an action. Destructive actions confirm.

**Comments** explain *why*, not *what*. Match the existing voice: direct,
specific, no filler. Do not add comments that restate the code.

---

## After every change, run these

```bash
npm run typecheck      # must be clean
npm run build          # must compile
npm run smoke          # 39 assertions, all must pass
```

`npm run smoke` needs the app running (`npm run build && npm start`) in another
terminal, and `npx playwright install chromium` once. If you change UI text that
the smoke test asserts on, update the test deliberately — do not weaken an
assertion to make it pass.

Do **not** run `npm audit fix --force`. `next` is pinned to `^15.5.24` and
`postcss` is pinned via `overrides` because of real advisories; forcing will drag
the project to a Next major version and break the build.

---

## Where things are

```
supabase/migrations/     001 identity · 002 scheduling · 003 clinical
                         004 therapeutics · 005 ancillary · 006 governance + RLS
supabase/seed.sql        3 hospitals · 8 doctors · 5 patients · 42 drugs
supabase/local_shim.sql  auth.uid() stub, to verify migrations on plain Postgres

src/lib/db/store.ts      the mock store — access rules, slot generator, writes
src/lib/db/seed.ts       the same demo world as seed.sql, same UUIDs
src/lib/tz.ts            IST wall-clock vs stored UTC
src/lib/clinical.ts      vital ranges, ICD-11 offline index, drug safety checks
src/lib/fhir.ts          case sheet → FHIR R4 document Bundle
src/lib/ai.ts            four narrow AI uses, each with an offline fallback
src/lib/i18n.ts          complete en + hi + te catalogues
src/lib/auth.ts          the ONLY file that knows how a session is established

src/app/page.tsx         PUBLIC marketing site — the front door for visitors
src/app/start/           the two-door patient/doctor fork (was at / before)
src/app/actions/         Server Actions: auth, patient, doctor, abdm
src/app/patient/         seven tabs + the access log
src/app/doctor/          queue, lookup, the 14-section case sheet, profile
src/app/e/[token]/       public emergency card
src/app/verify/[token]/  prescription verification for a pharmacist

src/components/ui.tsx    Button, Card, Badge, Stat, Empty, Field, AiLabel…
src/components/charts.tsx  all Recharts wrappers
```

## Routing

`/` is the **public marketing site** — anyone can read it, signed in or not. It
describes the product and links to `/start`. Do not put app functionality there.

`/start` is the two-door fork. It shows both doors **always**, even to a
signed-in visitor — an offer to continue, never a silent redirect. Redirecting
past it made the demo look like the login screen had disappeared. Everything under `/patient` and `/doctor` is gated by `middleware.ts`.
`/e/[token]` and `/verify/[token]` are deliberately public.

Screenshots on the marketing page live in `public/shots/` and are real captures
of the running app. If a screen changes materially, recapture them rather than
letting the site show something that no longer exists.

## Demo logins

| Role | Credentials |
|---|---|
| Patient | `+919011220001` · OTP `123456` (Sunita Kale — richest record, opens in Hindi) |
| Patient | `+919011220002` · OTP `123456` (Ramesh Patil — CKD, PM-JAY) |
| Patient | `+919011220005` · OTP `123456` (Joseph D'Souza — opens in Telugu) |
| Doctor | `anita.deshmukh@nidan.in` · `demo1234` (has today's clinic) |
| Doctor | `priya.nayak@nidan.in` · `demo1234` (no relationships — request-access flow) |
| Public | `/e/EMG-8f2a91c4d7` |

`GET /api/demo/reset` restores an identical clean state.

---

## What is deliberately unfinished

Do not "fix" these silently — they are scoped decisions. If asked to build one,
build it properly.

| Area | State |
|---|---|
| Availability editor | **Writable.** `setAvailability()` in the store validates the same three things Postgres does — a block that divides into its slot length, no overlap on a day, and no removing hours a patient is already booked into. |
| Supabase backend | Migrations are written and verified. `src/lib/db/supabase.ts` does not exist yet — the mock store is the runtime. |
| OCR extraction | `documents.extracted_values`, the trend chart and the full-text index are real. The extractor is not wired; values are pre-extracted in the seed. |
| Document upload | The signed-URL route and access check are real; the upload itself is mocked. |
| ABDM | M1 shapes against a faithful mock. Real sandbox calls need credentials. |
| Razorpay, teleconsult video | Out of scope. Fees display; there is no payment flow or video call. |

## Working style

- The user is building this for a hackathon deadline and is new to development.
  Prefer small, reviewable changes over large rewrites.
- Explain what you changed and why, in plain language.
- If a request would break an invariant above, say so and propose an alternative
  rather than doing it quietly.
