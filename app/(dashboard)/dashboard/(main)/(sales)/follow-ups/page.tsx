// app/dashboard/sales-query/my-followups/page.tsx
import { Suspense } from "react";
import { CalendarClock, Clock, CheckCircle2 } from "lucide-react";
import { Skeleton } from "../../components/ui/skeleton";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { getMyFollowUps } from "../sales-query/actions";
import { MyFollowUpsTable } from "./Myfollowupstable";

async function MyFollowUpsData() {
    const followUps = await getMyFollowUps();
    return <MyFollowUpsTable followUps={followUps} />;
}

export default function MyFollowUpsPage() {
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

            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                        <CalendarClock className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold">My Follow-Ups</h1>
                        <p className="text-sm text-muted-foreground">
                            All follow-ups logged by you — only visible to you
                        </p>
                    </div>
                </div>
            </div>

            <Suspense
                fallback={
                    <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="rounded-xl border bg-card p-4">
                                <Skeleton className="h-4 w-48 mb-2" />
                                <Skeleton className="h-3 w-full mb-1" />
                                <Skeleton className="h-3 w-3/4" />
                            </div>
                        ))}
                    </div>
                }
            >
                <MyFollowUpsData />
            </Suspense>
        </div>
    );
}