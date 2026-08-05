"use client";

import { useState } from "react";
import {
  Users, UserCheck, UserX, CheckCircle2, XCircle,
  TrendingUp, Inbox, Phone, MapPin,
} from "lucide-react";
import { cn } from "@/app/lib/utils";
import { TrendAreaChart, type TrendSeries } from "../components/dashboard/charts/TrendAreaChart";
import { QueryStatusBadge, QuerySourceBadge, type QueryStatus, type QuerySource } from "../components/dashboard/CustomBadges";
import { MemberAvatar, StatChip, memberPalette } from "./memberVisuals";
import type { SalesDeptReportData, SalesDeptMember, QueryRowDetail } from "./actions";

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(iso));
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SummaryCard({
  label, value, icon: Icon, colorClass, bg, warning = false,
}: {
  label: string; value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string; bg: string; warning?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-xl border bg-dashboard-base-100 px-5 py-4 flex items-start justify-between gap-3",
      warning && Number(value) > 0 ? "border-dashboard-warning/50 bg-dashboard-warning/5" : "border-dashboard-base-300",
    )}>
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
  member: SalesDeptMember;
  isSelected: boolean; onSelect: () => void;
}) {
  const p = memberPalette(member.id);
  const hasActivity = member.leadsAssigned > 0;

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
                {member.leadsAssigned}
              </span>
            )}
          </div>
          <p className="text-[10px] text-dashboard-base-content/45 truncate">{member.designation ?? "Sales Executive"}</p>
          {hasActivity ? (
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
              <StatChip value={member.leadsAssigned} label="assigned" color="text-dashboard-primary" />
              <StatChip value={member.converted} label="won" color="text-dashboard-success" />
              <StatChip value={member.rejected} label="rejected" color="text-dashboard-error" />
              <StatChip value={member.inProgress} label="active" color="text-dashboard-warning" />
            </div>
          ) : (
            <p className="text-[10px] text-dashboard-base-content/35 italic mt-1">No leads assigned yet</p>
          )}
        </div>
      </div>
    </button>
  );
}

function LeadsTable({ queries, memberName }: { queries: QueryRowDetail[]; memberName: string }) {
  if (queries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center">
        <Users className="h-10 w-10 text-dashboard-base-content/20 mb-3" />
        <p className="text-sm font-medium text-dashboard-base-content/50">No leads assigned</p>
        <p className="text-xs text-dashboard-base-content/30 mt-1">{memberName} wasn&apos;t assigned any leads in this period.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-dashboard-base-300 text-xs text-dashboard-base-content/50 uppercase tracking-wide">
            <th className="text-left px-4 py-2.5 font-semibold">Lead</th>
            <th className="text-left px-4 py-2.5 font-semibold">Destination</th>
            <th className="text-center px-4 py-2.5 font-semibold">Status</th>
            <th className="text-center px-4 py-2.5 font-semibold">Source</th>
            <th className="text-right px-4 py-2.5 font-semibold">Assigned</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-dashboard-base-200">
          {queries.map((q) => (
            <tr key={q.id} className="hover:bg-dashboard-base-200/50 transition-colors">
              <td className="px-4 py-3">
                <p className="font-medium text-dashboard-base-content truncate max-w-45">{q.name}</p>
                <p className="flex items-center gap-1 text-xs text-dashboard-base-content/50">
                  <Phone className="h-3 w-3" /> {q.phone}
                </p>
              </td>
              <td className="px-4 py-3 text-dashboard-base-content/60">
                {q.destination
                  ? <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-dashboard-secondary" /> {q.destination}</span>
                  : "—"}
              </td>
              <td className="px-4 py-3 text-center">
                <QueryStatusBadge status={q.status as QueryStatus} />
              </td>
              <td className="px-4 py-3 text-center">
                <QuerySourceBadge source={q.source as QuerySource} />
              </td>
              <td className="px-4 py-3 text-right text-xs text-dashboard-base-content/50">
                {q.assignedAt ? fmtDate(q.assignedAt) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function SalesReportTab({ data }: { data: SalesDeptReportData }) {
  const { summary, members, dailyChart } = data;

  const activeMembers = members.filter((m) => m.leadsAssigned > 0);
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <SummaryCard label="Leads Received" value={summary.leadsReceived} icon={Inbox}       colorClass="text-dashboard-primary"  bg="bg-dashboard-primary/10" />
        <SummaryCard label="Assigned"       value={summary.assigned}     icon={UserCheck}    colorClass="text-dashboard-info"     bg="bg-dashboard-info/10" />
        <SummaryCard label="Unassigned"     value={summary.unassigned}   icon={UserX}        colorClass="text-dashboard-warning"  bg="bg-dashboard-warning/10" warning />
        <SummaryCard label="Converted"      value={summary.converted}    icon={CheckCircle2} colorClass="text-dashboard-success"  bg="bg-dashboard-success/10" />
        <SummaryCard label="Conv. Rate"     value={`${summary.convRate}%`} icon={TrendingUp} colorClass="text-dashboard-accent"   bg="bg-dashboard-accent/10" />
      </div>

      {/* ── Warning banner ─────────────────────────────────────────────────── */}
      {summary.unassigned > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-dashboard-warning/40 bg-dashboard-warning/5 px-4 py-3">
          <UserX className="h-4 w-4 text-dashboard-warning mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-dashboard-warning">
              {summary.unassigned} lead{summary.unassigned > 1 ? "s" : ""} received without an owner
            </p>
            <p className="text-xs text-dashboard-warning/80 mt-0.5">
              Assign these to a sales executive so they don&apos;t sit idle.
            </p>
          </div>
        </div>
      )}

      {/* ── Team members grid ──────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-dashboard-base-content flex items-center gap-2">
            <Users className="h-4 w-4 text-dashboard-primary" />
            Sales Team — All Executives
          </h3>
          <span className="text-xs text-dashboard-base-content/40">
            {members.length} exec{members.length !== 1 ? "s" : ""} · {activeMembers.length} with leads this period
          </span>
        </div>
        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 rounded-xl border border-dashed border-dashboard-base-300 text-center">
            <Users className="h-10 w-10 text-dashboard-base-content/20 mb-2" />
            <p className="text-sm text-dashboard-base-content/50">No sales executives found</p>
            <p className="text-xs text-dashboard-base-content/30 mt-1">Make sure the &quot;Sales Executive&quot; role exists in the system.</p>
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

      {/* ── Per-exec lead drill-down ───────────────────────────────────────── */}
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
                    m.leadsAssigned > 0
                      ? cn(p.bg, p.text)
                      : "bg-dashboard-base-300 text-dashboard-base-content/40",
                  )}>
                    {m.leadsAssigned}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selected member header */}
          {selectedMember && (
            <div className="px-4 py-3 border-b border-dashboard-base-200 bg-dashboard-base-200/20 flex items-center gap-3">
              <MemberAvatar member={selectedMember} />
              <div>
                <p className="text-sm font-semibold text-dashboard-base-content">{selectedMember.name}</p>
                <p className="text-xs text-dashboard-base-content/50">{selectedMember.designation ?? "Sales Executive"}</p>
              </div>
              <div className="ml-auto flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 font-medium text-dashboard-primary">
                  <UserCheck className="h-3.5 w-3.5" /> {selectedMember.leadsAssigned} assigned
                </span>
                <span className="flex items-center gap-1 font-medium text-dashboard-success">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {selectedMember.converted} won
                </span>
                <span className="flex items-center gap-1 font-medium text-dashboard-error">
                  <XCircle className="h-3.5 w-3.5" /> {selectedMember.rejected} rejected
                </span>
              </div>
            </div>
          )}

          {/* Leads table */}
          <LeadsTable
            queries={selectedMember?.queries ?? []}
            memberName={selectedMember?.name ?? ""}
          />
        </div>
      )}

      {/* ── Team activity line chart ────────────────────────────────────────── */}
      {activeMembers.length > 0 && (
        <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-dashboard-base-content">Leads Assigned — Daily Trend</h3>
              <p className="text-xs text-dashboard-base-content/40 mt-0.5">Leads assigned per day to each sales executive</p>
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
