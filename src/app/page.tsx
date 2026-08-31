import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import {
  Activity, AlertTriangle, ArrowRight, CalendarDays, CircleUser, FileHeart,
  FileJson, Languages, LifeBuoy, Lock, QrCode, Receipt, ShieldCheck,
  Stethoscope, WifiOff,
} from "lucide-react";

// The public face of the project. A visitor — a judge, a teammate, a clinician —
// lands here and can understand what Nidan is before deciding to sign in.
// The working application lives behind /start and is untouched by this page.

export const metadata = {
  title: "Nidan — consented, portable health records for Indian hospitals",
  description:
    "Nidan turns the case sheet a doctor already writes on paper into structured, consented, portable health data. Built for the Smart India Hackathon.",
};

const PATIENT_FEATURES = [
  { icon: CircleUser, title: "Profile & health ID card", body: "Inline-editable profile with a completeness meter, and a printable card carrying your MRN, blood group, allergies and emergency QR." },
  { icon: FileHeart, title: "Records", body: "One vertical health timeline across every hospital — prescriptions, lab reports, medications, surgeries, organ-donor status — with full-text search over report contents." },
  { icon: CalendarDays, title: "Appointments", body: "Upcoming and past visits, live queue position, calendar export, directions, and one-tap follow-up booking with the same doctor." },
  { icon: Stethoscope, title: "Booking", body: "A four-step wizard that can only ever offer legal slots, because it reads from the same generator the database enforces." },
  { icon: Receipt, title: "Billing", body: "Year-to-month drill-down, spend by category, insurance utilisation including PM-JAY, lifetime totals, and CSV export for reimbursement." },
  { icon: LifeBuoy, title: "Emergency", body: "The loudest screen in the app. Ambulance dialling, location sharing, nearest hospitals, offline first-aid, and your emergency card." },
  { icon: Activity, title: "Wellness", body: "A sub-60-second daily check-in and connected-device trends — surfaced inside the doctor's case sheet, so history-taking starts from real observations." },
];

const DIFFERENTIATORS = [
  { icon: ShieldCheck, label: "ABDM-aligned", title: "Built on the government's health stack, not around it", body: "ABHA number and address are first-class fields with an OTP linking flow. Consent artefacts use ABDM's own vocabulary — purpose, HI types, date range, expiry — so mapping to the real gateway is mechanical rather than a rewrite." },
  { icon: FileJson, title: "Records emitted as FHIR R4", label: "Interoperable", body: "Any case sheet exports as a FHIR R4 document Bundle: Composition, Patient, Encounter, Condition, Observation, MedicationRequest, DiagnosticReport, AllergyIntolerance. There is a button in the doctor console that opens the real JSON." },
  { icon: QrCode, label: "Works when nothing else does", title: "An emergency card readable without a login", body: "Scanning the QR opens six fields — blood group, allergies, current medications, chronic conditions, organ donor status, contacts. Every scan is logged, the patient is notified within seconds, and access expires in six hours." },
  { icon: Languages, label: "Actually usable", title: "Complete in English and Hindi, and offline", body: "The entire patient surface is translated, including clinical terms. Records, the emergency card and first-aid content are cached, so the app keeps working with no signal." },
];

export default function Home() {
  return (
    <main className="min-h-dvh">
      {/* ── Header ─────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[var(--color-paper)]/90 backdrop-blur border-b border-[var(--color-line)]">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center gap-6">
          <Link href="/" className="text-[1.25rem] font-bold tracking-tight">
            Ni<span className="text-[var(--color-brand)]">dan</span>
          </Link>
          <nav className="hidden md:flex gap-5 text-sm text-[var(--color-ink-2)]">
            <a href="#problem" className="hover:text-[var(--color-brand)]">The problem</a>
            <a href="#features" className="hover:text-[var(--color-brand)]">Features</a>
            <a href="#consent" className="hover:text-[var(--color-brand)]">Consent</a>
            <a href="#different" className="hover:text-[var(--color-brand)]">What&apos;s different</a>
            <a href="#tech" className="hover:text-[var(--color-brand)]">Tech</a>
          </nav>
          <div className="flex-1" />
          <ThemeToggle className="mr-1" />
          <Link
            href="/start"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[6px] bg-[var(--color-brand)] text-[var(--color-on-brand)] text-sm font-medium hover:bg-[var(--color-brand-ink)]"
          >
            Try the demo <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-5 pt-14 pb-10 sm:pt-20">
        <div className="eyebrow mb-4">
          Smart India Hackathon · Patient Case-Taking Software
        </div>
        <h1 className="text-[2.25rem] sm:text-[3.25rem] font-bold tracking-tight leading-[1.05] max-w-4xl">
          A patient arrives at a new hospital with a plastic bag of paper.
          <span className="text-[var(--color-brand)]"> The doctor starts from zero.</span>
        </h1>
        <p className="mt-5 text-[1.0625rem] sm:text-[1.1875rem] text-[var(--color-ink-2)] max-w-2xl leading-relaxed">
          Nidan turns the case sheet a doctor already writes on paper into structured,
          consented, portable health data — so the patient carries their history, the
          next doctor doesn&apos;t start from zero, and the record is ABDM-ready from
          day one.
        </p>
        <p className="mt-3 text-sm text-[var(--color-ink-2)] max-w-2xl">
          <span lang="hi" className="font-medium text-[var(--color-ink)]">निदान</span>
          {" "}(nidān) — Sanskrit for <em>diagnosis</em>: literally, finding the cause.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/start"
            className="inline-flex items-center gap-2 h-12 px-6 rounded-[6px] bg-[var(--color-brand)] text-[var(--color-on-brand)] font-medium hover:bg-[var(--color-brand-ink)]"
          >
            Open the live demo <ArrowRight size={17} />
          </Link>
          <a
            href="#features"
            className="inline-flex items-center h-12 px-6 rounded-[6px] border border-[var(--color-line)] font-medium hover:border-[var(--color-brand)]"
          >
            See what it does
          </a>
        </div>
        <p className="mt-3 text-sm text-[var(--color-ink-3)]">
          No sign-up. Demo accounts are on the next screen.
        </p>

        <figure className="mt-12">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/shots/casesheet.png"
            alt="The doctor's structured case sheet: fourteen collapsible sections on the left, and a patient context panel on the right showing allergies in red, current medications, active problems and the last three visits."
            className="w-full rounded-[10px] border border-[var(--color-line)] shadow-[var(--shadow-card)]"
            width={1440}
            height={940}
          />
          <figcaption className="mt-3 text-sm text-[var(--color-ink-3)] max-w-2xl">
            The structured case sheet — fourteen sections, autosaved every two seconds,
            with the patient&apos;s allergies and medications pinned beside the form so
            the doctor never has to leave it to check history.
          </figcaption>
        </figure>
      </section>

      {/* ── Problem ────────────────────────────────────── */}
      <section id="problem" className="border-t border-[var(--color-line)] bg-[var(--color-surface)]">
        <div className="max-w-6xl mx-auto px-5 py-14">
          <div className="eyebrow mb-3">The read before a line of code</div>
          <h2 className="text-[1.75rem] sm:text-[2.125rem] font-bold tracking-tight max-w-3xl leading-tight">
            Most teams read &ldquo;case-taking software&rdquo; as &ldquo;hospital dashboard&rdquo;
            and ship a CRUD app with seven tabs.
          </h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2 max-w-4xl">
            <p className="text-[var(--color-ink-2)]">
              The tabs are table stakes. The thing that actually matters is the case
              sheet. Case-taking is a real clinical discipline — chief complaint,
              history of present illness, past and personal history, examination,
              provisional diagnosis, plan. Indian medical colleges teach it as a formal
              structure.
            </p>
            <p className="text-[var(--color-ink-2)]">
              So Nidan treats the patient dashboard as the <strong>consumer surface</strong>,
              and the doctor&apos;s structured case sheet as the <strong>system of
              record</strong>. Every patient tab is a read-view over data the case sheet
              produced. That single inversion is what makes the whole thing coherent
              instead of seven disconnected features.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              ["Structure, not text", "Every clinical finding is a typed field with a code where a standard exists — ICD-11 for diagnoses, a curated drug master for prescriptions. That is what makes analytics, portability and ABDM possible."],
              ["Consent, not access", "A doctor does not have access to patients. A doctor has access to a specific patient, for a bounded window, because a care relationship exists. Enforced in the database, not the interface."],
              ["Continuity, not silos", "Records follow the patient between hospitals via ABHA. A record written at Hospital A appears for a doctor at Hospital B once the patient grants consent."],
            ].map(([title, body]) => (
              <div key={title} className="card p-5">
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-sm text-[var(--color-ink-2)]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────── */}
      <section id="features" className="max-w-6xl mx-auto px-5 py-14">
        <div className="eyebrow mb-3">For patients</div>
        <h2 className="text-[1.75rem] sm:text-[2.125rem] font-bold tracking-tight">
          Seven surfaces, all reading from one record
        </h2>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PATIENT_FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="card p-5">
              <span className="w-9 h-9 rounded-[6px] bg-[var(--color-brand-soft)] text-[var(--color-brand-ink)] grid place-items-center mb-3">
                <Icon size={17} />
              </span>
              <h3 className="font-semibold mb-1.5">{title}</h3>
              <p className="text-sm text-[var(--color-ink-2)]">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2 items-start">
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/shots/records.png"
              alt="The patient records screen: a single vertical health timeline with visits, prescriptions and lab reports, filtered by a search bar and date range."
              className="w-full rounded-[10px] border border-[var(--color-line)]"
              width={1360} height={820}
            />
            <figcaption className="mt-2 text-sm text-[var(--color-ink-3)]">
              One timeline across every hospital. The five tabs are filters over it.
            </figcaption>
          </figure>
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/shots/billing.png"
              alt="The billing screen: lifetime totals, a twelve-month bar chart, spend by category as a donut, and insurance utilisation."
              className="w-full rounded-[10px] border border-[var(--color-line)]"
              width={1360} height={820}
            />
            <figcaption className="mt-2 text-sm text-[var(--color-ink-3)]">
              Every figure derived by database aggregate, never computed in the browser.
            </figcaption>
          </figure>
        </div>

        <div className="eyebrow mt-14 mb-3">For doctors</div>
        <h2 className="text-[1.75rem] sm:text-[2.125rem] font-bold tracking-tight">
          The case sheet is the product
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Today's clinic", "A live queue with token numbers, chief complaints from the booking, and one action per row: start the consultation."],
            ["Fourteen sections", "Chief complaint through to advice, with OLDCARTS as a labelled grid, tri-state examination findings, and ICD-11 autocomplete."],
            ["Prescription builder", "Type-ahead on a drug master, Indian 1-0-1 notation with a plain-language preview, and allergy conflicts that block rather than warn."],
            ["Finalise, then amend", "Signing off makes the sheet immutable. Corrections create a linked amendment — the original always stays."],
          ].map(([title, body]) => (
            <div key={title} className="card p-5">
              <h3 className="font-semibold mb-1.5">{title}</h3>
              <p className="text-sm text-[var(--color-ink-2)]">{body}</p>
            </div>
          ))}
        </div>

        <figure className="mt-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/shots/queue.png"
            alt="The doctor console showing today's clinic: stat tiles for patients today, completed, waiting and average consult time, above a queue of patients."
            className="w-full rounded-[10px] border border-[var(--color-line)]"
            width={1440} height={700}
          />
        </figure>
      </section>

      {/* ── Consent ────────────────────────────────────── */}
      <section id="consent" className="border-y border-[var(--color-line)] bg-[var(--color-surface)]">
        <div className="max-w-6xl mx-auto px-5 py-14">
          <div className="eyebrow mb-3">The part most teams cannot answer</div>
          <h2 className="text-[1.75rem] sm:text-[2.125rem] font-bold tracking-tight max-w-3xl leading-tight">
            &ldquo;What stops a doctor reading any patient&apos;s file?&rdquo;
          </h2>
          <p className="mt-4 text-[var(--color-ink-2)] max-w-2xl">
            Nothing in the interface. The database refuses. Access is granted by an
            active care relationship, created by exactly three events, and every
            clinical table carries a row-level policy that requires one.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              [CalendarDays, "The patient books", "Booking an appointment grants that doctor access until 30 days after the visit. The booking screen says so in plain words before you confirm."],
              [ShieldCheck, "The patient approves", "A doctor searching for someone they have no relationship with sees an identity card and a padlock. They can request access; the patient approves with an OTP on their own phone."],
              [AlertTriangle, "Emergency break-glass", "Scanning the QR card opens a narrow life-saving slice without consent — logged loudly, notified by SMS, and expiring in six hours."],
            ].map(([Icon, title, body]) => {
              const I = Icon as React.ElementType;
              return (
                <div key={title as string} className="card p-5">
                  <I size={18} className="text-[var(--color-brand)] mb-3" />
                  <h3 className="font-semibold mb-1.5">{title as string}</h3>
                  <p className="text-sm text-[var(--color-ink-2)]">{body as string}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1fr] items-center">
            <div className="min-w-0">
              <div className="rounded-[8px] bg-[var(--color-ink)] text-[var(--color-paper)] p-5 overflow-x-auto">
                <div className="eyebrow mb-2 !text-[var(--color-brand)]">
                  supabase/migrations/006_governance.sql
                </div>
                <pre className="font-mono text-[0.8125rem] leading-relaxed whitespace-pre">{`create policy "doctor reads with care relationship"
  on case_sheets for select
  using ( has_care_access(patient_id) );

-- nobody deletes a clinical record. Ever.
-- (no DELETE policy = no DELETE permitted)`}</pre>
              </div>
              <p className="mt-4 text-sm text-[var(--color-ink-2)]">
                Verified, not asserted: against a real Postgres, a doctor sees exactly
                her consented patients, a doctor with no relationship sees zero rows,
                and a patient sees only their own. Every read of another person&apos;s
                record writes an audit row the patient can see — with a revoke button
                beside it.
              </p>
            </div>
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/shots/emergency.png"
                alt="The public emergency card on a phone: a red banner saying the access has been logged and the patient notified, then blood group, allergies, current medications and emergency contacts."
                className="rounded-[10px] border border-[var(--color-line)] max-w-[290px] w-full"
                width={430} height={1180}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Differentiators ────────────────────────────── */}
      <section id="different" className="max-w-6xl mx-auto px-5 py-14">
        <div className="eyebrow mb-3">What separates this from a records viewer</div>
        <h2 className="text-[1.75rem] sm:text-[2.125rem] font-bold tracking-tight">
          Four things, each demonstrable in under a minute
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {DIFFERENTIATORS.map(({ icon: Icon, label, title, body }) => (
            <div key={title} className="card p-6">
              <div className="flex items-center gap-2 mb-3">
                <Icon size={17} className="text-[var(--color-brand)]" />
                <span className="eyebrow">{label}</span>
              </div>
              <h3 className="font-semibold text-[1.0625rem] mb-2">{title}</h3>
              <p className="text-sm text-[var(--color-ink-2)]">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-[8px] border border-[color-mix(in_srgb,var(--color-warning)_35%,transparent)] bg-[var(--color-warning-soft)] p-5">
          <div className="eyebrow !text-[var(--color-warning)] mb-2">Where AI is used, and where it is not</div>
          <p className="text-sm text-[var(--color-ink-2)] max-w-3xl">
            Four narrow, assistive uses: a visit summary, a two-year history synthesis,
            a plain-language report explainer for patients, and symptom structuring
            before a visit. Every output is visibly labelled as generated and requires
            doctor confirmation before it enters the record. The model never prescribes,
            never diagnoses, and never triages an emergency — any red-flag symptom
            routes straight to the emergency screen instead.
          </p>
        </div>
      </section>

      {/* ── Tech ───────────────────────────────────────── */}
      <section id="tech" className="border-t border-[var(--color-line)] bg-[var(--color-surface)]">
        <div className="max-w-6xl mx-auto px-5 py-14">
          <div className="eyebrow mb-3">How it is built</div>
          <h2 className="text-[1.75rem] sm:text-[2.125rem] font-bold tracking-tight">
            One deployable. Nothing that needs a separate backend server.
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Next.js 15 · TypeScript", "App Router with Server Components, so patient records render on the server and raw health data never ships to the browser bundle."],
              ["Postgres · Row Level Security", "Medical records are deeply relational. RLS is a stronger authorisation story than middleware checks, because it holds even if a route is written carelessly."],
              ["FHIR R4 · ICD-11", "Real standards where standards exist, so the data is portable rather than trapped."],
              ["PWA · offline", "A service worker precaches the app shell, records, the emergency card and first-aid content."],
            ].map(([title, body]) => (
              <div key={title} className="card p-5">
                <h3 className="font-semibold mb-1.5 text-[0.9375rem]">{title}</h3>
                <p className="text-sm text-[var(--color-ink-2)]">{body}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              ["6", "SQL migrations, applied and verified against Postgres 16"],
              ["29", "end-to-end browser tests covering the whole demo path"],
              ["0", "API keys needed — every integration has a mock path"],
            ].map(([n, label]) => (
              <div key={label} className="card p-5">
                <div className="text-[2.25rem] font-bold leading-none text-[var(--color-brand)] tabular-nums">{n}</div>
                <p className="text-sm text-[var(--color-ink-2)] mt-1.5">{label}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-[8px] border border-[var(--color-line)] p-5">
            <div className="eyebrow mb-2">Honest scope</div>
            <p className="text-sm text-[var(--color-ink-2)] max-w-3xl">
              ABDM alignment is implemented to the M1 shapes against the sandbox or a
              faithful mock; full certification is three milestones and a CERT-In
              security audit, which is a post-hackathon step. OCR values are
              pre-extracted in the demo dataset. We would rather say that plainly than
              be caught claiming otherwise.
            </p>
          </div>
        </div>
      </section>

      {/* ── Team ───────────────────────────────────────── */}
      <section id="team" className="max-w-6xl mx-auto px-5 py-14">
        <div className="eyebrow mb-3">Who built it</div>
        <h2 className="text-[1.75rem] sm:text-[2.125rem] font-bold tracking-tight">The team</h2>
        <p className="mt-3 text-sm text-[var(--color-ink-3)]">
          {/* TODO: replace these with your real names, roles and (optionally) photos.
              Delete any cards you do not need. */}
          Placeholder — edit <code className="font-mono">src/app/page.tsx</code>, section
          &ldquo;Team&rdquo;, to put your names here.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Satvik Saxena", "Team lead"],
            ["Team member", "Role"],
            ["Team member", "Role"],
            ["Team member", "Role"],
          ].map(([name, role], i) => (
            <div key={i} className="card p-5">
              <span className="w-11 h-11 rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand-ink)] grid place-items-center font-semibold mb-3">
                {name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
              </span>
              <h3 className="font-semibold">{name}</h3>
              <p className="text-sm text-[var(--color-ink-3)]">{role}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Closing call to action ─────────────────────── */}
      <section className="border-t border-[var(--color-line)] bg-[var(--color-brand-soft)]">
        <div className="max-w-6xl mx-auto px-5 py-16 text-center">
          <h2 className="text-[1.75rem] sm:text-[2.125rem] font-bold tracking-tight text-[var(--color-brand-ink)]">
            The record is already written. It just needs to travel.
          </h2>
          <p className="mt-3 text-[var(--color-brand-ink)] opacity-80 max-w-xl mx-auto">
            Sign in as a patient or a doctor with the demo accounts — or open an
            emergency card with no login at all.
          </p>
          <div className="mt-7 flex flex-wrap gap-3 justify-center">
            <Link
              href="/start"
              className="inline-flex items-center gap-2 h-12 px-6 rounded-[6px] bg-[var(--color-brand)] text-[var(--color-on-brand)] font-medium hover:bg-[var(--color-brand-ink)]"
            >
              Open the live demo <ArrowRight size={17} />
            </Link>
            <Link
              href="/e/EMG-8f2a91c4d7"
              className="inline-flex items-center gap-2 h-12 px-6 rounded-[6px] bg-[var(--color-surface)] border border-[var(--color-line)] font-medium hover:border-[var(--color-brand)]"
            >
              <QrCode size={16} /> See an emergency card
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--color-line)]">
        <div className="max-w-6xl mx-auto px-5 py-8 flex flex-wrap gap-4 items-center justify-between text-sm text-[var(--color-ink-3)]">
          <span>
            Ni<span className="text-[var(--color-brand)] font-semibold">dan</span> ·
            Smart India Hackathon · Patient Case-Taking Software
          </span>
          <span className="flex items-center gap-4">
            <Link href="/start" className="hover:text-[var(--color-brand)]">Demo</Link>
            <Link href="/scan" className="hover:text-[var(--color-brand)]">Scan a card</Link>
            <span className="flex items-center gap-1.5">
              <WifiOff size={13} /> works offline
            </span>
            <span className="flex items-center gap-1.5">
              <Lock size={13} /> consent enforced in the database
            </span>
          </span>
        </div>
      </footer>
    </main>
  );
}
