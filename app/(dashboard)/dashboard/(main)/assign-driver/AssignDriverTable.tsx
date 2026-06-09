"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CalendarDays, Car, CheckCircle2, Truck, UserCheck } from "lucide-react";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableFilters } from "../components/dashboard/Tablefilters";
import { TableEmptyState } from "../components/dashboard/TableEmptyState";
import { StatCard, StatGrid } from "../components/dashboard/Statcard";
import { PageHeader } from "../components/dashboard/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { PaymentPill } from "../package-bookings/pills";

export type AssignRow = {
    id: string;
    bookingNumber: string;
    startDate: Date;
    endDate: Date;
    travellers: number;
    totalAmount_paise: number;
    paymentStatus: string;
    createdAt: Date;
    cabType: string;
    user: { name: string | null; email: string | null } | null;
    package: { title: string | null } | null;
    destination: { name: string | null } | null;
    totalCabCount: number;
    assignedCount: number;
    isFullyAssigned: boolean;
    daysToTravel: number;
    isNearTravel: boolean; // ≤ 15 days away
};

export type AssignStats = {
    total: number;
    unassigned: number;
    nearTravel: number;
    fullyAssigned: number;
};

const fmt = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
const fmtDate = (d: Date) =>
    new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(d);
const titleCase = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export function AssignDriverTable({
    bookings, stats, currentPage, totalPages, totalCount, limit, search, filter,
}: {
    bookings: AssignRow[];
    stats: AssignStats;
    currentPage: number;
    totalPages: number;
    totalCount: number;
    limit: number;
    search: string;
    filter: string;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [, startTransition] = useTransition();
    const [localSearch, setLocalSearch] = useState(search);
    const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => { setLocalSearch(search); }, [search]);

    function updateParam(key: string, value: string) {
        const params = new URLSearchParams(searchParams.toString());
        if (!value || value === "all") params.delete(key);
        else params.set(key, value);
        params.delete("page");
        startTransition(() => router.replace(`?${params.toString()}`));
    }

    function handleSearch(value: string) {
        setLocalSearch(value);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => updateParam("search", value), 400);
    }

    function buildHref(p: number) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("page", String(p));
        return `?${params.toString()}`;
    }

    const from = totalCount === 0 ? 0 : (currentPage - 1) * limit + 1;
    const to = Math.min(currentPage * limit, totalCount);
    const paginationLabel = `Showing ${from}–${to} of ${totalCount} booking${totalCount !== 1 ? "s" : ""}`;

    const columns: ColumnDef<AssignRow>[] = [
        {
            header: "Booking",
            width: "w-[160px]",
            cell: (b) => (
                <div>
                    <Link
                        href={`/dashboard/assign-driver/${b.id}`}
                        className="font-semibold text-dashboard-primary hover:underline text-sm"
                    >
                        {b.bookingNumber}
                    </Link>
                    <div className="mt-0.5 text-[11px] text-dashboard-neutral">{fmtDate(b.createdAt)}</div>
                </div>
            ),
        },
        {
            header: "Customer",
            cell: (b) => (
                <div>
                    <div className="text-sm font-medium text-dashboard-base-content">{b.user?.name ?? "—"}</div>
                    <div className="text-xs text-dashboard-neutral truncate max-w-40">{b.user?.email ?? ""}</div>
                </div>
            ),
        },
        {
            header: "Package / Destination",
            cell: (b) => (
                <div>
                    <div className="text-sm text-dashboard-base-content line-clamp-1">{b.package?.title ?? "—"}</div>
                    <div className="text-xs text-dashboard-neutral">{b.destination?.name ?? ""}</div>
                </div>
            ),
        },
        {
            header: "Travel Dates",
            cell: (b) => (
                <div className="whitespace-nowrap">
                    <div className="flex items-center gap-1 text-sm text-dashboard-base-content">
                        <CalendarDays className="size-3.5 text-dashboard-neutral shrink-0" />
                        {fmtDate(b.startDate)}
                    </div>
                    <div className="text-xs text-dashboard-neutral mt-0.5 pl-5">→ {fmtDate(b.endDate)}</div>
                    {b.daysToTravel >= 0 && (
                        <div className={`mt-0.5 pl-5 text-[11px] font-semibold ${b.isNearTravel && !b.isFullyAssigned ? "text-red-600" : "text-dashboard-neutral"}`}>
                            {b.daysToTravel === 0 ? "Today!" : `${b.daysToTravel}d away`}
                        </div>
                    )}
                </div>
            ),
        },
        {
            header: "Cab Type",
            cell: (b) => (
                <span className="text-xs font-medium text-dashboard-base-content">{titleCase(b.cabType)}</span>
            ),
        },
        {
            header: "Amount",
            align: "right",
            cell: (b) => (
                <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums text-dashboard-base-content">{fmt(b.totalAmount_paise)}</div>
                    <div className="mt-0.5"><PaymentPill status={b.paymentStatus} /></div>
                </div>
            ),
        },
        {
            header: "Drivers",
            align: "center",
            width: "w-[110px]",
            cell: (b) => {
                const pct = b.totalCabCount > 0 ? Math.round((b.assignedCount / b.totalCabCount) * 100) : 0;
                return (
                    <div className="flex flex-col items-center gap-1.5">
                        <span className={`text-xs font-semibold tabular-nums ${
                            b.isFullyAssigned ? "text-green-700" : b.assignedCount > 0 ? "text-amber-700" : "text-red-600"
                        }`}>
                            {b.assignedCount}/{b.totalCabCount}
                        </span>
                        <div className="w-16 h-1.5 rounded-full bg-dashboard-base-300/60 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all ${
                                    b.isFullyAssigned ? "bg-green-500" : pct > 50 ? "bg-amber-400" : "bg-red-400"
                                }`}
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                    </div>
                );
            },
        },
        {
            header: "Action",
            align: "center",
            width: "w-[100px]",
            cell: (b) => (
                <Link
                    href={`/dashboard/assign-driver/${b.id}`}
                    className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                        b.isFullyAssigned
                            ? "border border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                            : "bg-dashboard-primary text-white hover:opacity-90"
                    }`}
                >
                    {b.isFullyAssigned ? "View" : "Assign →"}
                </Link>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Assign Drivers"
                description="Assign registered drivers to cab transfers. Driver details are shared with customers 4–5 days before travel."
                icon={UserCheck}
            />

            <StatGrid cols={4}>
                <StatCard label="Total Bookings"      value={stats.total}         icon={Car}         sub="With cab transfers" />
                <StatCard label="Awaiting Driver"     value={stats.unassigned}    icon={Truck}
                    iconColor="bg-amber-100" iconText="text-amber-600"
                    sub="No driver assigned yet"
                    className={stats.unassigned > 0 ? "border-amber-200 bg-amber-50/40" : ""} />
                <StatCard label="Near Travel (≤ 15d)" value={stats.nearTravel}    icon={AlertTriangle}
                    iconColor="bg-red-100" iconText="text-red-600"
                    sub="Unassigned, travel soon"
                    className={stats.nearTravel > 0 ? "border-red-200 bg-red-50/40" : ""} />
                <StatCard label="Fully Assigned"      value={stats.fullyAssigned} icon={CheckCircle2}
                    iconColor="bg-green-100" iconText="text-green-600"
                    sub="All legs have a driver"
                    className={stats.fullyAssigned > 0 ? "border-green-200 bg-green-50/40" : ""} />
            </StatGrid>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashboard-base-300 bg-dashboard-base-200/40 px-4 py-2.5 text-xs text-dashboard-neutral">
                <span className="font-medium text-dashboard-base-content">Row colours:</span>
                <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-green-200 inline-block" /> All drivers assigned</span>
                <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-red-200 inline-block" /> Travel ≤ 15 days, no driver</span>
                <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-white border border-dashboard-base-300 inline-block" /> Pending</span>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <TableFilters
                    search={localSearch}
                    onSearchChange={handleSearch}
                    searchPlaceholder="Search booking #, customer name or email…"
                    className="flex-1"
                    filters={[
                        {
                            value: filter,
                            onChange: (v) => updateParam("filter", v),
                            placeholder: "All bookings",
                            width: "w-48",
                            options: [
                                { label: "No driver yet",      value: "unassigned" },
                                { label: "Near travel (≤ 15d)", value: "near"       },
                                { label: "Fully assigned",      value: "assigned"   },
                            ],
                        },
                    ]}
                    filteredCount={totalCount}
                    totalCount={stats.total}
                />
                <Select
                    value={String(limit)}
                    onValueChange={(v) => {
                        const params = new URLSearchParams(searchParams.toString());
                        params.set("limit", v);
                        params.delete("page");
                        startTransition(() => router.replace(`?${params.toString()}`));
                    }}
                >
                    <SelectTrigger className="w-32 h-10 text-sm shrink-0 border-dashboard-base-300 bg-dashboard-base-100 text-dashboard-base-content/70 rounded-lg">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-dashboard-base-300 bg-dashboard-base-100">
                        {[10, 20, 50].map((n) => (
                            <SelectItem key={n} value={String(n)} className="text-sm text-dashboard-base-content focus:bg-dashboard-base-200 rounded-lg cursor-pointer">
                                {n} / page
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <DataTable
                data={bookings}
                columns={columns}
                rowKey={(b) => b.id}
                rowClassName={(b) => {
                    if (b.isFullyAssigned) return "bg-green-50/70 hover:bg-green-50 border-green-100";
                    if (b.isNearTravel)    return "bg-red-50/50 hover:bg-red-50 border-red-100";
                    return "hover:bg-dashboard-base-200";
                }}
                emptyState={
                    <TableEmptyState
                        title="No bookings found"
                        description="All drivers are assigned, or try adjusting your filters."
                    />
                }
                pagination={{ currentPage, totalPages, buildHref, label: paginationLabel }}
            />
        </div>
    );
}
