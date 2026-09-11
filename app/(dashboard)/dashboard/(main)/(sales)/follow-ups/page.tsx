// app/dashboard/sales-query/my-followups/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import { CalendarClock, Clock, AlertCircle, CalendarDays, ShieldCheck } from "lucide-react";
import { Skeleton } from "../../components/ui/skeleton";
import { Button } from "../../components/ui/button";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { getMyFollowUps, isSalesTeamLeader } from "../sales-query/actions";
import { MyFollowUpsTable } from "./Myfollowupstable";
import { isPast, isToday } from "date-fns";
import type { Metadata } from "next";
import { StatCard, StatGrid } from "../../components/dashboard/Statcard";
import { PageHeader } from "../../components/dashboard/PageHeader";


export const metadata: Metadata = {
    title: "Follow ups - Dashboard",
    description: "Follow ups page",
    robots: {
        index: false,
        follow: false,
        nocache: true,
        googleBot: { index: false, follow: false },
    },
};

async function MyFollowUpsContent() {
    const followUps = await getMyFollowUps();

    const overdueCount = followUps.filter(fu =>
        fu.followUpAt && isPast(new Date(fu.followUpAt)) && !isToday(new Date(fu.followUpAt))
    ).length;
    const todayCount = followUps.filter(fu =>
        fu.followUpAt && isToday(new Date(fu.followUpAt))
    ).length;
    const upcomingCount = followUps.filter(fu => {
        if (!fu.followUpAt) return false;
        const d = new Date(fu.followUpAt);
        return d > new Date() && !isToday(d);
    }).length;

    return (
        <>
            <StatGrid cols={4}>
                <StatCard
                    label="Total Follow-Ups"
                    value={followUps.length}
                    icon={CalendarDays}
                    iconText="text-dashboard-primary"
                />
                <StatCard
                    label="Overdue"
                    value={overdueCount}
                    icon={AlertCircle}
                    iconText="text-dashboard-info"
                />
                <StatCard
                    label="Due Today"
                    value={todayCount}
                    icon={Clock}
                    iconText="text-dashboard-warning"
                />
                <StatCard
                    label="Upcoming"
                    value={upcomingCount}
                    icon={CalendarClock}
                    iconText="text-dashboard-success"
                />
            </StatGrid>
            <MyFollowUpsTable followUps={followUps} />
        </>
    );
}

export default async function MyFollowUpsPage() {
    const isTeamLead = await isSalesTeamLeader();

    return (
        <div className="space-y-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard/sales-query">My Queries</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>My Follow-Ups</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <div className="flex items-start justify-between gap-4 flex-wrap">
                <PageHeader
                    title="My Follow-Ups"
                    description="All follow-ups logged by you"
                    icon={CalendarClock}
                />
                {isTeamLead && (
                    <Button asChild variant="outline" size="sm" className="gap-1.5">
                        <Link href="/dashboard/follow-ups/discipline">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Team Discipline
                        </Link>
                    </Button>
                )}
            </div>

            <Suspense
                fallback={
                    <div className="space-y-4">
                        {/* Stats skeleton */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="rounded-xl border bg-muted/40 px-4 py-3.5 flex items-center gap-3">
                                    <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                                    <div className="space-y-1.5">
                                        <Skeleton className="h-2.5 w-20" />
                                        <Skeleton className="h-6 w-10" />
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Cards skeleton */}
                        <div className="space-y-2.5">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="rounded-xl border bg-card p-4">
                                    <Skeleton className="h-4 w-48 mb-2" />
                                    <Skeleton className="h-3 w-full mb-1" />
                                    <Skeleton className="h-3 w-3/4" />
                                </div>
                            ))}
                        </div>
                    </div>
                }
            >
                <MyFollowUpsContent />
            </Suspense>
        </div>
    );
}