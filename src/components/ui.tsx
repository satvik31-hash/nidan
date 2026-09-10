import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ── Button ────────────────────────────────────────────────────
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-[6px] font-medium transition-colors " +
  "disabled:opacity-50 disabled:pointer-events-none select-none";

const BUTTON_VARIANTS: Record<string, string> = {
  primary: "bg-[var(--color-brand)] text-[var(--color-on-brand)] hover:bg-[var(--color-brand-ink)]",
  secondary:
    "border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-paper)]",
  ghost: "text-[var(--color-ink-2)] hover:bg-[var(--color-paper)]",
  danger: "bg-[var(--color-critical)] text-[var(--color-on-critical)] hover:opacity-90",
};

const BUTTON_SIZES: Record<string, string> = {
  sm: "h-8 px-3 text-[0.8125rem]",
  md: "h-10 px-4 text-[0.9375rem]",
  lg: "h-12 px-6 text-base",
};

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
      {...props}
    />
  );
}

export function LinkButton({
  href, variant = "primary", size = "md", className, children, ...rest
}: { href: string; variant?: ButtonProps["variant"]; size?: ButtonProps["size"]; className?: string; children: React.ReactNode } & Omit<React.ComponentProps<typeof Link>, "href" | "className" | "children">) {
  return (
    <Link
      href={href}
      className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant!], BUTTON_SIZES[size!], className)}
      {...rest}
    >
      {children}
    </Link>
  );
}

// ── Card ──────────────────────────────────────────────────────
export function Card({
  className, children, as: As = "div",
}: { className?: string; children: React.ReactNode; as?: React.ElementType }) {
  return <As className={cn("card p-4", className)}>{children}</As>;
}

export function SectionTitle({
  eyebrow, title, action, className,
}: { eyebrow?: string; title: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-end justify-between gap-4 mb-3", className)}>
      <div>
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h2 className="text-[1.0625rem] font-semibold tracking-tight">{title}</h2>
      </div>
      {action}
    </div>
  );
}

// ── Status colour is never carried by colour alone ────────────
export type Tone = "neutral" | "brand" | "good" | "warning" | "critical";

const TONE_STYLES: Record<Tone, string> = {
  neutral: "text-[var(--color-ink-2)] border-[var(--color-line)] bg-[var(--color-surface)]",
  brand: "text-[var(--color-brand-ink)] border-[color-mix(in_srgb,var(--color-brand)_35%,transparent)] bg-[var(--color-brand-soft)]",
  good: "text-[var(--color-good)] border-[color-mix(in_srgb,var(--color-good)_35%,transparent)] bg-[var(--color-good-soft)]",
  warning: "text-[var(--color-warning)] border-[color-mix(in_srgb,var(--color-warning)_35%,transparent)] bg-[var(--color-warning-soft)]",
  critical: "text-[var(--color-critical)] border-[color-mix(in_srgb,var(--color-critical)_40%,transparent)] bg-[var(--color-critical-soft)]",
};

export function Badge({
  tone = "neutral", icon, children, className,
}: { tone?: Tone; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("pill", TONE_STYLES[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

// ── Stat tile ─────────────────────────────────────────────────
export function Stat({
  label, value, sub, tone = "neutral",
}: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: Tone }) {
  return (
    <div className="card p-3">
      <div className="eyebrow">{label}</div>
      <div
        className={cn(
          "text-[1.75rem] font-semibold leading-tight mt-1",
          tone === "critical" && "text-[var(--color-critical)]",
          tone === "warning" && "text-[var(--color-warning)]",
          tone === "good" && "text-[var(--color-good)]",
          tone === "brand" && "text-[var(--color-brand)]",
        )}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-[var(--color-ink-3)] mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Empty states carry an action, never a shrug ───────────────
export function Empty({
  title, body, action,
}: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="card p-8 text-center">
      <p className="font-medium">{title}</p>
      {body && <p className="text-sm text-[var(--color-ink-3)] mt-1 max-w-sm mx-auto">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4 w-full", className)} />;
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card p-4 space-y-2">
          <Skeleton className="w-1/3" />
          <Skeleton className="w-2/3 h-3" />
        </div>
      ))}
    </div>
  );
}

// ── Field wrappers ────────────────────────────────────────────
export function Field({
  label, hint, error, children, className,
}: { label?: string; hint?: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      {label && <span className="label">{label}</span>}
      {children}
      {hint && !error && <span className="block text-xs text-[var(--color-ink-3)] mt-1">{hint}</span>}
      {error && <span className="block text-xs text-[var(--color-critical)] mt-1">{error}</span>}
    </label>
  );
}

// ── Provenance chip: who recorded this value, and when ────────
export function Provenance({ by, at, self }: { by: string; at: string; self?: boolean }) {
  return (
    <span
      className={cn(
        "pill text-[0.6875rem]",
        self ? TONE_STYLES.warning : TONE_STYLES.neutral,
      )}
      title={`${self ? "Self-reported" : "Recorded"} by ${by} on ${at}`}
    >
      {self ? "self-reported" : by}
    </span>
  );
}

// ── The AI label. Never optional. ─────────────────────────────
export function AiLabel({ source }: { source?: string }) {
  return (
    <span className="pill text-[0.6875rem] border-[color-mix(in_srgb,var(--color-brand)_35%,transparent)] bg-[var(--color-brand-soft)] text-[var(--color-brand-ink)]">
      AI-generated{source === "offline" ? " · offline" : ""} · confirm before use
    </span>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-[var(--color-line)]", className)} />;
}

// ── Table primitives — styling only, no logic. Used by the admin portal's
//    list pages, which is the first place this app needs a plain data grid. ──
export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  );
}

export function Tr({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <tr className={cn("transition-colors hover:bg-[var(--color-paper)]", className)}>{children}</tr>
  );
}

export function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn("text-left font-medium text-xs text-[var(--color-ink-3)] uppercase tracking-wide px-3 py-2 border-b border-[var(--color-line)]", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={cn("px-3 py-2.5 border-b border-[var(--color-line)] align-middle", className)}>
      {children}
    </td>
  );
}

export function KeyValue({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 border-b border-[var(--color-line)] last:border-0">
      <span className="text-xs text-[var(--color-ink-3)]">{k}</span>
      <span className="text-sm text-right">{v ?? "—"}</span>
    </div>
  );
}
