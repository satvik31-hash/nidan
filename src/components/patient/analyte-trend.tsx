"use client";

import { AnalyteChart } from "@/components/charts";

const REF: Record<string, [number, number]> = {
  Haemoglobin: [12, 15],
  Creatinine: [0.6, 1.2],
  TLC: [4000, 11000],
};

export function AnalyteTrend({
  data, analyte,
}: { data: { date: string; value: number; unit: string; flag: string; ref: string }[]; analyte: string }) {
  const [low, high] = REF[analyte] ?? [];
  const unit = data[0]?.unit ?? "";
  const latest = data[data.length - 1];

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1">
        <h3 className="font-semibold">{analyte}</h3>
        {latest && (
          <span className="text-sm text-[var(--color-ink-2)]">
            latest {latest.value} {unit}
            {latest.flag !== "normal" && (
              <span className={latest.flag === "high" ? "text-[var(--color-critical)]" : "text-[var(--color-warning)]"}>
                {" "}({latest.flag})
              </span>
            )}
          </span>
        )}
      </div>
      <AnalyteChart data={data} analyte={analyte} unit={unit} low={low} high={high} />
      {low != null && (
        <p className="text-xs text-[var(--color-ink-3)] mt-1">
          Shaded band is the reference range, {low}–{high} {unit}.
        </p>
      )}
    </div>
  );
}
