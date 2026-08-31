// FHIR R4 export.
//
// "This is a day of work and it is the single most defensible technical
// claim in your project. Judges see a real interoperability standard, not
// a claim about one." — §10.
//
// Any case sheet maps to a Bundle containing Patient, Encounter, Condition,
// Observation (vitals), MedicationRequest, DiagnosticReport and
// AllergyIntolerance. The shapes below follow the ABDM HI-type profiles for
// an OPConsultation record, so the mapping to the real gateway is mechanical.

import {
  allergiesFor, caseSheet, diagnosesFor, documentsFor, getDoctor, getHospital,
  getProfile, patientHeader, prescriptionsFor, vitalsFor,
} from "@/lib/db/store";
import type { UserRole } from "@/lib/types";

const SNOMED = "http://snomed.info/sct";
const LOINC = "http://loinc.org";
const ICD11 = "http://id.who.int/icd/release/11/mms";
const ABHA_SYSTEM = "https://healthid.ndhm.gov.in";

type Actor = { id: string; role: UserRole };

interface BundleEntry { fullUrl: string; resource: Record<string, unknown> }

export function caseSheetToFhir(actor: Actor, caseSheetId: string) {
  const cs = caseSheet(actor, caseSheetId);
  if (!cs) return null;

  const patient = patientHeader(cs.patient_id)!;
  const doctorProfile = getProfile(cs.doctor_id)!;
  const doctor = getDoctor(cs.doctor_id)!;
  const hospital = getHospital(cs.hospital_id)!;

  const vitals = vitalsFor(actor, cs.patient_id).filter((v) => v.case_sheet_id === cs.id);
  const dxs = diagnosesFor(actor, cs.patient_id).filter((d) => d.case_sheet_id === cs.id);
  const rxs = prescriptionsFor(actor, cs.patient_id).filter((r) => r.case_sheet_id === cs.id);
  const docs = documentsFor(actor, cs.patient_id).filter((d) => d.case_sheet_id === cs.id);
  const allergies = allergiesFor(actor, cs.patient_id);

  const entries: BundleEntry[] = [];
  const push = (type: string, id: string, resource: Record<string, unknown>) =>
    entries.push({ fullUrl: `urn:uuid:${id}`, resource: { resourceType: type, id, ...resource } });

  push("Patient", patient.id, {
    identifier: [
      { system: "https://nidan.in/mrn", value: patient.mrn },
      ...(patient.abha_number
        ? [{ system: ABHA_SYSTEM, value: patient.abha_number, type: { text: "ABHA Number" } }]
        : []),
    ],
    name: [{ text: patient.full_name }],
    gender: patient.sex === "intersex" || patient.sex === "undisclosed" ? "other" : patient.sex,
    birthDate: patient.date_of_birth,
    telecom: patient.phone ? [{ system: "phone", value: patient.phone }] : [],
    address: [{ line: [patient.address_line1], city: patient.city, state: patient.state, postalCode: patient.pincode, country: "IN" }],
  });

  push("Practitioner", doctor.id, {
    identifier: [
      { system: "https://nmc.org.in/registration", value: doctor.registration_no },
      ...(doctor.hpr_id ? [{ system: "https://hpr.abdm.gov.in", value: doctor.hpr_id }] : []),
    ],
    name: [{ text: doctorProfile.full_name }],
    qualification: doctor.qualifications.map((q) => ({ code: { text: q } })),
  });

  push("Organization", hospital.id, {
    identifier: hospital.hfr_id ? [{ system: "https://hfr.abdm.gov.in", value: hospital.hfr_id }] : [],
    name: hospital.name,
    address: [{ line: [hospital.address], city: hospital.city, state: hospital.state, postalCode: hospital.pincode, country: "IN" }],
  });

  push("Encounter", cs.id, {
    status: cs.status === "finalized" ? "finished" : "in-progress",
    class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: cs.visit_type === "ipd" ? "IMP" : "AMB", display: cs.visit_type === "ipd" ? "inpatient encounter" : "ambulatory" },
    subject: { reference: `urn:uuid:${patient.id}` },
    participant: [{ individual: { reference: `urn:uuid:${doctor.id}` } }],
    serviceProvider: { reference: `urn:uuid:${hospital.id}` },
    period: { start: cs.created_at, ...(cs.finalized_at ? { end: cs.finalized_at } : {}) },
    reasonCode: cs.chief_complaints.map((c) => ({
      text: `${c.complaint} — ${c.duration_value} ${c.duration_unit}`,
    })),
  });

  dxs.forEach((d) =>
    push("Condition", d.id, {
      clinicalStatus: { coding: [{ code: d.certainty === "ruled_out" ? "resolved" : "active" }] },
      verificationStatus: { coding: [{ code: d.certainty === "confirmed" ? "confirmed" : "provisional" }] },
      code: {
        coding: d.icd11_code ? [{ system: ICD11, code: d.icd11_code, display: d.icd11_title }] : [],
        text: d.icd11_title ?? d.free_text ?? "",
      },
      subject: { reference: `urn:uuid:${patient.id}` },
      encounter: { reference: `urn:uuid:${cs.id}` },
      recordedDate: cs.created_at,
    }),
  );

  const VITAL_LOINC: Record<string, [string, string, string]> = {
    temperature_c: ["8310-5", "Body temperature", "Cel"],
    pulse_bpm: ["8867-4", "Heart rate", "/min"],
    resp_rate: ["9279-1", "Respiratory rate", "/min"],
    bp_systolic: ["8480-6", "Systolic blood pressure", "mm[Hg]"],
    bp_diastolic: ["8462-4", "Diastolic blood pressure", "mm[Hg]"],
    spo2: ["59408-5", "Oxygen saturation", "%"],
    weight_kg: ["29463-7", "Body weight", "kg"],
    random_glucose: ["2339-0", "Glucose [Mass/volume] in Blood", "mg/dL"],
  };

  vitals.forEach((v) => {
    Object.entries(VITAL_LOINC).forEach(([key, [code, display, unit]]) => {
      const value = (v as unknown as Record<string, number | null>)[key];
      if (value == null) return;
      push("Observation", `${v.id}-${code}`, {
        status: "final",
        category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "vital-signs" }] }],
        code: { coding: [{ system: LOINC, code, display }] },
        subject: { reference: `urn:uuid:${patient.id}` },
        encounter: { reference: `urn:uuid:${cs.id}` },
        effectiveDateTime: v.recorded_at,
        valueQuantity: { value, unit, system: "http://unitsofmeasure.org", code: unit },
      });
    });
  });

  rxs.forEach((rx) =>
    rx.items.forEach((item) =>
      push("MedicationRequest", item.id, {
        status: "active",
        intent: "order",
        medicationCodeableConcept: { text: item.drug_text },
        subject: { reference: `urn:uuid:${patient.id}` },
        encounter: { reference: `urn:uuid:${cs.id}` },
        authoredOn: rx.issued_at,
        requester: { reference: `urn:uuid:${doctor.id}` },
        dosageInstruction: [{
          text: `${item.dose}, ${item.frequency}${item.timing ? `, ${item.timing}` : ""}${item.duration_days ? ` for ${item.duration_days} days` : ""}`,
          route: { text: item.route },
          ...(item.duration_days
            ? { timing: { repeat: { boundsDuration: { value: item.duration_days, unit: "d", system: "http://unitsofmeasure.org", code: "d" } } } }
            : {}),
        }],
      }),
    ),
  );

  docs.forEach((d) =>
    push("DiagnosticReport", d.id, {
      status: "final",
      code: { text: d.title },
      subject: { reference: `urn:uuid:${patient.id}` },
      encounter: { reference: `urn:uuid:${cs.id}` },
      effectiveDateTime: d.report_date,
      conclusion: d.ocr_text ?? undefined,
      result: (d.extracted_values ?? []).map((v) => ({
        display: `${v.analyte} ${v.value} ${v.unit} (ref ${v.ref})`,
      })),
    }),
  );

  allergies.forEach((a) =>
    push("AllergyIntolerance", a.id, {
      clinicalStatus: { coding: [{ code: "active" }] },
      verificationStatus: { coding: [{ code: "confirmed" }] },
      type: "allergy",
      category: [a.category === "drug" ? "medication" : a.category === "food" ? "food" : "environment"],
      criticality: a.severity === "anaphylaxis" || a.severity === "severe" ? "high" : "low",
      code: { coding: [{ system: SNOMED }], text: a.allergen },
      patient: { reference: `urn:uuid:${patient.id}` },
      reaction: a.reaction ? [{ manifestation: [{ text: a.reaction }], severity: a.severity === "mild" ? "mild" : "severe" }] : [],
    }),
  );

  // Composition first: an ABDM OPConsultation record is a document Bundle.
  const composition = {
    fullUrl: `urn:uuid:comp-${cs.id}`,
    resource: {
      resourceType: "Composition",
      id: `comp-${cs.id}`,
      status: cs.status === "finalized" ? "final" : "preliminary",
      type: { coding: [{ system: SNOMED, code: "371530004", display: "Clinical consultation report" }], text: "OP Consultation Record" },
      subject: { reference: `urn:uuid:${patient.id}` },
      encounter: { reference: `urn:uuid:${cs.id}` },
      date: cs.finalized_at ?? cs.created_at,
      author: [{ reference: `urn:uuid:${doctor.id}` }],
      title: "OP Consultation Record",
      custodian: { reference: `urn:uuid:${hospital.id}` },
      section: [
        { title: "Chief complaints", text: { status: "generated", div: `<div xmlns="http://www.w3.org/1999/xhtml">${cs.chief_complaints.map((c) => `${c.complaint} × ${c.duration_value} ${c.duration_unit}`).join("; ") || "—"}</div>` } },
        { title: "Medical history", entry: dxs.map((d) => ({ reference: `urn:uuid:${d.id}` })) },
        { title: "Physical examination", entry: vitals.map((v) => ({ reference: `urn:uuid:${v.id}-8867-4` })) },
        { title: "Medications", entry: rxs.flatMap((r) => r.items.map((i) => ({ reference: `urn:uuid:${i.id}` }))) },
        { title: "Allergies", entry: allergies.map((a) => ({ reference: `urn:uuid:${a.id}` })) },
        { title: "Advice", text: { status: "generated", div: `<div xmlns="http://www.w3.org/1999/xhtml">${cs.advice ?? "—"}</div>` } },
      ],
    },
  };

  return {
    resourceType: "Bundle",
    id: `bundle-${cs.id}`,
    type: "document",
    timestamp: new Date().toISOString(),
    meta: {
      profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentBundle"],
      lastUpdated: cs.updated_at,
    },
    entry: [composition, ...entries],
  };
}
