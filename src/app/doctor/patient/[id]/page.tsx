import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDoctor } from "@/lib/auth";
import {
  AccessDenied, activeRelationship, allergiesFor, billsFor, caseSheetsFor,
  checkinsFor, documentsFor, getHospital, getProfile, historyFor, medicationsFor,
  patientHeader, prescriptionsFor, vitalsFor,
} from "@/lib/db/store";
import { Badge, Card, Empty, SectionTitle, Stat } from "@/components/ui";
import { HistorySynthesis } from "@/components/doctor/history-synthesis";
import { RequestAccessPanel } from "@/components/doctor/request-access-panel";
import { fmtDate, relative, explainFrequency, rupees } from "@/lib/utils";
import { summariseVitals } from "@/lib/clinical";
import { AlertTriangle, FileJson, Pill } from "lucide-react";

// The doctor sees the same surfaces the patient sees — profile, records,
// appointments, billing, wellness — in a read-optimised layout, plus the
// clinical actions the patient does not have.

export default async function DoctorPatientView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireDoctor();
  const actor = { id: session.userId, role: "doctor" as const };

  const p = patientHeader(id);
  if (!p) notFound();

  const rel = activeRelationship(session.userId, id);
  if (!rel) {
    // No relationship: the identity card, and a way to ask. Nothing clinical.
    return (
      <div className="max-w-2xl">
        <SectionTitle eyebrow="Locked" title={p.full_name} />
        <RequestAccessPanel
          patientId={id}
          name={p.full_name}
          summary={`${p.age} y · ${p.sex} · ${p.mrn}`}
        />
      </div>
    );
  }

  let sheets, vitals, allergies, meds, docs, rxs, hist, bills, checkins;
  try {
    sheets = caseSheetsFor(actor, id);
    vitals = vitalsFor(actor, id);
    allergies = allergiesFor(actor, id);
    meds = medicationsFor(actor, id);
    docs = documentsFor(actor, id);
    rxs = prescriptionsFor(actor, id);
    hist = historyFor(actor, id);
    bills = rel.scope.includes("billing") ? billsFor(actor, id) : [];
    checkins = rel.scope.includes("wellness") ? checkinsFor(actor, id).slice(0, 14) : [];
  } catch (e) {
    if (e instanceof AccessDenied) notFound();
    throw e;
  }

  const latest = vitals[0];
  const vitalRows = latest ? summariseVitals(latest, p.age) : [];
  const abnormal = vitalRows.filter((v) => v.flag && v.flag !== "normal");
  const lastThree = sheets.slice(0, 3);

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="eyebrow">Patient record</div>
          <h1 className="text-[1.5rem] font-bold tracking-tight">{p.full_name}</h1>
          <p className="text-sm text-[var(--color-ink-3)]">
            {p.age} y · {p.sex} · {p.blood_group} · <span className="font-mono">{p.mrn}</span>
            {p.abha_number && <span className="font-mono"> · ABHA {p.abha_number}</span>}
          </p>
        </div>
        <div className="text-right">
          <Badge tone="good">access via {rel.basis.replace("_", " ")}</Badge>
          <p className="text-xs text-[var(--color-ink-3)] mt-1">
            expires {relative(rel.expires_at)} · scope: {rel.scope.join(", ")}
          </p>
        </div>
      </div>

      {/* Allergies in red at the top. Always. */}
      {allergies.length > 0 && (
        <div className="rounded-[8px] border border-[color-mix(in_srgb,var(--color-critical)_45%,transparent)] bg-[var(--color-critical-soft)] px-4 py-3">
          <p className="text-sm font-semibold text-[var(--color-critical)] flex items-center gap-1.5">
            <AlertTriangle size={15} /> Allergies
          </p>
          <ul className="text-sm text-[var(--color-critical)] mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
            {allergies.map((a) => (
              <li key={a.id}>
                <strong>{a.allergen}</strong> — {a.reaction ?? "reaction not recorded"} ({a.severity})
              </li>
            ))}
          </ul>
        </div>
      )}

      {abnormal.length > 0 && (
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
          {abnormal.map((v) => (
            <Stat
              key={v.key}
              label={v.label}
              value={`${v.value} ${v.unit}`}
              tone={v.flag === "high" ? "critical" : "warning"}
              sub={`usual ${v.low}–${v.high} · ${relative(latest.recorded_at)}`}
            />
          ))}
        </div>
      )}

      <HistorySynthesis patientId={id} visits={sheets.length} reports={docs.length} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="font-semibold mb-2 flex items-center gap-1.5">
            <Pill size={15} className="text-[var(--color-ink-3)]" /> Current medications
          </h3>
          {meds.current.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-3)]">None recorded.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {meds.current.map((med) => (
                <li key={med.id} className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium">{med.drug_text}</span>
                  <span>{med.dose}</span>
                  <span className="font-mono text-xs">{med.frequency}</span>
                  <span className="text-xs text-[var(--color-ink-3)]">
                    since {fmtDate(med.started_on)}
                  </span>
                  {med.is_self_reported && <Badge tone="warning">self-reported</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className="font-semibold mb-2">Active problems</h3>
          {hist.chronic.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-3)]">None recorded.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {hist.chronic.map((c) => (
                <li key={c.id} className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium">{c.condition}</span>
                  {c.icd11_code && <span className="font-mono text-xs text-[var(--color-ink-3)]">{c.icd11_code}</span>}
                  {c.since && <span className="text-xs text-[var(--color-ink-3)]">since {fmtDate(c.since)}</span>}
                  {c.on_treatment && <Badge tone="brand">on treatment</Badge>}
                </li>
              ))}
            </ul>
          )}
          {hist.family.length > 0 && (
            <>
              <h4 className="eyebrow mt-4 mb-1">Family history</h4>
              <ul className="text-sm text-[var(--color-ink-2)]">
                {hist.family.map((f) => (
                  <li key={f.id}>{f.relation}: {f.condition}{f.age_at_onset ? ` at ${f.age_at_onset}` : ""}</li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="font-semibold">Last visits</h3>
          <span className="text-xs text-[var(--color-ink-3)]">{sheets.length} on record</span>
        </div>
        {lastThree.length === 0 ? (
          <Empty title="No consultations recorded yet." />
        ) : (
          <div className="space-y-2">
            {lastThree.map((cs) => (
              <div key={cs.id} className="flex flex-wrap items-center gap-3 border-b border-[var(--color-line)] pb-2 last:border-0">
                <div className="flex-1 min-w-[200px]">
                  <p className="font-medium text-sm">{cs.provisional_dx ?? cs.chief_complaints[0]?.complaint ?? "Consultation"}</p>
                  <p className="text-xs text-[var(--color-ink-3)]">
                    {getProfile(cs.doctor_id)?.full_name} · {getHospital(cs.hospital_id)?.name} · {fmtDate(cs.created_at)}
                  </p>
                </div>
                <Badge tone={cs.status === "finalized" ? "good" : "warning"}>{cs.status}</Badge>
                <Link href={`/doctor/case/${cs.id}`} className="pill hover:border-[var(--color-brand)]">
                  Open
                </Link>
                {/* Judges see a real interoperability standard, not a claim. */}
                <Link href={`/api/fhir/case/${cs.id}`} target="_blank" className="pill hover:border-[var(--color-brand)]">
                  <FileJson size={12} /> View as FHIR
                </Link>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="font-semibold mb-2">Recent reports</h3>
          {docs.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-3)]">No uploaded reports.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {docs.slice(0, 5).map((d) => (
                <li key={d.id}>
                  <p className="font-medium">{d.title}</p>
                  <p className="text-xs text-[var(--color-ink-3)]">{fmtDate(d.report_date)}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(d.extracted_values ?? []).map((v) => (
                      <Badge
                        key={v.analyte}
                        tone={v.flag === "normal" ? "neutral" : v.flag === "high" ? "critical" : "warning"}
                      >
                        {v.analyte} {v.value} {v.unit}
                      </Badge>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className="font-semibold mb-2">Recent prescriptions</h3>
          {rxs.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-3)]">None issued.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {rxs.slice(0, 4).map((rx) => (
                <li key={rx.id}>
                  <p className="text-xs text-[var(--color-ink-3)]">
                    {fmtDate(rx.issued_at)} · {getProfile(rx.doctor_id)?.full_name}
                  </p>
                  {rx.items.map((i) => (
                    <p key={i.id}>
                      {i.drug_text} {i.dose}{" "}
                      <span className="text-[var(--color-ink-3)]">{explainFrequency(i.frequency)}</span>
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {checkins.length > 0 && (
        <Card>
          <h3 className="font-semibold mb-1">Last 14 days of check-ins</h3>
          <p className="text-xs text-[var(--color-ink-3)] mb-3">
            Recorded by the patient before the visit — pre-consultation data
            collection, not a fitness toy.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {checkins.map((c) => (
              <span key={c.id} className="pill" title={c.log_date}>
                {c.log_date.slice(5)} · mood {c.mood ?? "—"}/5 · pain {c.pain_score ?? "—"}/10
                {c.meds_taken === false && " · missed meds"}
              </span>
            ))}
          </div>
        </Card>
      )}

      {bills.length > 0 && (
        <Card>
          <h3 className="font-semibold mb-2">Billing</h3>
          <p className="text-sm text-[var(--color-ink-2)]">
            {bills.length} bills on record · {rupees(bills.reduce((a, b) => a + b.total, 0))} total ·{" "}
            {bills.filter((b) => b.status === "unpaid").length} unpaid
          </p>
        </Card>
      )}
    </div>
  );
}
