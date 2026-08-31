"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Activity, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui";
import { summariseVitals } from "@/lib/clinical";
import { cn, fmtDate, relative } from "@/lib/utils";
import type { Vitals } from "@/lib/types";
import type { CaseContext } from "@/components/doctor/case-sheet";

// The right pane. Allergies in red at the top, current medications, the last
// three visits, active problems, recent vitals and recent wellness data. The
// doctor never has to leave the form to check history.

export function ContextPanel({
  patient, context, vitals,
}: {
  patient: { id: string; name: string; age: number };
  context: CaseContext;
  vitals: Vitals | null;
}) {
  const vitalRows = vitals ? summariseVitals(vitals, patient.age) : [];

  return (
    <aside className="space-y-2 xl:sticky xl:top-[4.5rem]">
      {/* Allergies. Red. First. Always. */}
      <div
        className={cn(
          "rounded-[8px] border p-3",
          context.allergies.length
            ? "border-[color-mix(in_srgb,var(--color-critical)_45%,transparent)] bg-[var(--color-critical-soft)]"
            : "border-[var(--color-line)] bg-[var(--color-surface)]",
        )}
      >
        <p className={cn(
          "text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5",
          context.allergies.length ? "text-[var(--color-critical)]" : "text-[var(--color-ink-3)]",
        )}>
          <AlertTriangle size={13} /> Allergies
        </p>
        {context.allergies.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-3)] mt-1">None on record</p>
        ) : (
          <ul className="mt-1.5 space-y-1">
            {context.allergies.map((a) => (
              <li key={a.id} className="text-sm text-[var(--color-critical)]">
                <strong>{a.allergen}</strong>
                <span className="block text-xs opacity-90">
                  {a.reaction ?? "reaction not recorded"} · {a.severity}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Panel title="Current medications" count={context.medications.length} defaultOpen>
        {context.medications.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-3)]">None on record</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {context.medications.map((m) => (
              <li key={m.id}>
                {m.drug_text}
                <span className="block text-xs text-[var(--color-ink-3)]">
                  {m.dose} · <span className="font-mono">{m.frequency}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Active problems" count={context.problems.length} defaultOpen>
        {context.problems.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-3)]">None recorded</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {context.problems.map((p) => (
              <li key={p.id} className="flex items-baseline justify-between gap-2">
                <span>{p.condition}</span>
                {p.on_treatment && <Badge tone="brand">Rx</Badge>}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {vitalRows.length > 0 && (
        <Panel title="Vitals this visit" count={vitalRows.length} defaultOpen>
          <ul className="space-y-1 text-sm">
            {vitalRows.map((v) => (
              <li key={v.key} className="flex items-baseline justify-between gap-2">
                <span className="text-[var(--color-ink-3)]">{v.label}</span>
                <span className={cn(
                  "font-medium tabular-nums",
                  v.flag === "high" && "text-[var(--color-critical)]",
                  v.flag === "low" && "text-[var(--color-warning)]",
                )}>
                  {v.value} {v.unit}
                  {v.flag === "high" && " ↑"}
                  {v.flag === "low" && " ↓"}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="Last three visits" count={context.previous.length} defaultOpen>
        {context.previous.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-3)]">First recorded visit</p>
        ) : (
          <ul className="space-y-2">
            {context.previous.map((p) => (
              <li key={p.id} className="border-b border-[var(--color-line)] pb-2 last:border-0 last:pb-0">
                <Link href={`/doctor/case/${p.id}`} className="text-sm font-medium hover:text-[var(--color-brand)]">
                  {p.dx}
                </Link>
                <p className="text-xs text-[var(--color-ink-3)]">
                  {p.date} · {p.doctor}
                </p>
                {p.advice && (
                  <p className="text-xs text-[var(--color-ink-2)] mt-0.5 line-clamp-2">{p.advice}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Recent reports" count={context.reports.length}>
        {context.reports.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-3)]">None uploaded</p>
        ) : (
          <ul className="space-y-2">
            {context.reports.map((r) => (
              <li key={r.id}>
                <p className="text-sm">{r.title}</p>
                <p className="text-xs text-[var(--color-ink-3)]">{fmtDate(r.date)}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {r.flagged.map((f) => (
                    <Badge key={f.analyte} tone={f.flag === "high" ? "critical" : "warning"}>
                      {f.analyte} {f.value} {f.unit}
                    </Badge>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* The wellness tracker, surfaced inside the case sheet. Suddenly it is
          not a fitness toy — it is pre-consultation data collection. */}
      <Panel title="Patient check-ins · 14 days" count={context.checkins.length} defaultOpen>
        {context.checkins.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-3)]">No check-ins logged</p>
        ) : (
          <>
            <div className="flex items-center gap-1 mb-2">
              <Activity size={13} className="text-[var(--color-ink-3)]" />
              <span className="text-xs text-[var(--color-ink-3)]">mood, most recent first</span>
            </div>
            <div className="flex gap-[3px] mb-2">
              {context.checkins.map((c) => (
                <span
                  key={c.date}
                  title={`${c.date}: mood ${c.mood ?? "—"}/5, pain ${c.pain ?? "—"}/10${c.meds_taken === false ? ", missed medicines" : ""}`}
                  className="w-4 h-6 rounded-[3px] border border-[var(--color-line)]"
                  style={{
                    background: c.mood == null
                      ? "transparent"
                      : `color-mix(in srgb, var(--color-brand) ${c.mood * 18 + 10}%, var(--color-surface))`,
                  }}
                />
              ))}
            </div>
            {context.checkins.some((c) => c.meds_taken === false) && (
              <p className="text-xs text-[var(--color-warning)]">
                Missed medicines on{" "}
                {context.checkins.filter((c) => c.meds_taken === false).length} of the
                last {context.checkins.length} days.
              </p>
            )}
            {context.checkins[0] && (
              <p className="text-xs text-[var(--color-ink-3)] mt-1">
                Last logged {relative(context.checkins[0].date)}
                {context.checkins[0].symptoms.length > 0 &&
                  `, reporting ${context.checkins[0].symptoms.join(", ")}`}
              </p>
            )}
          </>
        )}
      </Panel>

      <Panel title="Surgical history" count={context.surgical.length}>
        {context.surgical.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-3)]">None recorded</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {context.surgical.map((s) => (
              <li key={s.id}>
                {s.name}
                <span className="block text-xs text-[var(--color-ink-3)]">
                  {s.on ? fmtDate(s.on) : "date not recorded"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </aside>
  );
}

function Panel({
  title, count, children, defaultOpen,
}: { title: string; count: number; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--color-paper)]"
      >
        <span className="eyebrow flex-1">{title}</span>
        <span className="text-xs text-[var(--color-ink-3)] tabular-nums">{count}</span>
        <ChevronDown size={15} className={cn("text-[var(--color-ink-3)] transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}
