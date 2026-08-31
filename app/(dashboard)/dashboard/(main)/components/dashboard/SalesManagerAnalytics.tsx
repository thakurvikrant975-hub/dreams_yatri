import { Users, Crown, IndianRupee, CheckCircle2, UserX, MessageCircleQuestion, Percent, Clock } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { StatCard, StatGrid } from "./Statcard";
import type { SalesTeamAnalytics, MemberPerformance } from "../../sales-teams/sales-team-analytics-actions";

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
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
    <div className="flex items-center justify-between gap-2 px-4 py-3 text-dashboard-neutral-content bg-dashboard-neutral border-b border-dashboard-base-300">
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function MemberRow({ member }: { member: MemberPerformance }) {
  const pct = member.monthlyTarget > 0 ? Math.min(100, Math.round((member.confirmedThisMonth / member.monthlyTarget) * 100)) : 0;
  return (
    <div className="px-4 py-2.5 border-t border-dashboard-base-300 space-y-1.5">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate text-dashboard-base-content">{member.name}</p>
          <p className="text-xs text-dashboard-base-content/45">{member.employeeId}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-dashboard-base-content">
            {member.confirmedThisMonth}/{member.monthlyTarget}
          </p>
          <p className="text-xs text-dashboard-base-content/45">{fmtCurrency(member.totalRevenue)}</p>
        </div>
        <div className="w-16 h-1.5 rounded-full bg-dashboard-base-300 overflow-hidden shrink-0">
          <div className="h-full bg-dashboard-primary" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-dashboard-base-content/50 pl-0">
        <span>{member.queriesThisMonth} quer{member.queriesThisMonth !== 1 ? "ies" : "y"} this month</span>
        <span>·</span>
        <span>{member.convertedThisMonth} converted ({member.conversionRate}%)</span>
        <span>·</span>
        <span>{member.pendingFollowUps} pending</span>
      </div>
    </div>
  );
}

export function SalesManagerAnalytics({ data }: { data: SalesTeamAnalytics }) {
  const sortedTeams = [...data.teams].sort((a, b) => b.teamConfirmedThisMonth - a.teamConfirmedThisMonth);
  const sortedUnassigned = [...data.unassigned].sort((a, b) => b.confirmedThisMonth - a.confirmedThisMonth);
  const companyConversionRate = data.companyTotals.queriesThisMonth > 0
    ? Math.round((data.companyTotals.convertedThisMonth / data.companyTotals.queriesThisMonth) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <StatGrid cols={4}>
        <StatCard label="Sales Teams" value={data.teams.length} icon={Users} />
        <StatCard label="Confirmed This Month" value={data.companyTotals.confirmedThisMonth} icon={CheckCircle2} />
        <StatCard label="Revenue This Month" value={fmtCurrency(data.companyTotals.totalRevenue)} icon={IndianRupee} />
        <StatCard label="Unassigned Execs" value={data.unassigned.length} icon={UserX} />
      </StatGrid>

      <StatGrid cols={4}>
        <StatCard label="Queries This Month" value={data.companyTotals.queriesThisMonth} icon={MessageCircleQuestion} />
        <StatCard label="Converted This Month" value={data.companyTotals.convertedThisMonth} icon={CheckCircle2} />
        <StatCard label="Conversion Rate" value={`${companyConversionRate}%`} icon={Percent} />
        <StatCard label="Pending Follow-ups" value={data.companyTotals.pendingFollowUps} icon={Clock} />
      </StatGrid>

      {sortedTeams.length === 0 ? (
        <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 flex flex-col items-center justify-center py-14 gap-2 text-center">
          <Users className="h-8 w-8 text-dashboard-base-content/40" />
          <p className="text-sm font-medium text-dashboard-base-content">No sales teams yet</p>
          <p className="text-xs text-dashboard-base-content/45">Create teams from the Sales Teams page to see performance here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sortedTeams.map((team) => (
            <DashCard key={team.teamId}>
              <DashCardHeader>
                <p className="text-sm font-semibold">{team.teamName}</p>
                {team.leader && (
                  <span className="flex items-center gap-1 text-xs opacity-75">
                    <Crown className="h-3 w-3" /> {team.leader.name}
                  </span>
                )}
              </DashCardHeader>
              <div className="flex items-center justify-between px-4 py-2 text-xs text-dashboard-base-content/60 bg-dashboard-base-200/40">
                <span>{team.teamConfirmedThisMonth} confirmed · {fmtCurrency(team.teamTotalRevenue)}</span>
                <span>{team.teamQueriesThisMonth} queries · {team.teamConversionRate}% conv · {team.teamPendingFollowUps} pending</span>
              </div>
              {team.members.length === 0 ? (
                <p className="px-4 py-6 text-sm text-center text-dashboard-base-content/45">No members assigned yet.</p>
              ) : (
                [...team.members]
                  .sort((a, b) => b.confirmedThisMonth - a.confirmedThisMonth)
                  .map((m) => <MemberRow key={m.id} member={m} />)
              )}
            </DashCard>
          ))}
        </div>
      )}

      {sortedUnassigned.length > 0 && (
        <DashCard>
          <DashCardHeader>
            <UserX className="h-4 w-4" />
            <p className="text-sm font-semibold">Unassigned sales executives</p>
          </DashCardHeader>
          {sortedUnassigned.map((m) => <MemberRow key={m.id} member={m} />)}
        </DashCard>
      )}
    </div>
  );
}
