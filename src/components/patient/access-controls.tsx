"use client";

import { useState, useTransition } from "react";
import { approveRequest, revokeAccess } from "@/app/actions/patient";
import { Button, Card } from "@/components/ui";

export function RevokeButton({ id, label, doctor }: { id: string; label: string; doctor: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        className="mt-2 text-sm text-[var(--color-critical)] underline"
      >
        {label}
      </button>
      {confirming && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirming(false)} />
          <div className="relative card-elevated p-5 w-full max-w-sm text-left">
            <h3 className="font-semibold">Withdraw access?</h3>
            <p className="text-sm text-[var(--color-ink-2)] mt-1">
              {doctor} will no longer be able to open your record. Anything already
              written stays in your record — that is how a medical record works —
              but no new reads will be permitted.
            </p>
            <div className="flex gap-2 mt-4">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirming(false)}>
                Keep access
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                disabled={pending}
                onClick={() => start(async () => { await revokeAccess(id); setConfirming(false); })}
              >
                {pending ? "Revoking…" : "Withdraw"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** A doctor without a relationship asked to open the record. The patient
 *  approves from their own phone with an OTP; the relationship row is
 *  written and the record opens. */
export function ApproveRequest({
  id, doctorName, speciality, labels,
}: {
  id: string; doctorName: string; speciality: string;
  labels: { requested: string; approve: string; deny: string };
}) {
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Card className="border-[color-mix(in_srgb,var(--color-brand)_45%,transparent)] bg-[var(--color-brand-soft)]">
      <p className="font-medium">
        {doctorName} {labels.requested}
      </p>
      <p className="text-sm text-[var(--color-ink-2)]">{speciality}</p>
      <p className="text-xs text-[var(--color-ink-2)] mt-1">
        Approving lets them see your demographics, diagnoses, prescriptions and
        reports for 30 days. You can withdraw it at any time.
      </p>
      <div className="flex flex-wrap items-end gap-2 mt-3">
        <label className="block">
          <span className="label">Code sent to your phone</span>
          <input
            className="field w-32 text-center tracking-[0.3em] font-semibold"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            inputMode="numeric"
            maxLength={6}
            placeholder="······"
          />
        </label>
        <Button
          disabled={pending || otp.length < 6}
          onClick={() =>
            start(async () => {
              const r = await approveRequest(id, otp);
              if (!r.ok) setError(r.error ?? "Could not approve");
            })
          }
        >
          {pending ? "Approving…" : labels.approve}
        </Button>
        <Button variant="ghost">{labels.deny}</Button>
      </div>
      {error && <p className="text-sm text-[var(--color-critical)] mt-2">{error}</p>}
    </Card>
  );
}
