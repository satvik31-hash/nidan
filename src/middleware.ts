import { NextResponse, type NextRequest } from "next/server";

// Route protection lives here, not in a client-side check. In production
// this reads the Supabase JWT and its role claim; the mock path reads the
// same cookie the demo session writes. Either way the decision is made on
// the edge before a Server Component renders a record.

const SESSION_COOKIE = "nidan_session";

// Deterministic prefixes from the seed. In production, read `role` from the
// verified JWT claim rather than inferring it from the subject.
const roleOf = (id: string): "patient" | "doctor" | "admin" | null =>
  id.startsWith("d1000000") ? "doctor"
    : id.startsWith("c1000000") ? "patient"
    : id.startsWith("e1000000") ? "admin"
    : null;

const HOME: Record<"patient" | "doctor" | "admin", string> = {
  patient: "/patient", doctor: "/doctor", admin: "/admin",
};

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = req.cookies.get(SESSION_COOKIE)?.value;
  const role = session ? roleOf(session) : null;

  const needsPatient = pathname.startsWith("/patient");
  const needsDoctor = pathname.startsWith("/doctor");
  const needsAdmin = pathname.startsWith("/admin");
  if (!needsPatient && !needsDoctor && !needsAdmin) return NextResponse.next();

  if (!role) {
    const url = req.nextUrl.clone();
    url.pathname = needsDoctor ? "/login/doctor" : needsAdmin ? "/login/admin" : "/login/patient";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  const needsRole = needsPatient ? "patient" : needsDoctor ? "doctor" : "admin";
  if (role !== needsRole) {
    return NextResponse.redirect(new URL(HOME[role], req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/patient/:path*", "/doctor/:path*", "/admin/:path*"],
};
