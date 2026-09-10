import { NextResponse } from "next/server";
import { db, notifyPatient } from "@/lib/db/store";

// The native app's login step. Mirrors src/app/actions/auth.ts:requestOtp —
// same DEMO_OTP bypass, same normalisation — but as plain JSON so a mobile
// HTTP client can call it directly instead of going through a Server Action.
export async function POST(req: Request) {
  const { phone } = (await req.json()) as { phone?: string };
  if (!phone) {
    return NextResponse.json({ ok: false, error: "Phone number required." }, { status: 400 });
  }
  const normalised = phone.startsWith("+") ? phone : `+91${phone.replace(/^0/, "")}`;
  const profile = db.profiles.find((p) => p.phone === normalised && p.role === "patient");
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "No patient account with that number." },
      { status: 404 },
    );
  }
  const demoOtp = process.env.DEMO_OTP ?? "123456";
  notifyPatient(profile.id, `Your Nidan sign-in code is ${demoOtp}.`);
  return NextResponse.json({ ok: true, phone: normalised, hint: `Demo code: ${demoOtp}` });
}
