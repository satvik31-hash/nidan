"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Pencil, Plus, TriangleAlert, X } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { saveAvailability } from "@/app/actions/doctor";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SLOT_LENGTHS = [5, 10, 15, 20, 30, 45, 60];

interface Rule {
  id: string; hospital_id: string; weekday: number;
  start_time: string; end_time: string; slot_minutes: number;
}

interface Block {
  start_time: string;
  end_time: string;
  slot_minutes: number;
}

const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

function countSlots(blocks: Block[]) {
  return blocks.reduce((n, b) => {
    const span = toMinutes(b.end_time) - toMinutes(b.start_time);
    return n + (span > 0 && b.slot_minutes > 0 ? Math.floor(span / b.slot_minutes) : 0);
  }, 0);
}

/**
 * The weekly grid, editable one day at a time.
 *
 * One day open at once, deliberately: a doctor changing Tuesday should not be
 * able to leave four other days half-edited and unsaved. Save is per-day and
 * the server is the only thing that decides whether a change is legal — the
 * client shows what came back rather than what it hoped for.
 */
export function AvailabilityEditor({
  rules, hospitals,
}: { rules: Rule[]; hospitals: { id: string; name: string }[] }) {
  const [hospitalId, setHospitalId] = useState(hospitals[0]?.id ?? "");
  const [all, setAll] = useState<Rule[]>(rules);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<Block[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savedDay, setSavedDay] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const forHospital = useMemo(
    () => all.filter((r) => r.hospital_id === hospitalId),
    [all, hospitalId],
  );

  const weekSlots = countSlots(forHospital);

  function beginEdit(weekday: number) {
    setError(null);
    setSavedDay(null);
    setEditing(weekday);
    setDraft(
      forHospital
        .filter((r) => r.weekday === weekday)
        .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time))
        .map((r) => ({
          start_time: r.start_time, end_time: r.end_time, slot_minutes: r.slot_minutes,
        })),
    );
  }

  function commit(weekday: number) {
    setError(null);
    startTransition(async () => {
      const res = await saveAvailability(hospitalId, weekday, draft);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setAll(res.rules);
      setEditing(null);
      setSavedDay(weekday);
    });
  }

  return (
    <div>
      {hospitals.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {hospitals.map((h) => (
            <button
              key={h.id}
              onClick={() => { setHospitalId(h.id); setEditing(null); setError(null); }}
              aria-pressed={hospitalId === h.id}
              className={`pill px-3 py-1.5 ${
                hospitalId === h.id
                  ? "bg-[var(--color-brand)] text-[var(--color-on-brand)] border-[var(--color-brand)]"
                  : "hover:border-[var(--color-brand)]"
              }`}
            >
              {h.name}
            </button>
          ))}
        </div>
      )}

      <div className="border border-[var(--color-line)] rounded-[var(--radius-card)] overflow-hidden">
        {DAYS.map((day, i) => {
          const dayRules = forHospital
            .filter((r) => r.weekday === i)
            .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));
          const isEditing = editing === i;

          return (
            <div
              key={day}
              className={`border-b border-[var(--color-line)] last:border-0 ${
                isEditing ? "bg-[var(--color-brand-soft)]" : ""
              }`}
            >
              <div className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-24 shrink-0">
                  <span className="font-medium text-sm">{SHORT[i]}</span>
                  <span className="hidden sm:inline text-sm">{day.slice(3)}</span>
                </div>

                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <span className="text-xs text-[var(--color-ink-2)]">
                      {draft.length === 0 ? "No clinic on this day" : `${countSlots(draft)} slots`}
                    </span>
                  ) : dayRules.length === 0 ? (
                    <span className="text-sm text-[var(--color-ink-3)]">No clinic</span>
                  ) : (
                    <span className="flex flex-wrap gap-1.5">
                      {dayRules.map((r) => (
                        <Badge key={r.id} tone="brand">
                          {r.start_time}–{r.end_time} · {r.slot_minutes} min
                        </Badge>
                      ))}
                    </span>
                  )}
                </div>

                {savedDay === i && !isEditing && (
                  <span className="flex items-center gap-1 text-xs text-[var(--color-good)]">
                    <Check size={13} /> saved
                  </span>
                )}

                {isEditing ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => { setEditing(null); setError(null); }}
                      className="pill px-2.5 py-1 text-xs hover:border-[var(--color-ink-3)]"
                    >
                      Cancel
                    </button>
                    <Button size="sm" onClick={() => commit(i)} disabled={pending}>
                      {pending ? "Saving…" : "Save day"}
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => beginEdit(i)}
                    className="pill px-2.5 py-1 text-xs inline-flex items-center gap-1 hover:border-[var(--color-brand)]"
                    aria-label={`Edit ${day} clinic hours`}
                  >
                    <Pencil size={12} /> Edit
                  </button>
                )}
              </div>

              {isEditing && (
                <div className="px-3 pb-3 space-y-2">
                  {draft.map((b, bi) => (
                    <div key={bi} className="flex flex-wrap items-center gap-2">
                      <label className="sr-only" htmlFor={`start-${i}-${bi}`}>Start time</label>
                      <input
                        id={`start-${i}-${bi}`}
                        type="time"
                        value={b.start_time}
                        step={300}
                        onChange={(e) =>
                          setDraft(draft.map((x, xi) => xi === bi ? { ...x, start_time: e.target.value } : x))
                        }
                        className="field w-[9rem]"
                      />
                      <span className="text-[var(--color-ink-3)]">to</span>
                      <label className="sr-only" htmlFor={`end-${i}-${bi}`}>End time</label>
                      <input
                        id={`end-${i}-${bi}`}
                        type="time"
                        value={b.end_time}
                        step={300}
                        onChange={(e) =>
                          setDraft(draft.map((x, xi) => xi === bi ? { ...x, end_time: e.target.value } : x))
                        }
                        className="field w-[9rem]"
                      />
                      <label className="sr-only" htmlFor={`len-${i}-${bi}`}>Slot length</label>
                      <select
                        id={`len-${i}-${bi}`}
                        value={b.slot_minutes}
                        onChange={(e) =>
                          setDraft(draft.map((x, xi) => xi === bi ? { ...x, slot_minutes: Number(e.target.value) } : x))
                        }
                        className="field w-[6.5rem]"
                      >
                        {SLOT_LENGTHS.map((m) => (
                          <option key={m} value={m}>{m} min</option>
                        ))}
                      </select>
                      <button
                        onClick={() => setDraft(draft.filter((_, xi) => xi !== bi))}
                        className="pill px-2 py-1 text-xs inline-flex items-center gap-1 hover:border-[var(--color-critical)] hover:text-[var(--color-critical)]"
                        aria-label="Remove this clinic block"
                      >
                        <X size={12} /> Remove
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={() =>
                      setDraft([...draft, { start_time: "09:00", end_time: "13:00", slot_minutes: 15 }])
                    }
                    className="pill px-2.5 py-1 text-xs inline-flex items-center gap-1 hover:border-[var(--color-brand)]"
                  >
                    <Plus size={12} /> Add a clinic block
                  </button>

                  {error && (
                    <p
                      role="alert"
                      className="flex items-start gap-1.5 text-xs text-[var(--color-critical)]"
                    >
                      <TriangleAlert size={13} className="mt-px shrink-0" />
                      {error}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-[var(--color-ink-3)] mt-3">
        {weekSlots} bookable slots a week at this hospital, minus anything already
        booked and anything blocked by a leave or theatre exception. A block has to
        divide evenly into its slot length, blocks on one day cannot overlap, and
        hours with a patient already booked into them cannot be removed.
      </p>
    </div>
  );
}
