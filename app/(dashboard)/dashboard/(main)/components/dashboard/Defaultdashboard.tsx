// app/dashboard/components/DefaultDashboard.tsx
import { Suspense } from "react";
import {
  Users,
  Inbox,
  CalendarCheck,
  BarChart3,
  ArrowRight,
  Building2,
} from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import type { CurrentMember } from "@/app/types/members";
import { GreetingBanner } from "./Greetingbanner";
import { FunNotification } from "./Funnotification";
import { StatCard, StatGrid } from "./Statcard";
import { db } from "@/app/lib/db";
import { cn } from "@/app/lib/utils";
import { QueryStatus } from "@/app/generated/prisma/client";
import { $Enums } from "@/app/generated/prisma";



interface DefaultDashboardProps {
  member: CurrentMember;
}

// ── Async data ────────────────────────────────────────────────────────────────

async function DefaultDashboardContent({ member }: { member: CurrentMember }) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalQueries,
    totalConfirmed,
    openQueries,
    totalMembers,
    recentActivity,
  ] = await Promise.all([
    db.package_queries.count(),
    db.package_queries.count({
      where: { verified: true },
    }),
    db.package_queries.count({
      where: {
        status: { notIn: [$Enums.QueryStatus.REJECTED] },
        verified: false,
      },
    }),
    db.teamMember.count({ where: { isActive: true } }),
    db.package_queries.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        destination: true,
        status: true,
        createdAt: true,
        assignedTo: true,
      },
    }),
  ]);

  const STATUS_STYLES: Record<string, string> = {
    SUBMITTED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    VERIFIED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    ASSIGNED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <div className="space-y-6">
      <FunNotification memberId={member.id} />

      {/* KPI overview */}
      <StatGrid cols={4}>
        <StatCard
          label="Total queries"
          value={totalQueries}
          sub="All time"
          icon={Inbox}
          iconColor="bg-blue-500/10"
          iconText="text-blue-600"
        />
        <StatCard
          label="Confirmed"
          value={totalConfirmed}
          sub="Successfully converted"
          icon={CalendarCheck}
          iconColor="bg-green-500/10"
          iconText="text-green-600"
          highlight={totalConfirmed > 0}
        />
        <StatCard
          label="Open pipeline"
          value={openQueries}
          sub="Pending action"
          icon={BarChart3}
          iconColor="bg-yellow-500/10"
          iconText="text-yellow-600"
          muted={openQueries === 0}
        />
        <StatCard
          label="Active members"
          value={totalMembers}
          sub="Online right now"
          icon={Users}
          iconColor="bg-purple-500/10"
          iconText="text-purple-600"
        />
      </StatGrid>

      {/* Recent activity */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Recent queries</p>
          </div>
          <a
            href="/dashboard/queries"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            View all <ArrowRight className="h-3 w-3" />
          </a>
        </div>

        {recentActivity.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-6">
            <span className="text-3xl">🌵</span>
            <p className="text-sm font-medium">Quiet in here.</p>
            <p className="text-xs text-muted-foreground">
              No queries yet. Marketing is probably warming up.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {recentActivity.map((q) => (
              <a
                key={q.id}
                href={`/dashboard/queries/${q.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{q.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {q.destination ?? "No destination"} ·{" "}
                    {new Intl.DateTimeFormat("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(q.createdAt))}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!q.assignedTo && (
                    <span className="text-[10px] text-muted-foreground border rounded-full px-1.5 py-0.5">
                      Unassigned
                    </span>
                  )}
                  <span
                    className={cn(
                      "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                      STATUS_STYLES[q.status] ?? "bg-muted text-muted-foreground"
                    )}
                  >
                    {q.status}
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Quick navigation */}
      <div className="rounded-xl border bg-card px-5 py-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Navigate
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { href: "/dashboard/queries", icon: Inbox, label: "Queries", color: "text-blue-600", bg: "bg-blue-500/10" },
            { href: "/dashboard/package-bookings", icon: CalendarCheck, label: "Bookings", color: "text-green-600", bg: "bg-green-500/10" },
            { href: "/dashboard/team", icon: Users, label: "Team", color: "text-purple-600", bg: "bg-purple-500/10" },
            { href: "/dashboard/hotels", icon: Building2, label: "Hotels", color: "text-orange-600", bg: "bg-orange-500/10" },
            { href: "/dashboard/analytics", icon: BarChart3, label: "Analytics", color: "text-pink-600", bg: "bg-pink-500/10" },
          ].map(({ href, icon: Icon, label, color, bg }) => (
            <a
              key={label}
              href={href}
              className="flex items-center gap-2.5 rounded-xl border bg-muted/30 px-3 py-3 hover:bg-muted/60 hover:border-border transition-all duration-150"
            >
              <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0", bg)}>
                <Icon className={cn("h-3.5 w-3.5", color)} />
              </div>
              <p className="text-sm font-medium">{label}</p>
            </a>
          ))}
        </div>
      </div>

    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function DefaultDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-60 rounded-xl bg-muted animate-pulse" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-12" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <Skeleton className="h-4 w-32" />
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 border-t">
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export function DefaultDashboard({ member }: DefaultDashboardProps) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<DefaultDashboardSkeleton />}>
        <DefaultDashboardContent member={member} />
      </Suspense>
    </div>
  );
}