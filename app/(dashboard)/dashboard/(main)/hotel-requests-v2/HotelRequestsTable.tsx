"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import Link from "next/link";
import { Bed, Clock, MapPin, ArrowRight, User } from "lucide-react";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableFilters } from "../components/dashboard/Tablefilters";
import { TableEmptyState } from "../components/dashboard/TableEmptyState";
import { StatCard, StatGrid } from "../components/dashboard/Statcard";

export type HotelRequestRow = {
    id: string;
    title: string;
    destination: string;
    travelDate: Date | null;
    /** The sales exec who built this package — i.e. who's waiting on the fill. */
    requestedByName: string | null;
    clientName: string | null;
    clientPhone: string | null;
    pendingDays: { day: number; note: string | null; requestedAt: Date | null }[];
    oldestRequestedAt: Date | null;
};

export type HotelRequestStats = { totalPackages: number; totalDays: number };

function daysAgo(d: Date | null): number | null {
    if (!d) return null;
    return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000));
}

export function HotelRequestsTable({
    requests, stats, currentPage, totalPages, totalCount, limit, search,
}: {
    requests: HotelRequestRow[];
    stats: HotelRequestStats;
    currentPage: number;
    totalPages: number;
    totalCount: number;
    limit: number;
    search: string;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [, startTransition] = useTransition();

    function handleSearch(value: string) {
        const params = new URLSearchParams(searchParams.toString());
        if (!value) params.delete("search"); else params.set("search", value);
        params.delete("page");
        startTransition(() => router.replace(`?${params.toString()}`));
    }

    function buildHref(p: number) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("page", String(p));
        return `?${params.toString()}`;
    }

    const from = totalCount === 0 ? 0 : (currentPage - 1) * limit + 1;
    const to = Math.min(currentPage * limit, totalCount);
    const paginationLabel = `Showing ${from}–${to} of ${totalCount} package${totalCount !== 1 ? "s" : ""}`;

    const columns: ColumnDef<HotelRequestRow>[] = [
        {
            header: "Package",
            sortKey: (r) => r.title?.toLowerCase() ?? "",
            cell: (r) => (
                <div>
                    <div className="font-semibold text-sm text-dashboard-primary line-clamp-1">{r.title}</div>
                    <div className="text-xs text-dashboard-neutral flex items-center gap-1 mt-0.5">
                        <MapPin className="size-3" /> {r.destination}
                    </div>
                </div>
            ),
        },
        {
            header: "Client",
            sortKey: (r) => r.clientName?.toLowerCase() ?? "",
            cell: (r) => (
                <div>
                    <div className="text-sm font-medium text-dashboard-base-content">{r.clientName ?? "—"}</div>
                    <div className="text-xs text-dashboard-neutral">{r.clientPhone ?? ""}</div>
                </div>
            ),
        },
        {
            header: "Requested By",
            sortKey: (r) => r.requestedByName?.toLowerCase() ?? "",
            cell: (r) => (
                <div className="flex items-center gap-1.5 text-sm text-dashboard-base-content">
                    <User className="size-3 text-dashboard-neutral shrink-0" />
                    {r.requestedByName ?? "—"}
                </div>
            ),
        },
        {
            header: "Pending Days",
            cell: (r) => (
                <div className="flex flex-wrap gap-1 max-w-[220px]">
                    {r.pendingDays.map((d) => (
                        <span
                            key={d.day}
                            title={d.note ?? undefined}
                            className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 text-[11px] font-semibold px-2 py-0.5"
                        >
                            Day {d.day}
                        </span>
                    ))}
                </div>
            ),
        },
        {
            header: "Waiting",
            align: "center",
            sortKey: (r) => r.oldestRequestedAt ? new Date(r.oldestRequestedAt).getTime() : 0,
            cell: (r) => {
                const age = daysAgo(r.oldestRequestedAt);
                return (
                    <div className="flex items-center justify-center gap-1 text-sm text-dashboard-base-content whitespace-nowrap">
                        <Clock className="size-3 text-dashboard-neutral shrink-0" />
                        {age == null ? "—" : age === 0 ? "Today" : `${age}d`}
                    </div>
                );
            },
        },
        {
            header: "Action",
            align: "right",
            width: "w-[130px]",
            cell: (r) => (
                <Link
                    href={`/dashboard/hotel-requests-v2/${r.id}`}
                    className="inline-flex items-center gap-1 rounded-md bg-dashboard-primary text-white text-xs font-semibold px-3 py-1.5 hover:opacity-90"
                >
                    Fill Hotels <ArrowRight className="size-3" />
                </Link>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <StatGrid cols={2}>
                <StatCard label="Packages Waiting" value={stats.totalPackages} icon={Bed} />
                <StatCard label="Days Pending" value={stats.totalDays} icon={Clock} />
            </StatGrid>

            <TableFilters
                search={search}
                onSearchChange={handleSearch}
                searchPlaceholder="Search package title, client name or phone…"
            />

            <DataTable
                data={requests}
                columns={columns}
                rowKey={(r) => r.id}
                emptyState={
                    <TableEmptyState
                        title="No pending hotel requests"
                        description="Packages appear here when a sales exec flags a day as needing a hotel from the team."
                    />
                }
                pagination={{
                    currentPage,
                    totalPages,
                    buildHref,
                    label: paginationLabel,
                }}
            />
        </div>
    );
}
