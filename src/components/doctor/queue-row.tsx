"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@/components/ui";
import { checkIn, startConsult } from "@/app/actions/doctor";
import { ChevronRight } from "lucide-react";

const TONE = {
  completed: "good", cancelled: "neutral", no_show: "critical",
  confirmed: "neutral", checked_in: "brand", in_consult: "warning", requested: "neutral",
} as const;

export function QueueRow({
  appointment: a, patient: p,
}: {
  appointment: {
    id: string; token: number | null; time: string; status: keyof typeof TONE;
    reason: string | null; caseSheetId: string | null; caseStatus: string | null;
  };
  patient: { id: string; name: string; age: number; sex: string; mrn: string };
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  // One primary action per row: Start consultation, which creates a draft
  // case sheet and opens it.
  const primary = () =>
    start(async () => {
      if (a.caseSheetId) { router.push(`/doctor/case/${a.caseSheetId}`); return; }
      const r = await startConsult(a.id);
      if (r.ok) router.push(`/doctor/case/${r.id}`);
    });

  return (
    <div className="card px-3 py-2.5 flex flex-wrap items-center gap-3 hover:border-[var(--color-brand)] transition-colors">
      <span className="w-9 h-9 rounded-[6px] bg-[var(--color-paper)] grid place-items-center font-mono text-sm font-semibold shrink-0">
        {a.token ?? "—"}
      </span>

      <span className="text-sm text-[var(--color-ink-3)] w-16 shrink-0">{a.time}</span>

      <Link href={`/doctor/patient/${p.id}`} className="min-w-[180px] flex-1 group">
        <span className="font-medium group-hover:text-[var(--color-brand)]">{p.name}</span>
        <span className="block text-xs text-[var(--color-ink-3)]">
          {p.age} y · {p.sex[0].toUpperCase()} · <span className="font-mono">{p.mrn}</span>
        </span>
      </Link>

      <span className="text-sm text-[var(--color-ink-2)] flex-1 min-w-[160px] truncate" title={a.reason ?? ""}>
        {a.reason ?? "—"}
      </span>

      <Badge tone={TONE[a.status]}>{a.status.replace("_", " ")}</Badge>

      {a.status === "confirmed" && (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => start(async () => { await checkIn(a.id); router.refresh(); })}
        >
          Check in
        </Button>
      )}

      <Button size="sm" onClick={primary} disabled={pending}>
        {a.caseSheetId
          ? a.caseStatus === "draft" ? "Resume consultation" : "Open case sheet"
          : "Start consultation"}
        <ChevronRight size={14} />
      </Button>
    </div>
  );
}
