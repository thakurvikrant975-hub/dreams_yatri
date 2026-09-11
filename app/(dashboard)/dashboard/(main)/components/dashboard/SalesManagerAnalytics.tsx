"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Users, Crown, IndianRupee, CheckCircle2, UserX, MessageCircleQuestion,
  Percent, Clock, Target, TrendingUp, Trophy, Medal, Award, LayoutGrid,
} from "lucide-react";
import { cn } from "@/app/lib/utils";
import { DateRangePicker } from "../ui/date-range-picker";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { StatCard, StatGrid } from "./Statcard";
import { DataTable, type ColumnDef } from "./Datatable";
import { TableFilters } from "./Tablefilters";
import type { SalesTeamAnalytics, MemberPerformance, TeamPerformance } from "../../sales-teams/sales-team-analytics-actions";

type Props = { data: SalesTeamAnalytics; from: string; to: string };

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}
function daysAgoStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}
function monthStartStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Attainment as a percentage of target, or null when there's nothing to
 * measure against — a manager reading "no target set" should see a dash,
 * not a misleading 0%. */
function pctOf(achieved: number, target: number | null): number | null {
  if (target === null || target <= 0) return null;
  return Math.round((achieved / target) * 100);
}

/** On/over target reads as success, under half reads as a caution —
 * everything between is the neutral brand color. */
function barTone(pct: number) {
  if (pct >= 100) return "bg-dashboard-success";
  if (pct < 50) return "bg-dashboard-warning";
  return "bg-dashboard-primary";
}

function MiniBar({ pct }: { pct: number }) {
  return (
    <span className="w-16 h-1.5 rounded-full bg-dashboard-base-300 overflow-hidden shrink-0">
      <span className={cn("block h-full rounded-full", barTone(pct))} style={{ width: `${Math.min(100, pct)}%` }} />
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
  if (rank === 1) return <Trophy className="h-4 w-4 text-amber-500" />;
  if (rank === 2) return <Medal className="h-4 w-4 text-slate-400" />;
  if (rank === 3) return <Award className="h-4 w-4 text-orange-600" />;
  return <span className="text-xs font-semibold text-dashboard-base-content/50 tabular-nums w-4 text-center">{rank}</span>;
}

function MemberRow({ member }: { member: MemberPerformance }) {
  const hasConversionTarget = member.conversionTarget !== null && member.conversionTarget > 0;
  const bookingPct = pctOf(member.confirmedThisMonth, member.conversionTarget);
  const hasRevenueTarget = member.revenueTarget !== null && member.revenueTarget > 0;
  const revenuePct = pctOf(member.totalRevenue, member.revenueTarget);
  return (
    <div className="px-4 py-2.5 border-t border-dashboard-base-300 space-y-1.5">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate text-dashboard-base-content">{member.name}</p>
          <p className="text-xs text-dashboard-base-content/45">{member.employeeId}</p>
        </div>
        <div className="text-right shrink-0 space-y-1">
          <div className="flex items-center justify-end gap-1.5 text-sm font-semibold text-dashboard-base-content">
            {member.confirmedThisMonth}{hasConversionTarget ? `/${member.conversionTarget}` : ""} bookings
            {bookingPct !== null && <MiniBar pct={bookingPct} />}
          </div>
          <div className="flex items-center justify-end gap-1.5 text-xs text-dashboard-base-content/45">
            {fmtCurrency(member.totalRevenue)}{hasRevenueTarget ? ` / ${fmtCurrency(member.revenueTarget!)}` : ""}
            {revenuePct !== null && <MiniBar pct={revenuePct} />}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-dashboard-base-content/50 pl-0">
        <span>{member.queriesThisMonth} quer{member.queriesThisMonth !== 1 ? "ies" : "y"}</span>
        <span>·</span>
        <span>{member.convertedThisMonth} converted ({member.conversionRate}%)</span>
        <span>·</span>
        <span>{member.pendingFollowUps} pending</span>
      </div>
    </div>
  );
}

/** Simple horizontal revenue ranking, self-contained rather than the shared
 * RankedBarChart — that component's tooltip is hardcoded to "action(s)",
 * which reads wrong next to a rupee amount. */
function RevenueByTeamChart({ teams }: { teams: TeamPerformance[] }) {
  const ranked = [...teams].sort((a, b) => b.teamTotalRevenue - a.teamTotalRevenue);
  const max = Math.max(1, ...ranked.map((t) => t.teamTotalRevenue));
  if (ranked.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-dashboard-base-content/45">No teams yet.</p>;
  }
  return (
    <div className="p-4 space-y-3">
      {ranked.map((t) => (
        <div key={t.teamId} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-dashboard-base-content truncate">{t.teamName}</span>
            <span className="text-dashboard-base-content/60 tabular-nums shrink-0">{fmtCurrency(t.teamTotalRevenue)}</span>
          </div>
          <div className="h-2 rounded-full bg-dashboard-base-300 overflow-hidden">
            <div
              className="h-full rounded-full bg-dashboard-primary"
              style={{ width: `${Math.max(2, Math.round((t.teamTotalRevenue / max) * 100))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Leaderboard row shapes, derived client-side from the same payload the
// team cards use — no extra fetch needed. ─────────────────────────────────
type ExecRow = MemberPerformance & { teamName: string; rank: number };
type TeamRow = TeamPerformance & { rank: number };

function rankExecs(data: SalesTeamAnalytics): ExecRow[] {
  const flat: (MemberPerformance & { teamName: string })[] = [
    ...data.teams.flatMap((t) => t.members.map((m) => ({ ...m, teamName: t.teamName }))),
    ...data.unassigned.map((m) => ({ ...m, teamName: "Unassigned" })),
  ];
  return flat
    .sort((a, b) => b.totalRevenue - a.totalRevenue || b.confirmedThisMonth - a.confirmedThisMonth)
    .map((m, i) => ({ ...m, rank: i + 1 }));
}

function rankTeams(data: SalesTeamAnalytics): TeamRow[] {
  return [...data.teams]
    .sort((a, b) => b.teamTotalRevenue - a.teamTotalRevenue || b.teamConfirmedThisMonth - a.teamConfirmedThisMonth)
    .map((t, i) => ({ ...t, rank: i + 1 }));
}

export function SalesManagerAnalytics({ data, from, to }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");

  const isToday = from === todayStr() && to === todayStr();
  const isLast7 = from === daysAgoStr(6) && to === todayStr();
  const isLast30 = from === daysAgoStr(29) && to === todayStr();
  const isMonth = from === monthStartStr() && to === todayStr();

  function setRange(newFrom: string, newTo: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", newFrom);
    params.set("to", newTo);
    startTransition(() => router.replace(`?${params.toString()}`));
  }

  const rangeLabel = from === to
    ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${from}T00:00:00`))
    : `${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(`${from}T00:00:00`))} – ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${to}T00:00:00`))}`;

  const teamOptions = data.teams.map((t) => ({ label: t.teamName, value: t.teamId }));

  const visibleTeams = useMemo(() => {
    const s = search.trim().toLowerCase();
    return data.teams
      .filter((t) => teamFilter === "all" || t.teamId === teamFilter)
      .map((t) => ({
        ...t,
        members: s ? t.members.filter((m) => m.name.toLowerCase().includes(s) || m.employeeId.toLowerCase().includes(s)) : t.members,
      }))
      .filter((t) => !s || t.teamName.toLowerCase().includes(s) || t.members.length > 0);
  }, [data.teams, search, teamFilter]);

  const visibleUnassigned = useMemo(() => {
    if (teamFilter !== "all") return [];
    const s = search.trim().toLowerCase();
    return s ? data.unassigned.filter((m) => m.name.toLowerCase().includes(s) || m.employeeId.toLowerCase().includes(s)) : data.unassigned;
  }, [data.unassigned, search, teamFilter]);

  // The stat cards above the team list used to always read data.companyTotals
  // — company-wide regardless of the team filter or search, so picking one
  // team left the numbers at the top unchanged. Summed off whichever members
  // are actually visible instead. Targets are summed once per still-visible
  // team (not per matched member) plus each visible unassigned member's own
  // — a team's target doesn't shrink just because a search narrowed which of
  // its members are shown.
  // Team-rostered members only — the org chart is Sales Manager → Team
  // Leader → Sales Executive, so unassigned execs (shown separately, purely
  // for awareness) never count toward these figures, matching
  // getSalesTeamAnalytics' own companyTotals rule.
  const visibleTotals = useMemo(() => {
    const members = visibleTeams.flatMap((t) => t.members);
    const visibleTeamIds = new Set(visibleTeams.map((t) => t.teamId));
    const revenueTargets = data.teams
      .filter((t) => visibleTeamIds.has(t.teamId))
      .map((t) => t.teamRevenueTarget)
      .filter((v): v is number => v !== null);
    const conversionTargets = data.teams
      .filter((t) => visibleTeamIds.has(t.teamId))
      .map((t) => t.teamConversionTarget)
      .filter((v): v is number => v !== null);
    return {
      totalRevenue: members.reduce((s, m) => s + m.totalRevenue, 0),
      confirmedThisMonth: members.reduce((s, m) => s + m.confirmedThisMonth, 0),
      queriesThisMonth: members.reduce((s, m) => s + m.queriesThisMonth, 0),
      convertedThisMonth: members.reduce((s, m) => s + m.convertedThisMonth, 0),
      pendingFollowUps: members.reduce((s, m) => s + m.pendingFollowUps, 0),
      revenueTarget: revenueTargets.length > 0 ? revenueTargets.reduce((a, b) => a + b, 0) : null,
      conversionTarget: conversionTargets.length > 0 ? conversionTargets.reduce((a, b) => a + b, 0) : null,
    };
  }, [visibleTeams, data.teams]);

  const visibleRevenuePct = pctOf(visibleTotals.totalRevenue, visibleTotals.revenueTarget);
  const visibleBookingPct = pctOf(visibleTotals.confirmedThisMonth, visibleTotals.conversionTarget);
  const visibleConversionRate = visibleTotals.queriesThisMonth > 0
    ? Math.round((visibleTotals.convertedThisMonth / visibleTotals.queriesThisMonth) * 100)
    : 0;
  const isFiltered = teamFilter !== "all" || search.trim() !== "";

  const execLeaderboard = useMemo(() => rankExecs(data), [data]);
  const teamLeaderboard = useMemo(() => rankTeams(data), [data]);

  const execCols: ColumnDef<ExecRow>[] = [
    { header: "Rank", width: "w-[50px]", cell: (r) => <RankBadge rank={r.rank} /> },
    { header: "Sales Executive", sortKey: (r) => r.name.toLowerCase(), cell: (r) => (
      <div>
        <p className="text-sm font-medium text-dashboard-base-content">{r.name}</p>
        <p className="text-xs text-dashboard-base-content/45">{r.employeeId}</p>
      </div>
    ) },
    { header: "Team", sortKey: (r) => r.teamName.toLowerCase(), cell: (r) => <span className="text-xs text-dashboard-base-content/70">{r.teamName}</span> },
    { header: "Bookings", align: "center", sortKey: (r) => r.confirmedThisMonth, cell: (r) => (
      <span className="text-sm tabular-nums">
        {r.confirmedThisMonth}{r.conversionTarget !== null ? `/${r.conversionTarget}` : ""}
      </span>
    ) },
    { header: "Revenue", align: "right", sortKey: (r) => r.totalRevenue, cell: (r) => (
      <div className="text-right">
        <p className="text-sm tabular-nums font-medium text-dashboard-base-content">{fmtCurrency(r.totalRevenue)}</p>
        {r.revenueTarget !== null && <p className="text-[11px] text-dashboard-base-content/45">of {fmtCurrency(r.revenueTarget)}</p>}
      </div>
    ) },
    { header: "Queries", align: "center", sortKey: (r) => r.queriesThisMonth, cell: (r) => <span className="text-sm tabular-nums">{r.queriesThisMonth}</span> },
    { header: "Conv. Rate", align: "right", sortKey: (r) => r.conversionRate, cell: (r) => <span className="text-sm tabular-nums font-medium">{r.conversionRate}%</span> },
    { header: "Pending", align: "right", sortKey: (r) => r.pendingFollowUps, cell: (r) => <span className="text-sm tabular-nums text-dashboard-base-content/60">{r.pendingFollowUps}</span> },
  ];

  const teamCols: ColumnDef<TeamRow>[] = [
    { header: "Rank", width: "w-[50px]", cell: (r) => <RankBadge rank={r.rank} /> },
    { header: "Team", sortKey: (r) => r.teamName.toLowerCase(), cell: (r) => <span className="text-sm font-medium text-dashboard-base-content">{r.teamName}</span> },
    { header: "Leader", cell: (r) => <span className="text-xs text-dashboard-base-content/70">{r.leader?.name ?? "—"}</span> },
    { header: "Members", align: "center", sortKey: (r) => r.members.length, cell: (r) => <span className="text-sm tabular-nums">{r.members.length}</span> },
    { header: "Bookings", align: "center", sortKey: (r) => r.teamConfirmedThisMonth, cell: (r) => (
      <span className="text-sm tabular-nums">
        {r.teamConfirmedThisMonth}{r.teamConversionTarget !== null ? `/${r.teamConversionTarget}` : ""}
      </span>
    ) },
    { header: "Revenue", align: "right", sortKey: (r) => r.teamTotalRevenue, cell: (r) => (
      <div className="text-right">
        <p className="text-sm tabular-nums font-medium text-dashboard-base-content">{fmtCurrency(r.teamTotalRevenue)}</p>
        {r.teamRevenueTarget !== null && <p className="text-[11px] text-dashboard-base-content/45">of {fmtCurrency(r.teamRevenueTarget)}</p>}
      </div>
    ) },
    { header: "Conv. Rate", align: "right", sortKey: (r) => r.teamConversionRate, cell: (r) => <span className="text-sm tabular-nums font-medium">{r.teamConversionRate}%</span> },
  ];

  return (
    <div className="space-y-6">
      {/* ── Range controls ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-2 justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { label: "Today", active: isToday, onClick: () => setRange(todayStr(), todayStr()) },
            { label: "Last 7 days", active: isLast7, onClick: () => setRange(daysAgoStr(6), todayStr()) },
            { label: "Last 30 days", active: isLast30, onClick: () => setRange(daysAgoStr(29), todayStr()) },
            { label: "This month", active: isMonth, onClick: () => setRange(monthStartStr(), todayStr()) },
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

      {/* ── Targets vs. actuals — reacts to the team filter / search below,
          so picking one team narrows these down too instead of always
          reading the whole floor's numbers. ─────────────────────────────── */}
      <StatGrid cols={4}>
        <StatCard label="Revenue Target" value={visibleTotals.revenueTarget !== null ? fmtCurrency(visibleTotals.revenueTarget) : "—"} sub={isFiltered ? "For the current filter" : "This month, company-wide"} icon={Target} />
        <StatCard
          label="Revenue Achieved" value={fmtCurrency(visibleTotals.totalRevenue)} sub={rangeLabel} icon={IndianRupee}
          trend={visibleRevenuePct !== null ? { value: `${visibleRevenuePct}%`, positive: visibleRevenuePct >= 100 } : undefined}
        />
        <StatCard label="Bookings Target" value={visibleTotals.conversionTarget ?? "—"} sub={isFiltered ? "For the current filter" : "This month, company-wide"} icon={CheckCircle2} />
        <StatCard
          label="Bookings Achieved" value={visibleTotals.confirmedThisMonth} sub={rangeLabel} icon={TrendingUp}
          trend={visibleBookingPct !== null ? { value: `${visibleBookingPct}%`, positive: visibleBookingPct >= 100 } : undefined}
        />
      </StatGrid>

      <StatGrid cols={4}>
        <StatCard label="Queries" value={visibleTotals.queriesThisMonth} icon={MessageCircleQuestion} sub={rangeLabel} />
        <StatCard label="Converted" value={visibleTotals.convertedThisMonth} icon={CheckCircle2} sub={rangeLabel} />
        <StatCard label="Conversion Rate" value={`${visibleConversionRate}%`} icon={Percent} sub="converted / queries" />
        <StatCard label="Pending Follow-ups" value={visibleTotals.pendingFollowUps} icon={Clock} sub="current backlog" />
      </StatGrid>

      <p className="flex items-center gap-1.5 text-xs text-dashboard-base-content/50">
        <Users className="size-3.5" />
        {isFiltered
          ? `Showing ${visibleTeams.length} of ${data.teams.length} sales team${data.teams.length !== 1 ? "s" : ""}${visibleUnassigned.length > 0 ? ` · ${visibleUnassigned.length} unassigned executive${visibleUnassigned.length !== 1 ? "s" : ""}` : ""}`
          : `${data.teams.length} sales team${data.teams.length !== 1 ? "s" : ""} · ${data.unassigned.length} unassigned executive${data.unassigned.length !== 1 ? "s" : ""}`}
      </p>

      <Tabs defaultValue="overview">
        <TabsList variant="line">
          <TabsTrigger value="overview">
            <LayoutGrid className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="leaderboard">
            <Trophy className="h-3.5 w-3.5" /> Leaderboard
          </TabsTrigger>
        </TabsList>

        {/* ── Overview: team cards, filterable ───────────────────────────── */}
        <TabsContent value="overview" className="space-y-6 pt-4">
          <TableFilters
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by executive name or employee ID..."
            filters={[
              { value: teamFilter, onChange: setTeamFilter, placeholder: "All Teams", width: "w-48", options: teamOptions },
            ]}
          />

          {data.teams.length > 0 && (
            <DashCard>
              <DashCardHeader>
                <TrendingUp className="h-4 w-4" />
                <p className="text-sm font-semibold">Revenue by team — {rangeLabel}</p>
              </DashCardHeader>
              <RevenueByTeamChart teams={data.teams} />
            </DashCard>
          )}

          {visibleTeams.length === 0 ? (
            <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 flex flex-col items-center justify-center py-14 gap-2 text-center">
              <Users className="h-8 w-8 text-dashboard-base-content/40" />
              <p className="text-sm font-medium text-dashboard-base-content">No matching teams</p>
              <p className="text-xs text-dashboard-base-content/45">
                {data.teams.length === 0 ? "Create teams from the Sales Teams page to see performance here." : "Try a different search or team filter."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {visibleTeams.map((team) => {
                const bookingPct = pctOf(team.teamConfirmedThisMonth, team.teamConversionTarget);
                const revenuePct = pctOf(team.teamTotalRevenue, team.teamRevenueTarget);
                return (
                  <DashCard key={team.teamId}>
                    <DashCardHeader>
                      <p className="text-sm font-semibold">{team.teamName}</p>
                      {team.leader && (
                        <span className="flex items-center gap-1 text-xs opacity-75">
                          <Crown className="h-3 w-3" /> {team.leader.name}
                        </span>
                      )}
                    </DashCardHeader>
                    <div className="flex flex-col gap-1.5 px-4 py-2.5 text-xs bg-dashboard-base-200/40">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-dashboard-base-content/60">
                          {team.teamConfirmedThisMonth}{team.teamConversionTarget !== null ? `/${team.teamConversionTarget}` : ""} bookings
                        </span>
                        {bookingPct !== null && <MiniBar pct={bookingPct} />}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-dashboard-base-content/60">
                          {fmtCurrency(team.teamTotalRevenue)}{team.teamRevenueTarget !== null ? ` / ${fmtCurrency(team.teamRevenueTarget)}` : ""}
                        </span>
                        {revenuePct !== null && <MiniBar pct={revenuePct} />}
                      </div>
                      <span className="text-dashboard-base-content/50">
                        {team.teamQueriesThisMonth} queries · {team.teamConversionRate}% conv · {team.teamPendingFollowUps} pending
                      </span>
                    </div>
                    {team.members.length === 0 ? (
                      <p className="px-4 py-6 text-sm text-center text-dashboard-base-content/45">No matching executives.</p>
                    ) : (
                      [...team.members]
                        .sort((a, b) => b.totalRevenue - a.totalRevenue)
                        .map((m) => <MemberRow key={m.id} member={m} />)
                    )}
                  </DashCard>
                );
              })}
            </div>
          )}

          {visibleUnassigned.length > 0 && (
            <DashCard>
              <DashCardHeader>
                <UserX className="h-4 w-4" />
                <p className="text-sm font-semibold">Unassigned sales executives</p>
              </DashCardHeader>
              {visibleUnassigned.map((m) => <MemberRow key={m.id} member={m} />)}
            </DashCard>
          )}
        </TabsContent>

        {/* ── Leaderboard ─────────────────────────────────────────────────── */}
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
