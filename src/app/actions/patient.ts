"use server";

import { revalidatePath } from "next/cache";
import { requirePatient } from "@/lib/auth";
import {
  approveAccess, bookAppointment, cancelAppointment, notifyPatient,
  reissueEmergencyCard, revokeEmergencyCard, revokeRelationship, SlotTaken,
  updatePatient, upsertCheckin, doctorCard, getHospital,
} from "@/lib/db/store";
import { structureSymptoms } from "@/lib/ai";

export async function updateProfile(name: string, value: string) {
  const s = await requirePatient();
  const ALLOWED = ["full_name", "email", "blood_group", "height_cm", "address_line1", "city", "pincode"];
  if (!ALLOWED.includes(name)) return { ok: false, error: "That field is not editable here." };
  const patch: Record<string, unknown> = { [name]: name === "height_cm" ? Number(value) || null : value };
  updatePatient(s.userId, patch);
  revalidatePath("/patient/profile");
  return { ok: true };
}

export async function book(input: {
  doctorId: string; hospitalId: string; start: string; end: string;
  reason: string; mode: "in_person" | "teleconsult";
}) {
  const s = await requirePatient();
  try {
    const appt = bookAppointment({ patientId: s.userId, ...input });
    const doc = doctorCard(input.doctorId);
    const hosp = getHospital(input.hospitalId);
    notifyPatient(
      s.userId,
      `Appointment confirmed with ${doc?.full_name} at ${hosp?.name} on ${new Date(input.start).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}. Token ${appt.token_no}.`,
    );
    revalidatePath("/patient/appointments");
    return { ok: true as const, id: appt.id, token: appt.token_no };
  } catch (e) {
    // Handle the race: the exclusion constraint rejected the insert, so tell
    // the user the slot just went and let the grid refresh.
    if (e instanceof SlotTaken) {
      return { ok: false as const, code: "23P01", error: "That slot has just been taken." };
    }
    return { ok: false as const, error: (e as Error).message };
  }
}

export async function cancelAppt(id: string, reason: string) {
  const s = await requirePatient();
  cancelAppointment(id, s.userId, reason);
  revalidatePath("/patient/appointments");
  return { ok: true };
}

export async function saveCheckin(data: {
  mood?: number; energy?: number; sleep_hours?: number; pain_score?: number;
  symptoms?: string[]; meds_taken?: boolean; water_glasses?: number; notes?: string;
}) {
  const s = await requirePatient();
  upsertCheckin(s.userId, data);
  revalidatePath("/patient/wellness");
  return { ok: true };
}

/** Twenty lines, and the most quotable feature in the project. */
export async function revokeAccess(relationshipId: string) {
  const s = await requirePatient();
  const ok = revokeRelationship(s.userId, relationshipId);
  revalidatePath("/patient/access");
  return { ok };
}

export async function approveRequest(requestId: string, otp: string) {
  await requirePatient();
  const r = approveAccess(requestId, otp);
  revalidatePath("/patient/access");
  return r;
}

export async function rotateEmergencyCard(revokeOnly = false) {
  const s = await requirePatient();
  const card = revokeOnly ? revokeEmergencyCard(s.userId) : reissueEmergencyCard(s.userId);
  revalidatePath("/patient/emergency");
  revalidatePath("/patient/card");
  return { ok: true, token: revokeOnly ? null : card?.token ?? null };
}

export async function structure(text: string) {
  await requirePatient();
  return structureSymptoms(text);
}
