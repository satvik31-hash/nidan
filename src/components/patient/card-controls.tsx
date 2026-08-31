"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rotateEmergencyCard } from "@/app/actions/patient";
import { Button } from "@/components/ui";

export function CardControls({ token }: { token: string | null }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  const run = (revokeOnly: boolean) =>
    start(async () => {
      const r = await rotateEmergencyCard(revokeOnly);
      setMsg(revokeOnly ? "Card revoked. The old QR no longer resolves." : `New card issued: ${r.token}`);
      router.refresh();
    });

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={pending || !token} onClick={() => run(true)}>
          Revoke this card
        </Button>
        <Button size="sm" disabled={pending} onClick={() => run(false)}>
          Issue a new card
        </Button>
      </div>
      {msg && <p className="text-sm text-[var(--color-good)]" aria-live="polite">{msg}</p>}
      {!token && <p className="text-sm text-[var(--color-warning)]">You have no active card.</p>}
    </div>
  );
}
