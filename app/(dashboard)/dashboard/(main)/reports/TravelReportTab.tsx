"use client";

import { useState } from "react";
import {
  TreePalm, Package, Route, CalendarDays,
  Layers, IndianRupee, Users, CheckCircle2,
} from "lucide-react";
import { cn } from "@/app/lib/utils";
import { TrendAreaChart, type TrendSeries } from "../components/dashboard/charts/TrendAreaChart";
import { MemberAvatar, StatChip, memberPalette } from "./memberVisuals";
import type { TravelDeptReportData, TravelDeptMember, PackageRowDetail } from "./actions";

// ── Helpers ────────────────────────────────────────────────────────────────

const R2_BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";

function thumb(key: string | null) {
  if (!key) return null;
  return key.startsWith("http") ? key : `${R2_BASE}/${key}`;
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

function MemberCard({
  member, isSelected, onSelect,
}: {
  member: TravelDeptMember;
  isSelected: boolean; onSelect: () => void;
}) {
  const p = memberPalette(member.id);
  const total = member.activitiesAdded + member.packagesAdded;
  const hasActivity = total > 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-xl border px-2.5 py-2 transition-all cursor-pointer",
        isSelected
          ? cn(p.border, p.bg, "shadow-sm")
          : "border-dashboard-base-300 bg-dashboard-base-100 hover:border-dashboard-base-content/30",
        !hasActivity && "opacity-60",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="relative shrink-0 mt-0.5">
          <MemberAvatar member={member} size="sm" />
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-dashboard-base-100",
              member.isActive ? "bg-dashboard-success" : "bg-dashboard-base-content/30",
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1.5">
            <p className="text-xs font-semibold text-dashboard-base-content truncate">{member.name}</p>
            {hasActivity && (
              <span className={cn("shrink-0 text-[11px] font-bold tabular-nums", p.text)}>
                {total}
              </span>
            )}
          </div>
          <p className="text-[10px] text-dashboard-base-content/45 truncate">{member.designation ?? "Travel Expert"}</p>
          {hasActivity ? (
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
              <StatChip value={member.activitiesAdded} label="activities" color="text-dashboard-secondary" />
              <StatChip value={member.packagesAdded} label="packages" color="text-dashboard-primary" />
              <StatChip value={member.routesAdded} label="routes" color="text-dashboard-info" />
              <StatChip value={member.daysAdded} label="days" color="text-dashboard-success" />
              <StatChip value={member.stayCategoriesAdded} label="stay cats." color="text-dashboard-accent" />
              <StatChip value={member.pricingAdded} label="pricing" color="text-dashboard-warning" />
            </div>
          ) : (
            <p className="text-[10px] text-dashboard-base-content/35 italic mt-1">No activity yet</p>
          )}
        </div>
      </div>
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
                    <img src={thumb(p.thumbnail)!} alt={p.title} className="h-9 w-12 rounded object-cover shrink-0 border border-dashboard-base-300" />
                  ) : (
                    <div className="h-9 w-12 rounded bg-dashboard-base-200 shrink-0 flex items-center justify-center">
                      <Package className="h-4 w-4 text-dashboard-base-content/30" />
                    </div>
                  )}
                  <span className="font-medium text-dashboard-base-content truncate max-w-45">{p.title}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-dashboard-base-content/60">{p.destination ?? "—"}</td>
              <td className="px-4 py-3 text-center">
                <span className={cn(
                  "inline-flex items-center justify-center h-6 w-10 rounded-md text-xs font-semibold",
                  p.routesCount > 0 ? "bg-dashboard-info/20 text-dashboard-base-content" : "bg-dashboard-base-200 text-dashboard-base-content/40",
                )}>
                  {p.routesCount}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className={cn(
                  "inline-flex items-center justify-center h-6 w-10 rounded-md text-xs font-semibold",
                  p.daysCount > 0 ? "bg-dashboard-success/10 text-dashboard-success" : "bg-dashboard-base-200 text-dashboard-base-content/40",
                )}>
                  {p.daysCount}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className={cn(
                  "inline-flex items-center justify-center h-6 w-10 rounded-md text-xs font-semibold",
                  p.stayCategoriesCount > 0 ? "bg-dashboard-accent/10 text-dashboard-accent" : "bg-dashboard-base-200 text-dashboard-base-content/40",
                )}>
                  {p.stayCategoriesCount}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className={cn(
                  "inline-flex items-center justify-center h-6 w-10 rounded-md text-xs font-semibold",
                  p.pricingCount > 0 ? "bg-dashboard-warning/15 text-dashboard-warning" : "bg-dashboard-base-200 text-dashboard-base-content/40",
                )}>
                  {p.pricingCount}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                {p.isActive ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-dashboard-success bg-dashboard-success/10 px-2 py-0.5 rounded-full">
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

  const chartSeries: TrendSeries[] = activeMembers.map((m) => ({
    key: m.id,
    label: m.name.split(" ")[0],
    color: memberPalette(m.id).css,
  }));

  return (
    <div className="space-y-6">

      {/* ── Summary stat cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCard label="Activities Added"   value={summary.activitiesAdded}     icon={TreePalm}      colorClass="text-dashboard-secondary" bg="bg-dashboard-secondary/10" />
        <SummaryCard label="Packages Added"     value={summary.packagesAdded}       icon={Package}       colorClass="text-dashboard-primary"   bg="bg-dashboard-primary/10" />
        <SummaryCard label="Routes Created"     value={summary.routesAdded}         icon={Route}         colorClass="text-dashboard-info"      bg="bg-dashboard-info/10" />
        <SummaryCard label="Days Created"       value={summary.daysAdded}           icon={CalendarDays}  colorClass="text-dashboard-success"   bg="bg-dashboard-success/10" />
        <SummaryCard label="Stay Categories"    value={summary.stayCategoriesAdded} icon={Layers}        colorClass="text-dashboard-accent"    bg="bg-dashboard-accent/10" />
        <SummaryCard label="Pricing Sections"   value={summary.pricingAdded}        icon={IndianRupee}   colorClass="text-dashboard-warning"   bg="bg-dashboard-warning/10" />
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {members.map((m) => (
              <MemberCard
                key={m.id}
                member={m}
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
            {members.map((m) => {
              const p = memberPalette(m.id);
              const isTabSelected = selectedMemberId === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMemberId(m.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 text-xs font-semibold whitespace-nowrap shrink-0 border-b-2 transition-all cursor-pointer",
                    isTabSelected
                      ? cn(p.border, p.text, "bg-dashboard-base-100")
                      : "border-transparent text-dashboard-base-content/50 hover:text-dashboard-base-content hover:bg-dashboard-base-200/60",
                  )}
                >
                  <MemberAvatar member={m} size="sm" />
                  <span>{m.name.split(" ")[0]}</span>
                  <span className={cn(
                    "flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-[10px] font-bold",
                    m.packagesAdded > 0
                      ? cn(p.bg, p.text)
                      : "bg-dashboard-base-300 text-dashboard-base-content/40",
                  )}>
                    {m.packagesAdded}
                  </span>
                </button>
              );
            })}
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
                <span className="flex items-center gap-1 font-medium text-dashboard-success">
                  <CalendarDays className="h-3.5 w-3.5" /> {selectedMember.daysAdded} days
                </span>
                <span className="flex items-center gap-1 font-medium text-dashboard-accent">
                  <Layers className="h-3.5 w-3.5" /> {selectedMember.stayCategoriesAdded} stay cats
                </span>
                <span className="flex items-center gap-1 font-medium text-dashboard-warning">
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
