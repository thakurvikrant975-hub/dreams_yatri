// (sales)/package-library/page.tsx

import { Suspense } from "react";
import { BookOpen } from "lucide-react";
import { Skeleton } from "../../components/ui/skeleton";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { getSalesPackageLibrary, getDestinationsForLibraryFilter } from "./actions";
import { PackageLibraryClient } from "./PackageLibraryClient";
import type { Metadata } from "next";
import { PageHeader } from "../../components/dashboard/PageHeader";
import { getPackageBuilderQueries } from "@/app/(dashboard)/dashboard/(builder)/package-builder/action";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Package Library - Dashboard",
    description: "Browse premade travel packages",
    robots: {
        index: false,
        follow: false,
        nocache: true,
        googleBot: { index: false, follow: false },
    },
};

function LibrarySkeleton() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border bg-card overflow-hidden">
                    <Skeleton className="h-36 w-full rounded-none" />
                    <div className="p-4 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-3 w-full" />
                    </div>
                </div>
            ))}
        </div>
    );
}

async function PackageLibraryData() {
    const [packages, destinations, pendingQueriesPage] = await Promise.all([
        getSalesPackageLibrary(),
        getDestinationsForLibraryFilter(),
        getPackageBuilderQueries({ size: 100 }),
    ]);
    return (
        <PackageLibraryClient
            packages={packages}
            destinations={destinations}
            pendingQueries={pendingQueriesPage.queries}
        />
    );
}

export default function PackageLibraryPage() {
    return (
        <div className="space-y-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Package Library</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader
                title="Package Library"
                description="Browse our premade packages — reference or share these with clients"
                icon={BookOpen}
            />

            <Suspense fallback={<LibrarySkeleton />}>
                <PackageLibraryData />
            </Suspense>
        </div>
    );
}
