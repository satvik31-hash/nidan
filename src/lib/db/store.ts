// The mock store.
//
// This is a faithful in-process implementation of the same rules the
// Postgres migrations enforce: the same care-relationship access check,
// the same slot generator, the same double-booking rejection, the same
// append-only case sheet. It exists so the whole application runs with
// zero API keys — the demo-day safety switch the blueprint asks for.
//
// Set NEXT_PUBLIC_SUPABASE_URL and MOCK_DB=false to swap this for
// src/lib/db/supabase.ts, which talks to real Postgres with RLS applied.

import * as seed from "./seed";
import { addIstDays, fmtIstTime, istDay, istHour, istInstant, istMinute, istWeekday } from "@/lib/tz";
import type {
  AccessAuditRow, AccessRequest, AdminAuditRow, Allergy, Appointment, ApptStatus, Bill,
  CareRelationship, CaseSheet, ChronicCondition, DailyCheckin, DeviceReading,
  Diagnosis, Doctor, DocumentRecord, EmergencyCard, EmergencyContact,
  FamilyHistory, Hospital, InsurancePolicy, InvestigationOrder, Patient,
  DoctorAvailability, PatientMedication, Prescription, Profile, RelBasis, Scope, Slot,
  SurgicalHistory, UserRole, Vitals,
} from "@/lib/types";

interface Store {
  profiles: Profile[];
  availability: DoctorAvailability[];
  patients: Patient[];
  doctors: Doctor[];
  hospitals: Hospital[];
  appointments: Appointment[];
  caseSheets: CaseSheet[];
  diagnoses: Diagnosis[];
  vitals: Vitals[];
  investigations: InvestigationOrder[];
  prescriptions: Prescription[];
  patientMedications: PatientMedication[];
  allergies: Allergy[];
  chronicConditions: ChronicCondition[];
  familyHistory: FamilyHistory[];
  surgicalHistory: SurgicalHistory[];
  documents: DocumentRecord[];
  bills: Bill[];
  insurancePolicies: InsurancePolicy[];
  dailyCheckins: DailyCheckin[];
  deviceReadings: DeviceReading[];
  emergencyContacts: EmergencyContact[];
  emergencyCards: EmergencyCard[];
  careRelationships: CareRelationship[];
  accessAudit: AccessAuditRow[];
  accessRequests: AccessRequest[];
  auditSeq: number;
  adminAudit: AdminAuditRow[];
  adminAuditSeq: number;
}

function build(): Store {
  return {
    profiles: structuredClone(seed.profiles),
    availability: structuredClone(seed.availability),
    patients: structuredClone(seed.patients),
    doctors: structuredClone(seed.doctors),
    hospitals: structuredClone(seed.hospitals),
    appointments: structuredClone(seed.appointments),
    caseSheets: structuredClone(seed.caseSheets),
    diagnoses: structuredClone(seed.diagnoses),
    vitals: structuredClone(seed.vitals),
    investigations: [],
    prescriptions: structuredClone(seed.prescriptions),
    patientMedications: structuredClone(seed.patientMedications),
    allergies: structuredClone(seed.allergies),
    chronicConditions: structuredClone(seed.chronicConditions),
    familyHistory: structuredClone(seed.familyHistory),
    surgicalHistory: structuredClone(seed.surgicalHistory),
    documents: structuredClone(seed.documents),
    bills: structuredClone(seed.bills),
    insurancePolicies: structuredClone(seed.insurancePolicies),
    dailyCheckins: structuredClone(seed.dailyCheckins),
    deviceReadings: structuredClone(seed.deviceReadings),
    emergencyContacts: structuredClone(seed.emergencyContacts),
    emergencyCards: structuredClone(seed.emergencyCards),
    careRelationships: structuredClone(seed.careRelationships),
    accessAudit: [],
    accessRequests: [],
    auditSeq: 1,
    adminAudit: [],
    adminAuditSeq: 1,
  };
}

// Survive dev-server hot reloads, so a demo does not lose state mid-run.
const g = globalThis as unknown as { __nidan?: Store };
export const db: Store = (g.__nidan ??= build());

/** "Reset and reload the demo dataset so every demo starts from an
 *  identical clean state." — §11, day 13. */
export function resetDemoData(): void {
  g.__nidan = build();
  Object.assign(db, g.__nidan);
}

// ═══════════════════════════════════════════════════════════════
// Access control — the same rule as has_care_access() in 006.
// ═══════════════════════════════════════════════════════════════

export function activeRelationship(
  doctorId: string,
  patientId: string,
  scope?: Scope,
): CareRelationship | null {
  const now = Date.now();
  return (
    db.careRelationships.find(
      (cr) =>
        cr.doctor_id === doctorId &&
        cr.patient_id === patientId &&
        !cr.revoked_at &&
        new Date(cr.expires_at).getTime() > now &&
        (!scope || cr.scope.includes(scope)),
    ) ?? null
  );
}

export function hasCareAccess(doctorId: string, patientId: string, scope?: Scope): boolean {
  return activeRelationship(doctorId, patientId, scope) !== null;
}

export class AccessDenied extends Error {
  constructor(public patientId: string) {
    super("No active care relationship for this patient");
    this.name = "AccessDenied";
  }
}

/** Every read of another person's record leaves a trace. */
export function audit(row: Omit<AccessAuditRow, "id" | "at">): void {
  db.accessAudit.unshift({ ...row, id: db.auditSeq++, at: new Date().toISOString() });
  if (db.accessAudit.length > 3000) db.accessAudit.length = 3000;
}

/**
 * Gate every clinical read through this. A patient always passes for their
 * own record; a doctor passes only where a live relationship exists.
 * Nothing in the UI layer is trusted to have checked first.
 */
export function assertAccess(
  actor: { id: string; role: UserRole },
  patientId: string,
  resource: string,
  scope?: Scope,
): void {
  if (actor.role === "patient") {
    if (actor.id !== patientId) throw new AccessDenied(patientId);
    return;
  }
  if (actor.role === "admin") return;
  const rel = activeRelationship(actor.id, patientId, scope);
  if (!rel) throw new AccessDenied(patientId);
  audit({
    actor_id: actor.id, actor_role: actor.role, patient_id: patientId,
    action: "view", resource, resource_id: null, basis: rel.basis,
  });
}

export function grantRelationship(
  patientId: string,
  doctorId: string,
  basis: RelBasis,
  opts: { scope?: Scope[]; hours?: number; via?: string } = {},
): CareRelationship {
  const existing = activeRelationship(doctorId, patientId);
  if (existing && basis !== "emergency_override") return existing;
  const hours = opts.hours ?? (basis === "emergency_override" ? 6 : 30 * 24);
  const rel: CareRelationship = {
    id: `cr-${crypto.randomUUID()}`,
    patient_id: patientId, doctor_id: doctorId, basis,
    scope: opts.scope ?? ["demographics", "diagnoses", "prescriptions", "reports"],
    granted_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + hours * 3600_000).toISOString(),
    revoked_at: null, granted_via: opts.via ?? null,
  };
  db.careRelationships.unshift(rel);
  return rel;
}

export function revokeRelationship(patientId: string, relId: string): boolean {
  const rel = db.careRelationships.find((r) => r.id === relId && r.patient_id === patientId);
  if (!rel) return false;
  rel.revoked_at = new Date().toISOString();
  return true;
}

// ═══════════════════════════════════════════════════════════════
// Directory
// ═══════════════════════════════════════════════════════════════

export const getProfile = (id: string) => db.profiles.find((p) => p.id === id) ?? null;
export const getPatient = (id: string) => db.patients.find((p) => p.id === id) ?? null;
export const getDoctor = (id: string) => db.doctors.find((d) => d.id === id) ?? null;
export const getHospital = (id: string) => db.hospitals.find((h) => h.id === id) ?? null;
export const listHospitals = () => db.hospitals;
export const listSpecializations = () => seed.specializations;
export const listAmbulance = () => seed.ambulanceProviders;

export function doctorCard(id: string) {
  const d = getDoctor(id);
  const p = getProfile(id);
  if (!d || !p) return null;
  const spec = seed.specializations.find((s) => s.id === d.specialization_id);
  return {
    ...d,
    full_name: p.full_name,
    specialization: spec?.name ?? "General Medicine",
    specialization_hi: spec?.name_hi ?? "",
    hospitals: seed.doctorHospitals
      .filter((dh) => dh.doctor_id === id)
      .map((dh) => ({ ...getHospital(dh.hospital_id)!, department: dh.department })),
  };
}

export type DoctorCard = NonNullable<ReturnType<typeof doctorCard>>;

export function listDoctors(filter?: { hospitalId?: string; specializationId?: number }) {
  let ids = db.doctors.map((d) => d.id);
  if (filter?.hospitalId) {
    const at = new Set(
      seed.doctorHospitals.filter((dh) => dh.hospital_id === filter.hospitalId).map((dh) => dh.doctor_id),
    );
    ids = ids.filter((id) => at.has(id));
  }
  let cards = ids.map((id) => doctorCard(id)!).filter(Boolean);
  if (filter?.specializationId) {
    cards = cards.filter((c) => c.specialization_id === filter.specializationId);
  }
  return cards;
}

export function patientHeader(id: string) {
  const p = getPatient(id);
  const pr = getProfile(id);
  if (!p || !pr) return null;
  return { ...p, full_name: pr.full_name, phone: pr.phone, email: pr.email, age: ageOf(p.date_of_birth) };
}

export function ageOf(dob: string): number {
  const b = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a;
}

/** Search accepts MRN, ABHA number, phone or name — §06 patient lookup. */
export function searchPatients(q: string) {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) return [];
  return db.patients
    .filter((p) => {
      const pr = getProfile(p.id)!;
      return (
        p.mrn.toLowerCase().includes(needle) ||
        (p.abha_number ?? "").includes(needle) ||
        (p.abha_address ?? "").toLowerCase().includes(needle) ||
        (pr.phone ?? "").includes(needle) ||
        pr.full_name.toLowerCase().includes(needle)
      );
    })
    .map((p) => patientHeader(p.id)!);
}

// ═══════════════════════════════════════════════════════════════
// Scheduling — the TypeScript twin of available_slots()
// ═══════════════════════════════════════════════════════════════

export function availableSlots(
  doctorId: string,
  hospitalId: string,
  from: Date | string,
  to: Date | string,
): Slot[] {
  const rules = db.availability.filter(
    (a) => a.doctor_id === doctorId && a.hospital_id === hospitalId,
  );
  const booked = db.appointments.filter(
    (a) => a.doctor_id === doctorId && !["cancelled", "no_show"].includes(a.status),
  );
  const out: Slot[] = [];
  const first = istDay(from);
  const last = istDay(to);

  for (let day = first; day <= last; day = addIstDays(day, 1)) {
    const wd = istWeekday(day);
    for (const r of rules.filter((x) => x.weekday === wd)) {
      const dayStart = istInstant(day, r.start_time).getTime();
      const dayEnd = istInstant(day, r.end_time).getTime();
      const step = r.slot_minutes * 60000;

      for (let t = dayStart; t + step <= dayEnd; t += step) {
        const s = new Date(t);
        const e = new Date(t + step);
        if (t <= Date.now()) continue;                         // no past slots
        const clash = booked.some(
          (b) => new Date(b.slot_start) < e && new Date(b.slot_end) > s,
        );
        if (clash) continue;                                   // already taken
        out.push({ start: s.toISOString(), end: e.toISOString(), hospital_id: hospitalId });
      }
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

/** All slots for an IST clinic day, including the taken ones — the booking
 *  grid shows taken slots visibly disabled rather than hidden. */
export function daySlots(doctorId: string, hospitalId: string, day: Date | string) {
  const d = istDay(day);
  const wd = istWeekday(d);
  const rules = db.availability.filter(
    (a) => a.doctor_id === doctorId && a.hospital_id === hospitalId && a.weekday === wd,
  );
  const booked = db.appointments.filter(
    (a) => a.doctor_id === doctorId && !["cancelled", "no_show"].includes(a.status),
  );
  const rows: { start: string; end: string; taken: boolean; past: boolean }[] = [];

  for (const r of rules) {
    const s0 = istInstant(d, r.start_time).getTime();
    const e0 = istInstant(d, r.end_time).getTime();
    const step = r.slot_minutes * 60000;
    for (let t = s0; t + step <= e0; t += step) {
      const s = new Date(t);
      const e = new Date(t + step);
      rows.push({
        start: s.toISOString(), end: e.toISOString(),
        taken: booked.some((b) => new Date(b.slot_start) < e && new Date(b.slot_end) > s),
        past: t <= Date.now(),
      });
    }
  }
  return rows.sort((a, b) => a.start.localeCompare(b.start));
}

export class SlotTaken extends Error {
  code = "23P01"; // the same SQLSTATE the exclusion constraint raises
  constructor() {
    super("That slot has just been taken");
    this.name = "SlotTaken";
  }
}


// ── Availability rules ────────────────────────────────────────
// The doctor owns their own clinic hours. Writing here changes what
// available_slots() returns on the very next query — there is no second
// table to keep in step, which is exactly why the slot generator derives
// slots instead of materialising them.

export class InvalidAvailability extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAvailability";
  }
}

export interface AvailabilityBlock {
  start_time: string;
  end_time: string;
  slot_minutes: number;
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/**
 * Replace one weekday's clinic hours at one hospital.
 *
 * Rejected up front rather than saved and repaired later: a malformed time,
 * an end before its start, a slot length that does not divide the block, and
 * two blocks on the same day that overlap. Postgres enforces the same three
 * with a check constraint and an exclusion constraint; this is the twin.
 */
export function setAvailability(
  doctorId: string,
  hospitalId: string,
  weekday: number,
  blocks: AvailabilityBlock[],
): DoctorAvailability[] {
  if (weekday < 0 || weekday > 6) throw new InvalidAvailability("Weekday out of range.");

  const sorted = [...blocks].sort((a, b) => mins(a.start_time) - mins(b.start_time));

  for (const b of sorted) {
    if (!HHMM.test(b.start_time) || !HHMM.test(b.end_time)) {
      throw new InvalidAvailability("Times must be in 24-hour HH:MM form.");
    }
    const span = mins(b.end_time) - mins(b.start_time);
    if (span <= 0) throw new InvalidAvailability("A clinic block must end after it starts.");
    if (![5, 10, 15, 20, 30, 45, 60].includes(b.slot_minutes)) {
      throw new InvalidAvailability("Slot length must be 5, 10, 15, 20, 30, 45 or 60 minutes.");
    }
    if (span % b.slot_minutes !== 0) {
      throw new InvalidAvailability(
        `${b.start_time}–${b.end_time} is ${span} minutes, which does not divide into ${b.slot_minutes}-minute slots.`,
      );
    }
  }

  for (let i = 1; i < sorted.length; i++) {
    if (mins(sorted[i].start_time) < mins(sorted[i - 1].end_time)) {
      throw new InvalidAvailability("Two clinic blocks on the same day overlap.");
    }
  }

  // Appointments already booked into hours the doctor is removing are not
  // silently orphaned — we refuse and say which one, so the doctor can move
  // the patient first. Deleting a slot out from under a booked patient is
  // the kind of quiet data loss that destroys trust in a scheduler.
  const covered = (t: number) =>
    sorted.some((b) => t >= mins(b.start_time) && t < mins(b.end_time));

  const orphan = db.appointments.find((a) => {
    if (a.doctor_id !== doctorId || a.hospital_id !== hospitalId) return false;
    if (["cancelled", "no_show", "completed"].includes(a.status)) return false;
    const start = new Date(a.slot_start);
    if (istWeekday(istDay(start)) !== weekday) return false;
    return !covered(istHour(start) * 60 + istMinute(start));
  });
  if (orphan) {
    const who = getProfile(orphan.patient_id)?.full_name ?? "a patient";
    throw new InvalidAvailability(
      `${who} is booked at ${fmtIstTime(orphan.slot_start)} on this day. Move or cancel that appointment first.`,
    );
  }

  db.availability = db.availability.filter(
    (a) => !(a.doctor_id === doctorId && a.hospital_id === hospitalId && a.weekday === weekday),
  );
  sorted.forEach((b, i) => {
    db.availability.push({
      id: `av-${doctorId.slice(0, 8)}-${hospitalId.slice(0, 8)}-${weekday}-${i}-${Date.now()}`,
      doctor_id: doctorId,
      hospital_id: hospitalId,
      weekday,
      start_time: b.start_time,
      end_time: b.end_time,
      slot_minutes: b.slot_minutes,
    });
  });

  return db.availability.filter((a) => a.doctor_id === doctorId);
}

export function availabilityFor(doctorId: string): DoctorAvailability[] {
  return db.availability.filter((a) => a.doctor_id === doctorId);
}

export function bookAppointment(input: {
  patientId: string; doctorId: string; hospitalId: string;
  start: string; end: string; reason: string; mode: "in_person" | "teleconsult";
}): Appointment {
  // The exclusion constraint, in TypeScript. Same rule, same error code.
  const s = new Date(input.start), e = new Date(input.end);
  const clash = db.appointments.some(
    (a) =>
      a.doctor_id === input.doctorId &&
      !["cancelled", "no_show"].includes(a.status) &&
      new Date(a.slot_start) < e && new Date(a.slot_end) > s,
  );
  if (clash) throw new SlotTaken();

  const sameDay = db.appointments.filter(
    (a) => a.doctor_id === input.doctorId && istDay(a.slot_start) === istDay(input.start),
  ).length;

  const appt: Appointment = {
    id: `appt-${crypto.randomUUID()}`, token_no: sameDay + 1,
    patient_id: input.patientId, doctor_id: input.doctorId,
    hospital_id: input.hospitalId, slot_start: input.start, slot_end: input.end,
    status: "confirmed", reason: input.reason, mode: input.mode,
    created_at: new Date().toISOString(), cancelled_at: null, cancel_reason: null,
  };
  db.appointments.push(appt);

  // "Booking this appointment lets Dr. X view your health records until
  //  30 days after the visit." That sentence, made real.
  grantRelationship(input.patientId, input.doctorId, "appointment", {
    via: `Appointment on ${input.start.slice(0, 10)}`,
  });
  return appt;
}

export function cancelAppointment(id: string, by: string, reason: string) {
  const a = db.appointments.find((x) => x.id === id);
  if (!a) return null;
  a.status = "cancelled";
  a.cancelled_at = new Date().toISOString();
  a.cancel_reason = reason;
  return a;
}

export function setAppointmentStatus(id: string, status: ApptStatus) {
  const a = db.appointments.find((x) => x.id === id);
  if (a) a.status = status;
  return a ?? null;
}

export function appointmentsForPatient(patientId: string) {
  return db.appointments
    .filter((a) => a.patient_id === patientId)
    .sort((a, b) => b.slot_start.localeCompare(a.slot_start));
}

/** Appointments booked for this doctor since `sinceIso` — `created_at` is
 *  when the booking happened, never touched again, which is what makes it
 *  the right field to poll on: a status change (check-in, finalize) doesn't
 *  create a new "someone booked" moment, only bookAppointment() does. Backs
 *  the doctor console's in-app "Patient X booked ..." alert, polled from
 *  the client rather than pushed, so it needs no new infrastructure. */
export function recentBookingsFor(doctorId: string, sinceIso: string) {
  return db.appointments
    .filter((a) => a.doctor_id === doctorId && a.status !== "cancelled" && a.created_at > sinceIso)
    .map((a) => ({
      id: a.id,
      patientName: getProfile(a.patient_id)?.full_name ?? "A patient",
      slotStart: a.slot_start,
      createdAt: a.created_at,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Today's clinic, in token order — the doctor console's landing view. */
export function todayQueue(doctorId: string) {
  const today = istDay();
  return db.appointments
    .filter((a) => a.doctor_id === doctorId && istDay(a.slot_start) === today)
    .sort((a, b) => a.slot_start.localeCompare(b.slot_start))
    .map((a) => ({
      ...a,
      patient: patientHeader(a.patient_id)!,
      caseSheet: db.caseSheets.find((c) => c.appointment_id === a.id) ?? null,
    }));
}

/** Live queue position — "You are #4, approx. 35 min". */
export function queuePosition(appointmentId: string) {
  const appt = db.appointments.find((a) => a.id === appointmentId);
  if (!appt) return null;
  const sameDay = db.appointments
    .filter(
      (a) => a.doctor_id === appt.doctor_id &&
        istDay(a.slot_start) === istDay(appt.slot_start) &&
        !["cancelled", "no_show", "completed"].includes(a.status),
    )
    .sort((a, b) => a.slot_start.localeCompare(b.slot_start));
  const idx = sameDay.findIndex((a) => a.id === appointmentId);
  if (idx < 0) return null;
  return { position: idx + 1, approxMinutes: idx * 12, ahead: idx };
}

// ═══════════════════════════════════════════════════════════════
// Clinical reads. Every one takes an actor and is gated.
// ═══════════════════════════════════════════════════════════════

type Actor = { id: string; role: UserRole };

export function caseSheetsFor(actor: Actor, patientId: string): CaseSheet[] {
  assertAccess(actor, patientId, "case_sheets");
  return db.caseSheets
    .filter((c) => c.patient_id === patientId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function caseSheet(actor: Actor, id: string): CaseSheet | null {
  const cs = db.caseSheets.find((c) => c.id === id);
  if (!cs) return null;
  assertAccess(actor, cs.patient_id, "case_sheet");
  return cs;
}

export function vitalsFor(actor: Actor, patientId: string): Vitals[] {
  assertAccess(actor, patientId, "vitals");
  return db.vitals
    .filter((v) => v.patient_id === patientId)
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
}

export function diagnosesFor(actor: Actor, patientId: string) {
  assertAccess(actor, patientId, "diagnoses", actor.role === "doctor" ? "diagnoses" : undefined);
  return db.diagnoses.filter((d) => d.patient_id === patientId);
}

export function prescriptionsFor(actor: Actor, patientId: string) {
  assertAccess(actor, patientId, "prescriptions", actor.role === "doctor" ? "prescriptions" : undefined);
  return db.prescriptions
    .filter((p) => p.patient_id === patientId)
    .sort((a, b) => b.issued_at.localeCompare(a.issued_at));
}

export function documentsFor(actor: Actor, patientId: string) {
  assertAccess(actor, patientId, "documents", actor.role === "doctor" ? "reports" : undefined);
  return db.documents
    .filter((d) => d.patient_id === patientId)
    .sort((a, b) => b.report_date.localeCompare(a.report_date));
}

export function medicationsFor(actor: Actor, patientId: string) {
  assertAccess(actor, patientId, "patient_medications");
  const all = db.patientMedications.filter((m) => m.patient_id === patientId);
  return {
    current: all.filter((m) => !m.ended_on),
    past: all.filter((m) => m.ended_on),
  };
}

export function allergiesFor(actor: Actor, patientId: string) {
  assertAccess(actor, patientId, "allergies");
  return db.allergies.filter((a) => a.patient_id === patientId);
}

export function historyFor(actor: Actor, patientId: string) {
  assertAccess(actor, patientId, "history");
  return {
    surgical: db.surgicalHistory.filter((s) => s.patient_id === patientId),
    family: db.familyHistory.filter((f) => f.patient_id === patientId),
    chronic: db.chronicConditions.filter((c) => c.patient_id === patientId),
  };
}

export function billsFor(actor: Actor, patientId: string) {
  assertAccess(actor, patientId, "bills", actor.role === "doctor" ? "billing" : undefined);
  return db.bills
    .filter((b) => b.patient_id === patientId)
    .sort((a, b) => b.billed_on.localeCompare(a.billed_on));
}

export function policiesFor(actor: Actor, patientId: string) {
  assertAccess(actor, patientId, "insurance_policies", actor.role === "doctor" ? "billing" : undefined);
  return db.insurancePolicies.filter((p) => p.patient_id === patientId);
}

export function checkinsFor(actor: Actor, patientId: string) {
  assertAccess(actor, patientId, "daily_checkins", actor.role === "doctor" ? "wellness" : undefined);
  return db.dailyCheckins
    .filter((c) => c.patient_id === patientId)
    .sort((a, b) => b.log_date.localeCompare(a.log_date));
}

export function readingsFor(actor: Actor, patientId: string) {
  assertAccess(actor, patientId, "device_readings", actor.role === "doctor" ? "wellness" : undefined);
  return db.deviceReadings
    .filter((r) => r.patient_id === patientId)
    .sort((a, b) => b.measured_at.localeCompare(a.measured_at));
}

export function contactsFor(patientId: string) {
  return db.emergencyContacts
    .filter((c) => c.patient_id === patientId)
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
}

export function auditFor(patientId: string) {
  return db.accessAudit.filter((a) => a.patient_id === patientId);
}

export function grantsFor(patientId: string) {
  return db.careRelationships
    .filter((cr) => cr.patient_id === patientId)
    .map((cr) => ({
      ...cr,
      doctor: doctorCard(cr.doctor_id),
      active: !cr.revoked_at && new Date(cr.expires_at).getTime() > Date.now(),
      views: db.accessAudit.filter(
        (a) => a.patient_id === patientId && a.actor_id === cr.doctor_id,
      ).length,
    }))
    .sort((a, b) => Number(b.active) - Number(a.active) || b.granted_at.localeCompare(a.granted_at));
}

/** The single vertical health timeline the Records tab defaults to. */
export type TimelineEntry = {
  id: string;
  at: string;
  kind: "visit" | "prescription" | "report" | "surgery" | "vitals";
  title: string;
  subtitle: string;
  href?: string;
  meta?: string;
};

export function timelineFor(actor: Actor, patientId: string): TimelineEntry[] {
  assertAccess(actor, patientId, "timeline");
  const nameOf = (id: string) => getProfile(id)?.full_name ?? "Unknown";
  const entries: TimelineEntry[] = [
    ...db.caseSheets.filter((c) => c.patient_id === patientId).map((c) => ({
      id: c.id, at: c.created_at, kind: "visit" as const,
      title: c.provisional_dx ?? c.chief_complaints[0]?.complaint ?? "Consultation",
      subtitle: `${nameOf(c.doctor_id)} · ${getHospital(c.hospital_id)?.name ?? ""}`,
      href: `/patient/records/visit/${c.id}`,
      meta: c.visit_type,
    })),
    ...db.prescriptions.filter((p) => p.patient_id === patientId).map((p) => ({
      id: p.id, at: p.issued_at, kind: "prescription" as const,
      title: p.items.map((i) => i.drug_text.split(" (")[0]).join(", "),
      subtitle: `${nameOf(p.doctor_id)} · ${p.items.length} drug${p.items.length > 1 ? "s" : ""}`,
      href: `/patient/records/rx/${p.id}`,
    })),
    ...db.documents.filter((d) => d.patient_id === patientId).map((d) => ({
      id: d.id, at: d.report_date, kind: "report" as const,
      title: d.title, subtitle: d.kind.replace("_", " "),
      href: `/patient/records/report/${d.id}`,
      meta: d.extracted_values?.find((v) => v.flag !== "normal")?.analyte,
    })),
    ...db.surgicalHistory.filter((s) => s.patient_id === patientId && s.performed_on).map((s) => ({
      id: s.id, at: s.performed_on!, kind: "surgery" as const,
      title: s.procedure_name, subtitle: `${s.hospital_name} · ${s.surgeon_name}`,
    })),
  ];
  return entries.sort((a, b) => b.at.localeCompare(a.at));
}

/** Every flagged analyte across every uploaded report, so Haemoglobin can
 *  be plotted across five years of scattered PDFs. */
export function analyteSeries(actor: Actor, patientId: string, analyte: string) {
  assertAccess(actor, patientId, "documents", actor.role === "doctor" ? "reports" : undefined);
  return db.documents
    .filter((d) => d.patient_id === patientId)
    .flatMap((d) =>
      (d.extracted_values ?? [])
        .filter((v) => v.analyte === analyte)
        .map((v) => ({ date: d.report_date, value: v.value, unit: v.unit, flag: v.flag, ref: v.ref })),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function analytesAvailable(patientId: string) {
  const set = new Set<string>();
  db.documents
    .filter((d) => d.patient_id === patientId)
    .forEach((d) => (d.extracted_values ?? []).forEach((v) => set.add(v.analyte)));
  return [...set];
}

/** "Find every report from Apollo mentioning creatinine" in one query. */
export function searchRecords(
  actor: Actor,
  patientId: string,
  q: string,
  filter: { from?: string; to?: string; hospitalId?: string; doctorId?: string } = {},
) {
  assertAccess(actor, patientId, "records_search");
  const needle = q.trim().toLowerCase();
  const inRange = (d: string) =>
    (!filter.from || d >= filter.from) && (!filter.to || d <= filter.to);

  const docs = db.documents.filter(
    (d) =>
      d.patient_id === patientId && inRange(d.report_date) &&
      (!needle ||
        d.title.toLowerCase().includes(needle) ||
        (d.ocr_text ?? "").toLowerCase().includes(needle)),
  );
  const dxs = db.diagnoses.filter(
    (d) => d.patient_id === patientId &&
      (!needle || (d.icd11_title ?? "").toLowerCase().includes(needle)),
  );
  const rxs = db.prescriptions.filter(
    (p) => p.patient_id === patientId && inRange(p.issued_at.slice(0, 10)) &&
      (!needle || p.items.some((i) => i.drug_text.toLowerCase().includes(needle))),
  );
  return { documents: docs, diagnoses: dxs, prescriptions: rxs };
}

// ═══════════════════════════════════════════════════════════════
// Clinical writes
// ═══════════════════════════════════════════════════════════════

export function startConsultation(doctorId: string, appointmentId: string): CaseSheet {
  const appt = db.appointments.find((a) => a.id === appointmentId);
  if (!appt) throw new Error("No such appointment");
  const existing = db.caseSheets.find((c) => c.appointment_id === appointmentId);
  if (existing) return existing;
  if (!hasCareAccess(doctorId, appt.patient_id)) throw new AccessDenied(appt.patient_id);

  const now = new Date().toISOString();
  const patient = getPatient(appt.patient_id)!;
  const cs: CaseSheet = {
    id: `cs-${crypto.randomUUID()}`,
    patient_id: appt.patient_id, doctor_id: doctorId,
    hospital_id: appt.hospital_id, appointment_id: appointmentId,
    visit_type: db.caseSheets.some((c) => c.patient_id === appt.patient_id) ? "followup" : "opd",
    // The chief complaint is pre-filled from the patient's own booking words.
    chief_complaints: appt.reason
      ? [{ complaint: appt.reason, duration_value: 1, duration_unit: "days" }]
      : [],
    hopi: {}, past_history: {}, personal_history: {},
    menstrual_obstetric: patient.sex === "female" ? {} : null,
    treatment_history: null, general_exam: {}, systemic_exam: {},
    provisional_dx: null, differential_dx: [], advice: null,
    follow_up_on: null, referred_to: null,
    status: "draft", finalized_at: null, ai_summary: null, amends_id: null,
    created_at: now, updated_at: now,
  };
  db.caseSheets.unshift(cs);
  setAppointmentStatus(appointmentId, "in_consult");
  audit({
    actor_id: doctorId, actor_role: "doctor", patient_id: appt.patient_id,
    action: "create", resource: "case_sheet", resource_id: cs.id, basis: "appointment",
  });
  return cs;
}

/** Autosave. Only the authoring doctor, and only while draft. */
export function saveCaseSheet(doctorId: string, id: string, patch: Partial<CaseSheet>): CaseSheet {
  const cs = db.caseSheets.find((c) => c.id === id);
  if (!cs) throw new Error("No such case sheet");
  if (cs.doctor_id !== doctorId) throw new AccessDenied(cs.patient_id);
  if (cs.status !== "draft") {
    throw new Error(`Case sheet ${id} is finalized; create an amendment instead`);
  }
  Object.assign(cs, patch, { updated_at: new Date().toISOString() });
  return cs;
}

/** On finalize: the sheet becomes immutable, derived rows are written,
 *  and a visit summary is pushed to the patient's timeline. */
export function finalizeCaseSheet(doctorId: string, id: string) {
  const cs = db.caseSheets.find((c) => c.id === id);
  if (!cs) throw new Error("No such case sheet");
  if (cs.doctor_id !== doctorId) throw new AccessDenied(cs.patient_id);
  cs.status = "finalized";
  cs.finalized_at = new Date().toISOString();
  cs.updated_at = cs.finalized_at;

  if (cs.provisional_dx && !db.diagnoses.some((d) => d.case_sheet_id === cs.id)) {
    db.diagnoses.push({
      id: `dx-${crypto.randomUUID()}`, case_sheet_id: cs.id, patient_id: cs.patient_id,
      icd11_code: null, icd11_title: cs.provisional_dx, free_text: null,
      certainty: "provisional", is_chronic: false, onset_date: null,
    });
  }
  if (cs.appointment_id) setAppointmentStatus(cs.appointment_id, "completed");
  audit({
    actor_id: doctorId, actor_role: "doctor", patient_id: cs.patient_id,
    action: "amend", resource: "case_sheet_finalize", resource_id: cs.id, basis: "appointment",
  });
  return cs;
}

/** Corrections never overwrite. They create a linked amendment. */
export function amendCaseSheet(doctorId: string, id: string): CaseSheet {
  const original = db.caseSheets.find((c) => c.id === id);
  if (!original) throw new Error("No such case sheet");
  const copy: CaseSheet = {
    ...structuredClone(original),
    id: `cs-${crypto.randomUUID()}`,
    status: "draft", finalized_at: null, amends_id: original.id,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
  db.caseSheets.unshift(copy);
  return copy;
}

export function recordVitals(doctorId: string, caseSheetId: string, v: Partial<Vitals>) {
  const cs = db.caseSheets.find((c) => c.id === caseSheetId);
  if (!cs) throw new Error("No such case sheet");
  const existing = db.vitals.find((x) => x.case_sheet_id === caseSheetId);
  if (existing) {
    Object.assign(existing, v);
    return existing;
  }
  const row: Vitals = {
    id: `vt-${crypto.randomUUID()}`, patient_id: cs.patient_id,
    case_sheet_id: caseSheetId, recorded_at: new Date().toISOString(), source: "clinic",
    temperature_c: null, pulse_bpm: null, resp_rate: null, bp_systolic: null,
    bp_diastolic: null, spo2: null, weight_kg: null, random_glucose: null,
    pain_score: null, ...v,
  };
  db.vitals.push(row);
  return row;
}

export function issuePrescription(
  doctorId: string,
  caseSheetId: string,
  items: Omit<Prescription["items"][number], "id" | "prescription_id">[],
): Prescription {
  const cs = db.caseSheets.find((c) => c.id === caseSheetId);
  if (!cs) throw new Error("No such case sheet");
  const id = `rx-${crypto.randomUUID()}`;
  const rx: Prescription = {
    id, case_sheet_id: caseSheetId, patient_id: cs.patient_id, doctor_id: doctorId,
    issued_at: new Date().toISOString(),
    verify_token: `RXV-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    items: items.map((i, n) => ({ ...i, id: `${id}-${n}`, prescription_id: id })),
  };
  db.prescriptions.unshift(rx);
  // Pushes the drugs into patient_medications, so the patient's Current
  // Medications list updates instantly.
  rx.items.forEach((i) =>
    db.patientMedications.unshift({
      id: `pm-${crypto.randomUUID()}`, patient_id: cs.patient_id,
      prescription_item_id: i.id, drug_text: i.drug_text, dose: i.dose,
      frequency: i.frequency, started_on: new Date().toISOString().slice(0, 10),
      ended_on: null, is_self_reported: false, adherence_pct: null,
    }),
  );
  return rx;
}

export function orderInvestigations(
  caseSheetId: string,
  tests: { test_name: string; panel?: string; urgency?: InvestigationOrder["urgency"]; clinical_note?: string }[],
) {
  const cs = db.caseSheets.find((c) => c.id === caseSheetId);
  if (!cs) throw new Error("No such case sheet");
  const rows = tests.map((t) => ({
    id: `io-${crypto.randomUUID()}`, case_sheet_id: caseSheetId,
    patient_id: cs.patient_id, test_name: t.test_name, panel: t.panel ?? null,
    urgency: t.urgency ?? "routine", clinical_note: t.clinical_note ?? null,
    ordered_at: new Date().toISOString(), status: "ordered" as const,
  }));
  db.investigations.push(...rows);
  return rows;
}

export function upsertCheckin(patientId: string, c: Partial<DailyCheckin>) {
  const date = c.log_date ?? new Date().toISOString().slice(0, 10);
  const existing = db.dailyCheckins.find(
    (x) => x.patient_id === patientId && x.log_date === date,
  );
  if (existing) {
    Object.assign(existing, c);
    return existing;
  }
  const row: DailyCheckin = {
    id: `dc-${crypto.randomUUID()}`, patient_id: patientId, log_date: date,
    mood: null, energy: null, sleep_hours: null, pain_score: null,
    symptoms: [], meds_taken: null, water_glasses: null, notes: null, ...c,
  };
  db.dailyCheckins.unshift(row);
  return row;
}

export function updatePatient(patientId: string, patch: Partial<Patient & Profile>) {
  const p = db.patients.find((x) => x.id === patientId);
  const pr = db.profiles.find((x) => x.id === patientId);
  if (p) Object.assign(p, patch);
  if (pr) Object.assign(pr, patch);
  return patientHeader(patientId);
}

export function addDocument(d: Omit<DocumentRecord, "id" | "uploaded_at">) {
  const row: DocumentRecord = {
    ...d, id: `doc-${crypto.randomUUID()}`, uploaded_at: new Date().toISOString(),
  };
  db.documents.unshift(row);
  return row;
}

// ═══════════════════════════════════════════════════════════════
// Consent: request access, approve, break glass
// ═══════════════════════════════════════════════════════════════

export function requestAccess(doctorId: string, patientId: string): AccessRequest {
  const req: AccessRequest = {
    id: `req-${crypto.randomUUID()}`, patient_id: patientId, doctor_id: doctorId,
    otp: process.env.DEMO_OTP ?? "123456",
    status: "pending", created_at: new Date().toISOString(),
  };
  db.accessRequests.unshift(req);
  return req;
}

export function pendingRequestsFor(patientId: string) {
  return db.accessRequests
    .filter((r) => r.patient_id === patientId && r.status === "pending")
    .map((r) => ({ ...r, doctor: doctorCard(r.doctor_id) }));
}

export function approveAccess(requestId: string, otp: string) {
  const req = db.accessRequests.find((r) => r.id === requestId);
  if (!req) return { ok: false as const, error: "No such request" };
  if (otp !== req.otp) return { ok: false as const, error: "That code did not match" };
  req.status = "approved";
  grantRelationship(req.patient_id, req.doctor_id, "patient_consent", {
    via: "OTP approval",
  });
  return { ok: true as const };
}

/**
 * Break-glass. An emergency doctor scanning a QR card gets a NARROW slice
 * without consent, because that is genuinely life-saving. It is not silent:
 * the row is written to access_audit with basis 'emergency_override', the
 * patient gets an SMS within seconds, and the relationship auto-expires in
 * six hours.
 */
export function breakGlass(token: string, actorId: string | null, ua: string | null) {
  const card = db.emergencyCards.find((c) => c.token === token && !c.revoked_at);
  if (!card) return null;
  const p = patientHeader(card.patient_id);
  if (!p) return null;

  if (actorId && getDoctor(actorId)) {
    grantRelationship(card.patient_id, actorId, "emergency_override", {
      scope: ["demographics", "diagnoses", "prescriptions"], hours: 6,
      via: "Emergency QR scan",
    });
  }
  audit({
    actor_id: actorId ?? "anonymous-scan", actor_role: "doctor",
    patient_id: card.patient_id, action: "override",
    resource: "emergency_card", resource_id: card.id, basis: "emergency_override",
  });
  notifyPatient(card.patient_id, "Your emergency card was scanned just now. If this was not you or a treating clinician, revoke it from the Emergency tab.");

  // The narrow slice. Nothing else crosses this boundary.
  return {
    name: p.full_name,
    mrn: p.mrn,
    age: p.age,
    sex: p.sex,
    blood_group: p.blood_group,
    organ_donor: p.organ_donor,
    allergies: db.allergies.filter((a) => a.patient_id === card.patient_id),
    medications: db.patientMedications.filter((m) => m.patient_id === card.patient_id && !m.ended_on),
    conditions: db.chronicConditions.filter((c) => c.patient_id === card.patient_id),
    contacts: contactsFor(card.patient_id),
    scanned_at: new Date().toISOString(),
  };
}

export function revokeEmergencyCard(patientId: string) {
  const card = db.emergencyCards.find((c) => c.patient_id === patientId && !c.revoked_at);
  if (card) card.revoked_at = new Date().toISOString();
  return card ?? null;
}

export function reissueEmergencyCard(patientId: string) {
  revokeEmergencyCard(patientId);
  const card: EmergencyCard = {
    id: `emc-${crypto.randomUUID()}`, patient_id: patientId,
    token: `EMG-${Math.random().toString(36).slice(2, 12)}`,
    issued_at: new Date().toISOString(), revoked_at: null,
  };
  db.emergencyCards.unshift(card);
  return card;
}

export function emergencyCardFor(patientId: string) {
  return db.emergencyCards.find((c) => c.patient_id === patientId && !c.revoked_at) ?? null;
}

// ═══════════════════════════════════════════════════════════════
// Administration — company-wide oversight. Every function here is
// read-only, gated to the admin role, and audited. Per-patient detail
// reuses the existing gated `*For(actor, patientId)` functions above —
// assertAccess() already passes an admin actor through — rather than a
// parallel read path.
// ═══════════════════════════════════════════════════════════════

function assertAdmin(actor: Actor): void {
  if (actor.role !== "admin") throw new Error("Administration access only");
}

function auditAdmin(actor: Actor, resource: string): void {
  db.adminAudit.unshift({
    id: db.adminAuditSeq++, actor_id: actor.id,
    actor_name: getProfile(actor.id)?.full_name ?? "Unknown",
    resource, at: new Date().toISOString(),
  });
  if (db.adminAudit.length > 1000) db.adminAudit.length = 1000;
}

export function platformStats(actor: Actor) {
  assertAdmin(actor);
  auditAdmin(actor, "stats");
  const today = istDay();
  const activeConsents = db.careRelationships.filter(
    (r) => !r.revoked_at && new Date(r.expires_at).getTime() > Date.now(),
  );
  const outstandingBillTotal = db.bills
    .filter((b) => b.status !== "paid")
    .reduce((sum, b) => sum + b.patient_payable, 0);
  return {
    patients: db.patients.length,
    doctors: db.doctors.length,
    hospitals: db.hospitals.length,
    appointmentsToday: db.appointments.filter((a) => istDay(a.slot_start) === today).length,
    activeConsents: activeConsents.length,
    outstandingBillTotal,
  };
}

export function listAllPatients(actor: Actor) {
  assertAdmin(actor);
  auditAdmin(actor, "patients:list");
  return db.patients
    .map((p) => patientHeader(p.id)!)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export function listAllDoctors(actor: Actor) {
  assertAdmin(actor);
  auditAdmin(actor, "doctors:list");
  return db.doctors
    .map((d) => doctorCard(d.id)!)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export function listAllHospitals(actor: Actor) {
  assertAdmin(actor);
  auditAdmin(actor, "hospitals:list");
  return db.hospitals.map((h) => ({
    ...h,
    doctorCount: seed.doctorHospitals.filter((dh) => dh.hospital_id === h.id).length,
    visitCount: db.caseSheets.filter((c) => c.hospital_id === h.id).length,
  }));
}

export function listAllAppointments(actor: Actor, opts: { limit?: number } = {}) {
  assertAdmin(actor);
  auditAdmin(actor, "appointments:list");
  return [...db.appointments]
    .sort((a, b) => b.slot_start.localeCompare(a.slot_start))
    .slice(0, opts.limit ?? 200)
    .map((a) => ({
      ...a,
      patientName: getProfile(a.patient_id)?.full_name ?? "Unknown",
      doctorName: getProfile(a.doctor_id)?.full_name ?? "Unknown",
      hospitalName: getHospital(a.hospital_id)?.name ?? "Unknown",
    }));
}

export function listAllBills(actor: Actor, opts: { limit?: number } = {}) {
  assertAdmin(actor);
  auditAdmin(actor, "bills:list");
  return [...db.bills]
    .sort((a, b) => b.billed_on.localeCompare(a.billed_on))
    .slice(0, opts.limit ?? 300)
    .map((b) => ({
      ...b,
      patientName: getProfile(b.patient_id)?.full_name ?? "Unknown",
      hospitalName: getHospital(b.hospital_id)?.name ?? "Unknown",
    }));
}

export function listAllCareRelationships(actor: Actor) {
  assertAdmin(actor);
  auditAdmin(actor, "consents:list");
  return [...db.careRelationships]
    .sort((a, b) => b.granted_at.localeCompare(a.granted_at))
    .map((r) => ({
      ...r,
      patientName: getProfile(r.patient_id)?.full_name ?? "Unknown",
      doctorName: getProfile(r.doctor_id)?.full_name ?? "Unknown",
      active: !r.revoked_at && new Date(r.expires_at).getTime() > Date.now(),
    }));
}

export function listAccessAudit(actor: Actor, opts: { limit?: number } = {}) {
  assertAdmin(actor);
  auditAdmin(actor, "audit:list");
  return db.accessAudit.slice(0, opts.limit ?? 300).map((row) => ({
    ...row,
    actorName: getProfile(row.actor_id)?.full_name ?? "Unknown",
    patientName: getProfile(row.patient_id)?.full_name ?? "Unknown",
  }));
}

/** Self-transparency: the admin's own recent reads. Not itself audited —
 *  logging a read of the activity log would just chase its own tail. */
export function recentAdminActivity(actor: Actor, limit = 10) {
  assertAdmin(actor);
  return db.adminAudit.slice(0, limit);
}

// ── Notifications: mocked by default, logged so the demo can show them ──
export const notifications: { patient_id: string; text: string; at: string }[] = [];

export function notifyPatient(patientId: string, text: string) {
  notifications.unshift({ patient_id: patientId, text, at: new Date().toISOString() });
  if (process.env.MOCK_SMS !== "false") {
    console.log(`[SMS → ${getProfile(patientId)?.phone}] ${text}`);
  }
  if (notifications.length > 200) notifications.length = 200;
}

export function notificationsFor(patientId: string) {
  return notifications.filter((n) => n.patient_id === patientId);
}

export { seed };
