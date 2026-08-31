"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export type Theme = "light" | "dark";

export const THEME_KEY = "nidan-theme";

/**
 * Light / dark switch.
 *
 * Two explicit states, not a single icon that cycles: a doctor glancing at
 * this has to be able to tell which theme is on without clicking to find out.
 * There is deliberately no "System" option — the app does not follow the
 * operating system (see globals.css), because a clinic screen that flips to
 * dark on its own is a different product from the one that was reviewed.
 *
 * The choice is written to localStorage and re-applied before first paint by
 * the inline script in the root layout, so there is no flash of the wrong
 * theme on the next page load. That means the source of truth at runtime is
 * the `data-theme` attribute, not React state — this component reads it on
 * mount rather than assuming.
 */
export function ThemeToggle({ className, tone = "default" }: {
  className?: string;
  /** "chrome" inverts the control for the dark console bar. */
  tone?: "default" | "chrome";
}) {
  // Render light on the server; correct it on mount. Guessing here would give
  // a hydration mismatch, because only the browser knows what was stored.
  const [theme, setTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "dark" : "light");
    setReady(true);
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Private browsing, or storage disabled. The theme still applies for
      // this page view; it just will not be remembered. Not worth an error.
    }
  }

  const OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
    { value: "light", label: "Light", Icon: Sun },
    { value: "dark", label: "Dark", Icon: Moon },
  ];

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className={cn(
        "inline-flex rounded-[var(--radius-pill)] p-0.5 border",
        tone === "chrome"
          ? "border-white/15 bg-white/5"
          : "border-[var(--color-line)] bg-[var(--color-surface)]",
        className,
      )}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = ready && theme === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => apply(value)}
            aria-pressed={active}
            // The visible word is hidden below the sm breakpoint, so the
            // accessible name has to come from the label, not the content.
            aria-label={`${label} theme`}
            title={`${label} theme`}
            className={cn(
              "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[var(--radius-pill)] text-xs transition-colors",
              active
                ? "bg-[var(--color-brand)] text-[var(--color-on-brand)] font-medium"
                : tone === "chrome"
                  ? "text-white/70 hover:text-white"
                  : "text-[var(--color-ink-2)] hover:text-[var(--color-ink)]",
            )}
          >
            <Icon size={13} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
