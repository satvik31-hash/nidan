"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Empty } from "@/components/ui";
import { askAccess } from "@/app/actions/doctor";
import { Lock, Search, Unlock } from "lucide-react";
import { useVoiceTargets } from "@/lib/voice-targets";

interface Hit {
  id: string; full_name: string; mrn: string; age: number; sex: string;
  abha_number: string | null; hasAccess: boolean;
}

export function PatientSearch() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [requested, setRequested] = useState<Record<string, boolean>>({});
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (q.trim().length < 2) { setHits(null); return; }
    const c = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/patients?q=${encodeURIComponent(q)}`, { signal: c.signal })
        .then((r) => r.json())
        .then((j) => setHits(j.results))
        .catch(() => {});
    }, 180);
    return () => { clearTimeout(timer); c.abort(); };
  }, [q]);

  const requestAccess = (h: Hit) =>
    start(async () => {
      await askAccess(h.id);
      setRequested((r) => ({ ...r, [h.id]: true }));
    });

  // Mirrors the booking wizard's confirm-step precedent (see AGENTS.md
  // invariant 8): voice triggers the exact same handler the on-screen button
  // calls — "Open record" navigates, "Request access" calls the same
  // askAccess() — never a separate or looser path. A hit already waiting on
  // patient approval isn't offered again; there's nothing left to select.
  const voiceTargets = useMemo(
    () =>
      (hits ?? [])
        .filter((h) => !requested[h.id])
        .map((h) => ({
          id: h.id,
          label: h.full_name,
          keywords: [h.full_name.toLowerCase(), h.mrn.toLowerCase()],
          onSelect: () => (h.hasAccess ? router.push(`/doctor/patient/${h.id}`) : requestAccess(h)),
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hits, requested],
  );
  useVoiceTargets("doctor-patient-search", voiceTargets);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 field h-11 py-0">
        <Search size={17} className="text-[var(--color-ink-3)] shrink-0" />
        <input
          className="bg-transparent outline-none w-full"
          placeholder="MRN, ABHA number, phone, or name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
      </div>

      {hits === null ? (
        <p className="text-sm text-[var(--color-ink-3)]">
          Try <span className="font-mono">ND-2026-000481</span>,{" "}
          <span className="font-mono">9011220002</span>, or “Sunita”.
        </p>
      ) : hits.length === 0 ? (
        <Empty title="No patient matches that" body="Check the MRN, or search by phone number." />
      ) : (
        hits.map((h) => (
          <Card key={h.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* A minimal identity card only. Nothing clinical is shown here. */}
              <div>
                <p className="font-medium">{h.full_name}</p>
                <p className="text-sm text-[var(--color-ink-3)]">
                  {h.age} y · {h.sex} · <span className="font-mono">{h.mrn}</span>
                  {h.abha_number && <span className="font-mono"> · ABHA {h.abha_number}</span>}
                </p>
              </div>

              {h.hasAccess ? (
                <div className="flex items-center gap-2">
                  <Badge tone="good" icon={<Unlock size={11} />}>care relationship active</Badge>
                  <Link
                    href={`/doctor/patient/${h.id}`}
                    className="inline-flex items-center h-9 px-4 rounded-[6px] bg-[var(--color-brand)] text-[var(--color-on-brand)] text-sm font-medium"
                  >
                    Open record
                  </Link>
                </div>
              ) : requested[h.id] ? (
                <Badge tone="warning">
                  waiting for the patient to approve on their phone
                </Badge>
              ) : (
                <div className="flex items-center gap-2">
                  <Badge tone="neutral" icon={<Lock size={11} />}>no relationship</Badge>
                  <Button size="sm" disabled={pending} onClick={() => requestAccess(h)}>
                    Request access
                  </Button>
                </div>
              )}
            </div>

            {!h.hasAccess && !requested[h.id] && (
              <p className="text-xs text-[var(--color-ink-3)] mt-2 pt-2 border-t border-[var(--color-line)]">
                You can see who this is, because you need to confirm you have the
                right person. You cannot see anything clinical until they approve.
              </p>
            )}
            {requested[h.id] && (
              <p className="text-xs text-[var(--color-ink-3)] mt-2 pt-2 border-t border-[var(--color-line)]">
                An approval code has been sent to {h.full_name.split(" ")[0]}&apos;s phone.
                The record opens the moment they approve it.
              </p>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
