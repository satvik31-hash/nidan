"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { CommandEntry } from "@/lib/commands";

interface Hit { label: string; sub?: string; href: string; icon: React.ElementType }

export function CommandPalette({
  staticHits, search, placeholder, onClose, onNavigate,
}: {
  /** The fixed, role-specific destinations — e.g. `doctorCommands` from `@/lib/commands`. */
  staticHits: CommandEntry[];
  /** Optional live search (e.g. patient lookup by name/MRN), keyed by the typed query. */
  search?: (q: string) => Promise<Hit[]>;
  placeholder?: string;
  onClose: () => void;
  onNavigate: (href: string) => void;
}) {
  const [q, setQ] = useState("");
  const [liveHits, setLiveHits] = useState<Hit[]>([]);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!search || q.length < 2) { setLiveHits([]); return; }
    let cancelled = false;
    search(q).then((hits) => { if (!cancelled) setLiveHits(hits); }).catch(() => {});
    return () => { cancelled = true; };
  }, [q, search]);

  const hits = useMemo(() => {
    const needle = q.toLowerCase();
    const statics = staticHits.filter((h) => !needle || h.label.toLowerCase().includes(needle));
    return [...liveHits, ...statics];
  }, [q, liveHits, staticHits]);

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
            placeholder={placeholder ?? "Jump to…"}
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
