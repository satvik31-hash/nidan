import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listAllHospitals, platformStats, recentAdminActivity } from "@/lib/db/store";
import { Card, SectionTitle, Stat } from "@/components/ui";
import { compactRupees, relative } from "@/lib/utils";
import { adminCommands } from "@/lib/commands";

export default async function AdminOverview() {
  const session = await requireAdmin();
  const actor = { id: session.userId, role: "admin" as const };

  const stats = platformStats(actor);
  const hospitals = listAllHospitals(actor);
  const activity = recentAdminActivity(actor, 10);

  const totalVisits = hospitals.reduce((a, h) => a + h.visitCount, 0) || 1;
  const visitsByHospital = hospitals
    .filter((h) => h.visitCount > 0)
    .sort((a, b) => b.visitCount - a.visitCount);

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <div className="eyebrow">Overview</div>
        <h1 className="text-[1.5rem] font-bold tracking-tight">Company-wide snapshot</h1>
        <p className="text-sm text-[var(--color-ink-3)] mt-1">
          Everything Nidan, the company, can see about its patients, doctors and hospitals.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {adminCommands.slice(1).map((c) => (
          <Link
            key={c.id}
            href={c.href}
            className="pill inline-flex items-center gap-1.5 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
          >
            <c.icon size={13} /> {c.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Patients" value={stats.patients} />
        <Stat label="Doctors" value={stats.doctors} />
        <Stat label="Hospitals" value={stats.hospitals} />
        <Stat label="Appointments today" value={stats.appointmentsToday} />
        <Stat label="Active consents" value={stats.activeConsents} tone="good" />
        <Stat
          label="Outstanding billing"
          value={compactRupees(stats.outstandingBillTotal)}
          tone={stats.outstandingBillTotal > 0 ? "warning" : "neutral"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Visits by hospital" eyebrow="Where patients are seen" />
          {visitsByHospital.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-3)]">No visits recorded yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {visitsByHospital.map((h) => (
                <li key={h.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="truncate">{h.name}</span>
                    <span className="text-[var(--color-ink-3)] shrink-0 ml-2">{h.visitCount} visits</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--color-paper)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--chart-1)]"
                      style={{ width: `${Math.round((h.visitCount / totalVisits) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle
            title="Recent administration activity"
            eyebrow="Self-transparency"
            action={
              <Link href="/admin/audit" className="text-xs text-[var(--color-brand)] hover:underline">
                Full audit log
              </Link>
            }
          />
          {activity.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-3)]">No reads logged yet this session.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {activity.map((a) => (
                <li key={a.id} className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="text-[var(--color-ink-2)]">
                    {a.actor_name} · <span className="font-mono">{a.resource}</span>
                  </span>
                  <span className="text-[var(--color-ink-3)] shrink-0">{relative(a.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
