"use client";

import { LOCALE_TAGS, type Locale } from "@/lib/i18n";
import { useState, useTransition } from "react";
import { Badge, Button, Card, Stat } from "@/components/ui";
import { MetricChart, Sparkline } from "@/components/charts";
import { saveCheckin } from "@/app/actions/patient";
import { Activity, Check, Footprints, HeartPulse, Moon, Droplets, Mic } from "lucide-react";

type Series = { date: string; v: number }[];

const MOODS = ["😞", "🙁", "😐", "🙂", "😄"];
const SYMPTOM_CHIPS = ["Headache", "Fatigue", "Giddiness", "Nausea", "Cough", "Breathlessness", "Joint pain", "Fever"];

const METRICS = [
  { key: "steps", label: "Steps", unit: "steps", icon: Footprints, hue: "var(--chart-1)" },
  { key: "heart_rate", label: "Resting heart rate", unit: "bpm", icon: HeartPulse, hue: "var(--chart-2)" },
  { key: "sleep_minutes", label: "Sleep", unit: "min", icon: Moon, hue: "var(--chart-3)" },
  { key: "spo2", label: "SpO₂", unit: "%", icon: Activity, hue: "var(--chart-6)" },
] as const;

export function WellnessView({
  today, streak, heatmap, series, connected, m,
}: {
  today: { mood: number | null; energy: number | null; sleep_hours: number | null; pain_score: number | null; symptoms: string[]; meds_taken: boolean | null; water_glasses: number | null; notes: string | null } | null;
  streak: number;
  heatmap: { date: string; mood: number | null; pain: number | null }[];
  series: Record<string, Series>;
  connected: boolean;
  m: Record<string, string>;
}) {
  const [mood, setMood] = useState(today?.mood ?? 3);
  const [energy, setEnergy] = useState(today?.energy ?? 3);
  const [sleep, setSleep] = useState(today?.sleep_hours ?? 7);
  const [pain, setPain] = useState(today?.pain_score ?? 0);
  const [symptoms, setSymptoms] = useState<string[]>(today?.symptoms ?? []);
  const [meds, setMeds] = useState<boolean | null>(today?.meds_taken ?? null);
  const [water, setWater] = useState(today?.water_glasses ?? 6);
  const [notes, setNotes] = useState(today?.notes ?? "");
  const [done, setDone] = useState(false);
  const [selected, setSelected] = useState<string>("steps");
  const [pending, start] = useTransition();

  const dictate = () => {
    type SR = { lang: string; onresult: (e: { results: { 0: { transcript: string } }[] }) => void; start: () => void };
    const W = window as unknown as { webkitSpeechRecognition?: new () => SR; SpeechRecognition?: new () => SR };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = LOCALE_TAGS[document.documentElement.lang as Locale] ?? "en-IN";
    rec.onresult = (e) => setNotes((n) => `${n} ${e.results[0][0].transcript}`.trim());
    rec.start();
  };

  const submit = () =>
    start(async () => {
      await saveCheckin({
        mood, energy, sleep_hours: sleep, pain_score: pain,
        symptoms, meds_taken: meds ?? undefined, water_glasses: water, notes,
      });
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    });

  const chart = series[selected] ?? [];
  const meta = METRICS.find((x) => x.key === selected)!;

  return (
    <div className="space-y-5">
      {/* ── b · Daily check-in. A sub-60-second form. ────────── */}
      <Card>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-semibold">{m.dailyCheckin}</h2>
          {streak > 0 && (
            <Badge tone="good">🔥 {streak} {m.streak}</Badge>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <span className="label">{m.mood}</span>
            <div className="flex gap-1.5">
              {MOODS.map((face, i) => (
                <button
                  key={i}
                  onClick={() => setMood(i + 1)}
                  aria-label={`${m.mood} ${i + 1} of 5`}
                  aria-pressed={mood === i + 1}
                  className={`w-11 h-11 rounded-full text-[1.25rem] grid place-items-center border transition-colors ${
                    mood === i + 1
                      ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)]"
                      : "border-[var(--color-line)]"
                  }`}
                >
                  {face}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="label">{m.energy}</span>
            <div className="flex gap-1.5 items-center h-11">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setEnergy(n)}
                  aria-label={`${m.energy} ${n} of 5`}
                  aria-pressed={energy === n}
                  className={`w-6 h-6 rounded-full border transition-colors ${
                    n <= energy
                      ? "bg-[var(--color-brand)] border-[var(--color-brand)]"
                      : "border-[var(--color-line)]"
                  }`}
                />
              ))}
            </div>
          </div>

          <div>
            <span className="label">{m.sleep} — {sleep} h</span>
            <div className="flex items-center gap-2 h-11">
              <Button variant="secondary" size="sm" onClick={() => setSleep((s) => Math.max(0, s - 0.5))}>−</Button>
              <span className="text-[1.25rem] font-semibold w-14 text-center">{sleep}</span>
              <Button variant="secondary" size="sm" onClick={() => setSleep((s) => Math.min(16, s + 0.5))}>+</Button>
            </div>
          </div>

          <div>
            <span className="label">{m.pain} — {pain}/10</span>
            <input
              type="range" min={0} max={10} value={pain}
              onChange={(e) => setPain(Number(e.target.value))}
              className="w-full h-11 accent-[var(--color-brand)]"
              aria-label={`${m.pain} ${pain} out of 10`}
            />
          </div>

          <div className="sm:col-span-2">
            <span className="label">{m.symptoms}</span>
            <div className="flex flex-wrap gap-1.5">
              {SYMPTOM_CHIPS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSymptoms((cur) => cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s])}
                  aria-pressed={symptoms.includes(s)}
                  className={`pill px-3 py-1.5 ${symptoms.includes(s) ? "bg-[var(--color-brand)] text-[var(--color-on-brand)] border-[var(--color-brand)]" : ""}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="label">{m.tookMedicines}</span>
            <div className="flex gap-2">
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  onClick={() => setMeds(v)}
                  aria-pressed={meds === v}
                  className={`pill px-4 py-2 ${meds === v ? "bg-[var(--color-brand)] text-[var(--color-on-brand)] border-[var(--color-brand)]" : ""}`}
                >
                  {v ? m.yes : m.no}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="label">{m.water} — {water}</span>
            <div className="flex gap-1 items-center h-11">
              {Array.from({ length: 10 }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setWater(i + 1)}
                  aria-label={`${i + 1} ${m.water}`}
                  className={i < water ? "text-[var(--color-brand)]" : "text-[var(--color-line)]"}
                >
                  <Droplets size={16} fill="currentColor" />
                </button>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <span className="label flex items-center gap-2">
              Note
              <button onClick={dictate} className="pill text-[0.6875rem]" type="button">
                <Mic size={11} /> dictate
              </button>
            </span>
            <textarea
              className="field min-h-[60px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything you want your doctor to know"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving…" : m.saveCheckin}
          </Button>
          <span aria-live="polite" className="text-sm text-[var(--color-good)]">
            {done && (<><Check size={14} className="inline" /> {m.saved}</>)}
          </span>
        </div>

        {/* The link that makes this clinical rather than cosmetic. */}
        <p className="text-xs text-[var(--color-ink-3)] mt-3 pt-3 border-t border-[var(--color-line)]">
          Your last 14 days of check-ins appear inside your doctor&apos;s case sheet, next
          to the vitals — so history-taking starts from real observations rather
          than what you can remember in the room.
        </p>
      </Card>

      {/* 30-day mood and pain heat-map: retention texture, and a genuinely
          useful pattern for a doctor to glance at. */}
      <Card>
        <h3 className="font-semibold mb-3">Last 30 days</h3>
        <div className="space-y-2">
          {(["mood", "pain"] as const).map((k) => (
            <div key={k} className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-ink-3)] w-10 capitalize">{k}</span>
              <div className="flex gap-[3px] flex-wrap">
                {heatmap.slice().reverse().map((d) => {
                  const v = k === "mood" ? d.mood : d.pain;
                  const norm = v == null ? null : k === "mood" ? v / 5 : 1 - v / 10;
                  return (
                    <span
                      key={d.date}
                      title={`${d.date}: ${k} ${v ?? "not logged"}`}
                      className="w-4 h-4 rounded-[3px] border border-[var(--color-line)]"
                      style={{
                        background: norm == null
                          ? "transparent"
                          : `color-mix(in srgb, var(--color-brand) ${Math.round(norm * 90) + 10}%, var(--color-surface))`,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-[var(--color-ink-3)] mt-2">
          Darker is better for both rows: a better mood, and less pain. Empty
          squares are days you did not log.
        </p>
      </Card>

      {/* ── a · Device sync ──────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-semibold">{m.deviceSync}</h2>
          <div className="flex gap-1.5">
            {["Google Fit", "Apple Health", "Fitbit"].map((p) => (
              <button key={p} className="pill hover:border-[var(--color-brand)]">
                {p === "Google Fit" && connected ? `✓ ${p}` : `Connect ${p}`}
              </button>
            ))}
          </div>
        </div>

        {/* Small multiples: a sparkline row above one large selected chart. */}
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 mb-4">
          {METRICS.map(({ key, label, unit, icon: Icon, hue }) => {
            const s = series[key] ?? [];
            const last = s[s.length - 1]?.v;
            return (
              <button
                key={key}
                onClick={() => setSelected(key)}
                aria-pressed={selected === key}
                className={`card p-3 text-left transition-colors ${
                  selected === key ? "border-[var(--color-brand)]" : ""
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs text-[var(--color-ink-3)]">
                  <Icon size={13} style={{ color: hue }} /> {label}
                </span>
                <span className="block text-[1.25rem] font-semibold leading-tight">
                  {last != null ? Math.round(last).toLocaleString("en-IN") : "—"}
                  <span className="text-xs font-normal text-[var(--color-ink-3)]"> {unit}</span>
                </span>
                <Sparkline data={s.slice(-7).map((p) => ({ v: p.v }))} hue={hue} />
              </button>
            );
          })}
        </div>

        {chart.length > 1 ? (
          <MetricChart data={chart} unit={meta.unit} label={meta.label} hue={meta.hue} />
        ) : (
          <p className="text-sm text-[var(--color-ink-3)] py-6 text-center">
            Connect a device, or keep logging manually — the manual path always works.
          </p>
        )}
      </Card>
    </div>
  );
}
