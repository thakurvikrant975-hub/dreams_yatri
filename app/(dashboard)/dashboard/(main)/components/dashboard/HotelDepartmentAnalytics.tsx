"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, CheckCircle2, XCircle, TrendingUp } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { DateRangePicker } from "../ui/date-range-picker";
import { StatCard, StatGrid } from "./Statcard";
import { TrendAreaChart } from "./charts/TrendAreaChart";
import type { HotelDepartmentAnalyticsData } from "../../actions/hotel-department-analytics-actions";

type Props = {
  data: HotelDepartmentAnalyticsData;
  from: string;
  to: string;
};

function todayStr() {
  return new Date().toISOString().split("T")[0];
}
function daysAgoStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function DashCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl overflow-hidden bg-dashboard-base-100 border border-dashboard-base-300", className)}>
      {children}
    </div>
  );
}
function DashCardHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 text-dashboard-neutral-content bg-dashboard-neutral border-b border-dashboard-base-300">
      {children}
    </div>
  );
}

export function HotelDepartmentAnalytics({ data, from, to }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const isToday = from === todayStr() && to === todayStr();
  const isLast7 = from === daysAgoStr(6) && to === todayStr();
  const isLast30 = from === daysAgoStr(29) && to === todayStr();

  function setRange(newFrom: string, newTo: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", newFrom);
    params.set("to", newTo);
    startTransition(() => router.replace(`?${params.toString()}`));
  }

  return (
    <div className="space-y-6">

      {/* ── Range controls ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-2 justify-between">
        <div className="flex items-center gap-1.5">
          {[
            { label: "Today", active: isToday, onClick: () => setRange(todayStr(), todayStr()) },
            { label: "Last 7 days", active: isLast7, onClick: () => setRange(daysAgoStr(6), todayStr()) },
            { label: "Last 30 days", active: isLast30, onClick: () => setRange(daysAgoStr(29), todayStr()) },
          ].map((b) => (
            <button
              key={b.label}
              type="button"
              onClick={b.onClick}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                b.active
                  ? "bg-dashboard-primary text-dashboard-primary-content"
                  : "bg-dashboard-base-200 text-dashboard-base-content/70 hover:bg-dashboard-base-300",
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
        <DateRangePicker from={from} to={to} onFromChange={(v) => setRange(v, to)} onToChange={(v) => setRange(from, v)} />
      </div>

      {/* ── KPI row ───────────────────────────────────────────────────────── */}
      <StatGrid cols={3}>
        <StatCard label="Hotels Added" value={data.totalAdded} icon={Building2} />
        <StatCard
          label="Active" value={data.activeAdded} icon={CheckCircle2}
          iconColor="bg-dashboard-success/10" iconText="text-dashboard-success"
        />
        <StatCard
          label="Inactive" value={data.inactiveAdded} icon={XCircle}
          iconColor="bg-dashboard-error/10" iconText="text-dashboard-error"
        />
      </StatGrid>

      {/* ── Trend ─────────────────────────────────────────────────────────── */}
      <DashCard>
        <DashCardHeader>
          <TrendingUp className="h-4 w-4" />
          <p className="text-sm font-semibold">Hotels added over time</p>
        </DashCardHeader>
        <div className="p-4">
          <TrendAreaChart
            data={data.dailyTrend}
            series={[{ key: "added", label: "Hotels added", color: "var(--color-dashboard-primary)" }]}
          />
        </div>
      </DashCard>

      {/* ── By team member ───────────────────────────────────────────────── */}
      <DashCard>
        <DashCardHeader>
          <Building2 className="h-4 w-4" />
          <p className="text-sm font-semibold">By team member</p>
        </DashCardHeader>
        {data.byMember.length > 0 ? (
          <div className="divide-y divide-dashboard-base-300">
            {data.byMember.map((m) => (
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
      </DashCard>
    </div>
  );
}
