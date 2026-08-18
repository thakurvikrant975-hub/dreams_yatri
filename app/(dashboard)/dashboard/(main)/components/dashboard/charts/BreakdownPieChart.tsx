"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

export type PieSlice = { name: string; value: number; color: string };

type Props = {
  data: PieSlice[];
  height?: number;
  /** Print "name: value" directly on/around each slice so it reads at a glance, no hover needed. */
  showLabels?: boolean;
};

function PieTooltip({ active, payload }: {
  active?: boolean;
  payload?: { name: string; value: number; payload: PieSlice }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-100 px-3 py-2 shadow-lg text-xs">
      <div className="flex items-center gap-1.5">
        <span className="size-2 rounded-full" style={{ backgroundColor: p.payload.color }} />
        <span className="text-dashboard-base-content/70">{p.name}:</span>
        <span className="font-semibold text-dashboard-base-content">{p.value}</span>
      </div>
    </div>
  );
}

export function BreakdownPieChart({ data, height = 260, showLabels = false }: Props) {
  const filtered = data.filter((d) => d.value > 0);

  if (filtered.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-dashboard-base-content/40" style={{ height }}>
        No data in this range yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={showLabels ? height + 20 : height}>
      <PieChart margin={showLabels ? { top: 10, right: 40, bottom: 10, left: 40 } : undefined}>
        <Pie
          data={filtered}
          dataKey="value"
          nameKey="name"
          innerRadius="45%"
          outerRadius={showLabels ? "65%" : "80%"}
          paddingAngle={2}
          strokeWidth={0}
          label={showLabels ? ({ name, value }) => `${name}: ${value}` : undefined}
          labelLine={showLabels ? { stroke: "var(--color-dashboard-base-content)", strokeOpacity: 0.35 } : false}
        >
          {filtered.map((slice) => (
            <Cell key={slice.name} fill={slice.color} />
          ))}
        </Pie>
        <Tooltip content={<PieTooltip />} />
        {!showLabels && (
          <Legend
            layout="vertical"
            verticalAlign="middle"
            align="right"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, lineHeight: "20px" }}
          />
        )}
      </PieChart>
    </ResponsiveContainer>
  );
}
