import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { AccessDenied, audit, db, documentsFor } from "@/lib/db/store";

// A 60-second signed URL, generated only after the same access check the
// database would apply — and the read is written to access_audit before the
// link is handed over. Storage objects are never public.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const doc = db.documents.find((d) => d.id === id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    documentsFor({ id: session.userId, role: session.role }, doc.patient_id);
  } catch (e) {
    if (e instanceof AccessDenied) {
      return NextResponse.json({ error: "No active care relationship" }, { status: 403 });
    }
    throw e;
  }

  audit({
    actor_id: session.userId, actor_role: session.role, patient_id: doc.patient_id,
    action: "export", resource: "document", resource_id: doc.id, basis: null,
  });

  // With Supabase Storage this is:
  //   supabase.storage.from('reports').createSignedUrl(doc.storage_path, 60)
  const expires = Date.now() + 60_000;
  return NextResponse.json({
    url: `/storage/${doc.storage_path}?token=demo&expires=${expires}`,
    expires_in: 60,
    note: "Mock signed URL. With a linked Supabase project this is createSignedUrl(path, 60).",
  });
}
