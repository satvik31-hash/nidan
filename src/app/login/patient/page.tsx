"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { requestOtp, verifyOtp } from "@/app/actions/auth";
import { Button, Card, Field } from "@/components/ui";
import { ArrowLeft, Phone } from "lucide-react";

// Phone number → 6-digit OTP. No password. This is how every Indian
// consumer app works and it removes an entire class of support problem.

const DEMO_NUMBERS = [
  ["+919011220001", "Sunita Kale", "68 · diabetes + hypertension, richest record"],
  ["+919011220002", "Ramesh Patil", "68 · CKD stage 3, PM-JAY"],
  ["+919011220003", "Aarav Sharma", "8 · asthma, paediatric ranges"],
  ["+919011220005", "Joseph D'Souza", "44 · profile is Telugu, so the app opens in Telugu"],
];

export default function PatientLogin() {
  const [phase, setPhase] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [reqState, requestAction, requesting] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const r = await requestOtp(prev, fd);
      if (r.ok) { setPhone(r.phone); setPhase("otp"); }
      return r;
    },
    null as Awaited<ReturnType<typeof requestOtp>> | null,
  );
  const [verifyState, verifyAction, verifying] = useActionState(
    verifyOtp,
    null as Awaited<ReturnType<typeof verifyOtp>> | null,
  );

  return (
    <main className="patient-surface min-h-dvh grid place-items-center px-5 py-10">
      <div className="w-full max-w-sm">
        <Link href="/start" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-2)] mb-6 hover:text-[var(--color-brand)]">
          <ArrowLeft size={16} /> Back
        </Link>

        <h1 className="text-[1.75rem] font-bold tracking-tight">
          Ni<span className="text-[var(--color-brand)]">dan</span>
        </h1>
        <p className="text-[var(--color-ink-2)] mt-1 mb-6">
          Sign in with the mobile number registered at your hospital.
        </p>

        {phase === "phone" ? (
          <form action={requestAction}>
            <Card className="space-y-4">
              <Field label="Mobile number" hint="We will send you a 6-digit code.">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-ink-3)]"><Phone size={18} /></span>
                  <input
                    className="field"
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    required
                    placeholder="90112 20001"
                    defaultValue={phone}
                  />
                </div>
              </Field>
              {reqState && !reqState.ok && (
                <p className="text-sm text-[var(--color-critical)]">{reqState.error}</p>
              )}
              <Button className="w-full" size="lg" disabled={requesting}>
                {requesting ? "Sending…" : "Send code"}
              </Button>
            </Card>
          </form>
        ) : (
          <form action={verifyAction}>
            <Card className="space-y-4">
              <input type="hidden" name="phone" value={phone} />
              <Field label="Enter the 6-digit code" hint={reqState?.ok ? reqState.hint : undefined}>
                <input
                  className="field text-center text-[1.5rem] tracking-[0.4em] font-semibold"
                  name="otp"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  required
                  placeholder="······"
                />
              </Field>
              <p className="text-xs text-[var(--color-ink-3)]">
                Sent to {phone}.{" "}
                <button type="button" className="underline" onClick={() => setPhase("phone")}>
                  Change number
                </button>
              </p>
              {verifyState && !verifyState.ok && (
                <p className="text-sm text-[var(--color-critical)]">{verifyState.error}</p>
              )}
              <Button className="w-full" size="lg" disabled={verifying}>
                {verifying ? "Checking…" : "Verify"}
              </Button>
            </Card>
          </form>
        )}

        <div className="mt-6">
          <div className="eyebrow mb-2">Demo accounts</div>
          <div className="space-y-1.5">
            {DEMO_NUMBERS.map(([num, name, note]) => (
              <button
                key={num}
                onClick={() => { setPhone(num); setPhase("phone"); }}
                className="w-full text-left card px-3 py-2 hover:border-[var(--color-brand)] transition-colors"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium text-sm">{name}</span>
                  <span className="font-mono text-xs text-[var(--color-ink-3)]">{num}</span>
                </div>
                <div className="text-xs text-[var(--color-ink-3)]">{note}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
