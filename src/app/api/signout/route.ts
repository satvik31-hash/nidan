import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

/** Behind a deployment the request URL is the internal one, so the redirect
 *  has to be built from the forwarded host or a signed-out user lands on
 *  localhost. Same fix as /api/demo/reset. */
function origin(req: Request) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : req.url;
}

function signOut(req: Request, to: string) {
  const res = NextResponse.redirect(new URL(to, origin(req)), { status: 303 });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

export async function POST(req: Request) {
  return signOut(req, "/");
}

/** The "sign out" link on /start is a plain anchor, so it arrives as a GET.
 *  It returns to the fork rather than the marketing page — someone signing out
 *  there is trying to sign in as somebody else. */
export async function GET(req: Request) {
  return signOut(req, "/start");
}
