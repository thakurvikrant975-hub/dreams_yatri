"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { Building2, MapPin, BedDouble, ChevronRight, CalendarRange } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableFilters } from "../components/dashboard/Tablefilters";
import { TableEmptyState } from "../components/dashboard/TableEmptyState";
import { EXPIRY_WINDOWS, type ExpiryWindow } from "./actions";
import type { getExpiringSeasonalRates } from "./actions";

type SeasonRow = Awaited<ReturnType<typeof getExpiringSeasonalRates>>["seasons"][number];

const R2_BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";

function thumb(key: string | null) {
    if (!key) return null;
    return key.startsWith("http") ? key : `${R2_BASE}/${key}`;
}

function urgencyClass(daysRemaining: number) {
    if (daysRemaining < 0) return "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400";
    if (daysRemaining <= 7) return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
    if (daysRemaining <= 30) return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
}

function urgencyLabel(daysRemaining: number) {
    if (daysRemaining < 0) return `Expired ${Math.abs(daysRemaining)}d ago`;
    if (daysRemaining === 0) return "Expires today";
    return `${daysRemaining}d left`;
}

export function ExpiringRatesTable({
    seasons, currentPage, totalPages, totalCount, limit, search, window,
}: {
    seasons: SeasonRow[];
    currentPage: number;
    totalPages: number;
    totalCount: number;
    limit: number;
    search: string;
    window: ExpiryWindow;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [, startTransition] = useTransition();

    function updateParam(key: string, value: string) {
        const params = new URLSearchParams(searchParams.toString());
        if (value === "") params.delete(key);
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
    const paginationLabel = `Showing ${from}–${to} of ${totalCount} seasonal rate${totalCount !== 1 ? "s" : ""}`;

    const columns: ColumnDef<SeasonRow>[] = [
        {
            header: "Room",
            sortKey: (row) => row.hotelName.toLowerCase(),
            cell: (row) => {
                const img = thumb(row.hotelThumbnail);
                return (
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-14 shrink-0 rounded-md overflow-hidden bg-dashboard-base-200 flex items-center justify-center">
                            {img
                                ? <img src={img} alt={row.hotelName} className="h-full w-full object-cover" />
                                : <Building2 className="h-4 w-4 text-dashboard-base-content/40" />}
                        </div>
                        <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{row.hotelName}</p>
                            <p className="text-xs text-dashboard-base-content/60 flex items-center gap-1 truncate">
                                <BedDouble className="h-3 w-3 shrink-0" /> {row.roomName}
                            </p>
                        </div>
                    </div>
                );
            },
        },
        {
            header: "Location",
            cell: (row) => (
                <div className="flex items-center gap-1.5 text-sm text-dashboard-base-content/75">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-dashboard-base-content/40" />
                    <span className="truncate">{row.hotelLocation || "—"}</span>
                </div>
            ),
        },
        {
            header: "Season",
            cell: (row) => (
                <div className="text-sm">
                    <p className="font-medium truncate">{row.seasonName || row.planName || "Seasonal rate"}</p>
                    <p className="text-xs text-dashboard-base-content/60 flex items-center gap-1">
                        <CalendarRange className="h-3 w-3 shrink-0" />
                        {format(row.validFrom, "d MMM yyyy")} – {format(row.validTo, "d MMM yyyy")}
                    </p>
                </div>
            ),
        },
        {
            header: "Rate",
            align: "right",
            width: "w-[130px]",
            sortKey: (row) => row.pricePerNight,
            cell: (row) => (
                <div className="text-sm text-right">
                    <p className="font-medium">₹{row.pricePerNight.toLocaleString("en-IN")}/night</p>
                    {row.extraBedRate != null && (
                        <p className="text-xs text-dashboard-base-content/50">+₹{row.extraBedRate.toLocaleString("en-IN")} extra bed</p>
                    )}
                </div>
            ),
        },
        {
            header: "Expires",
            align: "center",
            width: "w-[130px]",
            sortKey: (row) => row.daysRemaining,
            cell: (row) => (
                <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap", urgencyClass(row.daysRemaining))}>
                    {urgencyLabel(row.daysRemaining)}
                </span>
            ),
        },
        {
            header: "",
            align: "right",
            width: "w-[80px]",
            cell: (row) => (
                <Link
                    href={`/dashboard/hotels/${row.hotelId}?tab=pricing`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-dashboard-primary hover:underline"
                >
                    Fix <ChevronRight className="h-3 w-3" />
                </Link>
            ),
        },
    ];

    return (
        <div className="space-y-4">
            <TableFilters
                search={search}
                onSearchChange={(v) => updateParam("search", v)}
                searchPlaceholder="Search hotel, room or season…"
                filters={[
                    {
                        value: window,
                        onChange: (v) => updateParam("window", v),
                        placeholder: "Within 3 months",
                        width: "w-44",
                        allValue: "3m",
                        options: EXPIRY_WINDOWS.filter((w) => w.value !== "3m").map((w) => ({ label: w.label, value: w.value })),
                    },
                ]}
            />

            <DataTable
                data={seasons}
                columns={columns}
                rowKey={(r) => r.id}
                emptyState={
                    <TableEmptyState
                        title="No expiring seasonal rates"
                        description="Nothing in this window — try widening the filter"
                    />
                }
                pagination={{ currentPage, totalPages, buildHref, label: paginationLabel }}
            />
        </div>
    );
}
