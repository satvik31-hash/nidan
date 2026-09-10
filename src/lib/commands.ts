// The single source of navigable destinations per role — consumed by the
// doctor/admin ⌘K command palette and by the voice assistant, so the two
// surfaces can never drift apart into two different maps of the app.

import type { LucideIcon } from "lucide-react";
import {
  Activity, Building2, CalendarDays, CalendarPlus,
  CircleUser, FileHeart, LayoutGrid, LifeBuoy, Receipt, Search,
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

export const patientCommands: CommandEntry[] = [
  { id: "patient-records", label: "Records", keywords: ["records", "home", "history"], href: "/patient/records", icon: FileHeart },
  { id: "patient-appointments", label: "Appointments", keywords: ["appointments", "visits"], href: "/patient/appointments", icon: CalendarDays },
  { id: "patient-book", label: "Book appointment", keywords: ["book", "new appointment", "schedule"], href: "/patient/book", icon: CalendarPlus },
  { id: "patient-billing", label: "Billing", keywords: ["billing", "bills", "payments"], href: "/patient/billing", icon: Receipt },
  { id: "patient-emergency", label: "Emergency", keywords: ["emergency", "first aid"], href: "/patient/emergency", icon: LifeBuoy },
  { id: "patient-wellness", label: "Wellness", keywords: ["wellness", "checkin", "mood"], href: "/patient/wellness", icon: Activity },
  { id: "patient-profile", label: "Profile", keywords: ["profile", "my details"], href: "/patient/profile", icon: CircleUser },
  { id: "patient-access", label: "Who has seen my records", keywords: ["who has seen", "access log", "audit"], href: "/patient/access", icon: Search },
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
