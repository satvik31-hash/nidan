"use server";

import { revalidatePath } from "next/cache";
import { requirePatient } from "@/lib/auth";
import { db, getProfile, updatePatient } from "@/lib/db/store";

// Every integration sits behind a thin interface with a MOCK_<SERVICE> env
// flag, and the mock path is the default in development. You will demo on
// unreliable conference wifi in front of people who cannot be asked to wait.

const mocked = () => process.env.MOCK_ABDM !== "false" || !process.env.ABDM_CLIENT_ID;

export async function linkAbha(method: "mobile_otp" | "aadhaar_otp", otp: string) {
  const s = await requirePatient();
  const expected = process.env.DEMO_OTP ?? "123456";

  if (mocked()) {
    if (otp !== expected) {
      return { ok: false as const, error: "That code did not match." };
    }
    // A 14-digit ABHA number, formatted the way ABDM issues them.
    const digits = Array.from({ length: 14 }, (_, i) =>
      String((parseInt(s.userId.replace(/\D/g, "").slice(-6) || "1", 10) + i * 7) % 10),
    ).join("");
    const name = getProfile(s.userId)!.full_name.toLowerCase().split(" ")[0];
    const abha_number = digits;
    const abha_address = `${name}${digits.slice(-3)}@abdm`;

    updatePatient(s.userId, { abha_number, abha_address });
    db.profiles.find((p) => p.id === s.userId); // keep the profile row hot
    revalidatePath("/patient/profile");
    revalidatePath("/patient/profile/abha");
    return { ok: true as const, abha_number, abha_address };
  }

  // Real path, against sandbox.abdm.gov.in:
  //   1. POST /gateway/v0.5/sessions           → access token
  //   2. POST /v1/registration/mobile/login/verifyOtp
  //   3. GET  /v1/account/profile              → ABHA number + address
  // Each response is mapped onto the same shape returned above, so nothing
  // downstream of this function knows which path ran.
  try {
    const res = await fetch(`${process.env.ABDM_BASE_URL ?? "https://dev.abdm.gov.in"}/v1/registration/mobile/login/verifyOtp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ otp, method }),
    });
    if (!res.ok) return { ok: false as const, error: `ABDM gateway returned ${res.status}` };
    const json = (await res.json()) as { healthIdNumber: string; healthId: string };
    updatePatient(s.userId, { abha_number: json.healthIdNumber, abha_address: json.healthId });
    revalidatePath("/patient/profile/abha");
    return { ok: true as const, abha_number: json.healthIdNumber, abha_address: json.healthId };
  } catch (e) {
    return { ok: false as const, error: `Could not reach the ABDM gateway: ${(e as Error).message}` };
  }
}
