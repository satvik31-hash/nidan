import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { daySlots } from "@/lib/db/store";

// The only source of bookable times. The booking UI calls nothing else, so
// there is no code path that can produce an illegal booking — in the mock
// store as in Postgres, where this is the available_slots() function.
export async function GET(req: Request) {
  await requireSession();
  const url = new URL(req.url);
  const doctor = url.searchParams.get("doctor");
  const hospital = url.searchParams.get("hospital");
  const date = url.searchParams.get("date");
  if (!doctor || !hospital || !date) {
    return NextResponse.json({ error: "doctor, hospital and date are required" }, { status: 400 });
  }
  const day = new Date(date + "T00:00:00");
  if (Number.isNaN(day.getTime())) {
    return NextResponse.json({ error: "bad date" }, { status: 400 });
  }
  return NextResponse.json({ slots: daySlots(doctor, hospital, day) });
}
