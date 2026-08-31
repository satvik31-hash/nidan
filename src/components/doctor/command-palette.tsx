"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, FileText, Search, Stethoscope, User } from "lucide-react";

interface Hit { label: string; sub?: string; href: string; icon: React.ElementType }

const STATIC: Hit[] = [
  { label: "Today's queue", href: "/doctor", icon: CalendarDays },
  { label: "Patient lookup", href: "/doctor/lookup", icon: Search },
  { label: "My profile and availability", href: "/doctor/profile", icon: User },
  { label: "Open an emergency card", sub: "break-glass", href: "/scan", icon: Stethoscope },
];

export function CommandPalette({
  onClose, onNavigate,
}: { onClose: () => void; onNavigate: (href: string) => void }) {
  const [q, setQ] = useState("");
  const [patients, setPatients] = useState<Hit[]>([]);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (q.length < 2) { setPatients([]); return; }
    const c = new AbortController();
    fetch(`/api/patients?q=${encodeURIComponent(q)}`, { signal: c.signal })
      .then((r) => r.json())
      .then((j: { results: { id: string; full_name: string; mrn: string; age: number }[] }) =>
        setPatients(
          j.results.map((p) => ({
            label: p.full_name,
            sub: `${p.mrn} · ${p.age} y`,
            href: `/doctor/patient/${p.id}`,
            icon: FileText,
          })),
        ),
      )
      .catch(() => {});
    return () => c.abort();
  }, [q]);

  const hits = useMemo(() => {
    const needle = q.toLowerCase();
    const statics = STATIC.filter((h) => !needle || h.label.toLowerCase().includes(needle));
    return [...patients, ...statics];
  }, [q, patients]);

  useEffect(() => setCursor(0), [q]);

  return (
    <div className="fixed inset-0 z-50 p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative mx-auto w-full max-w-lg card-elevated overflow-hidden p-0">
        <div className="flex items-center gap-2 px-3 border-b border-[var(--color-line)]">
          <Search size={16} className="text-[var(--color-ink-3)]" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, hits.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
              if (e.key === "Enter" && hits[cursor]) onNavigate(hits[cursor].href);
            }}
            placeholder="Jump to a patient by name, MRN, ABHA or phone…"
            className="w-full h-12 bg-transparent outline-none text-[0.9375rem]"
          />
        </div>
        <ul className="max-h-80 overflow-y-auto">
          {hits.length === 0 ? (
            <li className="px-4 py-6 text-sm text-[var(--color-ink-3)] text-center">
              Nothing matches.
            </li>
          ) : (
            hits.map((h, i) => {
              const Icon = h.icon;
              return (
                <li key={h.href + h.label}>
                  <button
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => onNavigate(h.href)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left ${
                      i === cursor ? "bg-[var(--color-brand-soft)]" : ""
                    }`}
                  >
                    <Icon size={16} className="text-[var(--color-ink-3)] shrink-0" />
                    <span className="min-w-0">
                      <span className="block truncate">{h.label}</span>
                      {h.sub && <span className="block text-xs text-[var(--color-ink-3)]">{h.sub}</span>}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <div className="px-4 py-2 border-t border-[var(--color-line)] text-[0.6875rem] text-[var(--color-ink-3)] flex gap-3">
          <span><kbd className="font-mono">↑↓</kbd> move</span>
          <span><kbd className="font-mono">↵</kbd> open</span>
          <span><kbd className="font-mono">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
