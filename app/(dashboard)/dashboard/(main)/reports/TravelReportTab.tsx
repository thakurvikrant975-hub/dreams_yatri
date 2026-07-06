"use client";

import { useState } from "react";
import {
  TreePalm, Package, Route, CalendarDays,
  Layers, IndianRupee, TrendingUp, Users, CheckCircle2,
} from "lucide-react";
import { cn } from "@/app/lib/utils";
import { TrendAreaChart, type TrendSeries } from "../components/dashboard/charts/TrendAreaChart";
import type { TravelDeptReportData, TravelDeptMember, PackageRowDetail } from "./actions";

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

function MemberAvatar({ member, size = "md" }: { member: TravelDeptMember; size?: "sm" | "md" | "lg" }) {
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
  member: TravelDeptMember; index: number;
  isSelected: boolean; onSelect: () => void;
}) {
  const accentColor = CHART_COLORS[index % CHART_COLORS.length];
  const hasActivity = member.activitiesAdded > 0 || member.packagesAdded > 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-xl border transition-all",
        isSelected
          ? "border-dashboard-secondary bg-dashboard-secondary/5 shadow-md"
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
            <p className="text-xs text-dashboard-base-content/50 truncate">{member.designation ?? "Travel Expert"}</p>
          </div>
          {hasActivity && (
            <div className="flex items-center gap-1 text-xs font-bold shrink-0" style={{ color: accentColor }}>
              <TrendingUp className="h-3 w-3" />
              {member.activitiesAdded + member.packagesAdded}
            </div>
          )}
        </div>

        {/* Stats row 1 */}
        <div className="flex gap-2 flex-wrap">
          <StatPill value={member.activitiesAdded} label="Activities" color="text-dashboard-secondary" />
          <StatPill value={member.packagesAdded} label="Packages" color="text-dashboard-primary" />
          <StatPill value={member.routesAdded} label="Routes" color="text-dashboard-info" />
        </div>
        {/* Stats row 2 */}
        <div className="flex gap-2 flex-wrap">
          <StatPill value={member.daysAdded} label="Days" color="text-emerald-600" />
          <StatPill value={member.stayCategoriesAdded} label="Stay Cats." color="text-violet-600" />
          <StatPill value={member.pricingAdded} label="Pricing" color="text-amber-600" />
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

function PackageTable({ packages, memberName }: { packages: PackageRowDetail[]; memberName: string }) {
  if (packages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center">
        <Package className="h-10 w-10 text-dashboard-base-content/20 mb-3" />
        <p className="text-sm font-medium text-dashboard-base-content/50">No packages added</p>
        <p className="text-xs text-dashboard-base-content/30 mt-1">{memberName} didn't add any packages in this period.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-dashboard-base-300 text-xs text-dashboard-base-content/50 uppercase tracking-wide">
            <th className="text-left px-4 py-2.5 font-semibold">Package</th>
            <th className="text-left px-4 py-2.5 font-semibold">Destination</th>
            <th className="text-center px-4 py-2.5 font-semibold">
              <span className="flex items-center justify-center gap-1"><Route className="h-3 w-3" /> Routes</span>
            </th>
            <th className="text-center px-4 py-2.5 font-semibold">
              <span className="flex items-center justify-center gap-1"><CalendarDays className="h-3 w-3" /> Days</span>
            </th>
            <th className="text-center px-4 py-2.5 font-semibold">
              <span className="flex items-center justify-center gap-1"><Layers className="h-3 w-3" /> Stay Cats.</span>
            </th>
            <th className="text-center px-4 py-2.5 font-semibold">
              <span className="flex items-center justify-center gap-1"><IndianRupee className="h-3 w-3" /> Pricing</span>
            </th>
            <th className="text-center px-4 py-2.5 font-semibold">Status</th>
            <th className="text-right px-4 py-2.5 font-semibold">Added</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-dashboard-base-200">
          {packages.map((p) => (
            <tr key={p.id} className="hover:bg-dashboard-base-200/50 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  {p.thumbnail ? (
                    <img src={p.thumbnail} alt={p.title} className="h-9 w-12 rounded object-cover shrink-0 border border-dashboard-base-300" />
                  ) : (
                    <div className="h-9 w-12 rounded bg-dashboard-base-200 shrink-0 flex items-center justify-center">
                      <Package className="h-4 w-4 text-dashboard-base-content/30" />
                    </div>
                  )}
                  <span className="font-medium text-dashboard-base-content truncate max-w-[180px]">{p.title}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-dashboard-base-content/60">{p.destination ?? "—"}</td>
              <td className="px-4 py-3 text-center">
                <span className={cn(
                  "inline-flex items-center justify-center h-6 w-10 rounded-md text-xs font-semibold",
                  p.routesCount > 0 ? "bg-blue-100 text-blue-700" : "bg-dashboard-base-200 text-dashboard-base-content/40",
                )}>
                  {p.routesCount}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className={cn(
                  "inline-flex items-center justify-center h-6 w-10 rounded-md text-xs font-semibold",
                  p.daysCount > 0 ? "bg-emerald-100 text-emerald-700" : "bg-dashboard-base-200 text-dashboard-base-content/40",
                )}>
                  {p.daysCount}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className={cn(
                  "inline-flex items-center justify-center h-6 w-10 rounded-md text-xs font-semibold",
                  p.stayCategoriesCount > 0 ? "bg-violet-100 text-violet-700" : "bg-dashboard-base-200 text-dashboard-base-content/40",
                )}>
                  {p.stayCategoriesCount}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className={cn(
                  "inline-flex items-center justify-center h-6 w-10 rounded-md text-xs font-semibold",
                  p.pricingCount > 0 ? "bg-amber-100 text-amber-700" : "bg-dashboard-base-200 text-dashboard-base-content/40",
                )}>
                  {p.pricingCount}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                {p.isActive ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="h-3 w-3" /> Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-dashboard-base-content/40 bg-dashboard-base-200 px-2 py-0.5 rounded-full">
                    Inactive
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right text-xs text-dashboard-base-content/50">{fmtDate(p.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function TravelReportTab({ data }: { data: TravelDeptReportData }) {
  const { summary, members, dailyChart } = data;

  const activeMembers = members.filter((m) => m.activitiesAdded > 0 || m.packagesAdded > 0);
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCard label="Activities Added"   value={summary.activitiesAdded}     icon={TreePalm}      colorClass="text-dashboard-secondary" bg="bg-dashboard-secondary/10" />
        <SummaryCard label="Packages Added"     value={summary.packagesAdded}       icon={Package}       colorClass="text-dashboard-primary"   bg="bg-dashboard-primary/10" />
        <SummaryCard label="Routes Created"     value={summary.routesAdded}         icon={Route}         colorClass="text-dashboard-info"      bg="bg-dashboard-info/10" />
        <SummaryCard label="Days Created"       value={summary.daysAdded}           icon={CalendarDays}  colorClass="text-emerald-600"         bg="bg-emerald-100" />
        <SummaryCard label="Stay Categories"    value={summary.stayCategoriesAdded} icon={Layers}        colorClass="text-violet-600"          bg="bg-violet-100" />
        <SummaryCard label="Pricing Sections"   value={summary.pricingAdded}        icon={IndianRupee}   colorClass="text-amber-600"           bg="bg-amber-100" />
      </div>

      {/* ── Team members grid ──────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-dashboard-base-content flex items-center gap-2">
            <Users className="h-4 w-4 text-dashboard-secondary" />
            Travel Expert Department — All Members
          </h3>
          <span className="text-xs text-dashboard-base-content/40">
            {members.length} member{members.length !== 1 ? "s" : ""} · {activeMembers.length} active this period
          </span>
        </div>
        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 rounded-xl border border-dashed border-dashboard-base-300 text-center">
            <Users className="h-10 w-10 text-dashboard-base-content/20 mb-2" />
            <p className="text-sm text-dashboard-base-content/50">No travel expert department found</p>
            <p className="text-xs text-dashboard-base-content/30 mt-1">Make sure a department named "Travel" or "Travel Expert" exists.</p>
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

      {/* ── Per-member package drill-down ──────────────────────────────────── */}
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
                    ? "border-dashboard-secondary text-dashboard-secondary bg-dashboard-base-100"
                    : "border-transparent text-dashboard-base-content/50 hover:text-dashboard-base-content hover:bg-dashboard-base-200/60",
                )}
              >
                <MemberAvatar member={m} size="sm" />
                <span>{m.name.split(" ")[0]}</span>
                <span className={cn(
                  "flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-[10px] font-bold",
                  m.packagesAdded > 0
                    ? "bg-dashboard-secondary text-white"
                    : "bg-dashboard-base-300 text-dashboard-base-content/40",
                )}>
                  {m.packagesAdded}
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
                <p className="text-xs text-dashboard-base-content/50">{selectedMember.designation ?? "Travel Expert"}</p>
              </div>
              <div className="ml-auto flex items-center gap-3 text-xs flex-wrap">
                <span className="flex items-center gap-1 font-medium text-dashboard-secondary">
                  <TreePalm className="h-3.5 w-3.5" /> {selectedMember.activitiesAdded} activities
                </span>
                <span className="flex items-center gap-1 font-medium text-dashboard-primary">
                  <Package className="h-3.5 w-3.5" /> {selectedMember.packagesAdded} packages
                </span>
                <span className="flex items-center gap-1 font-medium text-dashboard-info">
                  <Route className="h-3.5 w-3.5" /> {selectedMember.routesAdded} routes
                </span>
                <span className="flex items-center gap-1 font-medium text-emerald-600">
                  <CalendarDays className="h-3.5 w-3.5" /> {selectedMember.daysAdded} days
                </span>
                <span className="flex items-center gap-1 font-medium text-violet-600">
                  <Layers className="h-3.5 w-3.5" /> {selectedMember.stayCategoriesAdded} stay cats
                </span>
                <span className="flex items-center gap-1 font-medium text-amber-600">
                  <IndianRupee className="h-3.5 w-3.5" /> {selectedMember.pricingAdded} pricing
                </span>
              </div>
            </div>
          )}

          {/* Package table */}
          <PackageTable
            packages={selectedMember?.packages ?? []}
            memberName={selectedMember?.name ?? ""}
          />
        </div>
      )}

      {/* ── Team activity line chart ────────────────────────────────────────── */}
      {activeMembers.length > 0 && (
        <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-dashboard-base-content">Packages & Activities — Daily Trend</h3>
              <p className="text-xs text-dashboard-base-content/40 mt-0.5">Packages + activities added per day by each team member</p>
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
