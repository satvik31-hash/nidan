// The single source of navigable destinations per role — consumed by the
// doctor/admin ⌘K command palette and by the voice assistant, so the two
// surfaces can never drift apart into two different maps of the app.

import type { LucideIcon } from "lucide-react";
import {
  Activity, Building2, CalendarDays, CalendarPlus,
  CircleUser, FileHeart, LayoutGrid, LifeBuoy, LogOut, Receipt, Search,
  ShieldCheck, Stethoscope, User, Users,
} from "lucide-react";

export interface CommandEntry {
  id: string;
  label: string;
  /** Spoken/typed words that should match this command. Lowercase. */
  keywords: string[];
  href: string;
  icon: LucideIcon;
  sub?: string;
}

export const doctorCommands: CommandEntry[] = [
  { id: "doctor-today", label: "Today's queue", keywords: ["today", "queue", "home", "clinic"], href: "/doctor", icon: CalendarDays },
  { id: "doctor-lookup", label: "Patient lookup", keywords: ["lookup", "find patient", "search patient"], href: "/doctor/lookup", icon: Search },
  { id: "doctor-profile", label: "My profile and availability", keywords: ["profile", "availability", "settings"], href: "/doctor/profile", icon: User },
  { id: "doctor-break-glass", label: "Open an emergency card", sub: "break-glass", keywords: ["emergency", "break glass", "scan"], href: "/scan", icon: Stethoscope },
];

// Keywords carry Hindi and Telugu alongside English — the same strings
// already shown on screen (src/lib/i18n.ts), not hand-translated here, so a
// patient using the app in their chosen language can say what they read.
// Doctor/admin commands stay English-only on purpose (see AGENTS.md:
// clinical vocabulary is never translated), which is also the only reason
// this note lives on patientCommands and not the arrays below it.
export const patientCommands: CommandEntry[] = [
  { id: "patient-records", label: "Records", keywords: ["records", "home", "history", "रिकॉर्ड", "రికార్డులు"], href: "/patient/records", icon: FileHeart },
  { id: "patient-appointments", label: "Appointments", keywords: ["appointments", "visits", "अपॉइंटमेंट", "అపాయింట్‌మెంట్లు"], href: "/patient/appointments", icon: CalendarDays },
  { id: "patient-book", label: "Book appointment", keywords: ["book", "new appointment", "schedule", "अपॉइंटमेंट लें", "अपॉइंटमेंट बुक करें", "అపాయింట్‌మెంట్ బుక్ చేయండి"], href: "/patient/book", icon: CalendarPlus },
  { id: "patient-billing", label: "Billing", keywords: ["billing", "bills", "payments", "बिल", "బిల్లులు"], href: "/patient/billing", icon: Receipt },
  { id: "patient-emergency", label: "Emergency", keywords: ["emergency", "first aid", "आपातकाल", "प्राथमिक उपचार", "అత్యవసరం", "ప్రథమ చికిత్స"], href: "/patient/emergency", icon: LifeBuoy },
  { id: "patient-wellness", label: "Wellness", keywords: ["wellness", "checkin", "mood", "स्वास्थ्य ट्रैकर", "रोज़ की जाँच", "मनोदशा", "ఆరోగ్య ట్రాకర్", "రోజువారీ చెక్-ఇన్", "మానసిక స్థితి"], href: "/patient/wellness", icon: Activity },
  { id: "patient-profile", label: "Profile", keywords: ["profile", "my details", "प्रोफ़ाइल", "ప్రొఫైల్"], href: "/patient/profile", icon: CircleUser },
  { id: "patient-access", label: "Who has seen my records", keywords: ["who has seen", "access log", "audit", "मेरा रिकॉर्ड किसने देखा", "నా రికార్డులను ఎవరు చూశారు"], href: "/patient/access", icon: Search },
];

export const adminCommands: CommandEntry[] = [
  { id: "admin-overview", label: "Overview", keywords: ["overview", "home", "dashboard", "stats"], href: "/admin", icon: LayoutGrid },
  { id: "admin-patients", label: "Patients", keywords: ["patients", "patient list"], href: "/admin/patients", icon: Users },
  { id: "admin-doctors", label: "Doctors", keywords: ["doctors", "doctor list", "clinicians"], href: "/admin/doctors", icon: Stethoscope },
  { id: "admin-hospitals", label: "Hospitals", keywords: ["hospitals", "hospital list"], href: "/admin/hospitals", icon: Building2 },
  { id: "admin-appointments", label: "Appointments", keywords: ["appointments", "scheduling"], href: "/admin/appointments", icon: CalendarDays },
  { id: "admin-billing", label: "Billing", keywords: ["billing", "bills", "revenue"], href: "/admin/billing", icon: Receipt },
  { id: "admin-audit", label: "Audit log", keywords: ["audit", "access log", "who accessed"], href: "/admin/audit", icon: ShieldCheck },
];

// Not part of any role's array above on purpose — it never appears in the
// ⌘K command palette (CommandPalette only ever receives one of the arrays
// above), only in the voice assistant, which merges it in for every role.
// href is a sentinel the voice assistant special-cases rather than a real
// route to navigate to.
export const signOutCommand: CommandEntry = {
  id: "sign-out",
  label: "Log out",
  keywords: ["logout", "log out", "sign out", "signout", "लॉग आउट", "లాగ్ అవుట్"],
  href: "#signout",
  icon: LogOut,
};
