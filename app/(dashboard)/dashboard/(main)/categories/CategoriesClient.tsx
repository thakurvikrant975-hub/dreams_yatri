import { Suspense } from "react";
import { OctagonAlert, Package, Tag, Tags } from "lucide-react";
import { Skeleton } from "../components/ui/skeleton";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { getCategories, type GetCategoriesParams } from "./actions";
import { CategoriesTable } from "./Categoriestable";
import { CreateCategoryDialog } from "./Categorydialog";
import { PageHeader } from "../components/dashboard/PageHeader";
import { StatCard, StatGrid } from "../components/dashboard/Statcard";

// ── Skeleton ──────────────────────────────────────────────────────────────────

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
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-4 w-10 mx-auto" />
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

// ── Async data component ──────────────────────────────────────────────────────

async function CategoriesData({ params }: { params: GetCategoriesParams }) {
    const { categories, totalCount, isFiltering, stats, parentCategories } =
        await getCategories(params);

    return (
        <>
            <StatGrid cols={4}>
                <StatCard label="Total Categories"  value={stats.total}         icon={Tags}        />
                <StatCard label="Active Categories" value={stats.active}        icon={Tag}         />
                <StatCard label="Sub-Categories"    value={stats.subCategories} icon={OctagonAlert} />
                <StatCard label="In Packages"       value={stats.packages}      icon={Package}     />
            </StatGrid>

            <CategoriesTable
                categories={categories}
                parentCategories={parentCategories}
                totalCount={totalCount}
                limit={params.limit ?? 10}
                currentPage={params.page ?? 1}
                isFiltering={isFiltering}
                search={params.search ?? ""}
                status={(params.status as string) ?? "all"}
                parentFilter={
                    params.parent_id === "top"           ? "top"
                    : typeof params.parent_id === "number" ? String(params.parent_id)
                    : "all"
                }
            />
        </>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export async function CategoriesClient({
    page,
    limit,
    search,
    status,
    parent_id,
}: {
    page:      number;
    limit:     number;
    search:    string;
    status:    "active" | "inactive" | "all";
    parent_id: "top" | "all" | number;
}) {
    // Fetch parent categories separately for the create dialog trigger
    // (needed before Suspense so the button renders immediately)
    const { parentCategories } = await getCategories({ page: 1, limit: 1 });

    const params: GetCategoriesParams = { page, limit, search, status, parent_id };

    return (
        <div className="space-y-6">

            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Categories</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader
                title="Categories"
                description="Manage categories and subcategories for packages"
                icon={Tag}
                actions={<CreateCategoryDialog parentCategories={parentCategories} />}
            />

            <Suspense
                key={`${page}-${limit}-${search}-${status}-${parent_id}`}
                fallback={<TableSkeleton />}
            >
                <CategoriesData params={params} />
            </Suspense>
        </div>
    );
}
