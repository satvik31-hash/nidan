import { requireDoctor } from "@/lib/auth";
import { availabilityFor, db, doctorCard } from "@/lib/db/store";
import { Badge, Card, KeyValue, SectionTitle, Stat } from "@/components/ui";
import { AvailabilityEditor } from "@/components/doctor/availability-editor";
import { rupees } from "@/lib/utils";
import { BadgeCheck, Clock } from "lucide-react";

export default async function DoctorProfile() {
  const session = await requireDoctor();
  const d = doctorCard(session.userId)!;

  // A small analytics strip, derived rather than decorative.
  const mine = db.caseSheets.filter((c) => c.doctor_id === session.userId);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const thisMonth = mine.filter((c) => new Date(c.created_at) >= monthStart);

  const dxCounts = new Map<string, number>();
  mine.forEach((c) => {
    if (c.provisional_dx) dxCounts.set(c.provisional_dx, (dxCounts.get(c.provisional_dx) ?? 0) + 1);
  });
  const topDx = [...dxCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const durations = mine
    .filter((c) => c.finalized_at)
    .map((c) => (new Date(c.finalized_at!).getTime() - new Date(c.created_at).getTime()) / 60000)
    .filter((x) => x > 0 && x < 120);
  const avg = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;

  const rules = availabilityFor(session.userId)
    .map((a) => ({
      id: a.id, hospital_id: a.hospital_id, weekday: a.weekday,
      start_time: a.start_time, end_time: a.end_time, slot_minutes: a.slot_minutes,
    }));

  return (
    <div className="max-w-4xl space-y-4">
      <SectionTitle
        eyebrow="Doctor profile"
        title={d.full_name}
        action={
          d.verified_at ? (
            <Badge tone="good" icon={<BadgeCheck size={12} />}>registration verified</Badge>
          ) : (
            <Badge tone="warning">pending verification</Badge>
          )
        }
      />

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Stat label="Patients this month" value={thisMonth.length} />
        <Stat label="Total consultations" value={mine.length} />
        <Stat label="Avg consult" value={avg ? `${avg} min` : "—"} />
        <Stat label="Consultation fee" value={rupees(d.consultation_fee)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="font-semibold mb-2">Registration and qualifications</h3>
          <KeyValue k="Medical council number" v={<span className="font-mono">{d.registration_no}</span>} />
          <KeyValue k="ABDM HPR ID" v={<span className="font-mono">{d.hpr_id ?? "—"}</span>} />
          <KeyValue k="Qualifications" v={d.qualifications.join(", ")} />
          <KeyValue k="Speciality" v={`${d.specialization}${d.sub_specialty ? ` · ${d.sub_specialty}` : ""}`} />
          <KeyValue k="Experience" v={`${d.experience_years} years`} />
          <KeyValue k="Languages" v={d.languages.join(", ")} />
        </Card>

        <Card>
          <h3 className="font-semibold mb-2">Hospital affiliations</h3>
          <ul className="space-y-2 text-sm">
            {d.hospitals.map((h) => (
              <li key={h.id} className="border-b border-[var(--color-line)] pb-2 last:border-0">
                <p className="font-medium">{h.name}</p>
                <p className="text-xs text-[var(--color-ink-3)]">
                  {h.department} · {h.city}
                </p>
              </li>
            ))}
          </ul>
          {d.bio && (
            <>
              <h4 className="eyebrow mt-4 mb-1">Bio</h4>
              <p className="text-sm text-[var(--color-ink-2)]">{d.bio}</p>
            </>
          )}
        </Card>
      </div>

      {d.awards.length > 0 && (
        <Card>
          <h3 className="font-semibold mb-2">Awards</h3>
          <ol className="relative border-l border-[var(--color-line)] ml-2">
            {d.awards.map((a, i) => (
              <li key={i} className="pl-4 pb-3 last:pb-0">
                <span className="absolute -left-1 w-2 h-2 rounded-full bg-[var(--color-brand)]" />
                <p className="text-sm font-medium">{a.title}</p>
                <p className="text-xs text-[var(--color-ink-3)]">{a.body} · {a.year}</p>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Card>
        <div className="flex items-center gap-2 mb-1">
          <Clock size={16} className="text-[var(--color-ink-3)]" />
          <h3 className="font-semibold">Availability</h3>
        </div>
        <p className="text-xs text-[var(--color-ink-3)] mb-3">
          These rules are the only source of bookable slots. A patient can never
          pick a time outside them, because the slot generator reads from here and
          the database refuses anything else. Edit a day and the booking grid
          changes on the next query — there is no second table to keep in step.
        </p>
        <AvailabilityEditor
          rules={rules}
          hospitals={d.hospitals.map((h) => ({ id: h.id, name: h.name }))}
        />
      </Card>

      {topDx.length > 0 && (
        <Card>
          <h3 className="font-semibold mb-2">Most common diagnoses</h3>
          <ul className="space-y-1.5">
            {topDx.map(([dx, n]) => (
              <li key={dx} className="flex items-center gap-3 text-sm">
                <span className="flex-1">{dx}</span>
                <div className="w-32 h-2 rounded-full bg-[var(--color-line)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-brand)]"
                    style={{ width: `${(n / topDx[0][1]) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-right text-[var(--color-ink-3)] tabular-nums">{n}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
