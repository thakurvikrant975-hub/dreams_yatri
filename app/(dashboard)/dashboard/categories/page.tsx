import { Suspense } from "react";
import { Tag } from "lucide-react";
import { Skeleton } from "../components/ui/skeleton";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { getCategories, getParentCategoriesForSelect } from "./actions";
import { CategoriesTable } from "./Categoriestable";
import { CreateCategoryDialog } from "./Categorydialog";
import { LayoutGrid, CheckCircle, GitBranch, Package } from "lucide-react";
import { StatsGrid, type Stat } from "../components/dashboard/StatsGrid";

// ── Skeleton ──────────────────────────────────────────────────────────────

function TableSkeleton() {
    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 grid grid-cols-6 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-4" />
                ))}
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
                <div
                    key={i}
                    className="px-4 py-3 grid grid-cols-6 gap-4 border-t items-center"
                >
                    <div className="flex items-center gap-2">
                        <div className="space-y-1">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-3 w-20" />
                        </div>
                    </div>
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

// ── Async data component ──────────────────────────────────────────────────

async function CategoriesData() {
    const [categories, parentCategories] = await Promise.all([
        getCategories(),
        getParentCategoriesForSelect(),
    ]);

    const totalCategories = categories.length;
    const topLevel = categories.filter((c) => c.parent_id === null).length;
    const subCategories = categories.filter((c) => c.parent_id !== null).length;
    const activeCount = categories.filter((c) => c.is_active).length;
    const inPackages = categories.reduce(
        (acc, c) => acc + c._count.packages,
        0,
    );

    const statsData: Stat[] = [
        {
            label: "Total Categories",
            value: String(totalCategories),
            icon: <LayoutGrid className="h-4 w-4" />,
        },
        {
            label: "Active",
            value: String(activeCount),
            highlight: true,
            icon: <CheckCircle className="h-4 w-4" />,
            trend: { value: 0, direction: "up" },
        },
        {
            label: "Subcategories",
            value: String(subCategories),
            icon: <GitBranch className="h-4 w-4" />,
        },
        {
            label: "In Packages",
            value: String(inPackages),
            icon: <Package className="h-4 w-4" />,
        },
    ];

    return (
        <>
            <StatsGrid stats={statsData} />
            <CategoriesTable
                categories={categories}
                parentCategories={parentCategories}
            />
        </>
    );
}

// ── Create button with data ───────────────────────────────────────────────

async function CreateButtonData() {
    const parentCategories = await getParentCategoriesForSelect();
    return <CreateCategoryDialog parentCategories={parentCategories} />;
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function CategoriesPage() {
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
                        <BreadcrumbPage>Categories</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            {/* Header */}
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

            {/* Data */}
            <Suspense
                fallback={
                    <div className="space-y-4">
                        <div className="grid grid-cols-4 gap-4">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="rounded-xl border bg-card p-4 space-y-2"
                                >
                                    <Skeleton className="h-3 w-16" />
                                    <Skeleton className="h-7 w-10" />
                                </div>
                            ))}
                        </div>
                        <TableSkeleton />
                    </div>
                }
            >
                <CategoriesData />
            </Suspense>
        </div>
    );
}