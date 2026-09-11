"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { prescribe } from "@/app/actions/doctor";
import { checkDrug, searchDrugs, type DrugWarning } from "@/lib/clinical";
import { explainFrequency, quantityFor } from "@/lib/utils";
import type { Drug } from "@/lib/types";

// The highest-frequency action in the app, so it gets its own sub-view.
// Type-ahead against the drug master on brand or generic; selecting a drug
// prefills the common dose and form; frequency is entered in the Indian
// 1-0-1 notation with a plain-language preview underneath; duration
// auto-computes the total quantity to dispense.

interface Item {
  drug_id: number | null; drug_text: string; dose: string; frequency: string;
  route: string; timing: string | null; duration_days: number | null;
  quantity: number | null; instructions: string | null;
}

const FREQ_PRESETS = ["1-0-0", "0-0-1", "1-0-1", "1-1-1", "0-1-0", "1-1-0", "SOS"];
const TIMINGS = ["after food", "before food", "empty stomach", "before bed", "with milk"];

export function RxBuilder({
  caseSheetId, allergies, currentDrugs, existing, disabled,
}: {
  caseSheetId: string;
  allergies: { id: string; allergen: string; reaction: string | null; severity: string; category: string }[];
  currentDrugs: string[];
  existing: { id: string; token: string; items: { drug_text: string; dose: string; frequency: string; timing: string | null; duration_days: number | null }[] }[];
  disabled: boolean;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  const [blocking, setBlocking] = useState<{ drug: Drug; warnings: DrugWarning[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const hits = searchDrugs(q);

  const consider = (drug: Drug) => {
    const warnings = checkDrug(
      drug,
      allergies.map((a) => ({ ...a, patient_id: "", recorded_by: null, recorded_at: "", category: a.category as "drug" | "food" | "environmental", severity: a.severity as "mild" | "moderate" | "severe" | "anaphylaxis" })),
      [...currentDrugs, ...items.map((i) => i.drug_text)],
    );
    // Allergy conflicts and duplicate therapy appear as a BLOCKING dialog,
    // not a passive banner. A banner gets scrolled past.
    if (warnings.length) { setBlocking({ drug, warnings }); return; }
    add(drug);
  };

  const add = (drug: Drug) => {
    setItems((s) => [...s, {
      drug_id: drug.id,
      drug_text: `${drug.generic_name}${drug.brand_name ? ` (${drug.brand_name})` : ""}`,
      dose: drug.strength ?? "", frequency: "1-0-1", route: drug.form === "injection" ? "IV" : "oral",
      timing: "after food", duration_days: 5, quantity: quantityFor("1-0-1", 5), instructions: null,
    }]);
    setQ("");
    setBlocking(null);
  };

  const update = (i: number, p: Partial<Item>) =>
    setItems((s) => s.map((x, j) => {
      if (j !== i) return x;
      const merged = { ...x, ...p };
      return { ...merged, quantity: quantityFor(merged.frequency, merged.duration_days ?? 1) };
    }));

  return (
    <div>
      {existing.length > 0 && (
        <div className="mb-4 space-y-2">
          {existing.map((rx) => (
            <div key={rx.id} className="rounded-[6px] border border-[var(--color-good)] bg-[var(--color-good-soft)] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-[var(--color-good)]">Prescription issued</p>
                <Link href={`/verify/${rx.token}`} target="_blank" className="pill bg-[var(--color-surface)]">
                  verify {rx.token}
                </Link>
              </div>
              <ul className="text-sm mt-1.5 space-y-0.5">
                {rx.items.map((i, n) => (
                  <li key={n}>
                    {i.drug_text} {i.dose} · <span className="font-mono">{i.frequency}</span>
                    {i.timing ? `, ${i.timing}` : ""}{i.duration_days ? `, ${i.duration_days} days` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {!disabled && (
        <>
          <div className="relative mb-3">
            <input
              className="field"
              placeholder="Search the drug master by brand or generic name"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {hits.length > 0 && (
              <ul className="absolute z-20 left-0 right-0 mt-1 card-elevated p-0 overflow-hidden max-h-64 overflow-y-auto">
                {hits.map((d) => (
                  <li key={d.id}>
                    <button
                      onClick={() => consider(d)}
                      className="w-full text-left px-3 py-2 hover:bg-[var(--color-brand-soft)]"
                    >
                      <span className="text-sm font-medium">{d.brand_name}</span>
                      <span className="text-sm text-[var(--color-ink-2)]"> · {d.generic_name}</span>
                      <span className="block text-xs text-[var(--color-ink-3)]">
                        {d.strength} {d.form} · {d.class}
                        {d.schedule && d.schedule !== "OTC" && ` · Schedule ${d.schedule}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-3)]">
              No drugs added yet. Allergy conflicts are checked by drug class, so a
              penicillin allergy blocks amoxicillin.
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((it, i) => (
                <li key={i} className="rounded-[6px] border border-[var(--color-line)] p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-medium">{it.drug_text}</p>
                    <button
                      onClick={() => setItems((s) => s.filter((_, j) => j !== i))}
                      className="text-[var(--color-critical)]"
                      aria-label="Remove drug"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-4">
                    <label className="block">
                      <span className="label">Dose</span>
                      <input className="field h-9 py-0" value={it.dose} onChange={(e) => update(i, { dose: e.target.value })} />
                    </label>
                    <label className="block">
                      <span className="label">Frequency</span>
                      <input
                        className="field h-9 py-0 font-mono"
                        value={it.frequency}
                        onChange={(e) => update(i, { frequency: e.target.value })}
                      />
                    </label>
                    <label className="block">
                      <span className="label">Route</span>
                      <select className="field h-9 py-0" value={it.route} onChange={(e) => update(i, { route: e.target.value })}>
                        {["oral", "IV", "IM", "SC", "topical", "inhaled", "PR"].map((r) => <option key={r}>{r}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="label">Duration (days)</span>
                      <input
                        type="number" className="field h-9 py-0"
                        value={it.duration_days ?? ""}
                        onChange={(e) => update(i, { duration_days: Number(e.target.value) || null })}
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {FREQ_PRESETS.map((f) => (
                      <button key={f} onClick={() => update(i, { frequency: f })} className="pill font-mono">
                        {f}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {TIMINGS.map((t) => (
                      <button
                        key={t}
                        onClick={() => update(i, { timing: t })}
                        className={`pill ${it.timing === t ? "bg-[var(--color-brand)] text-[var(--color-on-brand)] border-[var(--color-brand)]" : ""}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  {/* The plain-language preview underneath — this is what the
                      patient will read on their phone at home. */}
                  <p className="text-sm text-[var(--color-brand-ink)] bg-[var(--color-brand-soft)] rounded-[6px] px-2.5 py-1.5 mt-2">
                    {explainFrequency(it.frequency)}
                    {it.timing ? `, ${it.timing}` : ""}
                    {it.duration_days ? `, for ${it.duration_days} days` : ""}
                    {" — "}
                    <strong>{it.quantity}</strong> to dispense
                  </p>

                  <input
                    className="field h-9 py-0 mt-2"
                    placeholder="Instructions (optional)"
                    value={it.instructions ?? ""}
                    onChange={(e) => update(i, { instructions: e.target.value })}
                  />
                </li>
              ))}
            </ul>
          )}

          {items.length > 0 && (
            <Button
              className="mt-3"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await prescribe(caseSheetId, items);
                  if (r.ok) { setError(null); setItems([]); router.refresh(); }
                  else setError(r.error);
                })
              }
            >
              <Plus size={15} />
              {pending ? "Issuing…" : `Issue prescription (${items.length} drug${items.length === 1 ? "" : "s"})`}
            </Button>
          )}

          {error && (
            <div className="mt-2 flex items-center gap-2 rounded-[6px] bg-[var(--color-critical-soft)] text-[var(--color-critical)] px-3 py-2 text-sm">
              <AlertTriangle size={14} className="shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)} className="text-xs underline shrink-0">
                Dismiss
              </button>
            </div>
          )}
          <p className="text-xs text-[var(--color-ink-3)] mt-2">
            Saving generates a PDF with letterhead, registration number, signature and
            a verification QR — and pushes the drugs into the patient&apos;s Current
            Medications list instantly.
          </p>
        </>
      )}

      {/* Blocking dialog, not a passive banner. */}
      {blocking && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="alertdialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative card-elevated p-5 w-full max-w-md border-[var(--color-critical)]">
            <div className="flex items-center gap-2 text-[var(--color-critical)]">
              <AlertTriangle size={20} />
              <h3 className="font-semibold">Check before prescribing</h3>
            </div>
            <p className="text-sm mt-2">
              <strong>{blocking.drug.generic_name}</strong>
              {blocking.drug.brand_name ? ` (${blocking.drug.brand_name})` : ""} · {blocking.drug.class}
            </p>
            <ul className="mt-3 space-y-2">
              {blocking.warnings.map((w, i) => (
                <li
                  key={i}
                  className={`rounded-[6px] p-2.5 text-sm ${
                    w.level === "block"
                      ? "bg-[var(--color-critical-soft)] text-[var(--color-critical)]"
                      : "bg-[var(--color-warning-soft)] text-[var(--color-warning)]"
                  }`}
                >
                  <span className="font-medium flex items-center gap-1.5">
                    {w.title}
                    <Badge tone={w.level === "block" ? "critical" : "warning"}>{w.level}</Badge>
                  </span>
                  <span className="block mt-0.5">{w.detail}</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 mt-4">
              <Button variant="secondary" className="flex-1" onClick={() => setBlocking(null)}>
                Choose a different drug
              </Button>
              <Button
                variant={blocking.warnings.some((w) => w.level === "block") ? "danger" : "primary"}
                className="flex-1"
                onClick={() => add(blocking.drug)}
              >
                Prescribe anyway
              </Button>
            </div>
            <p className="text-xs text-[var(--color-ink-3)] mt-2">
              Overriding is recorded against this prescription.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
