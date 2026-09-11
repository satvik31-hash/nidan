import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { recentBookingsFor } from "@/lib/db/store";

// Polled by src/components/doctor/booking-alerts.tsx every few seconds so
// the doctor console can show "Sunita Kale booked 9:00 am, 11 Sept" without
// a page reload — including inside the mobile app's Doctor tab, which is
// this same page in a WebView, so no separate mobile push plumbing is
// needed for that surface either.
export async function GET(req: Request) {
  const session = await requireSession("doctor");
  const since = new URL(req.url).searchParams.get("since");
  if (!since) {
    return NextResponse.json({ error: "since is required" }, { status: 400 });
  }
  return NextResponse.json({ alerts: recentBookingsFor(session.userId, since) });
}
