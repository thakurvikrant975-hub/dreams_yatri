"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Building2, Car, TreePalm, Users, Loader2, CalendarRange } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { HotelReportTab } from "./HotelReportTab";
import { CabReportTab } from "./CabReportTab";
import { TravelReportTab } from "./TravelReportTab";
import { SalesReportTab } from "./SalesReportTab";
import type { ReportsData, TimePeriod } from "./actions";

// ── Types ──────────────────────────────────────────────────────────────────

type Dept = "hotel" | "cab" | "travel" | "sales";

type Props = {
  data: ReportsData;
  initialPeriod: TimePeriod;
  initialFrom?: string;
  initialTo?: string;
  initialDept: Dept;
};

// ── Period labels ──────────────────────────────────────────────────────────

const PERIOD_OPTIONS: { value: TimePeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This Week" },
  { value: "current_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "custom", label: "Custom" },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(s: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(s));
}


// ── Main Client ────────────────────────────────────────────────────────────

export function ReportsClient({
  data,
  initialPeriod,
  initialFrom,
  initialTo,
  initialDept,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [period, setPeriod] = useState<TimePeriod>(initialPeriod);
  const [customFrom, setCustomFrom] = useState(initialFrom ?? "");
  const [customTo, setCustomTo] = useState(initialTo ?? "");
  const [dept, setDept] = useState(initialDept);

  const navigate = useCallback(
    (p: TimePeriod, f?: string, t?: string, d?: string) => {
      const params = new URLSearchParams();
      params.set("period", p);
      if (p === "custom" && f && t) {
        params.set("from", f);
        params.set("to", t);
      }
      params.set("dept", d ?? dept);
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [router, pathname, dept],
  );

  function handlePeriodClick(p: TimePeriod) {
    setPeriod(p);
    if (p !== "custom") navigate(p);
  }

  function handleCustomApply() {
    if (customFrom && customTo) navigate("custom", customFrom, customTo);
  }


  const dateLabel =
    data.fromStr === data.toStr
      ? fmtDate(data.fromStr)
      : `${fmtDate(data.fromStr)} – ${fmtDate(data.toStr)}`;

  return (
    <div className="space-y-5">

      {/* ── Time Period Bar ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-3">

          {/* Pills */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-dashboard-base-200 flex-wrap">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handlePeriodClick(opt.value)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer",
                  period === opt.value
                    ? "bg-dashboard-primary text-dashboard-primary-content shadow-sm"
                    : "text-dashboard-base-content/60 hover:text-dashboard-base-content hover:bg-dashboard-base-100",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Custom date inputs */}
          {period === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-8 rounded-md border border-dashboard-base-300 bg-dashboard-base-100 px-2 text-xs text-dashboard-base-content outline-none focus:border-dashboard-primary"
              />
              <span className="text-dashboard-base-content/40 text-xs">→</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-8 rounded-md border border-dashboard-base-300 bg-dashboard-base-100 px-2 text-xs text-dashboard-base-content outline-none focus:border-dashboard-primary"
              />
              <button
                onClick={handleCustomApply}
                disabled={!customFrom || !customTo}
                className="h-8 px-3 rounded-md bg-dashboard-primary text-dashboard-primary-content text-xs font-semibold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                Apply
              </button>
            </div>
          )}

          {/* Date label */}
          <div className="ml-auto flex items-center gap-1.5 text-xs text-dashboard-base-content/50">
            {isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <CalendarRange className="h-3.5 w-3.5" />}
            <span>{dateLabel}</span>
          </div>
        </div>
      </div>

      {/* ── Department Tabs ─────────────────────────────────────────────── */}
      <Tabs value={dept} onValueChange={(v) => setDept(v as typeof dept)}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="sales" className="gap-2">
            <Users className="h-4 w-4" />
            Sales / Leads
          </TabsTrigger>
          <TabsTrigger value="hotel" className="gap-2">
            <Building2 className="h-4 w-4" />
            Hotel Department
          </TabsTrigger>
          <TabsTrigger value="cab" className="gap-2">
            <Car className="h-4 w-4" />
            Cab Department
          </TabsTrigger>
          <TabsTrigger value="travel" className="gap-2">
            <TreePalm className="h-4 w-4" />
            Travel Expert
          </TabsTrigger>
        </TabsList>

        {/* ── Sales / Leads ──────────────────────────────────────────────── */}
        <TabsContent value="sales" className="mt-5">
          <SalesReportTab data={data.salesDept} />
        </TabsContent>

        {/* ── Hotel ──────────────────────────────────────────────────────── */}
        <TabsContent value="hotel" className="mt-5">
          <HotelReportTab data={data.hotelDept} />
        </TabsContent>

        {/* ── Cab ────────────────────────────────────────────────────────── */}
        <TabsContent value="cab" className="mt-5">
          <CabReportTab data={data.cabDept} />
        </TabsContent>

        {/* ── Travel ─────────────────────────────────────────────────────── */}
        <TabsContent value="travel" className="mt-5">
          <TravelReportTab data={data.travelDept} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
