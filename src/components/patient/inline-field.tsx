"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Click the field, edit, blur to save, toast confirms. No edit mode. */
export function InlineField({
  name, label, value, action, type = "text", options, className,
}: {
  name: string;
  label: string;
  value: string;
  action: (name: string, value: string) => Promise<{ ok: boolean; error?: string }>;
  type?: string;
  options?: string[];
  className?: string;
}) {
  const [v, setV] = useState(value);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const commit = () => {
    if (v === value) return;
    start(async () => {
      const r = await action(name, v);
      if (r.ok) {
        setSaved(true);
        setError(null);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError(r.error ?? "Could not save");
      }
    });
  };

  return (
    <div className={cn("py-2 border-b border-[var(--color-line)]", className)}>
      <span className="label flex items-center gap-1.5">
        {label}
        {/* ARIA live region for save state, so the change is announced */}
        <span aria-live="polite" className="normal-case tracking-normal">
          {pending && <span className="text-[var(--color-ink-3)]">saving…</span>}
          {saved && (
            <span className="text-[var(--color-good)] inline-flex items-center gap-0.5">
              <Check size={11} /> saved
            </span>
          )}
        </span>
      </span>
      {options ? (
        <select
          className="field h-9 py-0"
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={commit}
          disabled={pending}
        >
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : (
        <input
          className="field h-9 py-0"
          type={type}
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={commit}
          disabled={pending}
        />
      )}
      {error && <span className="text-xs text-[var(--color-critical)]">{error}</span>}
    </div>
  );
}
