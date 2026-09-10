"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { LOCALE_COOKIE, SESSION_COOKIE } from "@/lib/auth";
import { db, notifyPatient } from "@/lib/db/store";

const DEMO_OTP = process.env.DEMO_OTP ?? "123456";

// The DEMO_OTP bypass is built on day three, not on demo morning. If MSG91
// is unreachable at the venue, the fixed code for seeded accounts still
// gets you through the door.
export async function requestOtp(_prev: unknown, formData: FormData) {
  const phone = String(formData.get("phone") ?? "").replace(/\s/g, "");
  const normalised = phone.startsWith("+") ? phone : `+91${phone.replace(/^0/, "")}`;
  const profile = db.profiles.find((p) => p.phone === normalised && p.role === "patient");
  if (!profile) {
    return {
      ok: false as const,
      error: "No patient account with that number. Try one of the demo numbers below.",
    };
  }
  notifyPatient(profile.id, `Your Nidan sign-in code is ${DEMO_OTP}.`);
  return { ok: true as const, phone: normalised, hint: `Demo code: ${DEMO_OTP}` };
}

export async function verifyOtp(_prev: unknown, formData: FormData) {
  const phone = String(formData.get("phone") ?? "");
  const otp = String(formData.get("otp") ?? "");
  if (otp !== DEMO_OTP) {
    return { ok: false as const, error: "That code did not match. Try again." };
  }
  const profile = db.profiles.find((p) => p.phone === phone && p.role === "patient");
  if (!profile) return { ok: false as const, error: "No account for that number." };

  const jar = await cookies();
  jar.set(SESSION_COOKIE, profile.id, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12,
  });
  jar.set(LOCALE_COOKIE, profile.preferred_locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/patient");
}

export async function doctorSignIn(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const profile = db.profiles.find((p) => p.email === email && p.role === "doctor");
  if (!profile || password !== "demo1234") {
    return { ok: false as const, error: "Those details did not match a registered doctor." };
  }
  const jar = await cookies();
  jar.set(SESSION_COOKIE, profile.id, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12,
  });
  redirect("/doctor");
}

export async function adminSignIn(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const profile = db.profiles.find((p) => p.email === email && p.role === "admin");
  if (!profile || password !== "demo1234") {
    return { ok: false as const, error: "Those details did not match a registered administrator." };
  }
  const jar = await cookies();
  jar.set(SESSION_COOKIE, profile.id, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12,
  });
  redirect("/admin");
}

export async function signOut() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/");
}

export async function setLocale(locale: Locale) {
  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
}
