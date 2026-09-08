import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Contact, Table2 } from "lucide-react";
import { Skeleton } from "../../components/ui/skeleton";
import { Button } from "../../components/ui/button";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { PageHeader } from "../../components/dashboard/PageHeader";
import { getAllTeamMembersDetailed, getDepartmentsForSelect, getRolesForSelect } from "./actions";
import { TeamCardsClient } from "./TeamCardsClient";

export const metadata: Metadata = {
  title: "Team Member Cards",
  description: "Full profile details of every team member at Dreams Yatri",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

function CardsSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl border bg-card p-4 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          {Array.from({ length: 4 }).map((_, j) => <Skeleton key={j} className="h-4 w-full" />)}
        </div>
      ))}
    </div>
  );
}

async function PageContent() {
  const [members, departments, roles] = await Promise.all([
    getAllTeamMembersDetailed(),
    getDepartmentsForSelect(),
    getRolesForSelect(),
  ]);

  return (
    <>
      <PageHeader
        title="Team Member Cards"
        description="Every profile detail your team has uploaded, at a glance"
        icon={Contact}
        actions={
          <Button variant="outline" asChild>
            <Link href="/dashboard/team-members">
              <Table2 className="h-4 w-4 mr-1.5" /> Table View
            </Link>
          </Button>
        }
      />
      <TeamCardsClient members={members} departments={departments} roles={roles} />
    </>
  );
}

export default function Page() {
  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbLink href="/dashboard/team-members">Team members</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>Cards</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <Suspense fallback={<CardsSkeleton />}>
        <PageContent />
      </Suspense>
    </div>
  );
}
