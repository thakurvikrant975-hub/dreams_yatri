"use client";

import { useState } from "react";
import {
  Car, Users, IndianRupee, CheckCircle2,
  TrendingUp, Phone, MapPin, ShieldCheck, AlertCircle,
} from "lucide-react";
import { cn } from "@/app/lib/utils";
import { TrendAreaChart, type TrendSeries } from "../components/dashboard/charts/TrendAreaChart";
import type { CabDeptReportData, CabDeptMember, DriverRowDetail } from "./actions";

// ── Constants ──────────────────────────────────────────────────────────────

const CHART_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#3b82f6", "#ef4444",
  "#8b5cf6", "#f97316", "#06b6d4", "#84cc16", "#ec4899",
];

// ── Helpers ────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

const AVATAR_COLORS = [
  "bg-indigo-100 text-indigo-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-blue-100 text-blue-700",
  "bg-rose-100 text-rose-700",
  "bg-violet-100 text-violet-700",
];

function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(iso));
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SummaryCard({
  label, value, icon: Icon, colorClass, bg,
}: {
  label: string; value: number;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string; bg: string;
}) {
  return (
    <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 px-5 py-4 flex items-start justify-between gap-3">
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-dashboard-base-content/50">{label}</p>
        <p className="text-3xl font-bold text-dashboard-base-content leading-none">{value}</p>
      </div>
      <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center shrink-0", bg)}>
        <Icon className={cn("h-5 w-5", colorClass)} />
      </div>
    </div>
  );
}

function MemberAvatar({ member, size = "md" }: { member: CabDeptMember; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "h-8 w-8 text-xs" : size === "lg" ? "h-14 w-14 text-lg" : "h-11 w-11 text-sm";
  if (member.profilePicUrl) {
    return (
      <img
        src={member.profilePicUrl}
        alt={member.name}
        className={cn("rounded-full object-cover shrink-0 ring-2 ring-white", sz)}
      />
    );
  }
  return (
    <div className={cn("rounded-full flex items-center justify-center font-bold shrink-0 ring-2 ring-white", sz, avatarColor(member.name))}>
      {initials(member.name)}
    </div>
  );
}

function StatPill({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center px-2.5 py-2 rounded-lg bg-dashboard-base-200/60 min-w-[56px]">
      <span className={cn("text-lg font-bold leading-none", color)}>{value}</span>
      <span className="text-[10px] text-dashboard-base-content/50 mt-1 text-center leading-tight">{label}</span>
    </div>
  );
}

function MemberCard({
  member, index, isSelected, onSelect,
}: {
  member: CabDeptMember; index: number;
  isSelected: boolean; onSelect: () => void;
}) {
  const accentColor = CHART_COLORS[index % CHART_COLORS.length];
  const hasActivity = member.driversAdded > 0 || member.pricingAdded > 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-xl border transition-all",
        isSelected
          ? "border-dashboard-info bg-dashboard-info/5 shadow-md"
          : "border-dashboard-base-300 bg-dashboard-base-100 hover:border-dashboard-base-content/30 hover:shadow-sm",
        !hasActivity && "opacity-60",
      )}
    >
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="relative">
            <MemberAvatar member={member} />
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white",
                member.isActive ? "bg-emerald-500" : "bg-gray-400",
              )}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-dashboard-base-content truncate">{member.name}</p>
            <p className="text-xs text-dashboard-base-content/50 truncate">{member.designation ?? "Cab Department"}</p>
          </div>
          {hasActivity && (
            <div className="flex items-center gap-1 text-xs font-bold shrink-0" style={{ color: accentColor }}>
              <TrendingUp className="h-3 w-3" />
              {member.driversAdded + member.pricingAdded}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="flex gap-2 flex-wrap">
          <StatPill value={member.driversAdded}      label="Drivers"    color="text-dashboard-info" />
          <StatPill value={member.driversVerified}   label="Verified"   color="text-emerald-600" />
          <StatPill value={member.driversWithVehicle} label="w/ Vehicle" color="text-dashboard-primary" />
          <StatPill value={member.pricingAdded}      label="Pricing"    color="text-amber-600" />
        </div>
      </div>

      {isSelected && (
        <div className="px-4 pb-2">
          <div className="h-0.5 rounded-full" style={{ backgroundColor: accentColor }} />
        </div>
      )}
    </button>
  );
}

function DriverTable({ drivers, memberName }: { drivers: DriverRowDetail[]; memberName: string }) {
  if (drivers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center">
        <Car className="h-10 w-10 text-dashboard-base-content/20 mb-3" />
        <p className="text-sm font-medium text-dashboard-base-content/50">No drivers added</p>
        <p className="text-xs text-dashboard-base-content/30 mt-1">{memberName} didn't add any drivers in this period.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-dashboard-base-300 text-xs text-dashboard-base-content/50 uppercase tracking-wide">
            <th className="text-left px-4 py-2.5 font-semibold">Driver</th>
            <th className="text-left px-4 py-2.5 font-semibold">
              <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> Mobile</span>
            </th>
            <th className="text-left px-4 py-2.5 font-semibold">
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Location</span>
            </th>
            <th className="text-center px-4 py-2.5 font-semibold">
              <span className="flex items-center justify-center gap-1"><Car className="h-3 w-3" /> Vehicle</span>
            </th>
            <th className="text-center px-4 py-2.5 font-semibold">
              <span className="flex items-center justify-center gap-1"><ShieldCheck className="h-3 w-3" /> Verified</span>
            </th>
            <th className="text-center px-4 py-2.5 font-semibold">Status</th>
            <th className="text-right px-4 py-2.5 font-semibold">Added</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-dashboard-base-200">
          {drivers.map((d) => (
            <tr key={d.id} className="hover:bg-dashboard-base-200/50 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-dashboard-info/10 flex items-center justify-center shrink-0">
                    <Car className="h-3.5 w-3.5 text-dashboard-info" />
                  </div>
                  <span className="font-medium text-dashboard-base-content truncate max-w-[160px]">{d.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-dashboard-base-content/60 font-mono text-xs">{d.mobile}</td>
              <td className="px-4 py-3 text-dashboard-base-content/60 text-xs">
                {[d.city, d.state].filter(Boolean).join(", ") || "—"}
              </td>
              <td className="px-4 py-3 text-center">
                {d.hasVehicle ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="h-3 w-3" /> Assigned
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                    <AlertCircle className="h-3 w-3" /> None
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-center">
                {d.isVerified ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                    <ShieldCheck className="h-3 w-3" /> Yes
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-dashboard-base-content/40 bg-dashboard-base-200 px-2 py-0.5 rounded-full">
                    Pending
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-center">
                {d.isActive ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-dashboard-base-content/40 bg-dashboard-base-200 px-2 py-0.5 rounded-full">
                    Inactive
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right text-xs text-dashboard-base-content/50">{fmtDate(d.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function CabReportTab({ data }: { data: CabDeptReportData }) {
  const { summary, members, dailyChart } = data;

  const activeMembers = members.filter((m) => m.driversAdded > 0 || m.pricingAdded > 0);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    activeMembers[0]?.id ?? members[0]?.id ?? "",
  );

  const selectedMember = members.find((m) => m.id === selectedMemberId);

  const chartSeries: TrendSeries[] = activeMembers.map((m, i) => ({
    key: m.id,
    label: m.name.split(" ")[0],
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <div className="space-y-6">

      {/* ── Summary stat cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Drivers Added"       value={summary.driversAdded}       icon={Car}           colorClass="text-dashboard-info"    bg="bg-dashboard-info/10" />
        <SummaryCard label="Drivers Verified"     value={summary.driversVerified}    icon={ShieldCheck}   colorClass="text-emerald-600"       bg="bg-emerald-100" />
        <SummaryCard label="Drivers w/ Vehicle"   value={summary.driversWithVehicle} icon={CheckCircle2}  colorClass="text-dashboard-primary" bg="bg-dashboard-primary/10" />
        <SummaryCard label="Pricing Entries"      value={summary.pricingAdded}       icon={IndianRupee}   colorClass="text-amber-600"         bg="bg-amber-100" />
      </div>

      {/* ── Team members grid ──────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-dashboard-base-content flex items-center gap-2">
            <Users className="h-4 w-4 text-dashboard-info" />
            Cab Department — All Members
          </h3>
          <span className="text-xs text-dashboard-base-content/40">
            {members.length} member{members.length !== 1 ? "s" : ""} · {activeMembers.length} active this period
          </span>
        </div>
        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 rounded-xl border border-dashed border-dashboard-base-300 text-center">
            <Users className="h-10 w-10 text-dashboard-base-content/20 mb-2" />
            <p className="text-sm text-dashboard-base-content/50">No cab department found</p>
            <p className="text-xs text-dashboard-base-content/30 mt-1">Make sure a department named "Cab" or "Cab Department" exists.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {members.map((m, i) => (
              <MemberCard
                key={m.id}
                member={m}
                index={i}
                isSelected={selectedMemberId === m.id}
                onSelect={() => setSelectedMemberId(m.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Per-member driver drill-down ───────────────────────────────────── */}
      {members.length > 0 && (
        <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 overflow-hidden">
          {/* Tab bar */}
          <div className="flex overflow-x-auto border-b border-dashboard-base-300 bg-dashboard-base-200/40 scrollbar-none">
            {members.map((m, i) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedMemberId(m.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-xs font-semibold whitespace-nowrap shrink-0 border-b-2 transition-all",
                  selectedMemberId === m.id
                    ? "border-dashboard-info text-dashboard-info bg-dashboard-base-100"
                    : "border-transparent text-dashboard-base-content/50 hover:text-dashboard-base-content hover:bg-dashboard-base-200/60",
                )}
              >
                <MemberAvatar member={m} size="sm" />
                <span>{m.name.split(" ")[0]}</span>
                <span className={cn(
                  "flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-[10px] font-bold",
                  m.driversAdded > 0
                    ? "bg-dashboard-info text-white"
                    : "bg-dashboard-base-300 text-dashboard-base-content/40",
                )}>
                  {m.driversAdded}
                </span>
              </button>
            ))}
          </div>

          {/* Selected member header */}
          {selectedMember && (
            <div className="px-4 py-3 border-b border-dashboard-base-200 bg-dashboard-base-200/20 flex items-center gap-3 flex-wrap">
              <MemberAvatar member={selectedMember} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-dashboard-base-content">{selectedMember.name}</p>
                <p className="text-xs text-dashboard-base-content/50">{selectedMember.designation ?? "Cab Department"}</p>
              </div>
              <div className="ml-auto flex items-center gap-3 text-xs flex-wrap">
                <span className="flex items-center gap-1 font-medium text-dashboard-info">
                  <Car className="h-3.5 w-3.5" /> {selectedMember.driversAdded} drivers
                </span>
                <span className="flex items-center gap-1 font-medium text-emerald-600">
                  <ShieldCheck className="h-3.5 w-3.5" /> {selectedMember.driversVerified} verified
                </span>
                <span className="flex items-center gap-1 font-medium text-dashboard-primary">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {selectedMember.driversWithVehicle} w/ vehicle
                </span>
                <span className="flex items-center gap-1 font-medium text-amber-600">
                  <IndianRupee className="h-3.5 w-3.5" /> {selectedMember.pricingAdded} pricing
                </span>
              </div>
            </div>
          )}

          {/* Driver table */}
          <DriverTable
            drivers={selectedMember?.drivers ?? []}
            memberName={selectedMember?.name ?? ""}
          />
        </div>
      )}

      {/* ── Team activity line chart ────────────────────────────────────────── */}
      {activeMembers.length > 0 && (
        <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-dashboard-base-content">Drivers & Pricing — Daily Trend</h3>
              <p className="text-xs text-dashboard-base-content/40 mt-0.5">Drivers added + pricing entries per day by each team member</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap justify-end">
              {chartSeries.map((s) => (
                <span key={s.key} className="flex items-center gap-1.5 text-xs text-dashboard-base-content/60">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.label}
                </span>
              ))}
            </div>
          </div>
          <TrendAreaChart
            data={dailyChart}
            series={chartSeries}
            xKey="date"
            height={220}
          />
        </div>
      )}

    </div>
  );
}
