export function CompletenessRing({ pct }: { pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const tone =
    pct >= 90 ? "var(--color-good)" : pct >= 60 ? "var(--color-brand)" : "var(--color-warning)";
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`Profile ${pct} percent complete`}>
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--color-line)" strokeWidth="6" />
      <circle
        cx="32" cy="32" r={r} fill="none" stroke={tone} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
        transform="rotate(-90 32 32)"
      />
      <text
        x="32" y="36" textAnchor="middle"
        fontSize="15" fontWeight="600" fill="var(--color-ink)"
      >
        {pct}%
      </text>
    </svg>
  );
}
