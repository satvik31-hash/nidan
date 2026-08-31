"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { askAccess } from "@/app/actions/doctor";
import { Lock } from "lucide-react";

/** Ninety seconds of demo, and the clearest possible statement of the
 *  consent architecture: the doctor asks, the patient approves on their own
 *  phone, the relationship row is written, the record opens. */
export function RequestAccessPanel({
  patientId, name, summary,
}: { patientId: string; name: string; summary: string }) {
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <Card>
      <div className="flex items-center gap-2 text-[var(--color-ink-2)]">
        <Lock size={16} />
        <span className="font-medium">This record is not open to you</span>
      </div>
      <p className="text-sm mt-2">
        <strong>{name}</strong> — {summary}
      </p>
      <p className="text-sm text-[var(--color-ink-2)] mt-3">
        You have no active care relationship with this patient, so the database
        itself refuses every clinical read. That is not a UI check you could
        route around: the row-level policy on each table requires a live
        relationship, and there is no relationship to find.
      </p>

      {sent ? (
        <div className="mt-4 rounded-[6px] bg-[var(--color-brand-soft)] p-3">
          <p className="text-sm text-[var(--color-brand-ink)] font-medium">
            Approval sent to {name.split(" ")[0]}&apos;s phone.
          </p>
          <p className="text-xs text-[var(--color-brand-ink)] opacity-80 mt-1">
            They approve with an OTP in their Nidan app. The moment they do, the
            relationship row is written and this page opens.
          </p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => router.refresh()}>
            Check again
          </Button>
        </div>
      ) : (
        <Button
          className="mt-4"
          disabled={pending}
          onClick={() => start(async () => { await askAccess(patientId); setSent(true); })}
        >
          {pending ? "Sending…" : "Request access"}
        </Button>
      )}

      <p className="text-xs text-[var(--color-ink-3)] mt-4 pt-3 border-t border-[var(--color-line)]">
        In a genuine emergency, scanning the patient&apos;s QR card opens a narrow
        life-saving slice without consent — logged loudly, notified by SMS, and
        expiring in six hours.
      </p>
    </Card>
  );
}
