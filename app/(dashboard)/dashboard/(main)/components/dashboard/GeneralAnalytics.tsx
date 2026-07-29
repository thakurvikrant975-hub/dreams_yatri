"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, IndianRupee, TrendingUp, XCircle, MapPin, PieChart as PieChartIcon } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { formatPaiseRoundedUp } from "@/app/lib/money";
import { DateRangePicker } from "../ui/date-range-picker";
import { StatCard, StatGrid } from "./Statcard";
import { TrendAreaChart } from "./charts/TrendAreaChart";
import { BreakdownPieChart } from "./charts/BreakdownPieChart";
import { RankedBarChart } from "./charts/RankedBarChart";
import type { GeneralAnalyticsData } from "../../actions/general-analytics-actions";

type Props = {
  data: GeneralAnalyticsData;
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

export function GeneralAnalytics({ data, from, to }: Props) {
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

  const rangeLabel = from === to
    ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${from}T00:00:00`))
    : `${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(`${from}T00:00:00`))} – ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${to}T00:00:00`))}`;

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
          label="Bookings" value={data.totalBookings} icon={BookOpen}
          iconColor="bg-dashboard-primary/10" iconText="text-dashboard-primary"
          sub={rangeLabel}
        />
        <StatCard
          label="Revenue" value={formatPaiseRoundedUp(data.totalRevenuePaise)} icon={IndianRupee}
          iconColor="bg-dashboard-success/10" iconText="text-dashboard-success"
          sub="confirmed & completed bookings"
        />
        <StatCard
          label="Avg. booking value" value={formatPaiseRoundedUp(data.avgBookingValuePaise)} icon={TrendingUp}
          iconColor="bg-dashboard-info/10" iconText="text-dashboard-info"
          sub="per booking, this range"
        />
        <StatCard
          label="Cancelled" value={data.cancelledBookings} icon={XCircle}
          iconColor="bg-dashboard-error/10" iconText="text-dashboard-error"
          sub={`of ${data.totalBookings} total`}
        />
      </StatGrid>

      {/* ── Charts ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashCard>
          <DashCardHeader>
            <BookOpen className="h-4 w-4" />
            <p className="text-sm font-semibold">Bookings over time</p>
          </DashCardHeader>
          <div className="p-4">
            <TrendAreaChart
              data={data.dailyTrend}
              series={[{ key: "bookings", label: "Bookings", color: "var(--color-dashboard-primary)" }]}
            />
          </div>
        </DashCard>

        <DashCard>
          <DashCardHeader>
            <IndianRupee className="h-4 w-4" />
            <p className="text-sm font-semibold">Revenue over time (₹)</p>
          </DashCardHeader>
          <div className="p-4">
            <TrendAreaChart
              data={data.dailyTrend}
              series={[{ key: "revenue", label: "Revenue (₹)", color: "var(--color-dashboard-success)" }]}
            />
          </div>
        </DashCard>

        <DashCard>
          <DashCardHeader>
            <PieChartIcon className="h-4 w-4" />
            <p className="text-sm font-semibold">Booking status breakdown</p>
          </DashCardHeader>
          <div className="p-4">
            <BreakdownPieChart data={data.statusBreakdown} />
          </div>
        </DashCard>

        <DashCard>
          <DashCardHeader>
            <MapPin className="h-4 w-4" />
            <p className="text-sm font-semibold">Top destinations</p>
          </DashCardHeader>
          <div className="p-4">
            <RankedBarChart data={data.topDestinations} height={260} />
          </div>
        </DashCard>
      </div>
    </div>
  );
}
