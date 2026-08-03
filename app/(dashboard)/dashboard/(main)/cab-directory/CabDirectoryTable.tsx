"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Car, Users, Snowflake } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableFilters } from "../components/dashboard/Tablefilters";
import { TableEmptyState } from "../components/dashboard/TableEmptyState";
import type { CabDirectoryGroup } from "./actions";

type Status = "all" | "active" | "inactive";

// Duplicated from (cabs)/vehicles/VehiclesClient.tsx's VEHICLE_TYPES rather
// than imported — that file is the admin vehicle-editor, a different route
// tree this sales-facing page has no other reason to depend on, and the
// label set (VehicleType enum values) rarely changes.
const VEHICLE_TYPE_LABELS: Record<string, string> = {
    HATCHBACK: "Hatchback",
    SEDAN: "Sedan",
    SUV: "SUV",
    LUXURY_SEDAN: "Luxury Sedan",
    LUXURY_SUV: "Luxury SUV",
    TEMPO_TRAVELLER: "Tempo Traveller",
    MINI_BUS: "Mini Bus",
    BUS: "Bus",
    Rikshaw: "Rikshaw",
};

function vehicleTypeLabel(type: string) {
    return VEHICLE_TYPE_LABELS[type] ?? type;
}

export function CabDirectoryTable({
    rows, currentPage, totalPages, totalCount, limit, search, status,
}: {
    rows: CabDirectoryGroup[];
    currentPage: number;
    totalPages: number;
    totalCount: number;
    limit: number;
    search: string;
    status: Status;
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

    function buildHref(p: number) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("page", String(p));
        return `?${params.toString()}`;
    }

    const from = totalCount === 0 ? 0 : (currentPage - 1) * limit + 1;
    const to = Math.min(currentPage * limit, totalCount);
    const paginationLabel = `Showing ${from}–${to} of ${totalCount} cit${totalCount !== 1 ? "ies" : "y"}`;

    const columns: ColumnDef<CabDirectoryGroup>[] = [
        {
            header: "City",
            width: "w-[200px]",
            sortKey: (row) => row.location_name.toLowerCase(),
            cell: (row) => (
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-dashboard-primary/10 flex items-center justify-center shrink-0">
                        <Car className="h-4 w-4 text-dashboard-primary" />
                    </div>
                    <div>
                        <p className="font-medium text-sm">{row.location_name}</p>
                        <p className="text-xs text-muted-foreground">
                            {row.active_count} of {row.total_count} cab{row.total_count !== 1 ? "s" : ""} available
                        </p>
                    </div>
                </div>
            ),
        },
        {
            header: "Cabs Available",
            cell: (row) => (
                <div className="flex flex-wrap gap-1">
                    {row.vehicles.map((v) => (
                        <div
                            key={v.vehicle_id}
                            className={cn(
                                "flex items-center gap-1.5 rounded-md border px-2 py-0.5",
                                v.is_active ? "bg-muted/40" : "bg-muted/20 opacity-60",
                            )}
                            title={!v.is_active ? "Currently unavailable" : undefined}
                        >
                            <span className="text-[11px] font-medium text-foreground">
                                {v.vehicle_name}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                                {vehicleTypeLabel(v.vehicle_type)}
                            </span>
                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                <Users className="h-2.5 w-2.5" />{v.passenger_capacity}
                            </span>
                            {v.has_ac && <Snowflake className="h-2.5 w-2.5 text-sky-500" />}
                        </div>
                    ))}
                </div>
            ),
        },
        {
            header: "Cabs",
            align: "center",
            width: "w-[90px]",
            sortKey: (row) => row.total_count,
            cell: (row) => (
                <div className="flex items-center justify-center gap-1 text-sm">
                    <span className="font-semibold">{row.active_count}</span>
                    <span className="text-muted-foreground">/ {row.total_count}</span>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-4">
            <TableFilters
                search={search}
                onSearchChange={(v) => updateParam("search", v)}
                searchPlaceholder="Search city…"
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
                ]}
            />

            <DataTable
                data={rows}
                columns={columns}
                rowKey={(r) => r.location_id}
                emptyState={
                    <TableEmptyState
                        title="No cabs found"
                        description="Try adjusting your search or filters"
                    />
                }
                pagination={{ currentPage, totalPages, buildHref, label: paginationLabel }}
            />
        </div>
    );
}
