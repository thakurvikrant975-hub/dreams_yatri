"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PlaneTakeoff, CalendarDays, CheckCircle2, AlertTriangle, Hotel, Car } from "lucide-react";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableFilters } from "../components/dashboard/Tablefilters";
import { TableEmptyState } from "../components/dashboard/TableEmptyState";
import { StatCard, StatGrid } from "../components/dashboard/Statcard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

export type GuestRow = {
    id: string;
    bookingNumber: string;
    startDate: Date;
    endDate: Date;
    travellers: number;
    contactEmail: string | null;
    user: { name: string | null; email: string | null } | null;
    travellersList: { fullName: string; firstName: string | null; lastName: string | null }[];
    package: { title: string | null } | null;
    destination: { name: string | null } | null;
    hotelTotal: number;
    hotelConfirmed: number;
    hotelReconfirmed: number;
    cabTotal: number;
    cabConfirmed: number;
    cabReconfirmed: number;
    daysToTravel: number;
    isFullyReconfirmed: boolean;
};

export type GuestStats = {
    total: number;
    travelingToday: number;
    fullyReconfirmed: number;
    needsAttention: number;
};

const fmtDate = (d: Date) =>
    new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(d);

// Same lead-traveller-first convention as verify-hotels/verify-cabs.
function travellerName(g: GuestRow): string {
    const t = g.travellersList[0];
    if (t) return t.fullName || [t.firstName, t.lastName].filter(Boolean).join(" ") || "—";
    return g.user?.name ?? g.contactEmail ?? "—";
}

function ReconfirmProgress({ label, Icon, confirmed, reconfirmed }: {
    label: string; Icon: React.ElementType; confirmed: number; reconfirmed: number;
}) {
    if (confirmed === 0) {
        return (
            <div className="flex items-center gap-1 text-[11px] text-dashboard-neutral">
                <Icon className="size-3" /> <span>—</span>
            </div>
        );
    }
    const done = reconfirmed === confirmed;
    const pct = Math.round((reconfirmed / confirmed) * 100);
    return (
        <div className="flex flex-col items-center gap-1">
            <span className={`flex items-center gap-1 text-xs font-semibold tabular-nums ${done ? "text-green-700" : "text-amber-700"}`}>
                <Icon className="size-3" /> {reconfirmed}/{confirmed}
            </span>
            <div className="w-14 h-1.5 rounded-full bg-dashboard-base-300/60 overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all ${done ? "bg-green-500" : "bg-amber-400"}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

export function UpcomingGuestsTable({
    guests, stats, currentPage, totalPages, totalCount, limit, search, daysAhead,
}: {
    guests: GuestRow[];
    stats: GuestStats;
    currentPage: number;
    totalPages: number;
    totalCount: number;
    limit: number;
    search: string;
    daysAhead: number;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [, startTransition] = useTransition();

    function updateParam(key: string, value: string) {
        const params = new URLSearchParams(searchParams.toString());
        if (!value || value === "all") params.delete(key);
        else params.set(key, value);
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
    const paginationLabel = `Showing ${from}–${to} of ${totalCount} guest${totalCount !== 1 ? "s" : ""}`;

    const columns: ColumnDef<GuestRow>[] = [
        {
            header: "Booking",
            width: "w-[160px]",
            sortKey: (g) => g.bookingNumber?.toLowerCase() ?? "",
            cell: (g) => (
                <Link
                    href={`/dashboard/upcoming-guests/${g.id}`}
                    className="font-semibold text-dashboard-primary hover:underline text-sm"
                >
                    {g.bookingNumber}
                </Link>
            ),
        },
        {
            header: "Guest",
            sortKey: (g) => travellerName(g).toLowerCase(),
            cell: (g) => (
                <div>
                    <div className="text-sm font-medium text-dashboard-base-content">{travellerName(g)}</div>
                    <div className="text-xs text-dashboard-neutral truncate max-w-[160px]">{g.user?.email ?? g.contactEmail ?? ""}</div>
                </div>
            ),
        },
        {
            header: "Package / Destination",
            sortKey: (g) => g.package?.title?.toLowerCase() ?? "",
            cell: (g) => (
                <div>
                    <div className="text-sm text-dashboard-base-content line-clamp-1">{g.package?.title ?? "—"}</div>
                    <div className="text-xs text-dashboard-neutral">{g.destination?.name ?? ""}</div>
                </div>
            ),
        },
        {
            header: "Travel Dates",
            sortKey: (g) => new Date(g.startDate).getTime(),
            cell: (g) => (
                <div className="whitespace-nowrap">
                    <div className="flex items-center gap-1 text-sm text-dashboard-base-content">
                        <CalendarDays className="size-3.5 text-dashboard-neutral shrink-0" />
                        {fmtDate(g.startDate)}
                    </div>
                    <div className="text-xs text-dashboard-neutral mt-0.5 pl-5">→ {fmtDate(g.endDate)}</div>
                    <div className={`mt-0.5 pl-5 text-[11px] font-semibold ${g.daysToTravel <= 2 ? "text-red-600" : "text-dashboard-neutral"}`}>
                        {g.daysToTravel <= 0 ? "Today" : `${g.daysToTravel}d away`}
                    </div>
                </div>
            ),
        },
        {
            header: "Pax",
            align: "center",
            width: "w-[60px]",
            sortKey: (g) => g.travellers ?? 0,
            cell: (g) => <span className="text-sm font-medium text-dashboard-base-content">{g.travellers}</span>,
        },
        {
            header: "Hotels",
            align: "center",
            width: "w-[90px]",
            cell: (g) => <ReconfirmProgress label="Hotels" Icon={Hotel} confirmed={g.hotelConfirmed} reconfirmed={g.hotelReconfirmed} />,
        },
        {
            header: "Cabs",
            align: "center",
            width: "w-[90px]",
            cell: (g) => <ReconfirmProgress label="Cabs" Icon={Car} confirmed={g.cabConfirmed} reconfirmed={g.cabReconfirmed} />,
        },
        {
            header: "Action",
            align: "center",
            width: "w-[100px]",
            cell: (g) => (
                <Link
                    href={`/dashboard/upcoming-guests/${g.id}`}
                    className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                        g.isFullyReconfirmed
                            ? "border border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                            : "bg-dashboard-primary text-white hover:opacity-90"
                    }`}
                >
                    {g.isFullyReconfirmed ? "View" : "Reconfirm →"}
                </Link>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <StatGrid cols={4}>
                <StatCard label={`Traveling in ${daysAhead}d`} value={stats.total}             icon={PlaneTakeoff} />
                <StatCard label="Traveling Today"              value={stats.travelingToday}     icon={CalendarDays} />
                <StatCard label="Needs Attention"              value={stats.needsAttention}     icon={AlertTriangle} />
                <StatCard label="Fully Reconfirmed"            value={stats.fullyReconfirmed}    icon={CheckCircle2} />
            </StatGrid>

            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashboard-base-300 bg-dashboard-base-200/40 px-4 py-2.5 text-xs text-dashboard-neutral">
                <AlertTriangle className="size-3.5 shrink-0" />
                Double-check every confirmed hotel/cab with the vendor before travel — a hotel or cab that confirmed weeks ago can still cancel or change on you.
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <TableFilters
                    search={search}
                    onSearchChange={(v) => updateParam("search", v)}
                    searchPlaceholder="Search booking #, guest name or email…"
                    className="flex-1"
                    filters={[]}
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

            <DataTable
                data={guests}
                columns={columns}
                rowKey={(g) => g.id}
                rowClassName={(g) => (g.isFullyReconfirmed ? "bg-green-50/60 hover:bg-green-50 border-green-100" : "hover:bg-dashboard-base-200")}
                emptyState={
                    <TableEmptyState
                        title="No upcoming guests"
                        description={`No paid bookings travelling in the next ${daysAhead} days.`}
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
