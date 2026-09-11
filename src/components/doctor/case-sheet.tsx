"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle, Check, ChevronDown, FileJson, Lock, Mic, Save, Sparkles,
} from "lucide-react";
import { AiLabel, Badge, Button } from "@/components/ui";
import { ContextPanel } from "@/components/doctor/context-panel";
import { RxBuilder } from "@/components/doctor/rx-builder";
import { autosave, finalize, amend, saveVitals, orderTests, saveTemplate } from "@/app/actions/doctor";
import {
  ADVICE_SNIPPETS, EXAM_METHODS, PANEL_PRESETS, RED_FLAG_ADVICE, SYMPTOM_LIST,
  SYSTEMS, VITAL_RANGES, WNL_TEXT, bmi, bmiBand, flagVital, rangeFor, searchIcd11,
} from "@/lib/clinical";
import type { CaseSheet, TriState, Vitals } from "@/lib/types";
import { cn, relative } from "@/lib/utils";

type PatientLite = {
  id: string; name: string; age: number; sex: string; mrn: string;
  blood_group: string; height_cm: number | null;
};

export interface CaseContext {
  allergies: { id: string; allergen: string; reaction: string | null; severity: string; category: string }[];
  medications: { id: string; drug_text: string; dose: string | null; frequency: string | null }[];
  problems: { id: string; condition: string; since: string | null; on_treatment: boolean }[];
  family: { id: string; relation: string; condition: string }[];
  surgical: { id: string; name: string; on: string | null }[];
  previous: { id: string; date: string; doctor: string; hospital: string; dx: string; advice: string | null }[];
  checkins: { date: string; mood: number | null; pain: number | null; sleep: number | null; meds_taken: boolean | null; symptoms: string[] }[];
  reports: { id: string; title: string; date: string; flagged: { analyte: string; value: number; unit: string; flag: string }[] }[];
}

const SECTIONS = [
  "Chief complaint", "History of present illness", "Past history",
  "Drug & allergy history", "Family history", "Personal history",
  "Menstrual & obstetric", "Vitals", "General examination",
  "Systemic examination", "Assessment", "Investigations",
  "Prescription", "Advice & follow-up",
] as const;

export function CaseSheetWorkspace({
  sheet, patient, doctorSpeciality, hospital, vitals, lastVitals, context, prescriptions, orders,
}: {
  sheet: CaseSheet;
  patient: PatientLite;
  doctorSpeciality: string;
  hospital: string;
  vitals: Vitals | null;
  lastVitals: Vitals | null;
  context: CaseContext;
  prescriptions: { id: string; token: string; items: { drug_text: string; dose: string; frequency: string; timing: string | null; duration_days: number | null }[] }[];
  orders: { id: string; test_name: string; urgency: string }[];
}) {
  const router = useRouter();
  const readOnly = sheet.status !== "draft";
  const [form, setForm] = useState<CaseSheet>(sheet);
  const [v, setV] = useState<Partial<Vitals>>(vitals ?? {});
  const [open, setOpen] = useState<number | null>(0);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ text: string; source: string } | null>(
    sheet.ai_summary ? { text: sheet.ai_summary, source: "offline" } : null,
  );
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [pending, startTx] = useTransition();
  const dirty = useRef(false);

  // ── Autosave every field, every two seconds ────────────────
  // Optimistic local write, background sync, a subtle "Saved 3s ago".
  // A draft case sheet must survive a dropped connection.
  const patch = useCallback((p: Partial<CaseSheet>) => {
    setForm((f) => ({ ...f, ...p }));
    dirty.current = true;
  }, []);

  useEffect(() => {
    if (readOnly) return;
    const t = setInterval(() => {
      if (!dirty.current) return;
      dirty.current = false;
      setSaving(true);
      const { id, patient_id, doctor_id, hospital_id, status, created_at, ...body } = form;
      void id; void patient_id; void doctor_id; void hospital_id; void status; void created_at;
      autosave(sheet.id, body).then((r) => {
        setSaving(false);
        if (r.ok) { setSavedAt(new Date()); setActionError(null); }
        else setActionError(r.error);
      });
    }, 2000);
    return () => clearInterval(t);
  }, [form, sheet.id, readOnly]);

  useEffect(() => {
    if (readOnly || !vitals) return;
    const t = setTimeout(() => {
      saveVitals(sheet.id, v).then((r) => { if (!r.ok) setActionError(r.error); });
    }, 1500);
    return () => clearTimeout(t);
  }, [v, sheet.id, readOnly, vitals]);

  // One entry per section, in section order. The progress bar, the rail and
  // each accordion's tick all read this, so they can never disagree.
  const done = useMemo(() => {
    return [
      form.chief_complaints.length > 0,
      Object.keys(form.hopi).length > 2,
      Object.keys(form.past_history).length > 0,
      context.medications.length > 0 || context.allergies.length > 0,
      context.family.length > 0,
      Object.keys(form.personal_history).length > 0,
      patient.sex !== "female" || !!form.menstrual_obstetric,
      Object.values(v).some((x) => x != null),
      Object.keys(form.general_exam).length > 0,
      Object.keys(form.systemic_exam).length > 0,
      !!form.provisional_dx,
      orders.length > 0,
      prescriptions.length > 0,
      !!form.advice,
    ];
  }, [form, v, context, orders, prescriptions, patient.sex]);

  const progress = Math.round((done.filter(Boolean).length / done.length) * 100);

  // Alt + ↓ / ↑ walks the sections, Escape collapses. A doctor typing into a
  // field should never have a bare key steal focus, so every shortcut needs a
  // modifier — and Alt is the one macOS and Windows browsers both leave alone
  // for arrow keys.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(null); return; }
      if (!e.altKey || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
      e.preventDefault();
      setOpen((cur) => {
        const step = e.key === "ArrowDown" ? 1 : -1;
        const next = cur === null ? (step === 1 ? 0 : SECTIONS.length - 1) : cur + step;
        return Math.max(0, Math.min(SECTIONS.length - 1, next));
      });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Bring a newly opened section into view without yanking the page around.
  useEffect(() => {
    if (open === null) return;
    document
      .getElementById(`section-${open}`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open]);

  const doFinalize = () =>
    startTx(async () => {
      const r = await finalize(sheet.id);
      if (r.ok) {
        setSummary({ text: r.summary, source: r.source });
        setConfirmFinalize(false);
        router.refresh();
      }
    });

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px] items-start max-w-[1400px]">
      <div className="min-w-0">
        {/* ── Header ───────────────────────────────────────── */}
        <div className="sticky top-14 z-10 bg-[var(--color-paper)] pb-3 pt-1 -mt-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="eyebrow">{form.visit_type} consultation · {hospital}</div>
              <h1 className="text-[1.375rem] font-bold tracking-tight">
                <Link href={`/doctor/patient/${patient.id}`} className="hover:text-[var(--color-brand)]">
                  {patient.name}
                </Link>
              </h1>
              <p className="text-sm text-[var(--color-ink-3)]">
                {patient.age} y · {patient.sex} · {patient.blood_group} ·{" "}
                <span className="font-mono">{patient.mrn}</span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* ARIA live region: the save state is announced, not just shown */}
              <span aria-live="polite" className="text-xs text-[var(--color-ink-3)] min-w-[92px] text-right">
                {readOnly ? "" : saving ? "Saving…" : savedAt ? `Saved ${relative(savedAt.toISOString())}` : "Not saved yet"}
              </span>
              {readOnly ? (
                <>
                  <Badge tone="good"><Lock size={11} /> finalised</Badge>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => startTx(async () => {
                      const r = await amend(sheet.id);
                      if (r.ok) router.push(`/doctor/case/${r.id}`);
                      else setActionError(r.error);
                    })}
                  >
                    Create amendment
                  </Button>
                </>
              ) : (
                <>
                  <TemplateMenu caseSheetId={sheet.id} onApply={(b) => patch(b)} />
                  <Button size="sm" onClick={() => setConfirmFinalize(true)}>
                    <Check size={14} /> Finalise
                  </Button>
                </>
              )}
              <Link href={`/api/fhir/case/${sheet.id}`} target="_blank" className="pill hover:border-[var(--color-brand)]">
                <FileJson size={12} /> View as FHIR
              </Link>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div className="h-1.5 flex-1 rounded-full bg-[var(--color-line)] overflow-hidden">
              <div
                className="h-full bg-[var(--color-brand)] transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-[var(--color-ink-3)] tabular-nums">{progress}% complete</span>
          </div>

          {actionError && (
            <div className="mt-2 flex items-center gap-2 rounded-[6px] bg-[var(--color-critical-soft)] text-[var(--color-critical)] px-3 py-2 text-sm">
              <AlertTriangle size={14} className="shrink-0" />
              <span className="flex-1">{actionError}</span>
              <button onClick={() => setActionError(null)} className="text-xs underline shrink-0">
                Dismiss
              </button>
            </div>
          )}

          <SectionRail done={done} open={open} onJump={setOpen} />
        </div>

        {summary && (
          <Section title="Visit summary" defaultOpen>
            <p className="text-sm whitespace-pre-line">{summary.text}</p>
            <div className="mt-2"><AiLabel source={summary.source} /></div>
          </Section>
        )}

        {/* ── 1 · Chief complaint ──────────────────────────── */}
        <Acc n={1} title={SECTIONS[0]} open={open === 0} onToggle={() => setOpen(open === 0 ? null : 0)} done={form.chief_complaints.length > 0}>
          <ComplaintEditor
            value={form.chief_complaints}
            onChange={(chief_complaints) => patch({ chief_complaints })}
            disabled={readOnly}
          />
        </Acc>

        {/* ── 2 · HOPI — the section judges look at hardest ── */}
        <Acc n={2} title={SECTIONS[1]} open={open === 1} onToggle={() => setOpen(open === 1 ? null : 1)} done={Object.keys(form.hopi).length > 2}>
          <p className="text-xs text-[var(--color-ink-3)] mb-3">
            OLDCARTS as a labelled grid, not a textarea.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              ["onset", "Onset", ["sudden", "gradual", "insidious"]],
              ["location", "Location", null],
              ["duration", "Duration", null],
              ["character", "Character", ["dull ache", "burning", "cramping", "sharp", "throbbing", "colicky"]],
              ["aggravating", "Aggravating factors", null],
              ["relieving", "Relieving factors", null],
              ["radiation", "Radiation", null],
              ["timing", "Timing", ["continuous", "intermittent", "nocturnal", "early morning", "post-prandial"]],
              ["progression", "Progression", ["improving", "static", "worsening"]],
            ] as const).map(([key, label, chips]) => (
              <div key={key}>
                <label className="label">{label}</label>
                <div className="flex gap-1.5">
                  <input
                    className="field"
                    value={(form.hopi[key] as string) ?? ""}
                    onChange={(e) => patch({ hopi: { ...form.hopi, [key]: e.target.value } })}
                    disabled={readOnly}
                  />
                  {!readOnly && <VoiceButton onText={(t) => patch({ hopi: { ...form.hopi, [key]: t } })} />}
                </div>
                {chips && !readOnly && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {chips.map((c) => (
                      <button
                        key={c}
                        onClick={() => patch({ hopi: { ...form.hopi, [key]: c } })}
                        className="pill text-[0.6875rem] hover:border-[var(--color-brand)]"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div className="sm:col-span-2">
              <label className="label">Severity — {form.hopi.severity_0_10 ?? 0}/10</label>
              <input
                type="range" min={0} max={10}
                value={form.hopi.severity_0_10 ?? 0}
                onChange={(e) => patch({ hopi: { ...form.hopi, severity_0_10: Number(e.target.value) } })}
                disabled={readOnly}
                className="w-full accent-[var(--color-brand)]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="label">Associated symptoms</label>
              <ChipMulti
                options={["nausea", "vomiting", "sweating", "palpitations", "fever", "giddiness", "breathlessness", "loss of appetite"]}
                value={form.hopi.associated ?? []}
                onChange={(associated) => patch({ hopi: { ...form.hopi, associated } })}
                disabled={readOnly}
              />
            </div>
          </div>
        </Acc>

        {/* ── 3 · Past history ─────────────────────────────── */}
        <Acc n={3} title={SECTIONS[2]} open={open === 2} onToggle={() => setOpen(open === 2 ? null : 2)} done={Object.keys(form.past_history).length > 0}>
          <div className="grid gap-2 sm:grid-cols-3">
            {(["diabetes", "hypertension", "tuberculosis", "asthma", "thyroid", "ihd", "cva", "epilepsy", "hepatitis"] as const).map((k) => {
              const entry = form.past_history[k];
              const on = !!entry?.present;
              return (
                <div key={k} className={cn("rounded-[6px] border p-2", on ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)]" : "border-[var(--color-line)]")}>
                  <button
                    disabled={readOnly}
                    onClick={() => patch({ past_history: { ...form.past_history, [k]: { ...entry, present: !on } } })}
                    aria-pressed={on}
                    className="w-full text-left text-sm font-medium capitalize"
                  >
                    {k === "ihd" ? "Ischaemic heart disease" : k === "cva" ? "Stroke / CVA" : k}
                  </button>
                  {/* Enabling one reveals "since when" and "on treatment?" */}
                  {on && (
                    <div className="mt-2 space-y-1.5">
                      <input
                        className="field h-8 py-0 text-xs"
                        placeholder="Since when"
                        value={entry?.since ?? ""}
                        onChange={(e) => patch({ past_history: { ...form.past_history, [k]: { ...entry!, present: true, since: e.target.value } } })}
                        disabled={readOnly}
                      />
                      <label className="flex items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          checked={!!entry?.on_treatment}
                          onChange={(e) => patch({ past_history: { ...form.past_history, [k]: { ...entry!, present: true, on_treatment: e.target.checked } } })}
                          disabled={readOnly}
                        />
                        On treatment
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <label className="label mt-3">Other</label>
          <textarea
            className="field min-h-[60px]"
            value={form.past_history.notes ?? ""}
            onChange={(e) => patch({ past_history: { ...form.past_history, notes: e.target.value } })}
            disabled={readOnly}
          />
        </Acc>

        {/* ── 4 · Drug & allergy history (pre-populated) ───── */}
        <Acc n={4} title={SECTIONS[3]} open={open === 3} onToggle={() => setOpen(open === 3 ? null : 3)} done={context.medications.length > 0 || context.allergies.length > 0}>
          <p className="text-xs text-[var(--color-ink-3)] mb-3">
            Pre-populated from the record. Confirm or amend — do not retype.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="eyebrow mb-1.5">Current medications</div>
              {context.medications.length === 0 ? (
                <p className="text-sm text-[var(--color-ink-3)]">None on record.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {context.medications.map((m) => (
                    <li key={m.id}>
                      {m.drug_text} {m.dose} <span className="font-mono text-xs">{m.frequency}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="eyebrow mb-1.5">Known allergies</div>
              {context.allergies.length === 0 ? (
                <p className="text-sm text-[var(--color-ink-3)]">None on record.</p>
              ) : (
                <ul className="space-y-1 text-sm text-[var(--color-critical)]">
                  {context.allergies.map((a) => (
                    <li key={a.id}>
                      <strong>{a.allergen}</strong> — {a.reaction ?? "reaction not recorded"} ({a.severity})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <label className="label mt-3">Treatment history for this episode</label>
          <textarea
            className="field min-h-[60px]"
            placeholder="What has already been tried, and with what effect"
            value={form.treatment_history ?? ""}
            onChange={(e) => patch({ treatment_history: e.target.value })}
            disabled={readOnly}
          />
        </Acc>

        {/* ── 5 · Family history ───────────────────────────── */}
        <Acc n={5} title={SECTIONS[4]} open={open === 4} onToggle={() => setOpen(open === 4 ? null : 4)} done={context.family.length > 0}>
          {context.family.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-3)]">Nothing on record.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {context.family.map((f) => (
                <li key={f.id}><strong>{f.relation}</strong> — {f.condition}</li>
              ))}
            </ul>
          )}
          <p className="text-xs text-[var(--color-ink-3)] mt-2">
            Family history is stored against the patient, not the visit, so it
            carries forward. Add to it from the patient record.
          </p>
        </Acc>

        {/* ── 6 · Personal history ─────────────────────────── */}
        <Acc n={6} title={SECTIONS[5]} open={open === 5} onToggle={() => setOpen(open === 5 ? null : 5)} done={Object.keys(form.personal_history).length > 0}>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              ["diet", ["veg", "non_veg", "eggetarian", "vegan"]],
              ["appetite", ["normal", "reduced", "increased"]],
              ["sleep", ["normal", "disturbed", "insomnia"]],
              ["bowel", ["regular", "constipated", "loose"]],
              ["bladder", ["normal", "frequency", "dysuria", "nocturia"]],
            ] as const).map(([key, opts]) => (
              <div key={key}>
                <label className="label capitalize">{key}</label>
                <Segmented
                  options={opts as unknown as string[]}
                  value={(form.personal_history[key] as string) ?? ""}
                  onChange={(val) => patch({ personal_history: { ...form.personal_history, [key]: val } })}
                  disabled={readOnly}
                />
              </div>
            ))}

            {/* Tobacco and alcohol expand into quantity and duration, and
                pack-years is computed rather than asked for. */}
            <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
              <SubstanceField
                label="Tobacco"
                value={form.personal_history.tobacco}
                onChange={(tobacco) => patch({ personal_history: { ...form.personal_history, tobacco } })}
                unit="cigarettes/day"
                disabled={readOnly}
                computed={(q, y) => (q && y ? `${((q / 20) * y).toFixed(1)} pack-years` : null)}
              />
              <SubstanceField
                label="Alcohol"
                value={form.personal_history.alcohol as { use: boolean; qty_per_day?: number; years?: number } | undefined}
                onChange={(alcohol) => patch({ personal_history: { ...form.personal_history, alcohol: { use: alcohol.use, units_per_week: alcohol.qty_per_day, years: alcohol.years } } })}
                unit="units/week"
                disabled={readOnly}
              />
            </div>

            <div>
              <label className="label">Occupation</label>
              <input
                className="field"
                value={form.personal_history.occupation ?? ""}
                onChange={(e) => patch({ personal_history: { ...form.personal_history, occupation: e.target.value } })}
                disabled={readOnly}
              />
            </div>
            <div>
              <label className="label">Exercise</label>
              <input
                className="field"
                value={form.personal_history.exercise ?? ""}
                onChange={(e) => patch({ personal_history: { ...form.personal_history, exercise: e.target.value } })}
                disabled={readOnly}
              />
            </div>
          </div>
        </Acc>

        {/* ── 7 · Menstrual & obstetric — rendered conditionally ── */}
        {patient.sex === "female" && (
          <Acc n={7} title={SECTIONS[6]} open={open === 6} onToggle={() => setOpen(open === 6 ? null : 6)} done={!!form.menstrual_obstetric?.lmp}>
            <p className="text-xs text-[var(--color-ink-3)] mb-3">
              Shown because sex is recorded as female. Never assumed.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ["lmp", "Last menstrual period", "date"],
                ["cycle", "Cycle", "text"],
                ["parity", "Parity", "text"],
                ["obstetric_score", "Obstetric score", "text"],
              ] as const).map(([k, label, type]) => (
                <div key={k}>
                  <label className="label">{label}</label>
                  <input
                    type={type}
                    className="field"
                    value={form.menstrual_obstetric?.[k] ?? ""}
                    onChange={(e) => patch({ menstrual_obstetric: { ...form.menstrual_obstetric, [k]: e.target.value } })}
                    disabled={readOnly}
                    placeholder={k === "cycle" ? "28/4, regular" : k === "obstetric_score" ? "G2P2L2A0" : ""}
                  />
                </div>
              ))}
            </div>
          </Acc>
        )}

        {/* ── 8 · Vitals with live range flagging ──────────── */}
        <Acc n={8} title={SECTIONS[7]} open={open === 7} onToggle={() => setOpen(open === 7 ? null : 7)} done={Object.values(v).some((x) => x != null)}>
          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(VITAL_RANGES) as (keyof typeof VITAL_RANGES)[]).map((key) => {
              const r = rangeFor(key, patient.age)!;
              const value = (v as Record<string, number | undefined>)[key];
              const flag = flagVital(key, value ?? null, patient.age);
              const prev = lastVitals ? (lastVitals as unknown as Record<string, number | null>)[key] : null;
              return (
                <div key={key}>
                  <label className="label">{r.label} <span className="normal-case">({r.unit})</span></label>
                  <input
                    type="number"
                    step="0.1"
                    className={cn(
                      "field",
                      flag === "high" && "border-[var(--color-critical)] text-[var(--color-critical)]",
                      flag === "low" && "border-[var(--color-warning)] text-[var(--color-warning)]",
                    )}
                    value={value ?? ""}
                    onChange={(e) => setV((s) => ({ ...s, [key]: e.target.value === "" ? null : Number(e.target.value) }))}
                    disabled={readOnly}
                  />
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[0.6875rem] text-[var(--color-ink-3)]">
                      normal {r.low}–{r.high}
                    </span>
                    {flag && flag !== "normal" && (
                      <span className={cn("text-[0.6875rem] font-medium", flag === "high" ? "text-[var(--color-critical)]" : "text-[var(--color-warning)]")}>
                        {flag === "high" ? "↑ high" : "↓ low"}
                      </span>
                    )}
                    {prev != null && (
                      <span className="text-[0.6875rem] text-[var(--color-ink-3)]">was {prev}</span>
                    )}
                  </div>
                </div>
              );
            })}

            <div>
              <label className="label">Weight (kg)</label>
              <input
                type="number" step="0.1" className="field"
                value={v.weight_kg ?? ""}
                onChange={(e) => setV((s) => ({ ...s, weight_kg: e.target.value === "" ? null : Number(e.target.value) }))}
                disabled={readOnly}
              />
            </div>
            <div>
              <label className="label">Pain score (0–10)</label>
              <input
                type="number" min={0} max={10} className="field"
                value={v.pain_score ?? ""}
                onChange={(e) => setV((s) => ({ ...s, pain_score: e.target.value === "" ? null : Number(e.target.value) }))}
                disabled={readOnly}
              />
            </div>
            <div>
              <label className="label">BMI (computed)</label>
              <div className="field flex items-center gap-2 bg-[var(--color-paper)]">
                {(() => {
                  const b = bmi(v.weight_kg, patient.height_cm);
                  const band = bmiBand(b);
                  return b ? (
                    <>
                      <span className="font-semibold">{b}</span>
                      {band && (
                        <Badge tone={band.flag === "normal" ? "good" : band.flag === "low" ? "warning" : "critical"}>
                          {band.label}
                        </Badge>
                      )}
                    </>
                  ) : (
                    <span className="text-[var(--color-ink-3)] text-sm">enter weight</span>
                  );
                })()}
              </div>
            </div>
          </div>
        </Acc>

        {/* ── 9 · General examination: tri-state ───────────── */}
        <Acc n={9} title={SECTIONS[8]} open={open === 8} onToggle={() => setOpen(open === 8 ? null : 8)} done={Object.keys(form.general_exam).length > 0}>
          <p className="text-xs text-[var(--color-ink-3)] mb-3">
            &ldquo;Not examined&rdquo; is clinically distinct from &ldquo;absent&rdquo;. Encoding that
            difference is the detail a doctor on the panel notices.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(["pallor", "icterus", "cyanosis", "clubbing", "lymphadenopathy", "oedema", "dehydration"] as const).map((k) => (
              <div key={k} className="flex items-center justify-between gap-3 py-1">
                <span className="text-sm capitalize">{k}</span>
                <TriStateToggle
                  value={form.general_exam[k]}
                  onChange={(val) => patch({ general_exam: { ...form.general_exam, [k]: val } })}
                  disabled={readOnly}
                />
              </div>
            ))}
          </div>
          <label className="label mt-3">Build and nourishment</label>
          <input
            className="field"
            value={form.general_exam.build ?? ""}
            onChange={(e) => patch({ general_exam: { ...form.general_exam, build: e.target.value } })}
            disabled={readOnly}
            placeholder="well built and nourished"
          />
        </Acc>

        {/* ── 10 · Systemic examination ────────────────────── */}
        <Acc n={10} title={SECTIONS[9]} open={open === 9} onToggle={() => setOpen(open === 9 ? null : 9)} done={Object.keys(form.systemic_exam).length > 0}>
          <SystemicExam
            value={form.systemic_exam}
            onChange={(systemic_exam) => patch({ systemic_exam })}
            disabled={readOnly}
          />
        </Acc>

        {/* ── 11 · Assessment: ICD-11 autocomplete ─────────── */}
        <Acc n={11} title={SECTIONS[10]} open={open === 10} onToggle={() => setOpen(open === 10 ? null : 10)} done={!!form.provisional_dx}>
          <Icd11Field
            label="Provisional diagnosis"
            value={form.provisional_dx ?? ""}
            onChange={(provisional_dx) => patch({ provisional_dx })}
            disabled={readOnly}
          />
          <label className="label mt-3">Differential diagnoses</label>
          <ChipList
            value={form.differential_dx}
            onChange={(differential_dx) => patch({ differential_dx })}
            placeholder="Add a differential and press Enter"
            disabled={readOnly}
          />
        </Acc>

        {/* ── 12 · Investigations: panel presets ───────────── */}
        <Acc n={12} title={SECTIONS[11]} open={open === 11} onToggle={() => setOpen(open === 11 ? null : 11)} done={orders.length > 0}>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {PANEL_PRESETS.map((p) => (
              <button
                key={p.name}
                disabled={readOnly || pending}
                onClick={() => startTx(async () => {
                  const r = await orderTests(sheet.id, p.tests.map((t) => ({ test_name: t, panel: p.name })));
                  if (r.ok) { setActionError(null); router.refresh(); }
                  else setActionError(r.error);
                })}
                className="pill hover:border-[var(--color-brand)] px-3 py-1.5"
              >
                + {p.name}
              </button>
            ))}
          </div>
          {orders.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-3)]">Nothing ordered yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center gap-2">
                  <Check size={13} className="text-[var(--color-good)]" />
                  {o.test_name}
                  {o.urgency !== "routine" && <Badge tone="warning">{o.urgency}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Acc>

        {/* ── 13 · Prescription ────────────────────────────── */}
        <Acc n={13} title={SECTIONS[12]} open={open === 12} onToggle={() => setOpen(open === 12 ? null : 12)} done={prescriptions.length > 0}>
          <RxBuilder
            caseSheetId={sheet.id}
            allergies={context.allergies}
            currentDrugs={context.medications.map((m) => m.drug_text)}
            existing={prescriptions}
            disabled={readOnly}
          />
        </Acc>

        {/* ── 14 · Advice & follow-up ──────────────────────── */}
        <Acc n={14} title={SECTIONS[13]} open={open === 13} onToggle={() => setOpen(open === 13 ? null : 13)} done={!!form.advice}>
          <label className="label">Advice</label>
          <div className="flex gap-1.5">
            <textarea
              className="field min-h-[90px]"
              value={form.advice ?? ""}
              onChange={(e) => patch({ advice: e.target.value })}
              disabled={readOnly}
            />
            {!readOnly && <VoiceButton onText={(t) => patch({ advice: `${form.advice ?? ""} ${t}`.trim() })} />}
          </div>
          {!readOnly && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(ADVICE_SNIPPETS[doctorSpeciality] ?? ADVICE_SNIPPETS["General Medicine"]).map((s) => (
                <button
                  key={s}
                  onClick={() => patch({ advice: `${form.advice ? form.advice + "\n" : ""}${s}` })}
                  className="pill text-left hover:border-[var(--color-brand)] max-w-full"
                >
                  + {s.length > 52 ? `${s.slice(0, 52)}…` : s}
                </button>
              ))}
            </div>
          )}

          <label className="label mt-4">Red-flag warnings</label>
          <div className="flex flex-wrap gap-1.5">
            {RED_FLAG_ADVICE.map((s) => (
              <button
                key={s}
                disabled={readOnly}
                onClick={() => patch({ advice: `${form.advice ? form.advice + "\n" : ""}⚠ ${s}` })}
                className="pill text-[var(--color-critical)] border-[color-mix(in_srgb,var(--color-critical)_35%,transparent)]"
              >
                + {s}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 mt-4">
            <div>
              <label className="label">Follow-up date</label>
              <input
                type="date" className="field"
                value={form.follow_up_on ?? ""}
                onChange={(e) => patch({ follow_up_on: e.target.value })}
                disabled={readOnly}
              />
              {!readOnly && (
                <div className="flex gap-1.5 mt-1.5">
                  {([["+3d", 3], ["+1w", 7], ["+2w", 14], ["+1m", 30]] as const).map(([label, days]) => (
                    <button
                      key={label}
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + days);
                        patch({ follow_up_on: d.toISOString().slice(0, 10) });
                      }}
                      className="pill hover:border-[var(--color-brand)]"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="label">Referred to</label>
              <input
                className="field"
                value={form.referred_to ?? ""}
                onChange={(e) => patch({ referred_to: e.target.value })}
                disabled={readOnly}
                placeholder="Speciality or named doctor"
              />
            </div>
          </div>
        </Acc>

        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2 mt-5 pb-10">
            <Button size="lg" onClick={() => setConfirmFinalize(true)}>
              <Check size={16} /> Finalise consultation
            </Button>
            <SaveTemplateButton caseSheetId={sheet.id} />
            <span className="text-xs text-[var(--color-ink-3)]">
              Finalising makes this sheet immutable. Corrections after that create a
              linked amendment.
            </span>
          </div>
        )}
      </div>

      <ContextPanel patient={patient} context={context} vitals={vitals} />

      {confirmFinalize && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmFinalize(false)} />
          <div className="relative card-elevated p-5 w-full max-w-md">
            <h3 className="font-semibold">Finalise this case sheet?</h3>
            <ul className="text-sm text-[var(--color-ink-2)] mt-2 space-y-1 list-disc list-inside">
              <li>The sheet becomes immutable. Corrections create an amendment.</li>
              <li>Diagnoses and vitals rows are written to the patient&apos;s record.</li>
              <li>A visit summary is pushed to their timeline and they are notified.</li>
              <li>A clinical summary is generated and labelled as AI-generated.</li>
            </ul>
            {progress < 60 && (
              <p className="text-sm text-[var(--color-warning)] mt-3 flex gap-1.5">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                The sheet is only {progress}% complete. You can still finalise, but
                the next doctor will see the gaps.
              </p>
            )}
            <div className="flex gap-2 mt-4">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmFinalize(false)}>
                Keep editing
              </Button>
              <Button className="flex-1" disabled={pending} onClick={doFinalize}>
                {pending ? "Finalising…" : "Finalise"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Pieces
// ═══════════════════════════════════════════════════════════════


/**
 * Fourteen sections is a lot of scrolling in a seven-minute consultation.
 * The rail is the whole sheet at a glance — filled means done, hollow means
 * empty — and one click is the difference between "where was vitals again"
 * and typing. Alt + ↓ / ↑ does the same thing without leaving the keyboard.
 */
function SectionRail({
  done, open, onJump,
}: { done: boolean[]; open: number | null; onJump: (i: number) => void }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Case sheet sections">
        {SECTIONS.map((title, i) => (
          <button
            key={title}
            type="button"
            data-rail={i}
            onClick={() => onJump(i)}
            title={`${i + 1}. ${title}${done[i] ? " — complete" : ""}`}
            aria-label={`${i + 1}. ${title}${done[i] ? ", complete" : ", empty"}`}
            aria-current={open === i ? "true" : undefined}
            className={cn(
              "w-6 h-6 rounded-[5px] text-[0.625rem] font-semibold tabular-nums transition-colors",
              open === i && "ring-2 ring-[var(--color-brand)] ring-offset-1 ring-offset-[var(--color-paper)]",
              done[i]
                ? "bg-[var(--color-good)] text-[var(--color-on-good)]"
                : "bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink-3)] hover:border-[var(--color-brand)]",
            )}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <span className="hidden lg:inline text-[0.6875rem] text-[var(--color-ink-3)] ml-1">
        <kbd className="font-mono">Alt</kbd> + <kbd className="font-mono">↓</kbd>/
        <kbd className="font-mono">↑</kbd> to move
      </span>
    </div>
  );
}

function Acc({
  n, title, open, onToggle, done, children,
}: { n: number; title: string; open: boolean; onToggle: () => void; done: boolean; children: React.ReactNode }) {
  return (
    <section id={`section-${n - 1}`} className="card mb-2 overflow-hidden scroll-mt-40">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--color-paper)]"
      >
        <span
          className={cn(
            "w-6 h-6 rounded-full grid place-items-center text-[0.6875rem] font-semibold shrink-0",
            done ? "bg-[var(--color-good)] text-[var(--color-on-good)]" : "border border-[var(--color-line)] text-[var(--color-ink-3)]",
          )}
        >
          {done ? <Check size={12} /> : n}
        </span>
        <span className="font-medium flex-1">{title}</span>
        <ChevronDown size={17} className={cn("text-[var(--color-ink-3)] transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="px-4 pb-4 pt-1 border-t border-[var(--color-line)]">{children}</div>}
    </section>
  );
}

function Section({ title, children, defaultOpen }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <section className="card mb-2 overflow-hidden border-[color-mix(in_srgb,var(--color-brand)_35%,transparent)]">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-4 py-3 text-left">
        <Sparkles size={15} className="text-[var(--color-brand)]" />
        <span className="font-medium flex-1">{title}</span>
        <ChevronDown size={17} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

function ComplaintEditor({
  value, onChange, disabled,
}: {
  value: CaseSheet["chief_complaints"];
  onChange: (v: CaseSheet["chief_complaints"]) => void;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState("");
  const suggestions = draft.length > 1
    ? SYMPTOM_LIST.filter((s) => s.toLowerCase().includes(draft.toLowerCase())).slice(0, 6)
    : [];

  const add = (complaint: string) => {
    onChange([...value, { complaint, duration_value: 1, duration_unit: "days" }]);
    setDraft("");
  };

  return (
    <div>
      {/* Repeatable, and ordered by significance — the first row is the one
          the doctor considers most important. */}
      <ul className="space-y-2 mb-3">
        {value.map((c, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[var(--color-ink-3)] w-4">{i + 1}.</span>
            <input
              className="field flex-1 min-w-[160px]"
              value={c.complaint}
              onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, complaint: e.target.value } : x)))}
              disabled={disabled}
            />
            <div className="flex items-center gap-1">
              <button
                disabled={disabled}
                onClick={() => onChange(value.map((x, j) => (j === i ? { ...x, duration_value: Math.max(1, x.duration_value - 1) } : x)))}
                className="w-8 h-9 rounded-[6px] border border-[var(--color-line)]"
              >−</button>
              <span className="w-8 text-center font-semibold">{c.duration_value}</span>
              <button
                disabled={disabled}
                onClick={() => onChange(value.map((x, j) => (j === i ? { ...x, duration_value: x.duration_value + 1 } : x)))}
                className="w-8 h-9 rounded-[6px] border border-[var(--color-line)]"
              >+</button>
            </div>
            <select
              className="field w-28 h-9 py-0"
              value={c.duration_unit}
              onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, duration_unit: e.target.value as typeof x.duration_unit } : x)))}
              disabled={disabled}
            >
              {["hours", "days", "weeks", "months", "years"].map((u) => <option key={u}>{u}</option>)}
            </select>
            {!disabled && (
              <button
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="text-[var(--color-critical)] text-sm px-2"
                aria-label="Remove complaint"
              >×</button>
            )}
          </li>
        ))}
      </ul>

      {!disabled && (
        <div className="relative">
          <input
            className="field"
            placeholder="Add a complaint — autocompletes from the symptom list"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && draft) { e.preventDefault(); add(draft); } }}
          />
          {suggestions.length > 0 && (
            <ul className="absolute z-10 left-0 right-0 mt-1 card-elevated p-0 overflow-hidden">
              {suggestions.map((s) => (
                <li key={s}>
                  <button onClick={() => add(s)} className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-brand-soft)]">
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function TriStateToggle({
  value, onChange, disabled,
}: { value?: TriState; onChange: (v: TriState) => void; disabled: boolean }) {
  const OPTS: { v: TriState; label: string; tone: string }[] = [
    { v: "present", label: "Present", tone: "bg-[var(--color-critical)] text-[var(--color-on-critical)] border-[var(--color-critical)]" },
    { v: "absent", label: "Absent", tone: "bg-[var(--color-good)] text-[var(--color-on-good)] border-[var(--color-good)]" },
    { v: "not_examined", label: "Not examined", tone: "bg-[var(--color-ink-3)] text-white border-[var(--color-ink-3)]" },
  ];
  return (
    <div className="flex rounded-[6px] overflow-hidden border border-[var(--color-line)]">
      {OPTS.map((o) => (
        <button
          key={o.v}
          disabled={disabled}
          onClick={() => onChange(o.v)}
          aria-pressed={value === o.v}
          className={cn(
            "px-2.5 h-8 text-[0.6875rem] border-r last:border-r-0 border-[var(--color-line)]",
            value === o.v ? o.tone : "text-[var(--color-ink-3)]",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Segmented({
  options, value, onChange, disabled,
}: { options: string[]; value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o}
          disabled={disabled}
          onClick={() => onChange(o)}
          aria-pressed={value === o}
          className={cn("pill px-2.5 py-1.5", value === o && "bg-[var(--color-brand)] text-[var(--color-on-brand)] border-[var(--color-brand)]")}
        >
          {o.replace("_", " ")}
        </button>
      ))}
    </div>
  );
}

function SubstanceField({
  label, value, onChange, unit, disabled, computed,
}: {
  label: string;
  value?: { use: boolean; qty_per_day?: number; units_per_week?: number; years?: number };
  onChange: (v: { use: boolean; qty_per_day?: number; years?: number }) => void;
  unit: string;
  disabled: boolean;
  computed?: (qty?: number, years?: number) => string | null;
}) {
  const qty = value?.qty_per_day ?? value?.units_per_week;
  const on = !!value?.use;
  return (
    <div className={cn("rounded-[6px] border p-2.5", on ? "border-[var(--color-warning)]" : "border-[var(--color-line)]")}>
      <button
        disabled={disabled}
        onClick={() => onChange({ use: !on, qty_per_day: qty, years: value?.years })}
        aria-pressed={on}
        className="text-sm font-medium"
      >
        {label} {on ? "· yes" : "· no"}
      </button>
      {on && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          <label className="block">
            <span className="text-[0.6875rem] text-[var(--color-ink-3)]">{unit}</span>
            <input
              type="number" className="field h-8 py-0 text-xs"
              value={qty ?? ""} disabled={disabled}
              onChange={(e) => onChange({ use: true, qty_per_day: Number(e.target.value), years: value?.years })}
            />
          </label>
          <label className="block">
            <span className="text-[0.6875rem] text-[var(--color-ink-3)]">for how many years</span>
            <input
              type="number" className="field h-8 py-0 text-xs"
              value={value?.years ?? ""} disabled={disabled}
              onChange={(e) => onChange({ use: true, qty_per_day: qty, years: Number(e.target.value) })}
            />
          </label>
          {computed && computed(qty, value?.years) && (
            <p className="col-span-2 text-xs text-[var(--color-warning)] font-medium">
              {computed(qty, value?.years)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SystemicExam({
  value, onChange, disabled,
}: {
  value: CaseSheet["systemic_exam"];
  onChange: (v: CaseSheet["systemic_exam"]) => void;
  disabled: boolean;
}) {
  const [tab, setTab] = useState<(typeof SYSTEMS)[number]["key"]>("cvs");
  const sys = value[tab] ?? {};

  // "Within normal limits" fills the standard normal findings, so the doctor
  // only edits the exceptions.
  const wnl = () => {
    onChange({ ...value, [tab]: { ...WNL_TEXT[tab], wnl: true } });
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-3">
        {SYSTEMS.map((s) => (
          <button
            key={s.key}
            onClick={() => setTab(s.key)}
            aria-pressed={tab === s.key}
            className={cn(
              "pill px-3 py-1.5",
              tab === s.key && "bg-[var(--color-brand)] text-[var(--color-on-brand)] border-[var(--color-brand)]",
              value[s.key] && tab !== s.key && "border-[var(--color-good)]",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {!disabled && (
        <Button size="sm" variant="secondary" onClick={wnl} className="mb-3">
          Within normal limits
        </Button>
      )}

      <div className="space-y-2">
        {EXAM_METHODS.map((mth) => (
          <div key={mth}>
            <label className="label">{mth}</label>
            <textarea
              className="field min-h-[54px]"
              value={(sys as Record<string, string | undefined>)[mth] ?? ""}
              onChange={(e) => onChange({ ...value, [tab]: { ...sys, [mth]: e.target.value, wnl: false } })}
              disabled={disabled}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function Icd11Field({
  label, value, onChange, disabled,
}: { label: string; value: string; onChange: (v: string) => void; disabled: boolean }) {
  const [q, setQ] = useState(value);
  const [code, setCode] = useState<string | null>(null);
  const hits = searchIcd11(q);

  return (
    <div className="relative">
      <label className="label">
        {label}
        {code && <span className="normal-case ml-2 font-mono text-[var(--color-brand)]">ICD-11 {code}</span>}
      </label>
      <input
        className="field"
        value={q}
        onChange={(e) => { setQ(e.target.value); setCode(null); onChange(e.target.value); }}
        disabled={disabled}
        placeholder="Type to search ICD-11"
      />
      <p className="text-xs text-[var(--color-ink-3)] mt-1">
        Autocompletes against the WHO ICD-11 API, with a local index of the
        commonest codes as the offline fallback.
      </p>
      {!disabled && q !== value.slice(0, q.length) && null}
      {!disabled && hits.length > 0 && q !== code && (
        <ul className="absolute z-10 left-0 right-0 mt-1 card-elevated p-0 overflow-hidden max-h-56 overflow-y-auto">
          {hits.map((h) => (
            <li key={h.code}>
              <button
                onClick={() => { setQ(h.title); setCode(h.code); onChange(h.title); }}
                className="w-full flex items-baseline gap-2 text-left px-3 py-2 text-sm hover:bg-[var(--color-brand-soft)]"
              >
                <span className="font-mono text-xs text-[var(--color-ink-3)] w-16 shrink-0">{h.code}</span>
                {h.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChipList({
  value, onChange, placeholder, disabled,
}: { value: string[]; onChange: (v: string[]) => void; placeholder: string; disabled: boolean }) {
  const [draft, setDraft] = useState("");
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.map((x) => (
          <span key={x} className="pill">
            {x}
            {!disabled && (
              <button onClick={() => onChange(value.filter((y) => y !== x))} className="text-[var(--color-critical)] ml-1">×</button>
            )}
          </span>
        ))}
      </div>
      {!disabled && (
        <input
          className="field"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              e.preventDefault();
              onChange([...value, draft.trim()]);
              setDraft("");
            }
          }}
        />
      )}
    </div>
  );
}

function ChipMulti({
  options, value, onChange, disabled,
}: { options: string[]; value: string[]; onChange: (v: string[]) => void; disabled: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          disabled={disabled}
          onClick={() => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])}
          aria-pressed={value.includes(o)}
          className={cn("pill px-2.5 py-1.5", value.includes(o) && "bg-[var(--color-brand)] text-[var(--color-on-brand)] border-[var(--color-brand)]")}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/** Web Speech API, Hindi and English. A doctor dictating HOPI while
 *  examining a patient is a memorable demo moment and it is thirty lines. */
function VoiceButton({ onText }: { onText: (t: string) => void }) {
  const [listening, setListening] = useState(false);
  const start = () => {
    type SR = { lang: string; interimResults: boolean; onresult: (e: { results: { 0: { transcript: string } }[] }) => void; onend: () => void; start: () => void };
    const W = window as unknown as { webkitSpeechRecognition?: new () => SR; SpeechRecognition?: new () => SR };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.onresult = (e) => onText(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.start();
    setListening(true);
  };
  return (
    <button
      type="button"
      onClick={start}
      title="Dictate (English or Hindi)"
      className={cn(
        "w-9 h-9 shrink-0 rounded-[6px] border grid place-items-center",
        listening ? "border-[var(--color-critical)] text-[var(--color-critical)]" : "border-[var(--color-line)] text-[var(--color-ink-3)]",
      )}
    >
      <Mic size={15} />
    </button>
  );
}

function TemplateMenu({
  caseSheetId, onApply,
}: { caseSheetId: string; onApply: (b: Partial<CaseSheet>) => void }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<{ id: string; name: string }[]>([]);
  const [pending, start] = useTransition();

  return (
    <div className="relative">
      <Button
        size="sm"
        variant="secondary"
        onClick={() =>
          start(async () => {
            const { listTemplates, applyTemplate } = await import("@/app/actions/doctor");
            void applyTemplate;
            setList(await listTemplates());
            setOpen((v) => !v);
          })
        }
      >
        Templates
      </Button>
      {open && (
        <div className="absolute right-0 mt-1 w-64 card-elevated p-0 overflow-hidden z-20">
          {list.length === 0 ? (
            <p className="p-3 text-sm text-[var(--color-ink-3)]">
              No templates yet. Save this sheet as one once it is filled in.
            </p>
          ) : (
            list.map((t) => (
              <button
                key={t.id}
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const { applyTemplate } = await import("@/app/actions/doctor");
                    const r = await applyTemplate(caseSheetId, t.id);
                    if (r.ok && r.body) onApply(r.body);
                    setOpen(false);
                  })
                }
                className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-brand-soft)] border-b border-[var(--color-line)] last:border-0"
              >
                {t.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function SaveTemplateButton({ caseSheetId }: { caseSheetId: string }) {
  const [name, setName] = useState("");
  const [asking, setAsking] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  if (saved) return <span className="text-sm text-[var(--color-good)]">Template saved</span>;

  if (!asking) {
    return (
      <Button variant="secondary" onClick={() => setAsking(true)}>
        <Save size={15} /> Save as template
      </Button>
    );
  }
  return (
    <span className="flex items-center gap-2">
      <input
        className="field h-10 w-52"
        placeholder="e.g. Viral fever, adult"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <Button
        disabled={pending || !name}
        onClick={() => start(async () => { await saveTemplate(caseSheetId, name); setSaved(true); })}
      >
        Save
      </Button>
    </span>
  );
}
