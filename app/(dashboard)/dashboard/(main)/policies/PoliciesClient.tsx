import { Suspense }          from "react";
import { FileText, CheckCircle2, XCircle, Package } from "lucide-react";
import { Skeleton }           from "../components/ui/skeleton";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { getPolicies, type GetPoliciesParams } from "./actions";
import { PoliciesTableClient }  from "./PoliciesTableClient";
import { CreatePolicyDialog }   from "./PolicyDialog";
import { PageHeader }           from "../components/dashboard/PageHeader";
import { StatCard, StatGrid }   from "../components/dashboard/Statcard";
import type { PolicyType }      from "./constants";

// re-export to satisfy PoliciesData inline cast
type _Status = "active" | "inactive" | "all";

// ── Skeleton ──────────────────────────────────────────────────────────────

function TableSkeleton() {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-7 w-10" />
                    </div>
                ))}
            </div>
            <div className="rounded-xl border bg-card overflow-hidden">
                <div className="bg-muted/50 px-4 py-3 grid grid-cols-6 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-4" />)}
                </div>
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="px-4 py-3 grid grid-cols-6 gap-4 border-t items-center">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-8 mx-auto" />
                        <Skeleton className="h-5 w-10 mx-auto" />
                        <div className="flex justify-end gap-1">
                            <Skeleton className="h-8 w-8 rounded-md" />
                            <Skeleton className="h-8 w-8 rounded-md" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Async data component ──────────────────────────────────────────────────

async function PoliciesData({
    params,
}: {
    params: GetPoliciesParams;
}) {
    const { policies, totalCount, isFiltering, stats } = await getPolicies(params);

    return (
        <>
            <StatGrid cols={4}>
                <StatCard label="Total Policies" value={stats.total}    icon={FileText}     />
                <StatCard label="Active"          value={stats.active}   icon={CheckCircle2} />
                <StatCard label="Inactive"        value={stats.inactive} icon={XCircle}      />
                <StatCard label="In Packages"     value={stats.packages} icon={Package}      />
            </StatGrid>

            <PoliciesTableClient
                policies={policies}
                totalCount={totalCount}
                limit={params.limit ?? 10}
                currentPage={params.page ?? 1}
                isFiltering={isFiltering}
                search={params.search ?? ""}
                type={(params.type ?? "all") as PolicyType | "all"}
                status={(params.status ?? "all") as _Status}
            />
        </>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────

export async function PoliciesClient({
    page,
    limit,
    search,
    type,
    status,
}: {
    page:   number;
    limit:  number;
    search: string;
    type:   PolicyType | "all";
    status: "active" | "inactive" | "all";
}) {
    const params: GetPoliciesParams = { page, limit, search, type, status };

    return (
        <div className="space-y-6">

            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Policies</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader
                title="Policies"
                description="Reusable policies assigned to packages during package creation"
                icon={FileText}
                actions={<CreatePolicyDialog />}
            />

            <Suspense
                key={`${page}-${limit}-${search}-${type}-${status}`}
                fallback={<TableSkeleton />}
            >
                <PoliciesData params={params} />
            </Suspense>
        </div>
    );
}
