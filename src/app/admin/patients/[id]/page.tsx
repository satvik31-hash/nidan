import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  allergiesFor, billsFor, caseSheetsFor, documentsFor, getHospital, getProfile,
  grantsFor, historyFor, patientHeader, prescriptionsFor,
} from "@/lib/db/store";
import { Badge, Card, Empty, KeyValue, SectionTitle } from "@/components/ui";
import { fmtDate, rupees } from "@/lib/utils";
import { AlertTriangle, ArrowLeft } from "lucide-react";

// Read-only, company-wide oversight — no editing control anywhere on this
// page. It reuses the same gated per-patient accessors the doctor console
// uses; assertAccess() already passes an admin actor through.

export default async function AdminPatientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAdmin();
  const actor = { id: session.userId, role: "admin" as const };

  const p = patientHeader(id);
  if (!p) notFound();

  const sheets = caseSheetsFor(actor, id);
  const allergies = allergiesFor(actor, id);
  const docs = documentsFor(actor, id);
  const rxs = prescriptionsFor(actor, id);
  const hist = historyFor(actor, id);
  const bills = billsFor(actor, id);
  const grants = grantsFor(id);

  return (
    <div className="max-w-5xl space-y-4">
      <Link
        href="/admin/patients"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-2)] hover:text-[var(--color-brand)]"
      >
        <ArrowLeft size={15} /> Back to patients
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="eyebrow">Company data view — read-only</div>
          <h1 className="text-[1.5rem] font-bold tracking-tight">{p.full_name}</h1>
          <p className="text-sm text-[var(--color-ink-3)]">
            {p.age} y · {p.sex} · {p.blood_group} · <span className="font-mono">{p.mrn}</span>
          </p>
        </div>
      </div>

      {allergies.length > 0 && (
        <div className="rounded-[8px] border border-[color-mix(in_srgb,var(--color-critical)_45%,transparent)] bg-[var(--color-critical-soft)] px-4 py-3">
          <p className="text-sm font-semibold text-[var(--color-critical)] flex items-center gap-1.5">
            <AlertTriangle size={15} /> Allergies
          </p>
          <ul className="text-sm text-[var(--color-critical)] mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
            {allergies.map((a) => (
              <li key={a.id}><strong>{a.allergen}</strong> — {a.severity}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="font-semibold mb-2">Demographics</h3>
          <KeyValue k="Phone" v={p.phone} />
          <KeyValue k="Email" v={p.email} />
          <KeyValue k="City" v={p.city} />
          <KeyValue k="ABHA number" v={p.abha_number} />
        </Card>

        <Card>
          <h3 className="font-semibold mb-2">Active problems</h3>
          {hist.chronic.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-3)]">None recorded.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {hist.chronic.map((c) => (
                <li key={c.id}>{c.condition}{c.since ? ` · since ${fmtDate(c.since)}` : ""}</li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <h3 className="font-semibold mb-2">Care relationships (consent)</h3>
        {grants.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-3)]">No doctor currently has access.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {grants.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-2">
                <Badge tone={g.active ? "good" : "neutral"}>{g.active ? "active" : "expired"}</Badge>
                <span className="font-medium">{g.doctor?.full_name ?? "Unknown"}</span>
                <span className="text-xs text-[var(--color-ink-3)]">
                  {g.basis.replace("_", " ")} · {g.views} view{g.views === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="font-semibold mb-2">Visits</h3>
        {sheets.length === 0 ? (
          <Empty title="No consultations recorded yet." />
        ) : (
          <ul className="space-y-2 text-sm">
            {sheets.slice(0, 5).map((cs) => (
              <li key={cs.id} className="flex flex-wrap items-center gap-3 border-b border-[var(--color-line)] pb-2 last:border-0">
                <div className="flex-1 min-w-[200px]">
                  <p className="font-medium">{cs.provisional_dx ?? cs.chief_complaints[0]?.complaint ?? "Consultation"}</p>
                  <p className="text-xs text-[var(--color-ink-3)]">
                    {getProfile(cs.doctor_id)?.full_name} · {getHospital(cs.hospital_id)?.name} · {fmtDate(cs.created_at)}
                  </p>
                </div>
                <Badge tone={cs.status === "finalized" ? "good" : "warning"}>{cs.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="font-semibold mb-2">Recent documents</h3>
          {docs.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-3)]">None uploaded.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {docs.slice(0, 5).map((d) => (
                <li key={d.id}>{d.title} <span className="text-xs text-[var(--color-ink-3)]">· {fmtDate(d.report_date)}</span></li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className="font-semibold mb-2">Recent prescriptions</h3>
          {rxs.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-3)]">None issued.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {rxs.slice(0, 5).map((rx) => (
                <li key={rx.id}>{fmtDate(rx.issued_at)} · {rx.items.length} item{rx.items.length === 1 ? "" : "s"}</li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <h3 className="font-semibold mb-2">Billing</h3>
        <p className="text-sm text-[var(--color-ink-2)]">
          {bills.length} bills on record · {rupees(bills.reduce((a, b) => a + b.total, 0))} total ·{" "}
          {bills.filter((b) => b.status !== "paid").length} outstanding
        </p>
      </Card>
    </div>
  );
}
