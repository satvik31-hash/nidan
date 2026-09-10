import { NextResponse } from "next/server";
import { db } from "@/lib/db/store";

// Mirrors src/app/actions/auth.ts:verifyOtp. Where the website sets an
// httpOnly cookie holding the raw profile id (see src/lib/auth.ts — that IS
// the whole session, by design, so it can be swapped for real Supabase Auth
// later without touching anything else), the native app has no cookie jar
// shared with the server, so this hands the same id back as a bearer token
// instead. Same trust model, different transport.
export async function POST(req: Request) {
  const { phone, otp } = (await req.json()) as { phone?: string; otp?: string };
  const demoOtp = process.env.DEMO_OTP ?? "123456";
  if (otp !== demoOtp) {
    return NextResponse.json({ ok: false, error: "That code did not match." }, { status: 401 });
  }
  const profile = db.profiles.find((p) => p.phone === phone && p.role === "patient");
  if (!profile) {
    return NextResponse.json({ ok: false, error: "No account for that number." }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    token: profile.id,
    name: profile.full_name,
    locale: profile.preferred_locale,
  });
}
