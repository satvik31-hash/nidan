import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { hasCareAccess, searchPatients } from "@/lib/db/store";

// Search returns a MINIMAL identity card only — name, MRN, age, sex. Opening
// the full record requires an active care relationship; without one the
// console offers "Request access" instead. Search is not access.
export async function GET(req: Request) {
  const session = await requireSession("doctor");
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const results = searchPatients(q).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    mrn: p.mrn,
    age: p.age,
    sex: p.sex,
    abha_number: p.abha_number,
    hasAccess: hasCareAccess(session.userId, p.id),
  }));
  return NextResponse.json({ results });
}
