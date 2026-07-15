"use client";

import { useEffect, useState, useTransition } from "react";
import { Building2, CheckCircle2, XCircle } from "lucide-react";
import { DateRangePicker } from "../../components/ui/date-range-picker";
import { StatCard, StatGrid } from "../../components/dashboard/Statcard";
import { getHotelDepartmentAnalytics, type HotelDepartmentAnalytics } from "./actions";

function defaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return d.toISOString().slice(0, 10);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function HotelDepartmentAnalyticsView({
  departmentId,
  departmentName,
}: {
  departmentId: string;
  departmentName: string;
}) {
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(todayISO());
  const [data, setData] = useState<HotelDepartmentAnalytics | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await getHotelDepartmentAnalytics(departmentId, from || null, to || null);
      setData(result);
    });
  }, [departmentId, from, to]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-dashboard-base-content">{departmentName} Analytics</h1>
          <p className="text-sm text-dashboard-base-content/60 mt-0.5">Hotels added by your department</p>
        </div>
        <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
      </div>

      <StatGrid cols={3}>
        <StatCard label="Total Hotels Added" value={data?.totalAdded ?? "—"} icon={Building2} />
        <StatCard label="Active" value={data?.activeAdded ?? "—"} icon={CheckCircle2} />
        <StatCard label="Inactive" value={data?.inactiveAdded ?? "—"} icon={XCircle} />
      </StatGrid>

      <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-dashboard-base-300">
          <p className="text-sm font-semibold text-dashboard-base-content">By Team Member</p>
        </div>
        {isPending && !data ? (
          <p className="px-4 py-6 text-sm text-dashboard-base-content/50 text-center">Loading…</p>
        ) : data && data.byMember.length > 0 ? (
          <div className="divide-y divide-dashboard-base-300">
            {data.byMember.map(m => (
              <div key={m.name} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-dashboard-base-content">{m.name}</span>
                <span className="font-semibold text-dashboard-base-content">{m.count}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-4 py-6 text-sm text-dashboard-base-content/50 text-center">
            No hotels added in this date range.
          </p>
        )}
      </div>
    </div>
  );
}
