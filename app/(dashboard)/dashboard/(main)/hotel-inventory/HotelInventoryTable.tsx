"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, MapPin, BedDouble, ChevronRight, Navigation } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableFilters } from "../components/dashboard/Tablefilters";
import { TableEmptyState } from "../components/dashboard/TableEmptyState";
import { CATEGORIES } from "../hotels/constants";
import type { getHotels } from "../hotels/actions";
import { LocationSearchSelect } from "../components/location/LocationSearchSelect";
import type { LocationValue } from "../components/location/location.types";

type HotelRow = Awaited<ReturnType<typeof getHotels>>["hotels"][number];
type Status = "all" | "active" | "inactive";
type NearSort = "distance" | "price";
type NearLocation = { id: string; name: string; type: string; lat: number; lng: number };
type Uploader = { id: string; name: string };

const R2_BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";

function thumb(key: string | null) {
    if (!key) return null;
    return key.startsWith("http") ? key : `${R2_BASE}/${key}`;
}

function catLabel(value: string | null) {
    if (!value) return "Uncategorized";
    return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function HotelInventoryTable({
    hotels, currentPage, totalPages, totalCount, limit, search, status, near, nearSort, uploadedBy, uploaders, category,
}: {
    hotels: HotelRow[];
    currentPage: number;
    totalPages: number;
    totalCount: number;
    limit: number;
    search: string;
    status: Status;
    near: NearLocation | null;
    nearSort: NearSort;
    uploadedBy: string;
    uploaders: Uploader[];
    category: string;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [, startTransition] = useTransition();

    function updateParam(key: string, value: string) {
        const params = new URLSearchParams(searchParams.toString());
        if (value === "all" || value === "") params.delete(key);
        else params.set(key, value);
        params.delete("page");
        startTransition(() => router.replace(`?${params.toString()}`));
    }

    // Text search and "near a location" are two different ways of finding the
    // same hotel — whichever the exec touches most recently wins, rather than
    // trying to combine a typed name with a distance ranking.
    function handleSearchChange(v: string) {
        const params = new URLSearchParams(searchParams.toString());
        if (v) params.set("search", v); else params.delete("search");
        params.delete("nearLat"); params.delete("nearLng");
        params.delete("nearName"); params.delete("nearId"); params.delete("nearType");
        params.delete("page");
        startTransition(() => router.replace(`?${params.toString()}`));
    }

    function handleNearChange(loc: LocationValue | null) {
        const params = new URLSearchParams(searchParams.toString());
        if (loc && loc.latitude != null && loc.longitude != null) {
            params.set("nearLat", String(loc.latitude));
            params.set("nearLng", String(loc.longitude));
            params.set("nearName", loc.name);
            params.set("nearId", loc.id);
            params.set("nearType", loc.type);
            params.delete("search");
        } else {
            params.delete("nearLat"); params.delete("nearLng");
            params.delete("nearName"); params.delete("nearId"); params.delete("nearType");
        }
        params.delete("page");
        startTransition(() => router.replace(`?${params.toString()}`));
    }

    function buildHref(p: number) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("page", String(p));
        return `?${params.toString()}`;
    }

    const nearValue: LocationValue | null = near ? {
        id: near.id, name: near.name, type: near.type as LocationValue["type"],
        breadcrumb: near.name, slug: "", latitude: near.lat, longitude: near.lng,
    } : null;

    const from = totalCount === 0 ? 0 : (currentPage - 1) * limit + 1;
    const to = Math.min(currentPage * limit, totalCount);
    const paginationLabel = `Showing ${from}–${to} of ${totalCount} hotel${totalCount !== 1 ? "s" : ""}`;

    const columns: ColumnDef<HotelRow>[] = [
        {
            header: "Hotel",
            sortKey: (row) => row.name.toLowerCase(),
            cell: (row) => {
                const img = thumb(row.thumbnail);
                return (
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-14 shrink-0 rounded-md overflow-hidden bg-dashboard-base-200 flex items-center justify-center">
                            {img
                                ? <img src={img} alt={row.name} className="h-full w-full object-cover" />
                                : <Building2 className="h-4 w-4 text-dashboard-base-content/40" />}
                        </div>
                        <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{row.name}</p>
                            <p className="text-xs text-dashboard-base-content/60">{catLabel(row.category)} · {row.stay_type ?? "Unrated"}</p>
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
                    <span className="truncate">{[row.city, row.state].filter(Boolean).join(", ") || row.country || "—"}</span>
                </div>
            ),
        },
        ...(near ? [{
            header: "Distance",
            align: "center" as const,
            width: "w-[130px]",
            sortKey: (row: HotelRow) => row.distanceKm ?? Infinity,
            cell: (row: HotelRow) => (
                <div className="flex flex-col items-center gap-0.5">
                    <div className="flex items-center justify-center gap-1 text-sm text-dashboard-base-content/75">
                        <Navigation className="h-3.5 w-3.5 shrink-0 text-dashboard-base-content/40" />
                        {row.distanceKm != null ? `${row.distanceKm} km` : "—"}
                    </div>
                    <span className="text-[10px] text-dashboard-base-content/50">
                        {row.priceFrom != null ? `from ₹${row.priceFrom.toLocaleString("en-IN")}` : "no priced room"}
                    </span>
                </div>
            ),
        }] : []),
        {
            header: "Rooms",
            align: "center",
            width: "w-[90px]",
            sortKey: (row) => row._count.hotelRooms,
            cell: (row) => (
                <div className="flex items-center justify-center gap-1 text-sm">
                    <BedDouble className="h-3.5 w-3.5 text-dashboard-base-content/40" />
                    {row._count.hotelRooms}
                </div>
            ),
        },
        {
            header: "Status",
            align: "center",
            width: "w-[100px]",
            cell: (row) => (
                <span
                    className={cn(
                        "text-[10px] font-medium px-2 py-0.5 rounded-full",
                        row.is_active
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
                    )}
                >
                    {row.is_active ? "Active" : "Inactive"}
                </span>
            ),
        },
        {
            header: "",
            align: "right",
            width: "w-[80px]",
            cell: (row) => (
                <Link
                    href={`/dashboard/hotel-inventory/${row.id}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-dashboard-primary hover:underline"
                >
                    View <ChevronRight className="h-3 w-3" />
                </Link>
            ),
        },
    ];

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="flex-1 min-w-0">
                    <TableFilters
                        search={search}
                        onSearchChange={handleSearchChange}
                        searchPlaceholder="Search hotel, city, state, country…"
                        filters={[
                            {
                                value: status,
                                onChange: (v) => updateParam("status", v),
                                placeholder: "All Statuses",
                                width: "w-38",
                                options: [
                                    { label: "Active", value: "active" },
                                    { label: "Inactive", value: "inactive" },
                                ],
                            },
                            {
                                value: category,
                                onChange: (v) => updateParam("category", v),
                                placeholder: "All Categories",
                                width: "w-40",
                                options: CATEGORIES.map((c) => ({ label: c.label, value: c.value })),
                            },
                            ...(near ? [{
                                value: nearSort,
                                onChange: (v: string) => updateParam("nearSort", v),
                                placeholder: "Nearest first",
                                width: "w-40",
                                allValue: "distance",
                                options: [
                                    { label: "Cheapest first", value: "price" },
                                ],
                            }] : []),
                            ...(uploaders.length > 0 ? [{
                                value: uploadedBy,
                                onChange: (v: string) => updateParam("uploadedBy", v),
                                placeholder: "Uploaded by anyone",
                                width: "w-44",
                                options: uploaders.map((u) => ({ label: u.name, value: u.id })),
                            }] : []),
                        ]}
                    />
                </div>
                {/* Proximity search — picks any mapped location and ranks
                   hotels by distance from it, instead of matching a typed
                   name. Independent of the text search above: picking a
                   location here clears it, and vice versa. */}
                <LocationSearchSelect
                    value={nearValue}
                    onChange={handleNearChange}
                    placeholder="Or search hotels near a location…"
                    className="w-full sm:w-72 shrink-0"
                    hideRecent
                />
            </div>

            {near && (
                <div className="flex items-center gap-2 rounded-lg border border-dashboard-primary/30 bg-dashboard-primary/5 px-3 py-2 text-xs text-dashboard-base-content/80">
                    <Navigation className="h-3.5 w-3.5 shrink-0 text-dashboard-primary" />
                    Showing hotels with a mapped location near <span className="font-medium">{near.name}</span>, {nearSort === "price" ? "cheapest first" : "nearest first"}.
                </div>
            )}

            <DataTable
                data={hotels}
                columns={columns}
                rowKey={(r) => r.id}
                emptyState={
                    <TableEmptyState
                        title="No hotels found"
                        description={near
                            ? "No hotels with a mapped location were found near this place yet."
                            : "Try adjusting your search or filters"}
                    />
                }
                pagination={{ currentPage, totalPages, buildHref, label: paginationLabel }}
            />
        </div>
    );
}
