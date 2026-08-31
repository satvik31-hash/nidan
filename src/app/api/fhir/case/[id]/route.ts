import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { AccessDenied, audit, db } from "@/lib/db/store";
import { caseSheetToFhir } from "@/lib/fhir";

// "View as FHIR" opens this. A real interoperability standard, emitted from
// the same row the doctor just wrote — not a claim about one.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const bundle = caseSheetToFhir({ id: session.userId, role: session.role }, id);
    if (!bundle) return NextResponse.json({ error: "No such case sheet" }, { status: 404 });

    const cs = db.caseSheets.find((c) => c.id === id)!;
    audit({
      actor_id: session.userId, actor_role: session.role, patient_id: cs.patient_id,
      action: "export", resource: "fhir_bundle", resource_id: id, basis: null,
    });

    return new NextResponse(JSON.stringify(bundle, null, 2), {
      headers: {
        "content-type": "application/fhir+json; charset=utf-8",
        "content-disposition": `inline; filename="opconsultation-${id}.json"`,
      },
    });
  } catch (e) {
    if (e instanceof AccessDenied) {
      return NextResponse.json({ error: "No active care relationship" }, { status: 403 });
    }
    throw e;
  }
}
