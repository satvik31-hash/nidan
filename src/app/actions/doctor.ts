"use server";

import { revalidatePath } from "next/cache";
import { requireDoctor } from "@/lib/auth";
import {
  AccessDenied, amendCaseSheet, breakGlass, caseSheet, db, documentsFor, finalizeCaseSheet,
  getProfile, issuePrescription, notifyPatient, orderInvestigations, patientHeader,
  recordVitals, requestAccess, saveCaseSheet, setAppointmentStatus, startConsultation,
  vitalsFor, caseSheetsFor, setAvailability, availabilityFor, InvalidAvailability,
  type AvailabilityBlock,
} from "@/lib/db/store";
import { summariseCase, synthesiseHistory } from "@/lib/ai";
import type { CaseSheet, Vitals } from "@/lib/types";

// A write can throw "No such case sheet" not because the sheet is missing,
// but because this demo's in-memory store is per-server-instance: a case
// sheet created a moment ago on one instance genuinely isn't in another's
// memory yet. Turning that into an unhandled exception crashes the whole
// page (Next.js's error boundary) instead of the one action that failed —
// this maps it to a typed {ok:false} result every write action returns
// instead, same shape autosave already used, so the form stays intact and
// the doctor can just retry.
function writeError(e: unknown): { ok: false; error: string } {
  if (e instanceof AccessDenied) return { ok: false, error: "You don't have access to this record." };
  const msg = e instanceof Error ? e.message : "Something went wrong.";
  return {
    ok: false,
    error: msg === "No such case sheet"
      ? "Could not save just now — please try again in a few seconds."
      : msg,
  };
}

export async function startConsult(appointmentId: string) {
  const s = await requireDoctor();
  const cs = startConsultation(s.userId, appointmentId);
  revalidatePath("/doctor");
  return { ok: true as const, id: cs.id };
}

/** Autosave every field, every two seconds. A draft case sheet must survive
 *  a dropped connection: the client writes optimistically and this
 *  reconciles in the background. */
export async function autosave(id: string, patch: Partial<CaseSheet>) {
  const s = await requireDoctor();
  try {
    const cs = saveCaseSheet(s.userId, id, patch);
    return { ok: true as const, at: cs.updated_at };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

export async function saveVitals(caseSheetId: string, v: Partial<Vitals>) {
  const s = await requireDoctor();
  try {
    recordVitals(s.userId, caseSheetId, v);
    return { ok: true as const };
  } catch (e) {
    return writeError(e);
  }
}

export async function prescribe(
  caseSheetId: string,
  items: { drug_id: number | null; drug_text: string; dose: string; frequency: string; route: string; timing: string | null; duration_days: number | null; quantity: number | null; instructions: string | null }[],
) {
  const s = await requireDoctor();
  try {
    const rx = issuePrescription(s.userId, caseSheetId, items);
    revalidatePath(`/doctor/case/${caseSheetId}`);
    return { ok: true as const, id: rx.id, token: rx.verify_token };
  } catch (e) {
    return writeError(e);
  }
}

export async function orderTests(caseSheetId: string, tests: { test_name: string; panel?: string; urgency?: "routine" | "urgent" | "stat" }[]) {
  await requireDoctor();
  try {
    const rows = orderInvestigations(caseSheetId, tests);
    revalidatePath(`/doctor/case/${caseSheetId}`);
    return { ok: true as const, count: rows.length };
  } catch (e) {
    return writeError(e);
  }
}

/** One button, one confirmation. The sheet becomes immutable, derived rows
 *  are written, a visit summary is pushed to the patient's timeline, and the
 *  AI summary job is queued. */
export async function finalize(id: string) {
  const s = await requireDoctor();
  const actor = { id: s.userId, role: "doctor" as const };
  const before = caseSheet(actor, id);
  if (!before) {
    return { ok: false as const, error: "Could not save just now — please try again in a few seconds." };
  }

  const patient = patientHeader(before.patient_id)!;
  const vitals = vitalsFor(actor, before.patient_id).find((v) => v.case_sheet_id === id);

  const summary = await summariseCase(before, {
    patientName: patient.full_name, age: patient.age, sex: patient.sex, vitals,
  });
  try {
    // Cached on the row: the demo reads the cache, so a network blip is invisible.
    saveCaseSheet(s.userId, id, { ai_summary: summary.text });
    const cs = finalizeCaseSheet(s.userId, id);

    notifyPatient(
      cs.patient_id,
      `Your visit summary from ${getProfile(s.userId)?.full_name} is now in your Nidan records.`,
    );
    revalidatePath(`/doctor/case/${id}`);
    revalidatePath("/doctor");
    return { ok: true as const, summary: summary.text, source: summary.source };
  } catch (e) {
    return writeError(e);
  }
}

/** Corrections after finalize create a linked amendment. They never
 *  overwrite. This is how real EMRs work and it is a five-second answer
 *  that signals seriousness. */
export async function amend(id: string) {
  const s = await requireDoctor();
  try {
    const copy = amendCaseSheet(s.userId, id);
    revalidatePath("/doctor");
    return { ok: true as const, id: copy.id };
  } catch (e) {
    return writeError(e);
  }
}

export async function askAccess(patientId: string) {
  const s = await requireDoctor();
  const req = requestAccess(s.userId, patientId);
  notifyPatient(
    patientId,
    `${getProfile(s.userId)?.full_name} is asking to open your health record. Approve it in Nidan with the code ${req.otp}.`,
  );
  revalidatePath(`/doctor/patient/${patientId}`);
  return { ok: true as const, id: req.id };
}

export async function checkIn(appointmentId: string) {
  await requireDoctor();
  setAppointmentStatus(appointmentId, "checked_in");
  revalidatePath("/doctor");
  return { ok: true as const };
}

/** "Summarise this patient's last two years" — the thing that is genuinely
 *  impossible on paper. */
export async function synthesise(patientId: string) {
  const s = await requireDoctor();
  const actor = { id: s.userId, role: "doctor" as const };
  const sheets = caseSheetsFor(actor, patientId);
  const reports = documentsFor(actor, patientId);
  const p = patientHeader(patientId)!;
  const r = await synthesiseHistory(sheets, reports, { patientName: p.full_name, age: p.age });
  return { text: r.text, source: r.source };
}

/** Break-glass from the doctor console: the QR token, typed. */
export async function emergencyOpen(token: string) {
  const s = await requireDoctor();
  const data = breakGlass(token, s.userId, null);
  return data ? { ok: true as const, patientName: data.name } : { ok: false as const };
}

/** Save the current sheet as a reusable template. A doctor sees forty fever
 *  cases a week; applying one in a click and editing the differences is the
 *  single biggest real-world time saver, and it costs one table. */
export interface Template { id: string; doctor_id: string; name: string; body: Partial<CaseSheet> }
const templates: Template[] = [];

export async function saveTemplate(caseSheetId: string, name: string) {
  const s = await requireDoctor();
  const cs = db.caseSheets.find((c) => c.id === caseSheetId);
  if (!cs) return { ok: false as const, error: "No such case sheet" };
  const { chief_complaints, hopi, past_history, personal_history, general_exam, systemic_exam, advice } = cs;
  templates.unshift({
    id: `tpl-${crypto.randomUUID()}`, doctor_id: s.userId, name,
    body: { chief_complaints, hopi, past_history, personal_history, general_exam, systemic_exam, advice },
  });
  return { ok: true as const };
}

export async function listTemplates() {
  const s = await requireDoctor();
  return templates
    .filter((t) => t.doctor_id === s.userId)
    .map((t) => ({ id: t.id, name: t.name }));
}

export async function applyTemplate(caseSheetId: string, templateId: string) {
  const s = await requireDoctor();
  const tpl = templates.find((t) => t.id === templateId && t.doctor_id === s.userId);
  if (!tpl) return { ok: false as const, error: "No such template" };
  try {
    saveCaseSheet(s.userId, caseSheetId, tpl.body);
    revalidatePath(`/doctor/case/${caseSheetId}`);
    return { ok: true as const, body: tpl.body };
  } catch (e) {
    return writeError(e);
  }
}

/**
 * Rewrite one weekday of the signed-in doctor's clinic hours.
 *
 * A doctor can only ever write their own availability — the session supplies
 * the doctor id, never the client. Validation lives in the store so the SQL
 * path and the mock path reject exactly the same things.
 */
export async function saveAvailability(
  hospitalId: string,
  weekday: number,
  blocks: AvailabilityBlock[],
) {
  const s = await requireDoctor();
  try {
    setAvailability(s.userId, hospitalId, weekday, blocks);
  } catch (e) {
    if (e instanceof InvalidAvailability) return { ok: false as const, error: e.message };
    throw e;
  }
  // The booking wizard reads slots derived from these rules, so both sides
  // of the app have to forget what they cached.
  revalidatePath("/doctor/profile");
  revalidatePath("/patient/book");
  return {
    ok: true as const,
    rules: availabilityFor(s.userId).map((a) => ({
      id: a.id, hospital_id: a.hospital_id, weekday: a.weekday,
      start_time: a.start_time, end_time: a.end_time, slot_minutes: a.slot_minutes,
    })),
  };
}
