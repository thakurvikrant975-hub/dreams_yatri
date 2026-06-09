import { Suspense } from "react";
import { ShieldCheck, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "../components/ui/skeleton";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { getRoles } from "./actions";
import { RolesTable } from "./Rolestable";
import { CreateRoleDialog } from "./Roledialog";
import { PageHeader } from "../components/dashboard/PageHeader";

// ── Skeleton ──────────────────────────────────────────────────────────────────

function TableSkeleton() {
    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 grid grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-4" />
                ))}
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-4 py-3 grid grid-cols-5 gap-4 border-t items-center">
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                        <div className="space-y-1">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-32" />
                        </div>
                    </div>
                    <Skeleton className="h-5 w-20" />
                    <div className="flex gap-1">
                        <Skeleton className="h-5 w-14 rounded-full" />
                        <Skeleton className="h-5 w-14 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-20" />
                    <div className="flex justify-end gap-1">
                        <Skeleton className="h-8 w-8 rounded-md" />
                        <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Async data ────────────────────────────────────────────────────────────────

async function RolesData() {
    const roles = await getRoles();
    return <RolesTable roles={roles} />;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RolesAndPermissionsPage() {
    return (
        <div className="space-y-6">

            {/* Breadcrumb */}
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Roles & Permissions</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader
                title="Roles & Permissions"
                description="Manage access control for your team members"
                icon={ShieldCheck}
                actions={<CreateRoleDialog />}
            />

            {/* Tabs */}
            <div className="flex gap-1 border-b">
                <Link
                    href="/dashboard/roles-and-permissions"
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 border-primary text-primary -mb-px"
                >
                    <ShieldCheck className="h-4 w-4" />
                    Roles & Data Access
                </Link>
                <Link
                    href="/dashboard/roles-and-permissions/page-access"
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 -mb-px transition-colors"
                >
                    <LayoutGrid className="h-4 w-4" />
                    Page Access
                </Link>
            </div>

            {/* Data */}
            <Suspense fallback={
                <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
                                <Skeleton className="h-3 w-16" />
                                <Skeleton className="h-7 w-10" />
                            </div>
                        ))}
                    </div>
                    <TableSkeleton />
                </div>
            }>
                <RolesData />
            </Suspense>

        </div>
    );
}