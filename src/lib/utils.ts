import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Everything is stored UTC and rendered Asia/Kolkata. Getting this right on
// day one is the difference between a working demo and an afternoon of
// appointment bugs on day nine.
const TZ = "Asia/Kolkata";

export const fmtDate = (d: string | Date, opts: Intl.DateTimeFormatOptions = {}) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric", timeZone: TZ, ...opts,
  });

export const fmtTime = (d: string | Date) =>
  new Date(d).toLocaleTimeString("en-IN", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ,
  });

export const fmtDateTime = (d: string | Date) => `${fmtDate(d)}, ${fmtTime(d)}`;

export const fmtDay = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-IN", { weekday: "short", timeZone: TZ });

export function relative(d: string | Date): string {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.round(diff / 864e5);
  if (Math.abs(days) < 1) {
    const mins = Math.round(diff / 60000);
    if (Math.abs(mins) < 1) return "just now";
    if (Math.abs(mins) < 60) return mins > 0 ? `${mins} min ago` : `in ${-mins} min`;
    const hrs = Math.round(mins / 60);
    return hrs > 0 ? `${hrs} h ago` : `in ${-hrs} h`;
  }
  if (days === 1) return "yesterday";
  if (days === -1) return "tomorrow";
  if (days > 0 && days < 30) return `${days} days ago`;
  if (days < 0 && days > -30) return `in ${-days} days`;
  const months = Math.round(days / 30);
  if (Math.abs(months) < 24) return months > 0 ? `${months} mo ago` : `in ${-months} mo`;
  return `${Math.round(days / 365)} y ago`;
}

export const rupees = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(n);

export const compactRupees = (n: number) =>
  n >= 1e5 ? `₹${(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `₹${(n / 1e3).toFixed(1)}k` : `₹${n}`;

export function ageString(dob: string): string {
  const b = new Date(dob);
  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  let months = now.getMonth() - b.getMonth();
  if (now.getDate() < b.getDate()) months--;
  if (months < 0) { years--; months += 12; }
  if (years < 2) return `${years * 12 + months} mo`;
  return `${years} y`;
}

export function initials(name: string) {
  return name.replace(/^Dr\.?\s*/i, "").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

/** "1-0-1" → "one tablet morning and night". Written out because a patient
 *  reading "1-0-1" on a phone at home is not helped by it. */
export function explainFrequency(freq: string, form = "tablet"): string {
  if (/^sos$/i.test(freq)) return `${form}, only when needed`;
  const parts = freq.split("-").map((p) => parseInt(p, 10));
  if (parts.length !== 3 || parts.some(Number.isNaN)) return freq;
  const when = ["morning", "afternoon", "night"];
  const taken = parts.map((n, i) => (n > 0 ? when[i] : null)).filter(Boolean) as string[];
  if (!taken.length) return "as directed";
  const qty = parts.find((n) => n > 0)!;
  const list = taken.length === 1 ? taken[0]
    : `${taken.slice(0, -1).join(", ")} and ${taken[taken.length - 1]}`;
  return `${qty === 1 ? "one" : qty} ${form}${qty > 1 ? "s" : ""} ${list}`;
}

export function quantityFor(freq: string, days: number): number {
  if (/^sos$/i.test(freq)) return days;
  const parts = freq.split("-").map((p) => parseInt(p, 10) || 0);
  const perDay = parts.reduce((a, b) => a + b, 0);
  return Math.max(perDay * days, 1);
}
