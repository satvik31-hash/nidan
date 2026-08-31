"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { doctorSignIn } from "@/app/actions/auth";
import { Button, Card, Field } from "@/components/ui";
import { ArrowLeft, BadgeCheck } from "lucide-react";

// Email + password + medical registration number, with an admin-verified
// flag. An unverified doctor can log in and complete their profile but
// cannot open a patient record. It is a real trust control, and showing it
// is worth thirty seconds of demo.

const DEMO_DOCTORS = [
  ["anita.deshmukh@nidan.in", "Dr. Anita Deshmukh", "General Medicine · has today's clinic"],
  ["rakesh.iyer@nidan.in", "Dr. Rakesh Iyer", "Cardiology · consent expiring"],
  ["priya.nayak@nidan.in", "Dr. Priya Nayak", "OBG · no relationships — try the request flow"],
];

export default function DoctorLogin() {
  const [email, setEmail] = useState("");
  const [state, action, pending] = useActionState(
    doctorSignIn,
    null as Awaited<ReturnType<typeof doctorSignIn>> | null,
  );

  return (
    <main className="min-h-dvh grid place-items-center px-5 py-10 bg-[var(--color-ink)] text-[var(--color-paper)]">
      <div className="w-full max-w-sm">
        <Link href="/start" className="inline-flex items-center gap-1.5 text-sm opacity-70 mb-6 hover:opacity-100">
          <ArrowLeft size={16} /> Back
        </Link>

        <h1 className="text-[1.75rem] font-bold tracking-tight">Doctor console</h1>
        <p className="opacity-70 mt-1 mb-6 text-[0.9375rem]">
          Today&apos;s queue, patient lookup and the case sheet.
        </p>

        <form action={action}>
          <div className="rounded-[8px] bg-[var(--color-surface)] text-[var(--color-ink)] border border-[var(--color-line)] p-4 space-y-4">
            <Field label="Email">
              <input
                className="field" name="email" type="email" required autoComplete="username"
                placeholder="you@hospital.in" value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Password" hint="Demo password: demo1234">
              <input
                className="field" name="password" type="password" required
                autoComplete="current-password" placeholder="••••••••"
              />
            </Field>
            <Field label="Medical registration number" hint="Verified against the state council register.">
              <input className="field" name="registration_no" placeholder="MMC-2009-44127" />
            </Field>
            {state && !state.ok && (
              <p className="text-sm text-[var(--color-critical)]">{state.error}</p>
            )}
            <Button className="w-full" size="lg" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </div>
        </form>

        <div className="mt-6">
          <div className="eyebrow mb-2 opacity-70">Demo accounts · password demo1234</div>
          <div className="space-y-1.5">
            {DEMO_DOCTORS.map(([mail, name, note]) => (
              <button
                key={mail}
                onClick={() => setEmail(mail)}
                className="w-full text-left rounded-[6px] border border-white/15 px-3 py-2 hover:border-[var(--color-brand)] transition-colors"
              >
                <div className="flex items-center gap-1.5 font-medium text-sm">
                  {name}
                  <BadgeCheck size={14} className="text-[var(--color-brand)]" />
                </div>
                <div className="text-xs opacity-60">{note}</div>
                <div className="text-xs font-mono opacity-50">{mail}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
