import { NextResponse } from "next/server";
import { resetDemoData } from "@/lib/db/store";

// "Reset and reload the demo dataset so every demo starts from an identical
// clean state." — §11, day 13. Six rehearsed run-throughs need six identical
// starting points.
//
// With a linked Supabase project the equivalent is `supabase db reset`,
// which replays the migrations and seed.sql.
export async function POST() {
  resetDemoData();
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}

// Visiting the URL in a browser resets and drops you back on the landing page.
// The origin comes from the request, so this works identically on localhost and
// on the deployed domain — never redirect a live site to localhost.
export async function GET(req: Request) {
  resetDemoData();
  // Behind a proxy (Vercel) the request's own URL is the internal one, so the
  // forwarded host is what the visitor actually typed. Never send a live site
  // to localhost.
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const base = host ? `${proto}://${host}` : req.url;
  return NextResponse.redirect(new URL("/", base));
}
