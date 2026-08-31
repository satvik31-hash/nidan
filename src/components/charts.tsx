"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie,
  PieChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { fmtDate, rupees } from "@/lib/utils";

// Charts read the palette from CSS custom properties, so light and dark
// each get their own validated steps with no JavaScript theme detection.
export const CHART_HUES = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)",
  "var(--chart-4)", "var(--chart-5)", "var(--chart-6)",
];

const AXIS = {
  stroke: "var(--chart-axis)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

function Box({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[6px] border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 py-2 text-xs shadow-[var(--shadow-card)]">
      {children}
    </div>
  );
}

// ── Single analyte across every uploaded report ───────────────
// One series, so no legend: the title names it. The reference range is
// drawn as a band rather than two lines, so "in range" reads at a glance.
export function AnalyteChart({
  data, analyte, unit, low, high,
}: {
  data: { date: string; value: number; flag: string }[];
  analyte: string; unit: string; low?: number; high?: number;
}) {
  if (data.length < 2) {
    return <p className="text-sm text-[var(--color-ink-3)] py-8 text-center">Not enough reports yet to draw a trend.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={190}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -14 }}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        {low != null && high != null && (
          <ReferenceArea y1={low} y2={high} fill="var(--chart-band)" fillOpacity={1} ifOverflow="extendDomain" />
        )}
        <XAxis dataKey="date" {...AXIS} tickFormatter={(d: string) => fmtDate(d, { day: undefined, year: "2-digit" })} minTickGap={24} />
        <YAxis {...AXIS} width={44} domain={["auto", "auto"]} />
        <Tooltip
          cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "3 3" }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <Box>
                <div className="text-[var(--color-ink-3)]">{fmtDate(String(label))}</div>
                <div className="font-medium">
                  {analyte} {payload[0].value} {unit}
                </div>
                {low != null && <div className="text-[var(--color-ink-3)]">Reference {low}–{high}</div>}
              </Box>
            ) : null
          }
        />
        <Line
          type="monotone" dataKey="value" stroke="var(--chart-1)" strokeWidth={2}
          dot={{ r: 4, strokeWidth: 0, fill: "var(--chart-1)" }}
          activeDot={{ r: 6, stroke: "var(--color-surface)", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Twelve months of billing ──────────────────────────────────
export function MonthBars({
  data, onSelect,
}: { data: { month: string; total: number }[]; onSelect?: (m: string) => void }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="month" {...AXIS} />
        <YAxis {...AXIS} width={52} tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
        <Tooltip
          cursor={{ fill: "var(--chart-grid)", fillOpacity: 0.5 }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <Box>
                <div className="text-[var(--color-ink-3)]">{label}</div>
                <div className="font-medium">{rupees(Number(payload[0].value))}</div>
                <div className="text-[var(--color-ink-3)]">Click to see the bills</div>
              </Box>
            ) : null
          }
        />
        <Bar
          dataKey="total" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={34}
          onClick={(d: { month?: string }) => d.month && onSelect?.(d.month)}
          cursor={onSelect ? "pointer" : undefined}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Spend by category ─────────────────────────────────────────
// Six categories, a legend that is always present, and every slice also
// named in the legend with its value — identity is never colour alone.
export function CategoryDonut({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((a, b) => a + b.value, 0) || 1;
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="w-[168px] h-[168px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data} dataKey="value" nameKey="name"
              innerRadius={48} outerRadius={78} paddingAngle={2}
              stroke="var(--color-surface)" strokeWidth={2}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_HUES[i % CHART_HUES.length]} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <Box>
                    <div className="font-medium">{payload[0].name}</div>
                    <div>{rupees(Number(payload[0].value))} · {Math.round((Number(payload[0].value) / total) * 100)}%</div>
                  </Box>
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="text-sm space-y-1.5 flex-1 min-w-[180px]">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-[2px] shrink-0"
              style={{ background: CHART_HUES[i % CHART_HUES.length] }}
              aria-hidden
            />
            <span className="capitalize flex-1">{d.name}</span>
            <span className="text-[var(--color-ink-2)]">{rupees(d.value)}</span>
            <span className="text-[var(--color-ink-3)] w-10 text-right">
              {Math.round((d.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Cumulative spend since the first visit ────────────────────
export function CumulativeArea({ data }: { data: { date: string; hospital: number; medication: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={190}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="date" {...AXIS} minTickGap={30} />
        <YAxis {...AXIS} width={52} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
        <Tooltip
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <Box>
                <div className="text-[var(--color-ink-3)]">{label}</div>
                {payload.map((p) => (
                  <div key={String(p.dataKey)} className="flex gap-3 justify-between">
                    <span className="capitalize">{String(p.dataKey)}</span>
                    <span className="font-medium">{rupees(Number(p.value))}</span>
                  </div>
                ))}
              </Box>
            ) : null
          }
        />
        <Area type="monotone" dataKey="hospital" stackId="1" stroke="var(--chart-1)" strokeWidth={2} fill="var(--chart-1)" fillOpacity={0.18} />
        <Area type="monotone" dataKey="medication" stackId="1" stroke="var(--chart-2)" strokeWidth={2} fill="var(--chart-2)" fillOpacity={0.18} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Wellness: a sparkline row above one large selected chart ──
export function Sparkline({ data, hue = "var(--chart-1)" }: { data: { v: number }[]; hue?: string }) {
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
        <Line type="monotone" dataKey="v" stroke={hue} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function MetricChart({
  data, unit, label, hue = "var(--chart-1)",
}: { data: { date: string; v: number }[]; unit: string; label: string; hue?: string }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -12 }}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="date" {...AXIS} minTickGap={28} tickFormatter={(d: string) => fmtDate(d, { year: undefined })} />
        <YAxis {...AXIS} width={46} />
        <Tooltip
          cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "3 3" }}
          content={({ active, payload, label: l }) =>
            active && payload?.length ? (
              <Box>
                <div className="text-[var(--color-ink-3)]">{fmtDate(String(l))}</div>
                <div className="font-medium">{label}: {payload[0].value} {unit}</div>
              </Box>
            ) : null
          }
        />
        <Area type="monotone" dataKey="v" stroke={hue} strokeWidth={2} fill={hue} fillOpacity={0.15} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
