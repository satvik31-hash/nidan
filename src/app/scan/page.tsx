"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { ArrowLeft, QrCode } from "lucide-react";

// Doctor-side scanning. A camera reader is one dependency away
// (html5-qrcode); the typed fallback is what always works, and it is what
// you demo when a venue's camera permission prompt appears at the wrong
// moment.

export default function Scan() {
  const [token, setToken] = useState("");
  const router = useRouter();

  return (
    <main className="min-h-dvh grid place-items-center p-6">
      <div className="w-full max-w-sm">
        <Link href="/start" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-2)] mb-6 hover:text-[var(--color-brand)]">
          <ArrowLeft size={16} /> Back
        </Link>
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <QrCode size={20} className="text-[var(--color-brand)]" />
            <h1 className="font-semibold">Open an emergency card</h1>
          </div>
          <p className="text-sm text-[var(--color-ink-3)] mb-4">
            Point a camera at the QR on the card, or type the code printed under it.
          </p>
          <form
            onSubmit={(e) => { e.preventDefault(); if (token) router.push(`/e/${token.trim()}`); }}
          >
            <input
              className="field font-mono"
              placeholder="EMG-8f2a91c4d7"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoFocus
            />
            <Button className="w-full mt-3" size="lg" disabled={!token}>
              Open record
            </Button>
          </form>
          <p className="text-xs text-[var(--color-ink-3)] mt-4">
            Opening a card is logged as an emergency override and the patient is
            notified immediately. Use it only when it is clinically necessary.
          </p>
          <div className="mt-4 pt-3 border-t border-[var(--color-line)]">
            <div className="eyebrow mb-1.5">Demo cards</div>
            <div className="flex flex-wrap gap-1.5">
              {["EMG-8f2a91c4d7", "EMG-3b71ee02af", "EMG-c90d54187b"].map((t) => (
                <button key={t} onClick={() => setToken(t)} className="pill font-mono hover:border-[var(--color-brand)]">
                  {t}
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
