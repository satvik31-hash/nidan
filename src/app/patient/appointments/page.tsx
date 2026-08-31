import Link from "next/link";
import { getLocale, requirePatient } from "@/lib/auth";
import { appointmentsForPatient, doctorCard, getHospital, queuePosition } from "@/lib/db/store";
import { t } from "@/lib/i18n";
import { Badge, Card, Empty, LinkButton, SectionTitle } from "@/components/ui";
import { AppointmentActions } from "@/components/patient/appointment-actions";
import { fmtDate, fmtTime, relative } from "@/lib/utils";
import { CalendarDays, MapPin, Video } from "lucide-react";

const STATUS_TONE = {
  completed: "good", cancelled: "warning", no_show: "critical",
  confirmed: "brand", requested: "neutral", checked_in: "brand", in_consult: "brand",
} as const;

export default async function Appointments() {
  const session = await requirePatient();
  const locale = await getLocale();
  const m = t(locale);
  const all = appointmentsForPatient(session.userId);
  const now = Date.now();
  const upcoming = all
    .filter((a) => new Date(a.slot_start).getTime() > now && !["cancelled", "completed", "no_show"].includes(a.status))
    .sort((a, b) => a.slot_start.localeCompare(b.slot_start));
  const history = all.filter((a) => !upcoming.includes(a));

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Appointments"
        title={m.appointments}
        action={<LinkButton href="/patient/book" size="sm">{m.book}</LinkButton>}
      />

      <section>
        <h3 className="font-semibold mb-3">{m.upcoming}</h3>
        {upcoming.length === 0 ? (
          <Empty title={m.noAppointments} action={<LinkButton href="/patient/book">{m.bookOne}</LinkButton>} />
        ) : (
          <div className="space-y-3">
            {upcoming.map((a) => {
              const doc = doctorCard(a.doctor_id)!;
              const hosp = getHospital(a.hospital_id)!;
              const queue = queuePosition(a.id);
              const soon = new Date(a.slot_start).getTime() - now < 864e5;
              return (
                <Card key={a.id} className="card-elevated">
                  <div className="flex gap-4">
                    <span className="w-12 h-12 rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand-ink)] grid place-items-center font-semibold shrink-0">
                      {doc.full_name.replace("Dr. ", "").split(" ").map((w) => w[0]).join("")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <p className="font-medium">{doc.full_name}</p>
                        <Badge tone={STATUS_TONE[a.status]}>{a.status.replace("_", " ")}</Badge>
                      </div>
                      <p className="text-sm text-[var(--color-ink-3)]">
                        {doc.specialization} · {hosp.name}
                      </p>
                      <p className="text-sm mt-1 flex items-center gap-1.5">
                        <CalendarDays size={14} className="text-[var(--color-ink-3)]" />
                        {fmtDate(a.slot_start)}, {fmtTime(a.slot_start)}
                        <span className={soon ? "text-[var(--color-brand)] font-medium" : "text-[var(--color-ink-3)]"}>
                          · {relative(a.slot_start)}
                        </span>
                      </p>
                      {a.reason && (
                        <p className="text-sm text-[var(--color-ink-2)] mt-1">&ldquo;{a.reason}&rdquo;</p>
                      )}

                      {/* Live queue position over a Realtime channel — a small
                          feature with outsized demo impact. */}
                      {queue && a.status === "checked_in" && (
                        <div className="mt-2 rounded-[6px] bg-[var(--color-brand-soft)] px-3 py-2 text-sm text-[var(--color-brand-ink)]">
                          {m.queuePosition}: <strong>#{queue.position}</strong>
                          {queue.ahead > 0 && ` · approximately ${queue.approxMinutes} min wait`}
                        </div>
                      )}

                      <AppointmentActions
                        id={a.id}
                        title={`${doc.full_name} — ${hosp.name}`}
                        start={a.slot_start}
                        end={a.slot_end}
                        mapsUrl={`https://www.google.com/maps/dir/?api=1&destination=${hosp.lat},${hosp.lng}`}
                        teleconsult={a.mode === "teleconsult"}
                        labels={{ reschedule: m.reschedule, cancel: m.cancel, calendar: m.addToCalendar, directions: m.directions, join: m.joinTeleconsult }}
                      />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h3 className="font-semibold mb-3">{m.history}</h3>
        <div className="space-y-2">
          {history.slice(0, 25).map((a) => {
            const doc = doctorCard(a.doctor_id)!;
            const hosp = getHospital(a.hospital_id)!;
            return (
              <Card key={a.id} className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <p className="font-medium text-sm">{doc.full_name}</p>
                  <p className="text-xs text-[var(--color-ink-3)] flex items-center gap-1">
                    <MapPin size={11} /> {hosp.name} · {fmtDate(a.slot_start)}
                  </p>
                  {a.reason && <p className="text-xs text-[var(--color-ink-2)] mt-0.5">{a.reason}</p>}
                </div>
                <Badge tone={STATUS_TONE[a.status]}>{a.status.replace("_", " ")}</Badge>
                <div className="flex gap-2">
                  {a.status === "completed" && (
                    <Link href={`/patient/records?tab=timeline`} className="pill hover:border-[var(--color-brand)]">
                      Visit record
                    </Link>
                  )}
                  <Link
                    href={`/patient/book?doctor=${a.doctor_id}&hospital=${a.hospital_id}`}
                    className="pill hover:border-[var(--color-brand)]"
                  >
                    {m.bookFollowUp}
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
