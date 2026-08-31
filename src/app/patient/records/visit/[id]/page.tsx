import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePatient } from "@/lib/auth";
import {
  caseSheet, diagnosesFor, getHospital, getProfile, prescriptionsFor, vitalsFor,
} from "@/lib/db/store";
import { Badge, Card, KeyValue, SectionTitle } from "@/components/ui";
import { fmtDate, fmtDateTime, explainFrequency } from "@/lib/utils";
import { summariseVitals } from "@/lib/clinical";
import { ArrowLeft } from "lucide-react";

// The patient's read-view of a visit. Same data as the doctor's case sheet,
// rendered for a person rather than a clinician: no abbreviations without
// their expansion, and nothing hidden.

export default async function VisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requirePatient();
  const actor = { id: session.userId, role: "patient" as const };

  const cs = caseSheet(actor, id);
  if (!cs) notFound();

  const doctor = getProfile(cs.doctor_id)!;
  const hospital = getHospital(cs.hospital_id)!;
  const vitals = vitalsFor(actor, cs.patient_id).find((v) => v.case_sheet_id === cs.id);
  const dxs = diagnosesFor(actor, cs.patient_id).filter((d) => d.case_sheet_id === cs.id);
  const rxs = prescriptionsFor(actor, cs.patient_id).filter((r) => r.case_sheet_id === cs.id);
  const vitalRows = vitals ? summariseVitals(vitals) : [];

  return (
    <div className="space-y-4">
      <Link href="/patient/records" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-2)] hover:text-[var(--color-brand)]">
        <ArrowLeft size={16} /> Back to records
      </Link>

      <SectionTitle
        eyebrow={`${cs.visit_type} visit · ${fmtDate(cs.created_at)}`}
        title={cs.provisional_dx ?? "Consultation"}
        action={
          <Badge tone={cs.status === "finalized" ? "good" : "warning"}>
            {cs.status}
          </Badge>
        }
      />

      <Card>
        <KeyValue k="Doctor" v={doctor.full_name} />
        <KeyValue k="Hospital" v={hospital.name} />
        <KeyValue k="Date" v={fmtDateTime(cs.created_at)} />
        {cs.finalized_at && <KeyValue k="Signed off" v={fmtDateTime(cs.finalized_at)} />}
      </Card>

      <Card>
        <h3 className="font-semibold mb-2">What you came in with</h3>
        <ul className="space-y-1 text-[0.9375rem]">
          {cs.chief_complaints.map((c, i) => (
            <li key={i}>
              {c.complaint} — for {c.duration_value} {c.duration_unit}
            </li>
          ))}
        </ul>
        {cs.hopi.severity_0_10 != null && (
          <p className="text-sm text-[var(--color-ink-3)] mt-2">
            Severity recorded as {cs.hopi.severity_0_10} out of 10
            {cs.hopi.character ? `, described as ${cs.hopi.character}` : ""}
            {cs.hopi.timing ? `, ${cs.hopi.timing}` : ""}.
          </p>
        )}
      </Card>

      {vitalRows.length > 0 && (
        <Card>
          <h3 className="font-semibold mb-3">Measurements taken</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            {vitalRows.map((v) => (
              <div key={v.key} className="border border-[var(--color-line)] rounded-[6px] p-2.5">
                <span className="eyebrow">{v.label}</span>
                <p className="text-[1.25rem] font-semibold leading-tight">
                  {v.value}
                  <span className="text-xs font-normal text-[var(--color-ink-3)]"> {v.unit}</span>
                </p>
                {v.flag && v.flag !== "normal" && (
                  <Badge tone={v.flag === "high" ? "critical" : "warning"}>
                    {v.flag === "high" ? "above" : "below"} the usual range ({v.low}–{v.high})
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {dxs.length > 0 && (
        <Card>
          <h3 className="font-semibold mb-2">What the doctor concluded</h3>
          <ul className="space-y-2">
            {dxs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{d.icd11_title ?? d.free_text}</span>
                <Badge tone={d.certainty === "confirmed" ? "good" : "neutral"}>{d.certainty}</Badge>
                {d.icd11_code && (
                  <span className="font-mono text-xs text-[var(--color-ink-3)]">ICD-11 {d.icd11_code}</span>
                )}
              </li>
            ))}
          </ul>
          {cs.differential_dx.length > 0 && (
            <p className="text-sm text-[var(--color-ink-3)] mt-2">
              Also being considered: {cs.differential_dx.join(", ")}
            </p>
          )}
        </Card>
      )}

      {rxs.map((rx) => (
        <Card key={rx.id}>
          <h3 className="font-semibold mb-2">Medicines prescribed</h3>
          <ul className="space-y-2">
            {rx.items.map((i) => (
              <li key={i.id}>
                <p className="font-medium">{i.drug_text} {i.dose}</p>
                <p className="text-sm text-[var(--color-ink-2)]">
                  {explainFrequency(i.frequency)}{i.timing ? `, ${i.timing}` : ""}
                  {i.duration_days ? `, for ${i.duration_days} days` : ""}
                  {i.instructions ? ` — ${i.instructions}` : ""}
                </p>
              </li>
            ))}
          </ul>
          <Link href={`/patient/records/rx/${rx.id}`} className="pill mt-3 inline-flex hover:border-[var(--color-brand)]">
            Open the prescription
          </Link>
        </Card>
      ))}

      {cs.advice && (
        <Card>
          <h3 className="font-semibold mb-2">Advice</h3>
          <p className="text-[0.9375rem] whitespace-pre-line">{cs.advice}</p>
          {cs.follow_up_on && (
            <p className="text-sm text-[var(--color-brand)] mt-2">
              Review on {fmtDate(cs.follow_up_on)}
            </p>
          )}
          {cs.referred_to && (
            <p className="text-sm text-[var(--color-ink-2)] mt-1">Referred to: {cs.referred_to}</p>
          )}
        </Card>
      )}
    </div>
  );
}
