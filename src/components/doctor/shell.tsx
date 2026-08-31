"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, LayoutGrid, LogOut, Search, Stethoscope, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/doctor/command-palette";
import { ThemeToggle } from "@/components/theme-toggle";

// The doctor console is dense, fast and information-first — same tokens as
// the patient app, different density. One step smaller type, tighter rows.

const NAV = [
  { href: "/doctor", label: "Today", icon: LayoutGrid, exact: true },
  { href: "/doctor/lookup", label: "Patient lookup", icon: Search },
  { href: "/doctor/profile", label: "My profile", icon: User },
];

export function DoctorShell({
  user, children,
}: {
  user: { name: string; speciality: string; initials: string; verified: boolean };
  children: React.ReactNode;
}) {
  const path = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const router = useRouter();

  // ⌘K. Doctors are keyboard users.
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
          <Link href="/doctor" className="font-bold tracking-tight">
            Ni<span className="text-[var(--color-brand)]">dan</span>
            <span className="ml-2 text-[0.625rem] uppercase tracking-[0.14em] opacity-60">
              console
            </span>
          </Link>

          <nav className="hidden sm:flex gap-1 ml-4">
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

          <Link
            href="/scan"
            className="flex items-center gap-1.5 h-8 px-3 rounded-[6px] border border-[var(--color-critical)] text-[var(--color-critical)] text-xs"
            title="Open an emergency card by QR token"
          >
            <AlertTriangle size={13} /> Break-glass
          </Link>

          <ThemeToggle tone="chrome" />

          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-right leading-tight">
              <span className="block text-sm font-medium">{user.name}</span>
              <span className="block text-[0.6875rem] opacity-60">
                {user.speciality}
                {!user.verified && " · unverified"}
              </span>
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
      </header>

      {/* An unverified doctor can log in and complete their profile but cannot
          open a patient record. A real trust control, shown plainly. */}
      {!user.verified && (
        <div className="bg-[var(--color-warning-soft)] text-[var(--color-warning)] px-4 sm:px-6 py-2 text-sm flex items-center gap-2">
          <Stethoscope size={15} />
          Your medical registration is pending verification. You can complete your
          profile, but patient records stay locked until an administrator verifies you.
        </div>
      )}

      <main className="px-4 sm:px-6 py-5">{children}</main>

      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          onNavigate={(href) => { setPaletteOpen(false); router.push(href); }}
        />
      )}
    </div>
  );
}
