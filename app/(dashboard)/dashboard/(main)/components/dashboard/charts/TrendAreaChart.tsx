"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

export type TrendSeries = { key: string; label: string; color: string };

type Props = {
  data: Record<string, string | number>[];
  series: TrendSeries[];
  xKey?: string;
  height?: number;
};

function TrendTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-100 px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-dashboard-base-content mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-dashboard-base-content/70">{p.name}:</span>
          <span className="font-semibold text-dashboard-base-content">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function TrendAreaChart({ data, series, xKey = "date", height = 260 }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-dashboard-base-content/40" style={{ height }}>
        No activity in this range yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={s.color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-dashboard-base-300)" vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 11, fill: "var(--color-dashboard-base-content)", opacity: 0.5 }}
          axisLine={{ stroke: "var(--color-dashboard-base-300)" }}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "var(--color-dashboard-base-content)", opacity: 0.5 }}
          axisLine={false}
          tickLine={false}
          width={28}
        />
        <Tooltip content={<TrendTooltip />} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />}
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            fill={`url(#fill-${s.key})`}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
