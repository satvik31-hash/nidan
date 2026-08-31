import Link from "next/link";
import { AlertTriangle, ArrowRight, Clock3, FileWarning, KeyRound, Search } from "lucide-react";
import { requireDoctor } from "@/lib/auth";
import { db, doctorCard, todayQueue } from "@/lib/db/store";
import { Card, Empty, Stat } from "@/components/ui";
import { QueueRow } from "@/components/doctor/queue-row";
import { fmtTime } from "@/lib/utils";
import { istDay } from "@/lib/tz";

// The landing view is the working day: four numbers, anything that needs a
// decision today, then the queue itself. Everything on this page is derived
// from real rows — there is no decorative statistic.

const DAY = 86_400_000;

export default async function DoctorHome() {
  const session = await requireDoctor();
  const doc = doctorCard(session.userId)!;
  const queue = todayQueue(session.userId);

  const completed = queue.filter((a) => a.status === "completed").length;
  const waiting = queue.filter((a) => ["checked_in", "confirmed"].includes(a.status)).length;

  // Average consult duration, derived rather than guessed
  const durations = db.caseSheets
    .filter((c) => c.doctor_id === session.userId && c.finalized_at)
    .map((c) => (new Date(c.finalized_at!).getTime() - new Date(c.created_at).getTime()) / 60000)
    .filter((d) => d > 0 && d < 120);
  const avg = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null;

  const drafts = db.caseSheets.filter(
    (c) => c.doctor_id === session.userId && c.status === "draft",
  );

  // Consent is time-bounded, so it expires quietly unless something says so.
  // A doctor who loses access mid-follow-up finds out at the worst moment.
  const now = Date.now();
  const expiring = db.careRelationships
    .filter((r) => r.doctor_id === session.userId && !r.revoked_at)
    .map((r) => ({ rel: r, inDays: (new Date(r.expires_at).getTime() - now) / DAY }))
    .filter((x) => x.inDays > 0 && x.inDays <= 7)
    .sort((a, b) => a.inDays - b.inDays);

  const awaiting = db.accessRequests.filter(
    (r) => r.doctor_id === session.userId && r.status === "pending",
  );

  const nameOf = (id: string) => db.profiles.find((p) => p.id === id)?.full_name ?? "Unknown";

  // The first row that still needs the doctor — what "next" actually means.
  const nextUpId = queue.find((a) => !["completed", "cancelled", "no_show"].includes(a.status))?.id;

  const attention = drafts.length + expiring.length + awaiting.length;

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <div className="eyebrow">Today&apos;s clinic</div>
          <h1 className="text-[1.5rem] font-bold tracking-tight">
            {new Date(`${istDay()}T12:00:00+05:30`).toLocaleDateString("en-IN", {
              weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata",
            })}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-[var(--color-ink-3)]">
            {doc.hospitals[0]?.name} · {doc.specialization}
          </p>
          <Link
            href="/doctor/lookup"
            className="pill px-3 py-1.5 inline-flex items-center gap-1.5 hover:border-[var(--color-brand)]"
          >
            <Search size={13} /> Find a patient
          </Link>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mb-4">
        <Stat label="Patients today" value={queue.length} />
        <Stat label="Seen" value={completed} tone="good" />
        <Stat label="Waiting" value={waiting} tone={waiting > 3 ? "warning" : "neutral"} />
        <Stat label="Avg consult" value={avg ? `${avg} min` : "—"} />
      </div>

      {/* ── Needs attention ──────────────────────────────────
          Three things that are invisible until they bite: an unfinalised
          sheet, a consent about to lapse, and a patient who has not yet
          approved a request. Shown only when there is something to do. */}
      {attention > 0 && (
        <div className="grid gap-3 sm:grid-cols-3 mb-5">
          {drafts.length > 0 && (
            <Card className="border-[color-mix(in_srgb,var(--color-warning)_35%,transparent)] bg-[var(--color-warning-soft)]">
              <div className="flex items-center gap-1.5 text-[var(--color-warning)]">
                <FileWarning size={14} />
                <span className="text-sm font-medium">
                  {drafts.length} unfinalised case sheet{drafts.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {drafts.slice(0, 3).map((d) => (
                  <Link
                    key={d.id}
                    href={`/doctor/case/${d.id}`}
                    className="pill bg-[var(--color-surface)] hover:border-[var(--color-brand)]"
                  >
                    {nameOf(d.patient_id)} · resume
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {expiring.length > 0 && (
            <Card>
              <div className="flex items-center gap-1.5 text-[var(--color-ink-2)]">
                <Clock3 size={14} />
                <span className="text-sm font-medium">
                  {expiring.length} consent{expiring.length === 1 ? "" : "s"} expiring this week
                </span>
              </div>
              <ul className="mt-2 space-y-1 text-xs text-[var(--color-ink-3)]">
                {expiring.slice(0, 3).map(({ rel, inDays }) => (
                  <li key={rel.id} className="flex justify-between gap-2">
                    <Link
                      href={`/doctor/patient/${rel.patient_id}`}
                      className="truncate hover:text-[var(--color-brand)]"
                    >
                      {nameOf(rel.patient_id)}
                    </Link>
                    <span className="shrink-0 tabular-nums">
                      {inDays < 1 ? "today" : `${Math.ceil(inDays)} d`}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-[0.6875rem] text-[var(--color-ink-3)] mt-2">
                Access ends on its own. Ask the patient to re-approve if the
                follow-up runs past it.
              </p>
            </Card>
          )}

          {awaiting.length > 0 && (
            <Card>
              <div className="flex items-center gap-1.5 text-[var(--color-ink-2)]">
                <KeyRound size={14} />
                <span className="text-sm font-medium">
                  {awaiting.length} request{awaiting.length === 1 ? "" : "s"} awaiting the patient
                </span>
              </div>
              <ul className="mt-2 space-y-1 text-xs text-[var(--color-ink-3)]">
                {awaiting.slice(0, 3).map((r) => (
                  <li key={r.id} className="truncate">{nameOf(r.patient_id)}</li>
                ))}
              </ul>
              <p className="text-[0.6875rem] text-[var(--color-ink-3)] mt-2">
                Nothing opens until they enter the code on their phone.
              </p>
            </Card>
          )}
        </div>
      )}

      {queue.length === 0 ? (
        <Empty
          title="No appointments today"
          body="Your availability rules decide which slots patients can book. Change them and the booking grid updates on the next query."
          action={
            <Link href="/doctor/profile" className="pill hover:border-[var(--color-brand)]">
              Edit availability <ArrowRight size={13} />
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {queue.map((a) => (
            <div key={a.id}>
              {a.id === nextUpId && completed > 0 && (
                <div className="flex items-center gap-2 pt-2 pb-1.5">
                  <span className="eyebrow text-[var(--color-brand)]">Next up</span>
                  <span className="h-px flex-1 bg-[var(--color-line)]" />
                </div>
              )}
              <QueueRow
                appointment={{
                  id: a.id,
                  token: a.token_no,
                  time: fmtTime(a.slot_start),
                  status: a.status,
                  reason: a.reason,
                  caseSheetId: a.caseSheet?.id ?? null,
                  caseStatus: a.caseSheet?.status ?? null,
                }}
                patient={{
                  id: a.patient.id,
                  name: a.patient.full_name,
                  age: a.patient.age,
                  sex: a.patient.sex,
                  mrn: a.patient.mrn,
                }}
              />
            </div>
          ))}
        </div>
      )}

      <p className="flex items-start gap-1.5 text-xs text-[var(--color-ink-3)] mt-4">
        <AlertTriangle size={13} className="mt-px shrink-0" />
        This queue is subscribed to a realtime channel — a patient checking in at
        the desk appears here without a refresh.
      </p>
    </div>
  );
}
