import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { Stethoscope, User, ShieldCheck, QrCode, Languages, WifiOff } from "lucide-react";

// One landing route with a single decisive choice. Two large cards, not a
// dropdown, not a toggle — a fork. It reads instantly to a judge and it lets
// the two portals be styled differently from the first click.

export default async function Start() {
  // A leftover session used to redirect straight past this page, which made the
  // fork look broken: you clicked "demo" and landed inside the doctor console
  // with no idea why. Now the choice is always shown and the existing session
  // is offered rather than assumed.
  const session = await getSession();

  // "Continue as Dr." is what naive first-word splitting produces for a doctor.
  // Strip the honorific, take the given name, then put the title back.
  const shortName = session
    ? (session.role === "doctor" ? "Dr. " : "") +
      session.name.replace(/^(Dr\.?|Mr\.?|Mrs\.?|Ms\.?)\s+/i, "").split(" ")[0]
    : "";

  return (
    <main className="min-h-dvh flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-[1.375rem] font-bold tracking-tight">
            Ni<span className="text-[var(--color-brand)]">dan</span>
          </span>
          <span className="eyebrow hidden sm:block">Patient case-taking software</span>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link href="/" className="text-sm text-[var(--color-ink-2)] hover:text-[var(--color-brand)]">
            About Nidan
          </Link>
          <Link href="/scan" className="text-sm text-[var(--color-ink-2)] hover:text-[var(--color-brand)]">
            Scan an emergency card
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-4xl">
          {session && (
            <div className="card mb-6 px-4 py-3 flex flex-wrap items-center gap-3">
              <span className="text-sm text-[var(--color-ink-2)] flex-1 min-w-[220px]">
                You are still signed in as <strong className="text-[var(--color-ink)]">{session.name}</strong>
                {" "}from an earlier session.
              </span>
              <Link
                href={session.role === "doctor" ? "/doctor" : "/patient"}
                className="pill px-3 py-1.5 bg-[var(--color-brand)] text-[var(--color-on-brand)] border-[var(--color-brand)]"
              >
                Continue as {shortName}
              </Link>
              <a href="/api/signout" className="pill px-3 py-1.5 hover:border-[var(--color-critical)]">
                Sign out
              </a>
            </div>
          )}

          <div className="text-center mb-10">
            <h1 className="text-[2rem] sm:text-[2.75rem] font-bold tracking-tight leading-[1.1]">
              Your health record,
              <br className="sm:hidden" /> written once and carried everywhere.
            </h1>
            <p className="mt-4 text-[var(--color-ink-2)] max-w-xl mx-auto">
              Nidan turns the case sheet a doctor already writes on paper into structured,
              consented, portable health data — so the next doctor doesn&apos;t start from zero.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              href="/login/patient"
              className="card-elevated p-7 group hover:border-[var(--color-brand)] transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand)] grid place-items-center mb-4">
                <User size={22} />
              </div>
              <h2 className="text-[1.375rem] font-semibold">I&apos;m a Patient</h2>
              <p className="text-[var(--color-ink-2)] mt-2 text-[0.9375rem]">
                See your prescriptions, reports, bills and appointments in one place.
                Sign in with your mobile number.
              </p>
              <span className="inline-block mt-4 text-[var(--color-brand)] font-medium group-hover:underline">
                Continue →
              </span>
            </Link>

            <Link
              href="/login/doctor"
              className="card-elevated p-7 group hover:border-[var(--color-brand)] transition-colors bg-[var(--color-chrome)] text-[var(--color-chrome-ink)] border-transparent"
            >
              <div className="w-12 h-12 rounded-full bg-white/10 grid place-items-center mb-4">
                <Stethoscope size={22} />
              </div>
              <h2 className="text-[1.375rem] font-semibold">I&apos;m a Doctor</h2>
              <p className="opacity-75 mt-2 text-[0.9375rem]">
                Today&apos;s queue, patient lookup, and the structured case sheet.
                Sign in with your registered email.
              </p>
              <span className="inline-block mt-4 font-medium group-hover:underline">
                Continue →
              </span>
            </Link>
          </div>

          <ul className="mt-10 grid gap-3 sm:grid-cols-4 text-[0.8125rem] text-[var(--color-ink-2)]">
            {[
              [<ShieldCheck key="a" size={16} />, "Consent enforced in the database, not the UI"],
              [<QrCode key="b" size={16} />, "Emergency card readable without a login"],
              [<Languages key="c" size={16} />, "Complete in English, Hindi and Telugu"],
              [<WifiOff key="d" size={16} />, "Records and first aid work offline"],
            ].map(([icon, text], i) => (
              <li key={i} className="flex gap-2 items-start">
                <span className="text-[var(--color-brand)] mt-0.5">{icon}</span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <footer className="px-6 py-5 text-xs text-[var(--color-ink-3)] text-center">
        Smart India Hackathon · Patient Case-Taking Software · demo build
      </footer>
    </main>
  );
}
