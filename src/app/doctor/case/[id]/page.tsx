import { notFound } from "next/navigation";
import { requireDoctor } from "@/lib/auth";
import {
  AccessDenied, allergiesFor, caseSheet, caseSheetsFor, checkinsFor, db,
  documentsFor, getHospital, getProfile, historyFor, medicationsFor,
  patientHeader, prescriptionsFor, vitalsFor, doctorCard,
} from "@/lib/db/store";
import { CaseSheetWorkspace } from "@/components/doctor/case-sheet";
import { fmtDate } from "@/lib/utils";

// The structured case sheet: a two-pane consultation workspace. Left, the
// form in collapsible sections with a progress indicator. Right, the patient
// context panel — allergies in red at the top, current medications, the last
// three visits, active problems, recent vitals and recent wellness data.
// The doctor never has to leave the form to check history.

export default async function CaseSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireDoctor();
  const actor = { id: session.userId, role: "doctor" as const };

  let cs;
  try {
    cs = caseSheet(actor, id);
  } catch (e) {
    if (e instanceof AccessDenied) notFound();
    throw e;
  }
  if (!cs) notFound();

  const p = patientHeader(cs.patient_id)!;
  const doctor = doctorCard(session.userId)!;
  const allergies = allergiesFor(actor, cs.patient_id);
  const meds = medicationsFor(actor, cs.patient_id).current;
  const hist = historyFor(actor, cs.patient_id);
  const vitals = vitalsFor(actor, cs.patient_id);
  const thisVisitVitals = vitals.find((v) => v.case_sheet_id === cs.id) ?? null;
  const previous = caseSheetsFor(actor, cs.patient_id)
    .filter((c) => c.id !== cs.id)
    .slice(0, 3)
    .map((c) => ({
      id: c.id,
      date: fmtDate(c.created_at),
      doctor: getProfile(c.doctor_id)?.full_name ?? "—",
      hospital: getHospital(c.hospital_id)?.name ?? "—",
      dx: c.provisional_dx ?? c.chief_complaints[0]?.complaint ?? "Consultation",
      advice: c.advice,
    }));

  const checkins = checkinsFor(actor, cs.patient_id).slice(0, 14).map((c) => ({
    date: c.log_date, mood: c.mood, pain: c.pain_score,
    sleep: c.sleep_hours, meds_taken: c.meds_taken, symptoms: c.symptoms,
  }));

  const rxs = prescriptionsFor(actor, cs.patient_id)
    .filter((r) => r.case_sheet_id === cs.id)
    .map((r) => ({
      id: r.id, token: r.verify_token,
      items: r.items.map((i) => ({
        drug_text: i.drug_text, dose: i.dose, frequency: i.frequency,
        timing: i.timing, duration_days: i.duration_days,
      })),
    }));

  const reports = documentsFor(actor, cs.patient_id).slice(0, 4).map((d) => ({
    id: d.id, title: d.title, date: d.report_date,
    flagged: (d.extracted_values ?? []).filter((v) => v.flag !== "normal"),
  }));

  const orders = db.investigations
    .filter((o) => o.case_sheet_id === cs.id)
    .map((o) => ({ id: o.id, test_name: o.test_name, urgency: o.urgency }));

  return (
    <CaseSheetWorkspace
      sheet={cs}
      patient={{
        id: p.id, name: p.full_name, age: p.age, sex: p.sex,
        mrn: p.mrn, blood_group: p.blood_group, height_cm: p.height_cm,
      }}
      doctorSpeciality={doctor.specialization}
      hospital={getHospital(cs.hospital_id)?.name ?? ""}
      vitals={thisVisitVitals}
      lastVitals={vitals.find((v) => v.case_sheet_id !== cs.id) ?? null}
      context={{
        allergies: allergies.map((a) => ({
          id: a.id, allergen: a.allergen, reaction: a.reaction,
          severity: a.severity, category: a.category,
        })),
        medications: meds.map((m) => ({
          id: m.id, drug_text: m.drug_text, dose: m.dose, frequency: m.frequency,
        })),
        problems: hist.chronic.map((c) => ({
          id: c.id, condition: c.condition, since: c.since, on_treatment: c.on_treatment,
        })),
        family: hist.family.map((f) => ({ id: f.id, relation: f.relation, condition: f.condition })),
        surgical: hist.surgical.map((s) => ({ id: s.id, name: s.procedure_name, on: s.performed_on })),
        previous,
        checkins,
        reports,
      }}
      prescriptions={rxs}
      orders={orders}
    />
  );
}
