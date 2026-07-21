import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import type { Prisma } from "@/app/generated/prisma";
import { db } from "@/app/lib/db";
import { VerifyPackagesTable, type PackageRow, type PackageStats } from "./VerifyPackagesTable";
import {
    Breadcrumb, BreadcrumbItem,
    BreadcrumbLink, BreadcrumbList,
    BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { Skeleton } from "../components/ui/skeleton";
import { PageHeader } from "../components/dashboard/PageHeader";

type Filter = "all" | "pending" | "verified";

function TableSkeleton() {
    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 grid grid-cols-6 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-4" />
                ))}
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-4 py-3 grid grid-cols-6 gap-4 border-t items-center">
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-16 mx-auto" />
                    <Skeleton className="h-7 w-20 ml-auto" />
                </div>
            ))}
        </div>
    );
}

async function PackagesData({
    page, limit, search, filter,
}: {
    page: number;
    limit: number;
    search: string;
    filter: Filter;
}) {
    const now        = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const searchWhere: Prisma.custom_packagesWhereInput = search
        ? {
            OR: [
                { title:       { contains: search, mode: "insensitive" } },
                { destination: { contains: search, mode: "insensitive" } },
                { query: { name:  { contains: search, mode: "insensitive" } } },
                { query: { phone: { contains: search, mode: "insensitive" } } },
            ],
        }
        : {};

    const baseWhere: Prisma.custom_packagesWhereInput = {
        sentAt: { not: null },
        ...searchWhere,
    };

    const filterWhere: Prisma.custom_packagesWhereInput =
        filter === "pending"  ? { verified: false } :
        filter === "verified" ? { verified: true } :
        {};

    const where: Prisma.custom_packagesWhereInput = { ...baseWhere, ...filterWhere };

    const [rows, totalCount, pending, verified, verifiedToday, total] = await Promise.all([
        db.custom_packages.findMany({
            where,
            orderBy: { sentAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
            select: {
                id: true, title: true, destination: true,
                totalDays: true, totalNights: true, travelDate: true,
                adults: true, children: true, infants: true,
                pricePerPerson: true, totalPrice: true, currency: true,
                status: true, builtByName: true, sentAt: true,
                viewedAt: true, viewCount: true,
                verified: true, verifiedAt: true, verifiedByName: true,
                query: { select: { id: true, name: true, phone: true, email: true } },
            },
        }),
        db.custom_packages.count({ where }),
        db.custom_packages.count({ where: { ...baseWhere, verified: false } }),
        db.custom_packages.count({ where: { ...baseWhere, verified: true } }),
        db.custom_packages.count({ where: { ...baseWhere, verifiedAt: { gte: todayStart } } }),
        db.custom_packages.count({ where: baseWhere }),
    ]);

    const stats: PackageStats = { total, pending, verified, verifiedToday };

    const packages: PackageRow[] = rows.map((r) => ({
        id: r.id,
        title: r.title,
        destination: r.destination,
        totalDays: r.totalDays,
        totalNights: r.totalNights,
        travelDate: r.travelDate,
        adults: r.adults,
        children: r.children,
        infants: r.infants,
        pricePerPerson: r.pricePerPerson,
        totalPrice: r.totalPrice,
        currency: r.currency,
        status: r.status,
        builtByName: r.builtByName,
        sentAt: r.sentAt,
        viewedAt: r.viewedAt,
        viewCount: r.viewCount,
        verified: r.verified,
        verifiedAt: r.verifiedAt,
        verifiedByName: r.verifiedByName,
        client: r.query,
    }));

    return (
        <VerifyPackagesTable
            packages={packages}
            stats={stats}
            currentPage={page}
            totalPages={Math.max(1, Math.ceil(totalCount / limit))}
            totalCount={totalCount}
            limit={limit}
            search={search}
            filter={filter}
        />
    );
}

export default function VerifyPackagesClient({
    page, limit, search, filter,
}: {
    page: number;
    limit: number;
    search: string;
    filter: Filter;
}) {
    return (
        <div className="space-y-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Verify Packages</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader
                title="Verify Packages"
                description="Double-check the pricing behind custom packages sent to clients"
                icon={ShieldCheck}
            />

            <Suspense
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
                <PackagesData page={page} limit={limit} search={search} filter={filter} />
            </Suspense>
        </div>
    );
}
