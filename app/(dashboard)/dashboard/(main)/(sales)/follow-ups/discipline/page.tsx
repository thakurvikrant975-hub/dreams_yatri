// (sales)/follow-ups/discipline/page.tsx
//
// Per-exec follow-up discipline for Team Leaders / Sales Managers: how many
// follow-ups each exec resolved on time vs let go MISSED vs kept pushing
// back (RESCHEDULED). Answers "are my execs actually working their
// follow-ups" at a glance, with the worst completion rate surfaced first.

import { Suspense } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Skeleton } from "../../../components/ui/skeleton";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../../components/ui/breadcrumb";
import { PageHeader } from "../../../components/dashboard/PageHeader";
import { TableEmptyState } from "../../../components/dashboard/TableEmptyState";
import { cn } from "@/app/lib/utils";
import {
    Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "../../../components/ui/table";
import { getFollowUpDisciplineStats, isSalesTeamLeader } from "../../sales-query/actions";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Follow-Up Discipline - Dashboard",
    description: "Per-exec follow-up discipline",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const RANGE_OPTIONS = [
    { label: "7 days", days: 7 },
    { label: "30 days", days: 30 },
    { label: "90 days", days: 90 },
];

function rateClass(rate: number | null) {
    if (rate === null) return "text-muted-foreground";
    if (rate >= 80) return "text-green-600 dark:text-green-400";
    if (rate >= 50) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
}

async function DisciplineTable({ days }: { days: number }) {
    const rows = await getFollowUpDisciplineStats(days);

    if (rows.length === 0) {
        return (
            <div className="bg-white p-4 py-12 rounded-xl border border-dashboard-base-300">
                <TableEmptyState
                    title="No follow-up activity yet"
                    description="Once your team logs follow-ups, their discipline stats will show up here."
                />
            </div>
        );
    }

    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Executive</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Completed</TableHead>
                        <TableHead className="text-right">Missed</TableHead>
                        <TableHead className="text-right">Rescheduled</TableHead>
                        <TableHead className="text-right">Cancelled</TableHead>
                        <TableHead className="text-right">Pending</TableHead>
                        <TableHead className="text-right">Completion Rate</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((r) => (
                        <TableRow key={r.id}>
                            <TableCell className="font-medium text-foreground">{r.name}</TableCell>
                            <TableCell className="text-right">{r.total}</TableCell>
                            <TableCell className="text-right text-green-600 dark:text-green-400">{r.completed}</TableCell>
                            <TableCell className="text-right text-red-600 dark:text-red-400">{r.missed}</TableCell>
                            <TableCell className="text-right text-blue-600 dark:text-blue-400">{r.rescheduled}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{r.cancelled}</TableCell>
                            <TableCell className="text-right text-amber-600 dark:text-amber-400">{r.pending}</TableCell>
                            <TableCell className={cn("text-right font-semibold", rateClass(r.completionRate))}>
                                {r.completionRate === null ? "—" : `${r.completionRate}%`}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

async function Unauthorized() {
    return (
        <div className="bg-white p-4 py-12 rounded-xl border border-dashboard-base-300">
            <TableEmptyState
                title="Not available"
                description="This view is for Team Leaders and Sales Managers."
            />
        </div>
    );
}

export default async function FollowUpDisciplinePage({
    searchParams,
}: {
    searchParams: Promise<{ days?: string }>;
}) {
    const sp = await searchParams;
    const days = RANGE_OPTIONS.some((o) => String(o.days) === sp.days) ? Number(sp.days) : 30;
    const allowed = await isSalesTeamLeader();

    return (
        <div className="space-y-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard/follow-ups">Follow-Ups</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Discipline</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <div className="flex items-start justify-between gap-4 flex-wrap">
                <PageHeader
                    title="Follow-Up Discipline"
                    description="Who's completing follow-ups on time, who's letting them slip"
                    icon={ShieldCheck}
                />
                {allowed && (
                    <div className="flex gap-1.5">
                        {RANGE_OPTIONS.map((o) => (
                            <Link
                                key={o.days}
                                href={`?days=${o.days}`}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                                    days === o.days
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "text-muted-foreground hover:text-foreground hover:border-primary/50",
                                )}
                            >
                                {o.label}
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
                {allowed ? <DisciplineTable days={days} /> : <Unauthorized />}
            </Suspense>
        </div>
    );
}
