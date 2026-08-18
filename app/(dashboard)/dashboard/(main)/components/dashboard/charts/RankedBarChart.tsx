"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList, ResponsiveContainer } from "recharts";

export type RankedBar = { name: string; value: number; color?: string };

type Props = {
  data: RankedBar[];
  height?: number;
  defaultColor?: string;
  barHeight?: number;
  /** Print the value at the end of each bar so it reads at a glance, no hover needed. */
  showValues?: boolean;
};

function RankedTooltip({ active, payload }: {
  active?: boolean;
  payload?: { value: number; payload: RankedBar }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-100 px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-dashboard-base-content">{p.payload.name}</p>
      <p className="text-dashboard-base-content/70">{p.value} action{p.value !== 1 ? "s" : ""}</p>
    </div>
  );
}

export function RankedBarChart({ data, height, defaultColor = "var(--color-dashboard-primary)", barHeight = 28, showValues = false }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-dashboard-base-content/40" style={{ height: height ?? 200 }}>
        No data in this range yet.
      </div>
    );
  }

  const resolvedHeight = height ?? Math.max(120, data.length * (barHeight + 8));

  return (
    <ResponsiveContainer width="100%" height={resolvedHeight}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: showValues ? 32 : 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-dashboard-base-300)" horizontal={false} />
        <XAxis
          type="number"
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "var(--color-dashboard-base-content)", opacity: 0.5 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={{ fontSize: 12, fill: "var(--color-dashboard-base-content)", opacity: 0.8 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<RankedTooltip />} cursor={{ fill: "var(--color-dashboard-base-200)" }} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={barHeight - 8}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color ?? defaultColor} />
          ))}
          {showValues && (
            <LabelList
              dataKey="value"
              position="right"
              style={{ fontSize: 11, fontWeight: 600, fill: "var(--color-dashboard-base-content)" }}
            />
          )}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
