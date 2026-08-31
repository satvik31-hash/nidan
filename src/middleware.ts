import { NextResponse, type NextRequest } from "next/server";

// Route protection lives here, not in a client-side check. In production
// this reads the Supabase JWT and its role claim; the mock path reads the
// same cookie the demo session writes. Either way the decision is made on
// the edge before a Server Component renders a record.

const SESSION_COOKIE = "nidan_session";

// Deterministic prefixes from the seed. In production, read `role` from the
// verified JWT claim rather than inferring it from the subject.
const roleOf = (id: string): "patient" | "doctor" | null =>
  id.startsWith("d1000000") ? "doctor" : id.startsWith("c1000000") ? "patient" : null;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = req.cookies.get(SESSION_COOKIE)?.value;
  const role = session ? roleOf(session) : null;

  const needsPatient = pathname.startsWith("/patient");
  const needsDoctor = pathname.startsWith("/doctor");
  if (!needsPatient && !needsDoctor) return NextResponse.next();

  if (!role) {
    const url = req.nextUrl.clone();
    url.pathname = needsDoctor ? "/login/doctor" : "/login/patient";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (needsPatient && role !== "patient") {
    return NextResponse.redirect(new URL("/doctor", req.url));
  }
  if (needsDoctor && role !== "doctor") {
    return NextResponse.redirect(new URL("/patient", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/patient/:path*", "/doctor/:path*"],
};
