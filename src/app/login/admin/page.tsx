"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { adminSignIn } from "@/app/actions/auth";
import { Button, Field } from "@/components/ui";
import { ArrowLeft, ShieldCheck } from "lucide-react";

// Company-wide oversight, not a consumer-facing door — this login is linked
// from a small text link, not one of the two big cards on /start.

const DEMO_ADMIN: [string, string, string] = [
  "meera.kulkarni@nidan.in", "Meera Kulkarni", "Company-wide oversight of every hospital on the platform",
];

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [state, action, pending] = useActionState(
    adminSignIn,
    null as Awaited<ReturnType<typeof adminSignIn>> | null,
  );

  return (
    <main className="min-h-dvh grid place-items-center px-5 py-10 bg-[var(--color-ink)] text-[var(--color-paper)]">
      <div className="w-full max-w-sm">
        <Link href="/start" className="inline-flex items-center gap-1.5 text-sm opacity-70 mb-6 hover:opacity-100">
          <ArrowLeft size={16} /> Back
        </Link>

        <h1 className="text-[1.75rem] font-bold tracking-tight">Administration</h1>
        <p className="opacity-70 mt-1 mb-6 text-[0.9375rem]">
          Company-wide oversight of patients, doctors, hospitals and consent activity.
        </p>

        <form action={action}>
          <div className="rounded-[8px] bg-[var(--color-surface)] text-[var(--color-ink)] border border-[var(--color-line)] p-4 space-y-4">
            <Field label="Email">
              <input
                className="field" name="email" type="email" required autoComplete="username"
                placeholder="you@nidan.in" value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Password" hint="Demo password: demo1234">
              <input
                className="field" name="password" type="password" required
                autoComplete="current-password" placeholder="••••••••"
              />
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
          <div className="eyebrow mb-2 opacity-70">Demo account · password demo1234</div>
          <button
            onClick={() => setEmail(DEMO_ADMIN[0])}
            className="w-full text-left rounded-[6px] border border-white/15 px-3 py-2 hover:border-[var(--color-brand)] transition-colors"
          >
            <div className="flex items-center gap-1.5 font-medium text-sm">
              {DEMO_ADMIN[1]}
              <ShieldCheck size={14} className="text-[var(--color-brand)]" />
            </div>
            <div className="text-xs opacity-60">{DEMO_ADMIN[2]}</div>
            <div className="text-xs font-mono opacity-50">{DEMO_ADMIN[0]}</div>
          </button>
        </div>
      </div>
    </main>
  );
}
