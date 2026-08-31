import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/db/store";
import type { UserRole } from "@/lib/types";
import { isLocale, type Locale } from "@/lib/i18n";

export const SESSION_COOKIE = "nidan_session";
export const LOCALE_COOKIE = "nidan_locale";

/**
 * Demo session.
 *
 * In production this is Supabase Auth: phone OTP for patients, email +
 * password for doctors, and the JWT carries the role claim. The mock path
 * keeps the same shape — a signed identity the middleware can read — so
 * swapping to @supabase/ssr is a change to this file and nothing else.
 */
export interface Session {
  userId: string;
  role: UserRole;
  name: string;
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const profile = getProfile(raw);
  if (!profile) return null;
  return { userId: profile.id, role: profile.role, name: profile.full_name };
}

export async function requireSession(role?: UserRole): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/");
  if (role && s.role !== role) redirect(s.role === "doctor" ? "/doctor" : "/patient");
  return s;
}

export async function requirePatient() {
  const s = await requireSession("patient");
  return s;
}

export async function requireDoctor() {
  const s = await requireSession("doctor");
  return s;
}

export async function actorOf(s: Session) {
  return { id: s.userId, role: s.role };
}

export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  const v = jar.get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : "en";
}
