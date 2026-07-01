"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity, Users, Flame, Trophy, ChevronDown, ChevronRight,
  PlusCircle, Pencil, Trash2, Clock, Building2, Car, Map as MapIcon, PieChart as PieChartIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/app/lib/utils";
import { DateRangePicker } from "../ui/date-range-picker";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { StatCard, StatGrid } from "./Statcard";
import { TrendAreaChart } from "./charts/TrendAreaChart";
import { BreakdownPieChart } from "./charts/BreakdownPieChart";
import { RankedBarChart } from "./charts/RankedBarChart";
import type {
  PlatformManagerAnalyticsData, DepartmentKey,
} from "../../actions/platform-manager-analytics-actions";

type Props = {
  data: PlatformManagerAnalyticsData;
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

function fmtTime(d: Date) {
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }).format(new Date(d));
}

const ACTION_ICON: Record<string, React.ElementType> = {
  CREATE: PlusCircle,
  UPDATE: Pencil,
  DELETE: Trash2,
};
const ACTION_STYLE: Record<string, string> = {
  CREATE: "bg-dashboard-success/10 text-dashboard-success",
  UPDATE: "bg-dashboard-info/10 text-dashboard-info",
  DELETE: "bg-dashboard-error/10 text-dashboard-error",
};

const DEPT_ICON: Record<DepartmentKey, LucideIcon> = {
  hotel: Building2,
  cab: Car,
  travel: MapIcon,
};
const DEPT_BADGE_STYLE: Record<string, string> = {
  "Hotel Department": "bg-dashboard-primary/10 text-dashboard-primary",
  "Cab Department": "bg-dashboard-info/10 text-dashboard-info",
  "Travel Expert": "bg-dashboard-secondary/10 text-dashboard-secondary",
  "Hotel & Cab": "bg-dashboard-warning/10 text-dashboard-warning",
};

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

export function PlatformManagerAnalytics({ data, from, to }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [deptFilter, setDeptFilter] = useState<"all" | DepartmentKey>("all");

  const isToday = from === todayStr() && to === todayStr();
  const isLast7 = from === daysAgoStr(6) && to === todayStr();
  const isLast30 = from === daysAgoStr(29) && to === todayStr();

  function setRange(newFrom: string, newTo: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", newFrom);
    params.set("to", newTo);
    startTransition(() => router.replace(`?${params.toString()}`));
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const rangeLabel = from === to
    ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${from}T00:00:00`))
    : `${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(`${from}T00:00:00`))} – ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${to}T00:00:00`))}`;

  const visibleWorkReport = useMemo(() => {
    if (deptFilter === "all") return data.workReport;
    return data.workReport.filter((emp) => emp.departmentKeys.includes(deptFilter));
  }, [data.workReport, deptFilter]);

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
      <StatGrid cols={4}>
        <StatCard
          label="Total actions" value={data.totalActions} icon={Activity}
          iconColor="bg-dashboard-primary/10" iconText="text-dashboard-primary"
          sub={rangeLabel}
        />
        <StatCard
          label="Active employees" value={`${data.activeEmployees}/${data.totalEmployees}`} icon={Users}
          iconColor="bg-dashboard-secondary/10" iconText="text-dashboard-secondary"
          sub="logged at least one action"
        />
        <StatCard
          label="Busiest day" value={data.busiestDay?.count ?? 0} icon={Flame}
          iconColor="bg-dashboard-warning/10" iconText="text-dashboard-warning"
          sub={data.busiestDay?.date ?? "No activity yet"}
        />
        <StatCard
          label="Top performer" value={data.topEmployee?.count ?? 0} icon={Trophy}
          iconColor="bg-dashboard-success/10" iconText="text-dashboard-success"
          sub={data.topEmployee?.name ?? "No activity yet"}
        />
      </StatGrid>

      {/* ── Department breakdown ─────────────────────────────────────────── */}
      <StatGrid cols={3}>
        {data.departments.map((dept) => {
          const Icon = DEPT_ICON[dept.key];
          return (
            <StatCard
              key={dept.key}
              label={dept.label}
              value={dept.totalActions}
              icon={Icon}
              sub={
                dept.topEmployee
                  ? `${dept.activeEmployees}/${dept.totalEmployees} active · top: ${dept.topEmployee.name} (${dept.topEmployee.count})`
                  : `${dept.activeEmployees}/${dept.totalEmployees} active · no activity yet`
              }
            />
          );
        })}
      </StatGrid>

      {/* ── Work report (primary) ────────────────────────────────────────── */}
      <DashCard>
        <DashCardHeader>
          <Clock className="h-4 w-4" />
          <p className="text-sm font-semibold flex-1">Work report — who did what</p>
        </DashCardHeader>

        <div className="px-4 pt-3">
          <Tabs value={deptFilter} onValueChange={(v) => setDeptFilter(v as "all" | DepartmentKey)}>
            <TabsList variant="line">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="hotel">Hotel Department</TabsTrigger>
              <TabsTrigger value="cab">Cab Department</TabsTrigger>
              <TabsTrigger value="travel">Travel Expert</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {visibleWorkReport.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-6">
            <span className="text-3xl">🗂️</span>
            <p className="text-sm font-medium text-dashboard-base-content">No team members in this department yet.</p>
          </div>
        ) : (
          <div>
            {visibleWorkReport.map((emp) => {
              const isOpen = expanded.has(emp.id);
              return (
                <div key={emp.id} className="border-t border-dashboard-base-300 first:border-t-0">
                  <button
                    type="button"
                    onClick={() => toggle(emp.id)}
                    disabled={emp.entries.length === 0}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-dashboard-base-200/60 transition-colors disabled:cursor-default disabled:hover:bg-transparent"
                  >
                    {emp.entries.length > 0 ? (
                      isOpen
                        ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-dashboard-base-content/40" />
                        : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-dashboard-base-content/40" />
                    ) : (
                      <span className="w-3.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-dashboard-base-content">{emp.name}</p>
                        <span className={cn(
                          "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                          DEPT_BADGE_STYLE[emp.departmentLabel] ?? "bg-dashboard-base-300 text-dashboard-base-content/60",
                        )}>
                          {emp.departmentLabel}
                        </span>
                        <span className="text-[10px] text-dashboard-base-content/40">{emp.role}</span>
                      </div>
                      {emp.total > 0 && (
                        <p className="text-xs text-dashboard-base-content/45 mt-0.5">
                          {emp.create > 0 && `${emp.create} created`}
                          {emp.create > 0 && (emp.update > 0 || emp.delete > 0) && " · "}
                          {emp.update > 0 && `${emp.update} updated`}
                          {emp.update > 0 && emp.delete > 0 && " · "}
                          {emp.delete > 0 && `${emp.delete} deleted`}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-bold text-dashboard-base-content tabular-nums">{emp.total}</p>
                      <p className="text-[10px] text-dashboard-base-content/40">action{emp.total !== 1 ? "s" : ""}</p>
                    </div>
                  </button>

                  {isOpen && emp.entries.length > 0 && (
                    <div className="bg-dashboard-base-200/40 px-4 py-2">
                      {emp.entries.map((entry) => {
                        const Icon = ACTION_ICON[entry.action] ?? PlusCircle;
                        const style = ACTION_STYLE[entry.action] ?? "bg-dashboard-base-300 text-dashboard-neutral";
                        return (
                          <div key={entry.id} className="flex items-center gap-3 py-2 border-b border-dashboard-base-300/50 last:border-b-0">
                            <div className={cn("h-6 w-6 rounded-md flex items-center justify-center shrink-0", style)}>
                              <Icon className="h-3 w-3" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-dashboard-base-content truncate">
                                {entry.description ?? `${entry.action.toLowerCase()}d ${entry.entity}`}
                              </p>
                            </div>
                            <span className="shrink-0 text-[10px] text-dashboard-base-content/40">{fmtTime(entry.actionAt)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DashCard>

      {/* ── Charts ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashCard>
          <DashCardHeader>
            <Activity className="h-4 w-4" />
            <p className="text-sm font-semibold">Daily activity trend</p>
          </DashCardHeader>
          <div className="p-4">
            <TrendAreaChart
              data={data.dailyTrend}
              series={[
                { key: "Hotel Department", label: "Hotel Department", color: "var(--color-dashboard-primary)" },
                { key: "Cab Department", label: "Cab Department", color: "var(--color-dashboard-info)" },
                { key: "Travel Expert", label: "Travel Expert", color: "var(--color-dashboard-secondary)" },
              ]}
            />
          </div>
        </DashCard>

        <DashCard>
          <DashCardHeader>
            <PieChartIcon className="h-4 w-4" />
            <p className="text-sm font-semibold">Share of work by department</p>
          </DashCardHeader>
          <div className="p-4">
            <BreakdownPieChart data={data.departmentBreakdown} />
          </div>
        </DashCard>

        <DashCard>
          <DashCardHeader>
            <Trophy className="h-4 w-4" />
            <p className="text-sm font-semibold">Employee leaderboard</p>
          </DashCardHeader>
          <div className="p-4">
            <RankedBarChart data={data.leaderboard} height={260} />
          </div>
        </DashCard>

        <DashCard>
          <DashCardHeader>
            <Users className="h-4 w-4" />
            <p className="text-sm font-semibold">Work by category</p>
          </DashCardHeader>
          <div className="p-4">
            <RankedBarChart data={data.entityBreakdown} height={260} />
          </div>
        </DashCard>

        <DashCard>
          <DashCardHeader>
            <Activity className="h-4 w-4" />
            <p className="text-sm font-semibold">Action type split</p>
          </DashCardHeader>
          <div className="p-4">
            <BreakdownPieChart data={data.actionBreakdown} />
          </div>
        </DashCard>
      </div>
    </div>
  );
}
