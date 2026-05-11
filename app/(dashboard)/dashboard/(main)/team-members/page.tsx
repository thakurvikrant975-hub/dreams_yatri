// page.tsx
import { Suspense } from "react";
import { IdCardLanyard } from "lucide-react";
import { Skeleton } from "../components/ui/skeleton";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import {
  getTeamMembersPaginated,
  getDepartmentsForSelect,
  getRolesForSelect,
} from "./actions";
import { TeamMembersTable } from "./TeamMembersTable";
import { CreateTeamMemberDialog } from "./TeamMemberDialog";
import { db } from "@/app/lib/db";
import { PageHeader } from "../components/dashboard/PageHeader";

function TableSkeleton() {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="bg-muted/50 px-4 py-3 grid grid-cols-7 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-4" />
        ))}
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="px-4 py-3 grid grid-cols-7 gap-4 border-t items-center">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-4 w-20" />
          <div className="flex justify-end">
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

// Replace PageContent's data fetching and props
async function PageContent({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));

  const [paginated, departments, roles, allMembers] = await Promise.all([
    getTeamMembersPaginated(page),
    getDepartmentsForSelect(),
    getRolesForSelect(),
    // Lightweight aggregate query — only pulls id, isActive, departmentId
    db.teamMember.findMany({
      select: { isActive: true, department: { select: { id: true } } },
    }),
  ]);

  const totalStats = {
    total: allMembers.length,
    active: allMembers.filter((m) => m.isActive).length,
    inactive: allMembers.filter((m) => !m.isActive).length,
    departments: new Set(allMembers.map((m) => m.department?.id).filter(Boolean)).size,
  };

  return (
    <>
      <PageHeader
        title="Team Members"
        description="Manage your team, roles, and access"
        icon={IdCardLanyard}
        actions={<CreateTeamMemberDialog departments={departments} roles={roles} />}

      />

      <TeamMembersTable
        paginated={paginated}
        totalStats={totalStats}
        departments={departments}
        roles={roles}
        currentPage={page}
      />
    </>
  );
}

export default function TeamMembersPage({ searchParams }: PageProps) {
  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Team members</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Suspense fallback={<TableSkeleton />}>
        <PageContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}