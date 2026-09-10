"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Building2, CalendarDays, LayoutGrid, LogOut, Receipt, Search, ShieldCheck, Stethoscope, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/doctor/command-palette";
import { VoiceAssistant } from "@/components/voice-assistant";
import { ThemeToggle } from "@/components/theme-toggle";
import { adminCommands } from "@/lib/commands";

// Company-wide oversight, not a clinical surface — same chrome tokens as the
// doctor console (this is the other role that lives at that density), but
// nothing here edits a record.

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutGrid, exact: true },
  { href: "/admin/patients", label: "Patients", icon: Users },
  { href: "/admin/doctors", label: "Doctors", icon: Stethoscope },
  { href: "/admin/hospitals", label: "Hospitals", icon: Building2 },
  { href: "/admin/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/admin/billing", label: "Billing", icon: Receipt },
  { href: "/admin/audit", label: "Audit log", icon: ShieldCheck },
];

export function AdminShell({
  user, children,
}: { user: { name: string; initials: string }; children: React.ReactNode }) {
  const path = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-dvh text-[0.9375rem]">
      <header className="sticky top-0 z-20 bg-[var(--color-chrome)] text-[var(--color-chrome-ink)]">
        <div className="flex items-center gap-4 px-4 sm:px-6 h-14">
          <Link href="/admin" className="font-bold tracking-tight">
            Ni<span className="text-[var(--color-brand)]">dan</span>
            <span className="ml-2 text-[0.625rem] uppercase tracking-[0.14em] opacity-60">
              administration
            </span>
          </Link>

          <nav className="hidden lg:flex gap-1 ml-4">
            {NAV.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? path === href : path.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 h-8 rounded-[6px] text-sm transition-colors",
                    active ? "bg-white/15 font-medium" : "opacity-70 hover:opacity-100",
                  )}
                >
                  <Icon size={15} />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="flex-1" />

          <button
            onClick={() => setPaletteOpen(true)}
            className="hidden md:flex items-center gap-2 h-8 px-3 rounded-[6px] border border-white/20 text-xs opacity-70 hover:opacity-100"
          >
            <Search size={13} />
            Jump to…
            <kbd className="font-mono border border-white/25 rounded px-1">⌘K</kbd>
          </button>
          <button
            onClick={() => setPaletteOpen(true)}
            aria-label="Jump to…"
            className="grid md:hidden place-items-center w-8 h-8 rounded-[6px] opacity-70 hover:opacity-100"
          >
            <Search size={15} />
          </button>

          <ThemeToggle tone="chrome" />

          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-right leading-tight">
              <span className="block text-sm font-medium">{user.name}</span>
              <span className="block text-[0.6875rem] opacity-60">Administrator</span>
            </span>
            <span className="w-8 h-8 rounded-full bg-white/15 grid place-items-center text-xs font-semibold">
              {user.initials}
            </span>
          </div>

          <form action="/api/signout" method="post">
            <button className="grid place-items-center w-8 h-8 rounded-[6px] opacity-70 hover:opacity-100" title="Log out">
              <LogOut size={16} />
            </button>
          </form>
        </div>

        <nav className="flex lg:hidden gap-1 px-4 pb-2 overflow-x-auto">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? path === href : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 px-3 h-8 rounded-[6px] text-xs shrink-0 transition-colors",
                  active ? "bg-white/15 font-medium" : "opacity-70",
                )}
              >
                <Icon size={13} />
                {label}
              </Link>
            );
          })}
        </nav>
      </header>

      <div className="bg-[var(--color-brand-soft)] text-[var(--color-brand-ink)] px-4 sm:px-6 py-2 text-xs">
        Company data view — every read on this portal is logged to the admin activity trail.
      </div>

      <main className="px-4 sm:px-6 py-5">{children}</main>

      {paletteOpen && (
        <CommandPalette
          staticHits={adminCommands}
          onClose={() => setPaletteOpen(false)}
          onNavigate={(href) => { setPaletteOpen(false); router.push(href); }}
        />
      )}

      <VoiceAssistant commands={adminCommands} />
    </div>
  );
}
