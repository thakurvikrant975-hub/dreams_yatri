import { Suspense } from "react";
import { Users, CheckCircle2, IndianRupee, ArrowRight, UsersRound, BarChart3, Clock } from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import { cn } from "@/app/lib/utils";
import type { CurrentMember } from "@/app/types/members";
import { StatCard, StatGrid } from "./Statcard";
import { getSalesTeamAnalytics } from "../../sales-teams/sales-team-analytics-actions";

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

function LinkCard({ href, icon: Icon, title, description }: { href: string; icon: React.ElementType; title: string; description: string }) {
  return (
    <a href={href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-dashboard-base-200/50 transition-colors">
      <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-dashboard-primary/10">
        <Icon className="h-4.5 w-4.5 text-dashboard-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-dashboard-base-content">{title}</p>
        <p className="text-xs text-dashboard-base-content/45">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-dashboard-base-content/30 shrink-0" />
    </a>
  );
}

async function SalesManagerDashboardContent({ member }: { member: CurrentMember }) {
  void member;
  const data = await getSalesTeamAnalytics();

  return (
    <div className="space-y-6">
      <StatGrid cols={5}>
        <StatCard label="Sales Teams" value={data.teams.length} icon={Users} />
        <StatCard label="Members" value={data.teams.reduce((s, t) => s + t.members.length, 0)} icon={UsersRound} />
        <StatCard label="Confirmed This Month" value={data.companyTotals.confirmedThisMonth} icon={CheckCircle2} />
        <StatCard label="Revenue This Month" value={fmtCurrency(data.companyTotals.totalRevenue)} icon={IndianRupee} />
        <StatCard label="Pending Follow-ups" value={data.companyTotals.pendingFollowUps} icon={Clock} />
      </StatGrid>

      <DashCard className="divide-y divide-dashboard-base-300">
        <LinkCard href="/dashboard/sales-teams" icon={UsersRound} title="Manage Sales Teams" description="Create teams, assign leaders, and sales executives" />
        <LinkCard href="/dashboard/analytics" icon={BarChart3} title="View Full Analytics" description="Team-by-team leaderboards and performance breakdown" />
      </DashCard>
    </div>
  );
}

function SalesManagerSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 p-4 space-y-3">
            <Skeleton className="h-3 w-20 bg-dashboard-base-300" />
            <Skeleton className="h-7 w-12 bg-dashboard-base-300" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 p-4 space-y-3">
        <Skeleton className="h-10 w-full bg-dashboard-base-300" />
        <Skeleton className="h-10 w-full bg-dashboard-base-300" />
      </div>
    </div>
  );
}

export function SalesManagerDashboard({ member }: { member: CurrentMember }) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<SalesManagerSkeleton />}>
        <SalesManagerDashboardContent member={member} />
      </Suspense>
    </div>
  );
}
