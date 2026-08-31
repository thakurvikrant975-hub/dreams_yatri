import type { Metadata } from "next";
import { Suspense } from "react";
import { UsersRound, Users, UserX } from "lucide-react";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { PageHeader } from "../components/dashboard/PageHeader";
import { StatCard, StatGrid } from "../components/dashboard/Statcard";
import { Skeleton } from "../components/ui/skeleton";
import { getSalesTeamsOverview, getEligibleMembersForSelect } from "./actions";
import { SalesTeamsTableClient } from "./SalesTeamsTableClient";

export const metadata: Metadata = {
  title: "Sales Teams - Dashboard",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

function TeamsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-12" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

async function SalesTeamsData() {
  const [teams, eligibleMembers] = await Promise.all([
    getSalesTeamsOverview(),
    getEligibleMembersForSelect(),
  ]);

  const membersAssigned = teams.reduce((sum, t) => sum + t.memberCount, 0);
  const unassigned = eligibleMembers.filter((m) => !m.currentTeam).length;

  return (
    <div className="space-y-6">
      <StatGrid cols={3}>
        <StatCard label="Teams" value={teams.length} icon={UsersRound} />
        <StatCard label="Members Assigned" value={membersAssigned} icon={Users} />
        <StatCard label="Unassigned Sales Execs" value={unassigned} icon={UserX} />
      </StatGrid>

      <SalesTeamsTableClient teams={teams} eligibleMembers={eligibleMembers} />
    </div>
  );
}

export default function SalesTeamsPage() {
  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>Sales Teams</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        title="Sales Teams"
        description="Create teams, assign leaders, and manage sales executives"
        icon={UsersRound}
      />

      <Suspense fallback={<TeamsSkeleton />}>
        <SalesTeamsData />
      </Suspense>
    </div>
  );
}
