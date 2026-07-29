"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Hotel, AlertTriangle, Clock, CheckCircle2, CalendarDays } from "lucide-react";
import { useVerificationCounts } from "@/app/lib/ably-client";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableFilters } from "../components/dashboard/Tablefilters";
import { TableEmptyState } from "../components/dashboard/TableEmptyState";
import { StatCard, StatGrid } from "../components/dashboard/Statcard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { PaymentPill } from "../package-bookings/pills";

export type BookingRow = {
    id: string;
    bookingNumber: string;
    startDate: Date;
    endDate: Date;
    travellers: number;
    hotelPricingPaise: number;
    paymentStatus: string;
    createdAt: Date;
    hotelConfirmedAt: Date | null;
    user: { name: string | null; email: string | null } | null;
    package: { title: string | null } | null;
    destination: { name: string | null } | null;
    pendingCount: number;
    totalHotelCount: number;
    isFullyConfirmed: boolean;
    daysToTravel: number;
    hoursOld: number;
    isUrgent: boolean;
    isOverdue: boolean;
};

export type HotelStats = {
    total: number;
    pending: number;
    urgent: number;
    overdue: number;
    confirmedToday: number;
};

const fmt = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
const fmtDate = (d: Date) =>
    new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(d);

function UrgencyBadge({ row }: { row: BookingRow }) {
    if (row.isFullyConfirmed) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                <CheckCircle2 className="size-3" /> Done
            </span>
        );
    }
    if (row.isUrgent) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                <AlertTriangle className="size-3" /> {row.daysToTravel}d left
            </span>
        );
    }
    if (row.isOverdue) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                <Clock className="size-3" /> {Math.floor(row.hoursOld)}h old
            </span>
        );
    }
    return null;
}

export function VerifyHotelsTable({
    bookings,
    stats,
    currentPage,
    totalPages,
    totalCount,
    limit,
    search,
    urgency,
}: {
    bookings: BookingRow[];
    stats: HotelStats;
    currentPage: number;
    totalPages: number;
    totalCount: number;
    limit: number;
    search: string;
    urgency: string;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    // Live "Total Pending" — starts from the server-rendered count, then
    // updates in place over Ably whenever a booking enters/leaves the queue
    // (new payment, hotel confirmed, cancellation) — no polling, no refresh.
    // Re-syncs from props during render (not an effect) when a navigation
    // brings a new server-computed count, per React's "adjusting state when a
    // prop changes" pattern.
    const [syncedFrom, setSyncedFrom] = useState(stats.pending);
    const [pendingCount, setPendingCount] = useState(stats.pending);
    if (stats.pending !== syncedFrom) {
        setSyncedFrom(stats.pending);
        setPendingCount(stats.pending);
    }
    useVerificationCounts((counts) => setPendingCount(counts.hotelsPending));

    function updateParam(key: string, value: string) {
        const params = new URLSearchParams(searchParams.toString());
        if (!value || value === "all") params.delete(key);
        else params.set(key, value);
        params.delete("page");
        startTransition(() => router.replace(`?${params.toString()}`));
    }

    function handleSearch(value: string) {
        updateParam("search", value);
    }

    function buildHref(p: number) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("page", String(p));
        return `?${params.toString()}`;
    }

    const from = totalCount === 0 ? 0 : (currentPage - 1) * limit + 1;
    const to = Math.min(currentPage * limit, totalCount);
    const paginationLabel = `Showing ${from}–${to} of ${totalCount} booking${totalCount !== 1 ? "s" : ""}`;

    const columns: ColumnDef<BookingRow>[] = [
        {
            header: "Booking",
            width: "w-[160px]",
            sortKey: (b) => b.bookingNumber?.toLowerCase() ?? "",
            cell: (b) => (
                <div>
                    <Link
                        href={`/dashboard/verify-hotels/${b.id}`}
                        className="font-semibold text-dashboard-primary hover:underline text-sm"
                    >
                        {b.bookingNumber}
                    </Link>
                    <div className="mt-0.5 text-[11px] text-dashboard-neutral">{fmtDate(b.createdAt)}</div>
                    <div className="mt-1"><UrgencyBadge row={b} /></div>
                </div>
            ),
        },
        {
            header: "Customer",
            sortKey: (b) => b.user?.name?.toLowerCase() ?? "",
            cell: (b) => (
                <div>
                    <div className="text-sm font-medium text-dashboard-base-content">{b.user?.name ?? "—"}</div>
                    <div className="text-xs text-dashboard-neutral truncate max-w-[160px]">{b.user?.email ?? ""}</div>
                </div>
            ),
        },
        {
            header: "Package / Destination",
            sortKey: (b) => b.package?.title?.toLowerCase() ?? "",
            cell: (b) => (
                <div>
                    <div className="text-sm text-dashboard-base-content line-clamp-1">{b.package?.title ?? "—"}</div>
                    <div className="text-xs text-dashboard-neutral">{b.destination?.name ?? ""}</div>
                </div>
            ),
        },
        {
            header: "Travel Dates",
            sortKey: (b) => new Date(b.startDate).getTime(),
            cell: (b) => (
                <div className="whitespace-nowrap">
                    <div className="flex items-center gap-1 text-sm text-dashboard-base-content">
                        <CalendarDays className="size-3.5 text-dashboard-neutral shrink-0" />
                        {fmtDate(b.startDate)}
                    </div>
                    <div className="text-xs text-dashboard-neutral mt-0.5 pl-5">→ {fmtDate(b.endDate)}</div>
                    {!b.isFullyConfirmed && b.daysToTravel >= 0 && (
                        <div className={`mt-0.5 pl-5 text-[11px] font-medium ${b.daysToTravel <= 15 ? "text-red-600" : "text-dashboard-neutral"}`}>
                            {b.daysToTravel === 0 ? "Today" : `${b.daysToTravel}d away`}
                        </div>
                    )}
                </div>
            ),
        },
        {
            header: "Pax",
            align: "center",
            width: "w-[60px]",
            sortKey: (b) => b.travellers ?? 0,
            cell: (b) => (
                <span className="text-sm font-medium text-dashboard-base-content">{b.travellers}</span>
            ),
        },
        {
            header: "Hotel Pricing",
            align: "right",
            sortKey: (b) => b.hotelPricingPaise ?? 0,
            cell: (b) => (
                <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums text-dashboard-base-content">{fmt(b.hotelPricingPaise)}</div>
                    <div className="mt-0.5"><PaymentPill status={b.paymentStatus} /></div>
                </div>
            ),
        },
        {
            header: "Hotels",
            align: "center",
            width: "w-[110px]",
            cell: (b) => {
                const done = b.totalHotelCount - b.pendingCount;
                const pct = b.totalHotelCount > 0 ? Math.round((done / b.totalHotelCount) * 100) : 0;
                return (
                    <div className="flex flex-col items-center gap-1.5">
                        <span className={`text-xs font-semibold tabular-nums ${
                            b.isFullyConfirmed ? "text-green-700" : b.pendingCount > 0 ? "text-amber-700" : "text-dashboard-neutral"
                        }`}>
                            {done}/{b.totalHotelCount}
                        </span>
                        <div className="w-16 h-1.5 rounded-full bg-dashboard-base-300/60 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all ${b.isFullyConfirmed ? "bg-green-500" : pct > 50 ? "bg-amber-400" : "bg-red-400"}`}
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
            width: "w-[90px]",
            cell: (b) => (
                <Link
                    href={`/dashboard/verify-hotels/${b.id}`}
                    className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                        b.isFullyConfirmed
                            ? "border border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                            : "bg-dashboard-primary text-white hover:opacity-90"
                    }`}
                >
                    {b.isFullyConfirmed ? "View" : "Verify →"}
                </Link>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            {/* Stats */}
            <StatGrid cols={4}>
                <StatCard label="Total Pending"    value={pendingCount}         icon={Hotel}        />
                <StatCard label="Urgent (≤ 15d)"   value={stats.urgent}         icon={AlertTriangle} />
                <StatCard label="Overdue (> 48h)"  value={stats.overdue}        icon={Clock}        />
                <StatCard label="Confirmed Today"  value={stats.confirmedToday} icon={CheckCircle2} />
            </StatGrid>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashboard-base-300 bg-dashboard-base-200/40 px-4 py-2.5 text-xs text-dashboard-neutral">
                <span className="font-medium text-dashboard-base-content">Row colours:</span>
                <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-green-200 inline-block" /> Fully confirmed</span>
                <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-red-200 inline-block" /> Travel ≤ 15 days</span>
                <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-amber-200 inline-block" /> Pending {'>'} 48 h</span>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <TableFilters
                    search={search}
                    onSearchChange={handleSearch}
                    searchPlaceholder="Search booking #, customer name or email…"
                    className="flex-1"
                    filters={[
                        {
                            value: urgency,
                            onChange: (v) => updateParam("urgency", v),
                            placeholder: "All bookings",
                            width: "w-44",
                            options: [
                                { label: "Urgent (≤ 15 days)", value: "urgent" },
                                { label: "Overdue (> 48 h)",   value: "overdue" },
                                { label: "Confirmed",          value: "confirmed" },
                                { label: "Pending only",       value: "pending" },
                            ],
                        },
                    ]}
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
                    <SelectTrigger className="w-32 h-10 text-sm shrink-0 border-dashboard-base-300 bg-dashboard-base-100 text-dashboard-base-content/70 rounded-lg focus:ring-dashboard-primary/30 focus:border-dashboard-primary">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-dashboard-base-300 bg-dashboard-base-100">
                        {[10, 20, 50].map((n) => (
                            <SelectItem key={n} value={String(n)} className="text-sm text-dashboard-base-content focus:bg-dashboard-base-200 focus:text-dashboard-base-content rounded-lg cursor-pointer">
                                {n} / page
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Table */}
            <DataTable
                data={bookings}
                columns={columns}
                rowKey={(b) => b.id}
                rowClassName={(b) => {
                    if (b.isFullyConfirmed)
                        return "bg-green-50/60 hover:bg-green-50 border-green-100";
                    if (b.isUrgent)
                        return "bg-red-50/50 hover:bg-red-50 border-red-100";
                    if (b.isOverdue)
                        return "bg-amber-50/50 hover:bg-amber-50 border-amber-100";
                    return "hover:bg-dashboard-base-200";
                }}
                emptyState={
                    <TableEmptyState
                        title="No bookings found"
                        description="All hotels are verified, or try adjusting your filters."
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
