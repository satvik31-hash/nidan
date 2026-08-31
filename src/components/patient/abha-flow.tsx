"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field } from "@/components/ui";
import { linkAbha } from "@/app/actions/abdm";

export function AbhaLinkFlow() {
  const [step, setStep] = useState<"choose" | "otp" | "done">("choose");
  const [method, setMethod] = useState<"mobile_otp" | "aadhaar_otp">("mobile_otp");
  const [otp, setOtp] = useState("");
  const [result, setResult] = useState<{ abha_number: string; abha_address: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (step === "done" && result) {
    return (
      <Card>
        <p className="font-medium text-[var(--color-good)]">ABHA linked</p>
        <p className="font-mono mt-2">{result.abha_number}</p>
        <p className="font-mono text-sm text-[var(--color-ink-3)]">{result.abha_address}</p>
        <Button className="mt-4" onClick={() => router.refresh()}>Done</Button>
      </Card>
    );
  }

  return (
    <Card>
      {step === "choose" ? (
        <>
          <h3 className="font-semibold mb-1">Link your ABHA</h3>
          <p className="text-sm text-[var(--color-ink-3)] mb-4">
            Verify with an OTP. We never store your Aadhaar number — only the ABHA
            number the gateway returns.
          </p>
          <div className="space-y-2">
            {([
              ["mobile_otp", "Mobile OTP", "A code to the number registered with ABDM."],
              ["aadhaar_otp", "Aadhaar OTP", "A code to the mobile linked to your Aadhaar."],
            ] as const).map(([v, label, note]) => (
              <button
                key={v}
                onClick={() => { setMethod(v); setStep("otp"); }}
                className="w-full text-left rounded-[6px] border border-[var(--color-line)] p-3 hover:border-[var(--color-brand)]"
              >
                <p className="font-medium text-sm">{label}</p>
                <p className="text-xs text-[var(--color-ink-3)]">{note}</p>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <h3 className="font-semibold mb-1">Enter the code</h3>
          <p className="text-sm text-[var(--color-ink-3)] mb-4">
            Sent by {method === "mobile_otp" ? "ABDM to your mobile" : "UIDAI to your Aadhaar-linked mobile"}.
            In the mock gateway the code is 123456.
          </p>
          <Field label="6-digit code">
            <input
              className="field text-center text-[1.25rem] tracking-[0.35em]"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              autoFocus
            />
          </Field>
          {error && <p className="text-sm text-[var(--color-critical)] mt-2">{error}</p>}
          <div className="flex gap-2 mt-4">
            <Button variant="secondary" onClick={() => setStep("choose")}>Back</Button>
            <Button
              disabled={pending || otp.length < 6}
              onClick={() =>
                start(async () => {
                  const r = await linkAbha(method, otp);
                  if (r.ok) { setResult(r); setStep("done"); router.refresh(); }
                  else setError(r.error);
                })
              }
            >
              {pending ? "Verifying…" : "Verify and link"}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
