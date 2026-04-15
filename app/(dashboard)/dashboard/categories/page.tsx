import { Suspense } from "react";
import { Tag } from "lucide-react";
import { Skeleton } from "../components/ui/skeleton";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { getCategories, getParentCategoriesForSelect } from "./actions";
import { CategoriesTable } from "./Categoriestable";
import { CreateCategoryDialog } from "./Categorydialog";
import { Stats } from "../components/dashboard/Stats";

const PAGE_SIZE = 10;

function TableSkeleton() {
    return (
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
    );
}

async function CategoriesData({ page }: { page: number }) {
    const [categories, parentCategories] = await Promise.all([
        getCategories(),
        getParentCategoriesForSelect(),
    ]);

    const topLevel = categories.filter((c) => c.parent_id === null);
    const totalPages = Math.ceil(topLevel.length / PAGE_SIZE);
    const paginated = topLevel.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const activeCount = categories.filter((c) => c.is_active).length;
    const subCategories = categories.filter((c) => c.parent_id !== null).length;
    const inPackages = categories.reduce((acc, c) => acc + c._count.packages, 0);

    return (
        <>
            {/* Stats */}
            <Stats
                rows={[
                    { label: "Total Categories", value: categories.length },
                    { label: "Active",            value: activeCount},
                    { label: "Subcategories",          value: subCategories },
                    { label: "In Packages",       value: inPackages },
                ]}
            />
            <CategoriesTable
                categories={categories}
                paginatedTopLevel={paginated}
                parentCategories={parentCategories}
                currentPage={page}
                totalPages={totalPages}
                pageSize={PAGE_SIZE}
            />
        </>
    );
}

async function CreateButtonData() {
    const parentCategories = await getParentCategoriesForSelect();
    return <CreateCategoryDialog parentCategories={parentCategories} />;
}

export default async function CategoriesPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>;
}) {
    const params = await searchParams;
    const page = Math.max(1, Number(params.page ?? 1));

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

            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Tag className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold">Categories</h1>
                        <p className="text-sm text-muted-foreground">
                            Manage categories and subcategories for packages
                        </p>
                    </div>
                </div>
                <Suspense fallback={<Skeleton className="h-9 w-36" />}>
                    <CreateButtonData />
                </Suspense>
            </div>

            <Suspense
                key={page}
                fallback={
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
                }
            >
                <CategoriesData page={page} />
            </Suspense>
        </div>
    );
}