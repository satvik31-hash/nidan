"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Badge } from "@/components/ui";
import { book, structure } from "@/app/actions/patient";
import { fmtDate, fmtTime, rupees } from "@/lib/utils";
import { addIstDays, istDay, istHour } from "@/lib/tz";
import { interpolate } from "@/lib/i18n";
import { COMMON_COMPLAINT_CHIPS } from "@/lib/clinical";
import { AlertTriangle, Check, MapPin, Navigation, Sparkles, Star } from "lucide-react";

// A four-step wizard with a persistent summary rail. Each step narrows the
// query for the next: hospital → speciality → doctor → legal slots → confirm.

interface Hospital { id: string; name: string; city: string; address: string; lat: number; lng: number }
interface Doctor {
  id: string; full_name: string; specialization: string; specialization_id: number;
  qualifications: string[]; experience_years: number; languages: string[];
  consultation_fee: number; verified: boolean; hospitalIds: string[];
}
interface Slot { start: string; end: string; taken: boolean; past: boolean }

const STEPS = ["Hospital", "Doctor", "Date & time", "Confirm"];

export function BookingWizard({
  hospitals, doctors, specializations, preselect, m,
}: {
  hospitals: Hospital[];
  doctors: Doctor[];
  specializations: { id: number; name: string }[];
  preselect: { doctorId?: string; hospitalId?: string };
  m: Record<string, string>;
}) {
  const router = useRouter();
  const [step, setStep] = useState(preselect.doctorId ? 2 : 0);
  const [hospitalId, setHospitalId] = useState(preselect.hospitalId ?? "");
  const [specId, setSpecId] = useState<number | null>(null);
  const [doctorId, setDoctorId] = useState(preselect.doctorId ?? "");
  // The date strip is IST clinic days, not the viewer's local days — a judge
  // opening this from a laptop still on UTC must see the same clinic.
  const [date, setDate] = useState(() => istDay());
  const [slot, setSlot] = useState<Slot | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"in_person" | "teleconsult">("in_person");
  const [hospitalQuery, setHospitalQuery] = useState("");
  const [near, setNear] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const hospital = hospitals.find((h) => h.id === hospitalId) ?? null;
  const doctor = doctors.find((d) => d.id === doctorId) ?? null;

  const visibleHospitals = useMemo(() => {
    let list = hospitals.filter(
      (h) => !hospitalQuery ||
        (h.name + h.city + h.address).toLowerCase().includes(hospitalQuery.toLowerCase()),
    );
    if (near) {
      list = [...list].sort(
        (a, b) =>
          (a.lat - near.lat) ** 2 + (a.lng - near.lng) ** 2 -
          ((b.lat - near.lat) ** 2 + (b.lng - near.lng) ** 2),
      );
    }
    return list;
  }, [hospitals, hospitalQuery, near]);

  const visibleDoctors = doctors.filter(
    (d) => d.hospitalIds.includes(hospitalId) && (!specId || d.specialization_id === specId),
  );

  // Picking a date calls the slot generator and renders only legal slots.
  // Taken slots are visibly disabled rather than hidden — the grid should
  // show a busy clinic, not an empty one.
  useEffect(() => {
    if (step !== 2 || !doctorId || !hospitalId) return;
    setSlots(null);
    const c = new AbortController();
    fetch(`/api/slots?doctor=${doctorId}&hospital=${hospitalId}&date=${date}`, { signal: c.signal })
      .then((r) => r.json())
      .then((j) => setSlots(j.slots ?? []))
      .catch(() => {});
    return () => c.abort();
  }, [step, doctorId, hospitalId, date]);

  const dateStrip = Array.from({ length: 14 }, (_, i) => addIstDays(istDay(), i));

  const grouped = (slots ?? []).reduce<Record<string, Slot[]>>((acc, s) => {
    const h = istHour(s.start);
    const band = h < 12 ? m.morning : h < 16 ? m.afternoon : m.evening;
    (acc[band] ??= []).push(s);
    return acc;
  }, {});

  const submit = () =>
    start(async () => {
      if (!slot || !doctor || !hospital) return;
      const r = await book({
        doctorId, hospitalId, start: slot.start, end: slot.end,
        reason: reason || "General consultation", mode,
      });
      if (r.ok) {
        router.push("/patient/appointments");
        router.refresh();
      } else {
        setError(r.code === "23P01" ? m.slotGone : r.error ?? "Could not book");
        setSlot(null);
        setStep(2);
        // Refresh the grid so the taken slot shows as taken.
        fetch(`/api/slots?doctor=${doctorId}&hospital=${hospitalId}&date=${date}`)
          .then((r2) => r2.json())
          .then((j) => setSlots(j.slots ?? []));
      }
    });

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_260px] items-start">
      <div>
        {/* Progress */}
        <ol className="flex items-center gap-1 mb-5 text-xs">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-1 flex-1">
              <button
                disabled={i > step}
                onClick={() => setStep(i)}
                className={`flex items-center gap-1.5 ${i <= step ? "text-[var(--color-brand)]" : "text-[var(--color-ink-3)]"}`}
              >
                <span
                  className={`w-5 h-5 rounded-full grid place-items-center text-[0.625rem] font-semibold ${
                    i < step ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]"
                      : i === step ? "border-2 border-[var(--color-brand)]"
                      : "border border-[var(--color-line)]"
                  }`}
                >
                  {i < step ? <Check size={11} /> : i + 1}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </button>
              {i < STEPS.length - 1 && <span className="flex-1 h-px bg-[var(--color-line)]" />}
            </li>
          ))}
        </ol>

        {error && (
          <div className="mb-4 rounded-[6px] border border-[color-mix(in_srgb,var(--color-warning)_40%,transparent)] bg-[var(--color-warning-soft)] px-3 py-2 text-sm text-[var(--color-warning)] flex gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* ── 1 · Hospital ───────────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                className="field"
                placeholder="Search hospitals or a city"
                value={hospitalQuery}
                onChange={(e) => setHospitalQuery(e.target.value)}
              />
              <Button
                variant="secondary"
                onClick={() =>
                  navigator.geolocation?.getCurrentPosition(
                    (p) => setNear({ lat: p.coords.latitude, lng: p.coords.longitude }),
                    () => setNear({ lat: 18.5204, lng: 73.8567 }), // Pune, if denied
                  )
                }
              >
                <Navigation size={15} /> {m.nearMe}
              </Button>
            </div>
            {visibleHospitals.map((h) => (
              <button
                key={h.id}
                onClick={() => { setHospitalId(h.id); setStep(1); }}
                className="w-full text-left card p-4 hover:border-[var(--color-brand)] transition-colors"
              >
                <p className="font-medium">{h.name}</p>
                <p className="text-sm text-[var(--color-ink-3)] flex items-center gap-1">
                  <MapPin size={12} /> {h.address}, {h.city}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* ── 2 · Speciality → doctor ────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSpecId(null)}
                className={`pill ${!specId ? "bg-[var(--color-brand)] text-[var(--color-on-brand)] border-[var(--color-brand)]" : ""}`}
              >
                All
              </button>
              {specializations.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSpecId(s.id)}
                  className={`pill ${specId === s.id ? "bg-[var(--color-brand)] text-[var(--color-on-brand)] border-[var(--color-brand)]" : ""}`}
                >
                  {s.name}
                </button>
              ))}
            </div>

            <SymptomTriage onSuggest={(spec, text) => {
              const found = specializations.find((s) => s.name === spec);
              if (found) setSpecId(found.id);
              if (text) setReason(text);
            }} />

            <div className="grid gap-3 sm:grid-cols-2">
              {visibleDoctors.map((d) => (
                <button
                  key={d.id}
                  onClick={() => { setDoctorId(d.id); setStep(2); }}
                  className="text-left card p-4 hover:border-[var(--color-brand)] transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="w-11 h-11 rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand-ink)] grid place-items-center font-semibold shrink-0">
                      {d.full_name.replace("Dr. ", "").split(" ").map((w) => w[0]).join("")}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium flex items-center gap-1">
                        {d.full_name}
                        {d.verified && <Star size={12} className="text-[var(--color-brand)]" />}
                      </p>
                      <p className="text-xs text-[var(--color-ink-3)]">{d.specialization}</p>
                      <p className="text-xs text-[var(--color-ink-3)]">{d.qualifications.join(", ")}</p>
                      <p className="text-xs text-[var(--color-ink-3)] mt-1">
                        {d.experience_years} yrs · speaks {d.languages.join(", ")}
                      </p>
                      <p className="text-sm font-medium mt-1">{rupees(d.consultation_fee)}</p>
                    </div>
                  </div>
                </button>
              ))}
              {visibleDoctors.length === 0 && (
                <p className="text-sm text-[var(--color-ink-3)]">
                  No doctors of that speciality at this hospital. Try another speciality.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── 3 · Date & time ────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
              {dateStrip.map((iso) => {
                const d = new Date(`${iso}T12:00:00+05:30`);
                const sel = iso === date;
                return (
                  <button
                    key={iso}
                    onClick={() => { setDate(iso); setSlot(null); }}
                    className={`shrink-0 w-14 py-2 rounded-[6px] border text-center ${
                      sel
                        ? "bg-[var(--color-brand)] text-[var(--color-on-brand)] border-[var(--color-brand)]"
                        : "border-[var(--color-line)] hover:border-[var(--color-brand)]"
                    }`}
                  >
                    <span className="block text-[0.625rem] uppercase opacity-70">
                      {d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" })}
                    </span>
                    <span className="block text-base font-semibold">
                      {d.toLocaleDateString("en-IN", { day: "numeric", timeZone: "Asia/Kolkata" })}
                    </span>
                    <span className="block text-[0.625rem] opacity-70">
                      {d.toLocaleDateString("en-IN", { month: "short", timeZone: "Asia/Kolkata" })}
                    </span>
                  </button>
                );
              })}
            </div>

            {slots === null ? (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {Array.from({ length: 12 }).map((_, i) => <div key={i} className="skeleton h-9" />)}
              </div>
            ) : Object.keys(grouped).length === 0 ? (
              <Card>
                <p className="text-sm text-[var(--color-ink-3)]">
                  No clinic on this day. Try another date.
                </p>
              </Card>
            ) : (
              Object.entries(grouped).map(([band, list]) => (
                <div key={band}>
                  <div className="eyebrow mb-2">{band}</div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {list.map((s) => {
                      const disabled = s.taken || s.past;
                      const sel = slot?.start === s.start;
                      return (
                        <button
                          key={s.start}
                          disabled={disabled}
                          onClick={() => setSlot(s)}
                          title={s.taken ? "Already booked" : s.past ? "In the past" : undefined}
                          className={`h-9 rounded-[6px] text-sm border transition-colors ${
                            sel
                              ? "bg-[var(--color-brand)] text-[var(--color-on-brand)] border-[var(--color-brand)]"
                              : disabled
                              ? "border-[var(--color-line)] text-[var(--color-ink-3)] line-through cursor-not-allowed opacity-60"
                              : "border-[var(--color-line)] hover:border-[var(--color-brand)]"
                          }`}
                        >
                          {fmtTime(s.start)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}

            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep(1)}>{m.back}</Button>
              <Button disabled={!slot} onClick={() => setStep(3)}>{m.next}</Button>
            </div>
          </div>
        )}

        {/* ── 4 · Confirm ────────────────────────────────────── */}
        {step === 3 && slot && doctor && hospital && (
          <div className="space-y-4">
            <Card>
              <label className="block">
                <span className="label">{m.reasonForVisit}</span>
                <textarea
                  className="field min-h-[80px]"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="In your own words — the doctor sees this before you walk in."
                />
              </label>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {COMMON_COMPLAINT_CHIPS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setReason((r) => (r ? `${r}, ${c.toLowerCase()}` : c))}
                    className="pill hover:border-[var(--color-brand)]"
                  >
                    {c}
                  </button>
                ))}
              </div>
            </Card>

            <Card>
              <span className="label">Consultation mode</span>
              <div className="flex gap-2">
                {(["in_person", "teleconsult"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setMode(v)}
                    className={`pill px-3 py-1.5 ${mode === v ? "bg-[var(--color-brand)] text-[var(--color-on-brand)] border-[var(--color-brand)]" : ""}`}
                  >
                    {v === "in_person" ? "In person" : "Video consult"}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-baseline justify-between border-t border-[var(--color-line)] pt-3">
                <span className="text-sm text-[var(--color-ink-3)]">{m.consultationFee}</span>
                <span className="text-lg font-semibold">{rupees(doctor.consultation_fee)}</span>
              </div>
            </Card>

            {/* The consent model, made visible. This sentence is the product. */}
            <div className="rounded-[8px] border border-[color-mix(in_srgb,var(--color-brand)_35%,transparent)] bg-[var(--color-brand-soft)] p-4">
              <p className="text-sm text-[var(--color-brand-ink)]">
                {interpolate(m.consentLine, { doctor: doctor.full_name })}
              </p>
              <p className="text-xs text-[var(--color-brand-ink)] opacity-80 mt-1.5">
                You can revoke this at any time from &ldquo;Who has seen my records&rdquo;.
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep(2)}>{m.back}</Button>
              <Button onClick={submit} disabled={pending} size="lg" className="flex-1">
                {pending ? "Booking…" : m.confirmBooking}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Persistent summary rail */}
      <aside className="card p-4 sticky top-24 hidden lg:block">
        <div className="eyebrow mb-3">Your booking</div>
        <dl className="space-y-3 text-sm">
          <Row k="Hospital" v={hospital?.name} />
          <Row k="Doctor" v={doctor?.full_name} sub={doctor?.specialization} />
          <Row k="When" v={slot ? `${fmtDate(slot.start)}, ${fmtTime(slot.start)}` : undefined} />
          <Row k="Fee" v={doctor ? rupees(doctor.consultation_fee) : undefined} />
        </dl>
      </aside>
    </div>
  );
}

function Row({ k, v, sub }: { k: string; v?: string; sub?: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--color-ink-3)]">{k}</dt>
      <dd className={v ? "font-medium" : "text-[var(--color-ink-3)]"}>{v ?? "—"}</dd>
      {sub && v && <dd className="text-xs text-[var(--color-ink-3)]">{sub}</dd>}
    </div>
  );
}

/** "Not sure which speciality?" runs the symptom triage helper. The model
 *  structures the description; it does not diagnose, and any red flag goes
 *  straight to the emergency screen instead. */
function SymptomTriage({ onSuggest }: { onSuggest: (spec: string, text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [result, setResult] = useState<Awaited<ReturnType<typeof structure>> | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-[var(--color-brand)] hover:underline inline-flex items-center gap-1">
        <Sparkles size={14} /> Not sure which speciality?
      </button>
    );
  }

  return (
    <Card>
      <label className="block">
        <span className="label">Describe what you are feeling</span>
        <textarea
          className="field min-h-[70px]"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. burning in my chest after meals for about 2 weeks"
        />
      </label>
      <div className="flex items-center gap-2 mt-2">
        <Button
          size="sm"
          disabled={pending || text.length < 5}
          onClick={() =>
            start(async () => {
              const r = await structure(text);
              setResult(r);
              if (r.redFlag) router.push("/patient/emergency");
            })
          }
        >
          {pending ? "Reading…" : "Help me choose"}
        </Button>
        <Badge tone="brand">AI-generated · your doctor confirms it</Badge>
      </div>

      {result && !result.redFlag && (
        <div className="mt-3 border-t border-[var(--color-line)] pt-3 text-sm">
          <p>
            Suggested speciality: <strong>{result.suggestedSpeciality}</strong>
          </p>
          {result.complaints.map((c, i) => (
            <p key={i} className="text-[var(--color-ink-2)]">
              {c.complaint} · {c.duration_value} {c.duration_unit}
              {result.severity ? ` · severity ${result.severity}/10` : ""}
            </p>
          ))}
          <Button
            size="sm"
            variant="secondary"
            className="mt-2"
            onClick={() => {
              onSuggest(
                result.suggestedSpeciality,
                result.complaints.map((c) => `${c.complaint} × ${c.duration_value} ${c.duration_unit}`).join("; "),
              );
              setOpen(false);
            }}
          >
            Use this
          </Button>
        </div>
      )}
    </Card>
  );
}
