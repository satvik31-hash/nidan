# Nidan

A consent-aware clinical record and case-taking platform for Indian hospitals.
Built to the Smart India Hackathon "Patient Case-Taking Software" problem
statement, from the build blueprint in this repo's brief.

```bash
npm install
npm run dev          # http://localhost:3000
```

**It runs with zero API keys.** Every external integration sits behind a
`MOCK_<SERVICE>` flag and the mock path is the default. There is no database to
provision, no Supabase project to link, and no network call on the demo path.

---

## The idea in one line

> Nidan turns the case sheet a doctor already writes on paper into structured,
> consented, portable health data — so the patient carries their history, the
> next doctor doesn't start from zero, and the record is ABDM-ready from day one.

The patient dashboard is the **consumer surface**. The doctor's structured case
sheet is the **system of record**. Every patient tab is a read-view over data the
case sheet produced. That inversion is what makes the app coherent rather than
seven disconnected features.

## Demo accounts

| Role | Sign in with | Notes |
|---|---|---|
| Patient | `+919011220001` · code `123456` | Sunita Kale, 58 — diabetes + hypertension, the richest record. Profile locale is **Hindi**, so the app opens in Hindi. |
| Patient | `+919011220002` · code `123456` | Ramesh Patil, 68 — CKD stage 3, PM-JAY |
| Patient | `+919011220003` · code `123456` | Aarav Sharma, 8 — asthma, paediatric vital ranges |
| Patient | `+919011220005` · code `123456` | Joseph D'Souza, 44 — profile locale is **Telugu**, so the app opens in Telugu |
| Doctor | `anita.deshmukh@nidan.in` / `demo1234` | Has today's clinic and two live care relationships |
| Doctor | `priya.nayak@nidan.in` / `demo1234` | No relationships — use this to demo the request-access flow |
| Nobody | `/e/EMG-8f2a91c4d7` | The public emergency card. No login. |

`POST /api/demo/reset` restores an identical clean state before each run.

## The three claims the demo defends

**1 · Structure, not text.** Every clinical finding is a typed field with a code
where a standard exists — ICD-11 for diagnoses, a curated drug master for
prescriptions, LOINC on export. The case sheet is fourteen sections
(`src/components/doctor/case-sheet.tsx`), not a notes box.

**2 · Consent, not access.** A doctor does not "have access to patients". A
doctor has access to *a specific patient, for a bounded window, because a care
relationship exists*. That relationship is created by exactly three events — the
patient books, the patient approves an OTP, or an emergency break-glass override
— and it is enforced in the database, not the UI:

```sql
create policy "doctor reads with care relationship" on case_sheets
  for select using ( has_care_access(patient_id) );
```

Proven in `supabase/migrations/006_governance.sql` and re-proven in the mock
store's `assertAccess()`. The smoke test asserts a doctor gets HTTP 403 on a case
sheet outside her relationships and 200 inside them.

**3 · Continuity, not silos.** ABHA number and address are first-class fields,
and any case sheet exports as a FHIR R4 document Bundle — Composition, Patient,
Encounter, Condition, Observation, MedicationRequest, DiagnosticReport,
AllergyIntolerance. The "View as FHIR" button in the doctor console opens the
real JSON.

## What is where

```
supabase/
  migrations/001_identity.sql      enums, profiles, patients, doctors, hospitals
  migrations/002_scheduling.sql    availability, appointments, available_slots()
  migrations/003_clinical.sql      case_sheets, diagnoses, vitals, investigations
  migrations/004_therapeutics.sql  drug master, prescriptions, history, documents
  migrations/005_ancillary.sql     billing, insurance, wellness, emergency
  migrations/006_governance.sql    care_relationships, consent, audit, RLS
  seed.sql                         3 hospitals · 8 doctors · 5 patients · 42 drugs
  local_shim.sql                   auth.uid() stub, for verifying migrations locally

src/lib/
  db/seed.ts      the same demo world as seed.sql, same UUIDs
  db/store.ts     the mock store — same access rule, same slot generator,
                  same double-booking rejection, same append-only case sheet
  clinical.ts     vital ranges, ICD-11 offline index, drug-interaction checks
  fhir.ts         case sheet → FHIR R4 document Bundle
  ai.ts           four narrow AI uses, each with an offline template fallback
  tz.ts           IST wall-clock vs stored UTC — the appointment-bug trap
  i18n.ts         complete English, Hindi and Telugu catalogues

src/app/
  page.tsx        the public marketing site — problem, features, consent, tech
  start/          the two-door patient/doctor fork
  patient/        seven tabs: profile, records, appointments, book, billing,
                  emergency, wellness — plus the access log
  doctor/         today's queue, patient lookup, the case sheet, doctor profile
  e/[token]/      the public emergency card
  verify/[token]/ prescription verification for a pharmacist
```

## Verifying it

```bash
npm run typecheck                  # tsc --noEmit
npm run build && npm start         # production build, 32 routes

npx playwright install chromium    # once
npm run smoke                      # 40 end-to-end assertions
```

`smoke.mjs` drives the whole demo path in a real browser: OTP login, the Hindi
locale and the language switch, the timeline, the analyte trend chart, the slot
grid, the consent sentence, booking, the access log, the public emergency card
(and what it must *not* leak), the doctor queue, a locked patient, the case
sheet, live vital flagging, ICD-11 autocomplete, the allergy block, autosave,
finalise, the FHIR export, and the 403 on a record outside the relationship.

The SQL is verified separately against a real Postgres 16:

```bash
psql -f supabase/local_shim.sql -f supabase/migrations/001_identity.sql ... -f supabase/seed.sql
```

That run confirms `available_slots()` emits only legal slots, the `btree_gist`
exclusion constraint rejects a double booking with SQLSTATE `23P01`, a finalised
case sheet refuses an UPDATE, and — with a non-superuser role and a JWT claim
set — a doctor sees exactly her consented patients and nobody else's.

## Working on this with an AI agent

`AGENTS.md` is the source of truth for how this codebase works and what must not
break — the consent model, the append-only records, the IST/UTC rule, the narrow
emergency slice. Cursor loads it via `.cursor/rules/nidan.mdc`; Claude Code and
other agents read `AGENTS.md` directly.

`CURSOR-PROMPTS.md` has ready-to-paste prompts for the remaining work.

## Dependency hygiene

`npm audit` reports **0 vulnerabilities**. Two things keep it there:

- `next` is pinned to `^15.5.24`. Earlier 15.1.x carries CVE-2025-66478.
- `overrides: { "postcss": "^8.5.23" }` in `package.json` patches the copy of
  postcss that Next bundles, without forcing a jump to Next 16.

`recharts@2.15.4` prints a deprecation warning on install. It is a deprecation,
not an advisory — v3 is a breaking API change and is not worth taking before a
demo. Leave it.

**Never run `npm audit fix --force`.** It installs outside the stated ranges and
will break the build. Pin the specific version instead, as above.

## Wiring it to a real Supabase project

The mock store and the SQL describe the same world, so the swap is mechanical.

1. `npx supabase init && npx supabase link --project-ref <ref>` — create the
   project in **ap-south-1 (Mumbai)**. Round-trip latency from a judging venue in
   India to a US-East database is the difference between "snappy" and "laggy", and
   it is a free choice you make once and cannot change later.
2. `npx supabase db push` then `npx supabase db reset` to apply the migrations
   and the seed.
3. Create the storage buckets: `avatars` (public), and `reports`, `films`,
   `prescriptions`, `insurance` — all private.
4. Enable phone auth (SMS provider) and email auth. Set the site URL and redirect
   URLs for both localhost and the deployed domain.
5. Fill `.env.local` from `.env.example` and set `MOCK_DB=false`.
6. `npx supabase gen types typescript --linked > src/lib/database.types.ts` and
   check it against `src/lib/types.ts`.

`src/lib/auth.ts` is the only file that knows how a session is established;
swapping the demo cookie for `@supabase/ssr` is a change to that file and the
middleware's role claim.

## Honest scope

Some things here are demonstrated rather than production-certified, and saying so
plainly is better than being caught:

- **ABDM.** The M1 shapes are implemented — ABHA number and address as first-class
  fields, a linking flow by OTP against the sandbox or a faithful mock, consent
  artefacts modelled in ABDM's vocabulary, and FHIR R4 export. M2 and M3 are an
  integration rather than a rewrite. Production certification needs a CERT-In
  security audit, which is a post-hackathon step.
- **AI.** Four narrow, assistive uses: case summary, history synthesis, report
  explainer, symptom structuring. Every output is visibly labelled as generated
  and requires doctor confirmation before entering the record. The model never
  prescribes, never diagnoses, and never triages an emergency — a red-flag symptom
  string short-circuits to the emergency screen before a request is made. With no
  API key it runs on deterministic offline templates built from the real record.
- **OCR.** Report analytes are pre-extracted in the seed. The pipeline
  (`documents.extracted_values`) is real; the extractor is not wired in this build.
- **PDF.** Prescriptions print through a print stylesheet and the browser's own
  "Save as PDF" rather than a renderer dependency — fewer moving parts, and it
  honours the letterhead layout exactly.
- **i18n.** The patient surface is complete in English, Hindi and Telugu —
  including the offline first-aid cards. Doctor-facing clinical vocabulary stays
  in English, which is what Indian doctors actually use. A fourth language is a
  catalogue in `src/lib/i18n.ts`, not a refactor.

## The design system

All colour, spacing and radius are CSS custom properties in
`src/app/globals.css`; no component hardcodes a hex value. The brand is a
clinical blue (`#2563a8`) on a near-white page, chosen so that red can mean
exactly one thing — a warning — everywhere it appears. Dark mode is its own set
of steps, not an automatic flip.

The cursor is a first-aid cross: outlined when idle, filled and ringed over
anything clickable. Text inputs keep the native I-beam, because a caret has to
look like a caret, and the whole thing is dropped on touch devices and under
`forced-colors`.

## Design notes

Two portals, one system, different temperatures. The patient app is calm and one
type-step larger; the doctor console is dense and information-first. Same tokens,
different density.

Semantic colour is reserved for clinical meaning — if red appears anywhere that
is not a warning, the warning stops working — and status is never carried by
colour alone. Chart hues are a separate, validated palette: both the light and
dark sets pass a lightness band, chroma floor, adjacent-pair separation under
deuteranopia and tritanopia, and contrast against the chart surface.
Dark mode is its own set of steps and is **opt-in** — the app does not follow
the operating system, so a laptop in night mode still shows the light product.
The Light / Dark switch sits in the header of the marketing site, the `/start`
fork, the patient app and the doctor console; the choice is stored per device
and re-applied before first paint, so there is no flash of the wrong theme.

Skeleton loaders rather than spinners; empty states carry an action; every
destructive action confirms, and cancelling an appointment asks why.
