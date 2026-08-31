# Prompts to paste into Cursor

Copy one block at a time into Cursor's Agent panel (⌘ + I). Do them in order —
each assumes the one before it is finished.

## Before your first prompt

1. Open the `nidan` folder in Cursor: **File → Open Folder…**
2. Cursor reads `.cursor/rules/nidan.mdc` and `AGENTS.md` automatically. You do
   not need to paste those in. Everything below assumes it has them.
3. Make a branch first, every time, so a bad change is one click to undo. In
   GitHub Desktop: **Current Branch → New Branch**, name it after the task.
4. Keep `npm run dev` running in a Terminal window so you can see changes live.

## Three rules for working with an agent

**Read the diff before you accept it.** Cursor shows you every changed line. You
do not have to understand every character, but you should recognise the files it
touched. If it edited something the task had nothing to do with, reject and ask
why.

**Make it prove the work.** Every prompt below ends by telling Cursor to run the
tests. If it says it is done without running them, tell it to run them.

**One task per branch.** If a prompt goes wrong, discard the branch and start
again. That is much easier than unpicking a half-finished change.

---

# 1 · Make the availability editor writable

The highest-value gap. The weekly grid already renders and the booking system
already reads from it — only the writing is missing.

```
Make the doctor's availability editor writable.

Right now `src/components/doctor/availability-editor.tsx` renders the weekly
clinic-hours grid read-only, and the slot generator in `src/lib/db/store.ts`
reads those rules from `src/lib/db/seed.ts`. I want a doctor to be able to add,
edit and remove their own clinic hours from `/doctor/profile`.

Requirements:

- Availability rules must become mutable state in the store, not a frozen import
  from the seed. Add an `availability` array to the `Store` interface in
  `src/lib/db/store.ts`, populate it in `build()` from the seed, and change
  `availableSlots()` and `daySlots()` to read from `db.availability`. Confirm
  `resetDemoData()` restores the original rules.
- Add Server Actions in `src/app/actions/doctor.ts`: `addAvailability`,
  `updateAvailability`, `removeAvailability`. Each must verify the rule belongs
  to the signed-in doctor before touching it — a doctor must never be able to
  edit another doctor's clinic hours.
- Validate on the server, not just in the form: end time after start time,
  slot length between 5 and 60 minutes, weekday 0-6, and the hospital must be one
  the doctor is actually affiliated with.
- In the UI, each weekday row gets an "Add hours" control and each existing block
  becomes editable with a remove button. Removing hours is destructive, so it
  confirms first.
- If removing or narrowing a rule would orphan appointments already booked in
  that window, do not silently drop them — warn the doctor, name how many
  appointments are affected, and make them confirm.
- Match the existing visual language exactly: CSS custom properties only, no
  hardcoded colours, the same pill and table styles already in that file.

Then verify: `npm run typecheck`, `npm run build`, and `npm run smoke` (all 29
must still pass). Also check by hand that after adding a Saturday evening slot as
Dr Anita, that time appears in the patient booking wizard for her.

Explain what you changed and why, in plain language.
```

---

# 2 · Connect the real Supabase database

The biggest job in the project. Do it on a branch, and keep the mock working the
whole time — it is your demo-day fallback.

**Do this by hand first, before prompting Cursor.** Cursor cannot create accounts
or click through websites.

1. Create a Supabase project at supabase.com. **Region must be ap-south-1
   (Mumbai)** — it cannot be changed later.
2. Save the database password somewhere you will not lose it.
3. Copy `.env.example` to `.env.local` and fill in the project URL and anon key
   from the Supabase dashboard (Settings → API).

Then split the work into two prompts. Do not ask for both at once.

## 2a · Apply the schema

```
Help me apply this project's SQL schema to my new Supabase project.

The migrations in `supabase/migrations/` (001 to 006) and `supabase/seed.sql`
are already written and verified against Postgres 16. I have created a Supabase
project in ap-south-1 and put the URL and anon key in `.env.local`.

Walk me through it one command at a time, waiting for me to confirm each worked
before giving me the next. I am new to this, so tell me what each command does
and what output means success.

Cover: installing the Supabase CLI, `supabase init`, `supabase link`, pushing the
migrations, running the seed, and generating TypeScript types into
`src/lib/database.types.ts`.

Then compare those generated types against `src/lib/types.ts` and tell me about
any mismatch. If they disagree, the migration is what needs fixing, not the
TypeScript type — do not "fix" it by loosening a type.

Do not change any application code in this step.
```

## 2b · Write the real data layer

```
Write `src/lib/db/supabase.ts`, a real Postgres implementation of the query
surface that `src/lib/db/store.ts` currently provides with in-memory data.

Read `src/lib/db/store.ts` first and mirror its exported function signatures
exactly, so the rest of the app does not need to change. Use `@supabase/ssr`
with the server client, so Row Level Security applies to every query — the whole
point of this schema is that the database refuses unauthorised reads, and using
the service-role key here would throw that away.

Do the reads the demo path needs first, in this order:
  1. `todayQueue`, `patientHeader`, `doctorCard`, `listHospitals`, `listDoctors`
  2. `caseSheet`, `caseSheetsFor`, `vitalsFor`, `allergiesFor`, `medicationsFor`
  3. `availableSlots` / `daySlots` — these must call the `available_slots()`
     Postgres function via RPC, not reimplement the logic in TypeScript
  4. `timelineFor`, `documentsFor`, `prescriptionsFor`, `billsFor`
  5. the writes: `bookAppointment`, `startConsultation`, `saveCaseSheet`,
     `finalizeCaseSheet`, `issuePrescription`

Then add `src/lib/db/index.ts` that exports either the mock or the Supabase
implementation depending on `process.env.MOCK_DB`, and change the app's imports
to come from there. `MOCK_DB=true` must keep working exactly as it does today —
that is the demo-day fallback and it must never regress.

Handle the booking race properly: when the exclusion constraint rejects a double
booking, Postgres raises SQLSTATE `23P01`. Catch that specific code and surface
it the same way the mock does, so the booking wizard's "that slot just went"
message still works.

Do not touch `src/lib/auth.ts` in this prompt — swapping the session layer to
Supabase Auth is a separate job.

Verify with `npm run typecheck`, `npm run build`, and `npm run smoke` with
MOCK_DB=true. Then tell me exactly what I need to do to test it with MOCK_DB=false.
```

---

# 3 · Pre-demo polish pass

Run this a few days before you present, not now — it is most useful once you have
stopped adding features.

```
Do a pre-demo quality pass on this app. I am presenting it to judges and I want
nothing on screen that looks unfinished.

Go through the patient app and the doctor console and find:

- Empty states that just say "nothing here" without offering an action
- Any English string on the patient surface that is missing from the Hindi
  catalogue in `src/lib/i18n.ts` — the patient surface is meant to be completely
  translated, so list every gap you find
- Hardcoded hex colours that should be CSS custom properties
- Anything that breaks or overflows at 390px wide (an iPhone) — I will be handing
  a judge my phone
- Loading states that use a spinner where the codebase's convention is a skeleton
- Buttons or links with no visible focus ring
- Text below 16px on the patient app

Report everything you find as a numbered list first, with the file and line, and
tell me which three matter most for a demo. Do not change anything yet — wait for
me to pick.
```

---

# Short prompts worth keeping

Paste these as needed.

**When something breaks:**
```
This error appeared when I <what you were doing>. Here is the full text:

<paste the entire error, not a summary>

Explain in plain language what it means and what caused it, then fix it. Do not
change anything unrelated to this error.
```

**When you do not understand some code:**
```
Explain what <file or function> does, as if I have never seen this codebase.
Do not change any code — I only want to understand it.
```

**Before you present:**
```
Run npm run typecheck, npm run build and npm run smoke, and show me the output.
If anything fails, fix it and run them again. Do not change any test assertion
to make it pass — if a test is failing, the code is what is wrong.
```

**When an agent suggests something that worries you:**
```
Before you do that: does this change break any of the invariants in AGENTS.md?
List which ones it touches and how you are keeping them intact.
```
