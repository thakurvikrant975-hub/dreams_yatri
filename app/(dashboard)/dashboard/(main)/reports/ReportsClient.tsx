"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import {
  Building2, Car, TreePalm, Users, AlertTriangle,
  CheckCircle2, Loader2,
  MapPin, Route, Layers, IndianRupee, Activity as ActivityIcon,
  Package, CalendarRange, TrendingUp,
} from "lucide-react";
import { cn } from "@/app/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { HotelReportTab } from "./HotelReportTab";
import type {
  ReportsData, TimePeriod, MemberCabWork, MemberTravelWork,
} from "./actions";

// ── Types ──────────────────────────────────────────────────────────────────

type Props = {
  data: ReportsData;
  initialPeriod: TimePeriod;
  initialFrom?: string;
  initialTo?: string;
  initialDept: "hotel" | "cab" | "travel";
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

function initials(name: string) {
  return name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function fmtDate(s: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(s));
}

// ── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, iconBg, iconColor, warning = false,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  warning?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl px-4 py-3.5 border bg-dashboard-base-100 border-dashboard-base-300 space-y-3",
        warning && value > 0 && "border-dashboard-warning/50 bg-dashboard-warning/5",
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-dashboard-base-content/60">
          {label}
        </p>
        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", iconBg)}>
          <Icon className={cn("h-4 w-4", iconColor)} />
        </div>
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="text-2xl font-bold leading-none text-dashboard-base-content">{value}</p>
        {warning && value > 0 && (
          <span className="text-xs font-medium text-dashboard-warning flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Warning
          </span>
        )}
      </div>
    </div>
  );
}

// ── Member Avatar ──────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-dashboard-primary/20 text-dashboard-primary",
  "bg-dashboard-secondary/20 text-dashboard-secondary",
  "bg-dashboard-info/20 text-dashboard-info",
  "bg-dashboard-success/20 text-dashboard-success",
  "bg-dashboard-warning/20 text-dashboard-warning",
];

function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// ── Member Card Shell ──────────────────────────────────────────────────────

function MemberCardShell({
  name, dept, accentColor, total, children,
}: {
  name: string;
  dept: string;
  accentColor: string;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-dashboard-base-300 bg-dashboard-base-200">
        <div className={cn("h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0", avatarColor(name))}>
          {initials(name)}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-dashboard-base-content truncate">{name}</p>
          <p className="text-xs text-dashboard-base-content/50">{dept}</p>
        </div>
        <div className={cn("ml-auto flex items-center gap-1.5 text-xs font-semibold", accentColor)}>
          <TrendingUp className="h-3.5 w-3.5" />
          {total} items
        </div>
      </div>
      <div className="grid grid-cols-2 divide-x divide-dashboard-base-300">
        {children}
      </div>
    </div>
  );
}

function MemberStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="px-4 py-3 text-center">
      <p className="text-lg font-bold text-dashboard-base-content">{value}</p>
      <p className="text-xs text-dashboard-base-content/50 mt-0.5">{label}</p>
    </div>
  );
}

// ── Specific Member Cards ──────────────────────────────────────────────────

function CabMemberCard({ m }: { m: MemberCabWork }) {
  return (
    <MemberCardShell name={m.memberName} dept="Cab Department" accentColor="text-dashboard-info" total={m.pricingAdded + m.driversAdded}>
      <MemberStat value={m.pricingAdded} label="Pricing Added" />
      <MemberStat value={m.driversAdded} label="Drivers Added" />
    </MemberCardShell>
  );
}

function TravelMemberCard({ m }: { m: MemberTravelWork }) {
  return (
    <MemberCardShell name={m.memberName} dept="Travel Expert" accentColor="text-dashboard-secondary" total={m.activitiesAdded + m.packagesAdded}>
      <MemberStat value={m.activitiesAdded} label="Activities Added" />
      <MemberStat value={m.packagesAdded} label="Packages Added" />
    </MemberCardShell>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ label }: { label: string }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center gap-2 py-12 text-center">
      <Users className="h-10 w-10 text-dashboard-base-content/20" />
      <p className="text-sm font-medium text-dashboard-base-content/50">No {label} activity</p>
      <p className="text-xs text-dashboard-base-content/30">No entries were recorded for the selected period.</p>
    </div>
  );
}

// ── Member section header ──────────────────────────────────────────────────

function MemberSectionHeader({ count, iconColor }: { count: number; iconColor: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className={cn("text-sm font-semibold text-dashboard-base-content flex items-center gap-2")}>
        <Users className={cn("h-4 w-4", iconColor)} />
        Team Member Breakdown
      </h3>
      <span className="text-xs text-dashboard-base-content/40">
        {count} member{count !== 1 ? "s" : ""} active
      </span>
    </div>
  );
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

  const { cab, travel } = data;

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
                  "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
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
                className="h-8 px-3 rounded-md bg-dashboard-primary text-dashboard-primary-content text-xs font-semibold disabled:opacity-40"
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

        {/* ── Hotel ──────────────────────────────────────────────────────── */}
        <TabsContent value="hotel" className="mt-5">
          <HotelReportTab data={data.hotelDept} />
        </TabsContent>

        {/* ── Cab ────────────────────────────────────────────────────────── */}
        <TabsContent value="cab" className="mt-5 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Pricing Entries"      value={cab.pricingAdded}       icon={IndianRupee}   iconBg="bg-dashboard-info/10"    iconColor="text-dashboard-info" />
            <StatCard label="Drivers Added"         value={cab.driversAdded}       icon={Car}           iconBg="bg-dashboard-info/10"    iconColor="text-dashboard-info" />
            <StatCard label="Drivers with Vehicle"  value={cab.driversWithVehicle} icon={MapPin}        iconBg="bg-dashboard-success/10" iconColor="text-dashboard-success" />
            <StatCard label="Drivers Verified"      value={cab.driversVerified}    icon={CheckCircle2}  iconBg="bg-dashboard-success/10" iconColor="text-dashboard-success" />
          </div>

          <MemberSectionHeader count={cab.byMember.length} iconColor="text-dashboard-info" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cab.byMember.length === 0
              ? <EmptyState label="cab" />
              : cab.byMember.map((m) => <CabMemberCard key={m.memberId} m={m} />)}
          </div>
        </TabsContent>

        {/* ── Travel ─────────────────────────────────────────────────────── */}
        <TabsContent value="travel" className="mt-5 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard label="Activities Added"  value={travel.activitiesAdded}    icon={ActivityIcon}  iconBg="bg-dashboard-secondary/10" iconColor="text-dashboard-secondary" />
            <StatCard label="Packages Added"    value={travel.packagesAdded}      icon={Package}       iconBg="bg-dashboard-secondary/10" iconColor="text-dashboard-secondary" />
            <StatCard label="Routes Created"    value={travel.routesAdded}        icon={Route}         iconBg="bg-dashboard-primary/10"   iconColor="text-dashboard-primary" />
            <StatCard label="Stay Categories"   value={travel.stayCategoriesAdded} icon={Layers}       iconBg="bg-dashboard-info/10"      iconColor="text-dashboard-info" />
            <StatCard label="Pricing Sections"  value={travel.pricingSectionsAdded} icon={IndianRupee} iconBg="bg-dashboard-success/10"   iconColor="text-dashboard-success" />
          </div>

          {travel.packagesAdded > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-dashboard-base-300 bg-dashboard-base-200 px-4 py-3">
              <Package className="h-4 w-4 text-dashboard-secondary mt-0.5 shrink-0" />
              <p className="text-xs text-dashboard-base-content/60">
                Routes, stay categories, and pricing sections are counted for packages created during this period
                ({travel.packagesAdded} package{travel.packagesAdded !== 1 ? "s" : ""}).
              </p>
            </div>
          )}

          <MemberSectionHeader count={travel.byMember.length} iconColor="text-dashboard-secondary" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {travel.byMember.length === 0
              ? <EmptyState label="travel" />
              : travel.byMember.map((m) => <TravelMemberCard key={m.memberId} m={m} />)}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
