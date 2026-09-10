import { NextResponse } from "next/server";
import { patientHeader, timelineFor } from "@/lib/db/store";

// The token minted by verify-otp is the patient's own profile id — the same
// shape the website's own session cookie carries (see src/lib/auth.ts). A
// patient actor can only ever read their own record: timelineFor()'s
// assertAccess() call enforces that regardless of what this route does, so
// there is no separate authorisation check to get wrong here.
export async function GET(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing token." }, { status: 401 });
  }
  const header = patientHeader(token);
  if (!header) {
    return NextResponse.json({ ok: false, error: "Unknown token." }, { status: 401 });
  }
  const actor = { id: token, role: "patient" as const };
  const timeline = timelineFor(actor, token);
  return NextResponse.json({ ok: true, patient: header, timeline });
}
