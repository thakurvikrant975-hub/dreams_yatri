"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Users, MapPin, PieChart as PieChartIcon, TrendingUp, Phone,
  Trophy, Medal, Award, Crown, ShieldCheck,
} from "lucide-react";
import { cn } from "@/app/lib/utils";
import { DateRangePicker } from "../ui/date-range-picker";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { StatCard, StatGrid } from "./Statcard";
import { TrendAreaChart } from "./charts/TrendAreaChart";
import { BreakdownPieChart } from "./charts/BreakdownPieChart";
import { RankedBarChart } from "./charts/RankedBarChart";
import { DataTable, type ColumnDef } from "./Datatable";
import { TableFilters } from "./Tablefilters";
import type { TeamLeaderAnalyticsData, TeamLeadRow } from "../../actions/team-leader-analytics-actions";
import type { SalesTeamAnalytics, MemberPerformance } from "../../sales-teams/sales-team-analytics-actions";

type Props = {
  teamData: TeamLeaderAnalyticsData | null;
  leaderboard: SalesTeamAnalytics;
  from: string;
  to: string;
  viewerTeamId: string | null;
};

function todayStr() {
  return new Date().toISOString().split("T")[0];
}
function daysAgoStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}
function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(iso));
}
function fmtTime(iso: string) {
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
function statusLabel(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
}

const STATUS_STYLES: Record<string, string> = {
  CONVERTED: "bg-green-100 text-green-700",
  PAYMENT_INITIATED: "bg-green-100 text-green-700",
  CLIENT_ACCEPTED: "bg-emerald-100 text-emerald-700",
  CLIENT_DECLINED: "bg-red-100 text-red-700",
  REJECTED: "bg-red-100 text-red-700",
  CLOSED: "bg-dashboard-base-300 text-dashboard-base-content",
  FOLLOW_UP: "bg-amber-100 text-amber-700",
  ASSIGNED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  SUBMITTED: "bg-dashboard-base-300 text-dashboard-base-content",
  VERIFIED: "bg-cyan-100 text-cyan-700",
  PACKAGE_SENT: "bg-indigo-100 text-indigo-700",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_STYLES[status] ?? "bg-dashboard-base-300 text-dashboard-base-content")}>
      {statusLabel(status)}
    </span>
  );
}

function DashCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl overflow-hidden bg-dashboard-base-100 border border-dashboard-base-300", className)}>
      {children}
    </div>
  );
}
function DashCardHeader({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-3 text-dashboard-neutral-content bg-dashboard-neutral border-b border-dashboard-base-300">
      <div className="flex items-center gap-2">{children}</div>
      {action}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-4 w-4 text-amber-500" />;
  if (rank === 2) return <Medal className="h-4 w-4 text-slate-400" />;
  if (rank === 3) return <Award className="h-4 w-4 text-orange-600" />;
  return <span className="text-xs font-semibold text-dashboard-base-content/50 tabular-nums w-4 text-center">{rank}</span>;
}

// ── Leaderboard row shapes (derived client-side from the company-wide
// SalesTeamAnalytics payload — no extra fetch needed) ──────────────────────
type ExecRow = MemberPerformance & { teamName: string; rank: number };
type TeamRow = SalesTeamAnalytics["teams"][number] & { rank: number };

function rankExecs(data: SalesTeamAnalytics): ExecRow[] {
  // SalesTeam.members always auto-includes the team's own leader (see the
  // model's doc comment) — excluded here so this leaderboard is Sales
  // Executives only; the Team Leaderboard below still reflects the whole
  // team's numbers, leader included.
  const flat: (MemberPerformance & { teamName: string })[] = [
    ...data.teams.flatMap((t) =>
      t.members
        .filter((m) => m.id !== t.leader?.id)
        .map((m) => ({ ...m, teamName: t.teamName }))),
    ...data.unassigned.map((m) => ({ ...m, teamName: "Unassigned" })),
  ];
  return flat
    .sort((a, b) =>
      b.convertedThisMonth - a.convertedThisMonth
      || b.conversionRate - a.conversionRate
      || b.queriesThisMonth - a.queriesThisMonth)
    .map((m, i) => ({ ...m, rank: i + 1 }));
}

function rankTeams(data: SalesTeamAnalytics): TeamRow[] {
  return [...data.teams]
    .sort((a, b) =>
      b.teamConvertedThisMonth - a.teamConvertedThisMonth
      || b.teamConversionRate - a.teamConversionRate
      || b.teamQueriesThisMonth - a.teamQueriesThisMonth)
    .map((t, i) => ({ ...t, rank: i + 1 }));
}

export function TeamLeaderAnalytics({ teamData, leaderboard, from, to, viewerTeamId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [memberFilter, setMemberFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [reportPage, setReportPage] = useState(1);
  const reportPageSize = 25;

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

  const filteredRows = useMemo(() => {
    if (!teamData) return [];
    const s = search.trim().toLowerCase();
    return teamData.reportRows.filter((r) => {
      const matchSearch = !s
        || r.name.toLowerCase().includes(s)
        || r.phone.includes(s)
        || (r.destination ?? "").toLowerCase().includes(s);
      const matchMember = memberFilter === "all" || r.assignedTo === memberFilter;
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      return matchSearch && matchMember && matchStatus;
    });
  }, [teamData, search, memberFilter, statusFilter]);

  const reportTotalPages = Math.max(1, Math.ceil(filteredRows.length / reportPageSize));
  const safeReportPage = Math.min(reportPage, reportTotalPages);
  const pagedReportRows = useMemo(
    () => filteredRows.slice((safeReportPage - 1) * reportPageSize, safeReportPage * reportPageSize),
    [filteredRows, safeReportPage],
  );

  const reportCols: ColumnDef<TeamLeadRow>[] = [
    { header: "Date", width: "w-[100px]", sortKey: (r) => r.createdAt, cell: (r) => (
      <div className="text-xs text-dashboard-base-content/70 whitespace-nowrap">
        {fmtDate(r.createdAt)} · {fmtTime(r.createdAt)}
      </div>
    ) },
    { header: "Lead", sortKey: (r) => r.name.toLowerCase(), cell: (r) => (
      <div>
        <div className="text-sm font-medium text-dashboard-base-content">{r.name}</div>
        <div className="text-xs text-dashboard-neutral">{r.phone}</div>
      </div>
    ) },
    { header: "Destination", sortKey: (r) => r.destination?.toLowerCase() ?? "", cell: (r) => <span className="text-sm text-dashboard-base-content">{r.destination?.trim() || "—"}</span> },
    { header: "Source", sortKey: (r) => r.channel, cell: (r) => <span className="text-xs text-dashboard-base-content/70">{r.channel}</span> },
    { header: "Status", cell: (r) => <StatusPill status={r.status} /> },
    { header: "Assigned To", sortKey: (r) => r.assignedToName?.toLowerCase() ?? "", cell: (r) => <span className="text-sm text-dashboard-base-content/80">{r.assignedToName ?? "Unassigned"}</span> },
  ];

  const memberPerfCols: ColumnDef<TeamLeaderAnalyticsData["byTeamMember"][number]>[] = [
    { header: "Member", cell: (m) => <span className="text-sm font-medium text-dashboard-base-content">{m.name}</span> },
    { header: "Total Leads", align: "center", cell: (m) => <span className="text-sm tabular-nums">{m.totalLeads}</span> },
    { header: "Converted", align: "center", cell: (m) => <span className="text-sm tabular-nums text-dashboard-success font-medium">{m.converted}</span> },
    { header: "Conv. Rate", align: "right", cell: (m) => <span className="text-sm tabular-nums font-medium">{m.convRate}%</span> },
  ];

  const execLeaderboard = useMemo(() => rankExecs(leaderboard), [leaderboard]);
  const teamLeaderboard = useMemo(() => rankTeams(leaderboard), [leaderboard]);

  const execCols: ColumnDef<ExecRow>[] = [
    { header: "Rank", width: "w-[50px]", cell: (r) => <RankBadge rank={r.rank} /> },
    { header: "Sales Executive", cell: (r) => (
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-dashboard-base-content">{r.name}</span>
        {r.teamName !== "Unassigned" && viewerTeamId && leaderboard.teams.find((t) => t.teamName === r.teamName)?.teamId === viewerTeamId && (
          <span title="Your team" className="inline-flex items-center rounded-full bg-dashboard-primary/10 text-dashboard-primary px-1.5 py-0.5 text-[10px] font-semibold">
            My Team
          </span>
        )}
      </div>
    ) },
    { header: "Team", cell: (r) => <span className="text-xs text-dashboard-base-content/70">{r.teamName}</span> },
    { header: "Converted", align: "center", cell: (r) => <span className="text-sm tabular-nums text-dashboard-success font-medium">{r.convertedThisMonth}</span> },
    { header: "Leads", align: "center", cell: (r) => <span className="text-sm tabular-nums">{r.queriesThisMonth}</span> },
    { header: "Conv. Rate", align: "right", cell: (r) => <span className="text-sm tabular-nums font-medium">{r.conversionRate}%</span> },
  ];

  const teamCols: ColumnDef<TeamRow>[] = [
    { header: "Rank", width: "w-[50px]", cell: (r) => <RankBadge rank={r.rank} /> },
    { header: "Team", cell: (r) => (
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-dashboard-base-content">{r.teamName}</span>
        {r.teamId === viewerTeamId && (
          <span title="Your team" className="inline-flex items-center rounded-full bg-dashboard-primary/10 text-dashboard-primary px-1.5 py-0.5 text-[10px] font-semibold">
            My Team
          </span>
        )}
      </div>
    ) },
    { header: "Leader", cell: (r) => <span className="text-xs text-dashboard-base-content/70">{r.leader?.name ?? "—"}</span> },
    { header: "Members", align: "center", cell: (r) => <span className="text-sm tabular-nums">{r.members.length}</span> },
    { header: "Converted", align: "center", cell: (r) => <span className="text-sm tabular-nums text-dashboard-success font-medium">{r.teamConvertedThisMonth}</span> },
    { header: "Leads", align: "center", cell: (r) => <span className="text-sm tabular-nums">{r.teamQueriesThisMonth}</span> },
    { header: "Conv. Rate", align: "right", cell: (r) => <span className="text-sm tabular-nums font-medium">{r.teamConversionRate}%</span> },
  ];

  return (
    <div className="space-y-6">
      {/* ── Range controls ────────────────────────────────────────────────── */}
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

      <Tabs defaultValue="my-team">
        <TabsList variant="line">
          <TabsTrigger value="my-team">
            <Users className="h-3.5 w-3.5" /> My Team
          </TabsTrigger>
          <TabsTrigger value="leaderboard">
            <Trophy className="h-3.5 w-3.5" /> Leaderboard
          </TabsTrigger>
        </TabsList>

        {/* ── My Team ─────────────────────────────────────────────────────── */}
        <TabsContent value="my-team" className="space-y-6 pt-4">
          {!teamData ? (
            <DashCard>
              <div className="p-8 text-center text-sm text-dashboard-base-content/60">
                You&apos;re not currently set as the leader of a SalesTeam — ask your admin to assign you before this section can show your team&apos;s numbers.
              </div>
            </DashCard>
          ) : (
            <>
              {(() => {
                const myTeam = leaderboard.teams.find((t) => t.teamId === viewerTeamId);
                if (!myTeam || (myTeam.teamRevenueTarget === null && myTeam.teamConversionTarget === null)) return null;
                return (
                  <DashCard>
                    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                      <p className="flex items-center gap-1.5 text-sm font-medium text-dashboard-base-content">
                        <Trophy className="h-3.5 w-3.5 text-dashboard-primary" /> This month&apos;s team target
                      </p>
                      <div className="flex items-center gap-4 text-xs text-dashboard-base-content/70">
                        {myTeam.teamConversionTarget !== null && (
                          <span>
                            <span className="font-semibold text-dashboard-base-content">{myTeam.teamConfirmedThisMonth}</span>
                            {" "}/ {myTeam.teamConversionTarget} bookings
                          </span>
                        )}
                        {myTeam.teamRevenueTarget !== null && (
                          <span>
                            <span className="font-semibold text-dashboard-base-content">
                              {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(myTeam.teamTotalRevenue)}
                            </span>
                            {" "}/ {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(myTeam.teamRevenueTarget)}
                          </span>
                        )}
                      </div>
                    </div>
                  </DashCard>
                );
              })()}

              <StatGrid cols={5}>
                <StatCard
                  label="Today's Leads" value={teamData.summary.todayLeads} icon={Phone}
                  iconColor="bg-dashboard-primary/10" iconText="text-dashboard-primary"
                  sub={new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date())}
                />
                <StatCard
                  label="Total Leads" value={teamData.summary.totalLeads} icon={Users}
                  iconColor="bg-dashboard-info/10" iconText="text-dashboard-info"
                  sub={rangeLabel}
                />
                <StatCard
                  label="Converted" value={teamData.summary.converted} icon={TrendingUp}
                  iconColor="bg-dashboard-success/10" iconText="text-dashboard-success"
                  sub="this range"
                />
                <StatCard
                  label="Conv. Rate" value={`${teamData.summary.convRate}%`} icon={PieChartIcon}
                  iconColor="bg-dashboard-warning/10" iconText="text-dashboard-warning"
                  sub="converted / total leads"
                />
                <StatCard
                  label="Destinations" value={teamData.summary.uniqueDestinations} icon={MapPin}
                  iconColor="bg-dashboard-secondary/10" iconText="text-dashboard-secondary"
                  sub="distinct destinations reached"
                />
              </StatGrid>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <DashCard>
                  <DashCardHeader>
                    <TrendingUp className="h-4 w-4" />
                    <p className="text-sm font-semibold">Team leads over time</p>
                  </DashCardHeader>
                  <div className="p-4">
                    <TrendAreaChart
                      data={teamData.dailyTrend}
                      series={[{ key: "leads", label: "Leads", color: "var(--color-dashboard-primary)" }]}
                    />
                  </div>
                </DashCard>

                <DashCard>
                  <DashCardHeader>
                    <PieChartIcon className="h-4 w-4" />
                    <p className="text-sm font-semibold">Leads by source</p>
                  </DashCardHeader>
                  <div className="p-4">
                    <BreakdownPieChart data={teamData.byChannel} showLabels />
                  </div>
                </DashCard>

                <DashCard className="lg:col-span-2">
                  <DashCardHeader>
                    <MapPin className="h-4 w-4" />
                    <p className="text-sm font-semibold">Leads by destination ({teamData.byDestination.length})</p>
                  </DashCardHeader>
                  <div className="p-4 max-h-105 overflow-y-auto">
                    <RankedBarChart data={teamData.byDestination} height={Math.max(180, teamData.byDestination.length * 34)} showValues />
                  </div>
                </DashCard>
              </div>

              {/* ── Per-member performance ──────────────────────────────────── */}
              <DashCard>
                <DashCardHeader>
                  <ShieldCheck className="h-4 w-4" />
                  <p className="text-sm font-semibold">Team member performance — {rangeLabel}</p>
                </DashCardHeader>
                <DataTable
                  data={teamData.byTeamMember}
                  columns={memberPerfCols}
                  rowKey={(m) => m.id}
                  emptyState={<p className="text-sm text-dashboard-base-content/45 py-8">No team members found.</p>}
                />
              </DashCard>

              {/* ── Filterable full lead report ─────────────────────────────── */}
              <DashCard>
                <DashCardHeader>
                  <Users className="h-4 w-4" />
                  <p className="text-sm font-semibold">Full lead report — {rangeLabel} ({filteredRows.length})</p>
                </DashCardHeader>
                <div className="p-4 pb-0">
                  <TableFilters
                    search={search}
                    onSearchChange={(v) => { setSearch(v); setReportPage(1); }}
                    searchPlaceholder="Search by name, phone, destination..."
                    filteredCount={filteredRows.length}
                    totalCount={teamData.reportRows.length}
                    filters={[
                      {
                        value: memberFilter,
                        onChange: (v) => { setMemberFilter(v); setReportPage(1); },
                        placeholder: "All Members",
                        width: "w-44",
                        options: teamData.teamMembers.map((m) => ({ label: m.name, value: m.id })),
                      },
                      {
                        value: statusFilter,
                        onChange: (v) => { setStatusFilter(v); setReportPage(1); },
                        placeholder: "All Statuses",
                        width: "w-44",
                        options: [
                          "SUBMITTED", "VERIFIED", "ASSIGNED", "IN_PROGRESS", "FOLLOW_UP",
                          "PACKAGE_SENT", "CLIENT_ACCEPTED", "CLIENT_DECLINED",
                          "PAYMENT_INITIATED", "CONVERTED", "CLOSED", "REJECTED",
                        ].map((s) => ({ label: statusLabel(s), value: s })),
                      },
                    ]}
                  />
                </div>
                <DataTable
                  data={pagedReportRows}
                  columns={reportCols}
                  rowKey={(r) => r.id}
                  emptyState={<p className="text-sm text-dashboard-base-content/45 py-8">No leads match these filters.</p>}
                  pagination={{
                    currentPage: safeReportPage,
                    totalPages: reportTotalPages,
                    onPageChange: setReportPage,
                    label: `Showing ${filteredRows.length === 0 ? 0 : (safeReportPage - 1) * reportPageSize + 1}–${Math.min(safeReportPage * reportPageSize, filteredRows.length)} of ${filteredRows.length} leads`,
                  }}
                />
              </DashCard>
            </>
          )}
        </TabsContent>

        {/* ── Leaderboard — company-wide, every Team Leader sees everyone ──── */}
        <TabsContent value="leaderboard" className="space-y-6 pt-4">
          <DashCard>
            <DashCardHeader>
              <Trophy className="h-4 w-4" />
              <p className="text-sm font-semibold">Sales Executive Leaderboard — {rangeLabel}</p>
            </DashCardHeader>
            <DataTable
              data={execLeaderboard}
              columns={execCols}
              rowKey={(r) => r.id}
              emptyState={<p className="text-sm text-dashboard-base-content/45 py-8">No sales executives found.</p>}
            />
          </DashCard>

          <DashCard>
            <DashCardHeader>
              <Users className="h-4 w-4" />
              <p className="text-sm font-semibold">Team Leaderboard — {rangeLabel}</p>
            </DashCardHeader>
            <DataTable
              data={teamLeaderboard}
              columns={teamCols}
              rowKey={(r) => r.teamId}
              emptyState={<p className="text-sm text-dashboard-base-content/45 py-8">No sales teams found.</p>}
            />
          </DashCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
