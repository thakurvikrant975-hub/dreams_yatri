"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Car, CalendarDays, CheckCircle2, XCircle, Eye } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableFilters } from "../components/dashboard/Tablefilters";
import { TableEmptyState } from "../components/dashboard/TableEmptyState";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "../components/ui/sheet";
import { Button } from "../components/ui/button";
import type { CabPricingGroup } from "../(cabs)/cab-pricing/actions";

type Status = "all" | "active" | "inactive";

function money(v: number): string {
    return `₹${v.toLocaleString("en-IN")}`;
}

// ── Read-only pricing detail sheet ──────────────────────────────────────────

function CabPricingDetailSheet({ group }: { group: CabPricingGroup }) {
    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 h-8">
                    <Eye className="h-3.5 w-3.5" /> View
                </Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-lg overflow-y-auto">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        <Car className="h-4 w-4 text-dashboard-primary" /> {group.location_name}
                    </SheetTitle>
                </SheetHeader>

                <div className="px-4 pb-6 space-y-4">
                    {group.pricings.map((p) => (
                        <div key={p.vehicle_id} className="rounded-xl border overflow-hidden">
                            <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-dashboard-primary/5 border-b">
                                <div>
                                    <p className="text-sm font-semibold text-foreground">{p.vehicle_name}</p>
                                    <p className="text-xs text-muted-foreground">{p.vehicle_type}</p>
                                </div>
                                {p.is_active ? (
                                    <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                                        <CheckCircle2 className="h-2.5 w-2.5" /> Active
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                                        <XCircle className="h-2.5 w-2.5" /> Inactive
                                    </span>
                                )}
                            </div>
                            <div className="p-4 space-y-3">
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-lg font-bold text-foreground">{money(p.price)}</span>
                                    <span className="text-xs text-muted-foreground">{p.pricing_type === "PER_KM" ? "per km" : "per day"}</span>
                                </div>

                                {p.seasons.length > 0 && (
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1">
                                            <CalendarDays className="h-3 w-3" /> Seasonal Rates
                                        </p>
                                        <div className="space-y-1.5">
                                            {p.seasons.map((s) => (
                                                <div key={s.id} className="rounded-lg bg-muted/50 px-3 py-2 text-xs space-y-1">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="font-medium text-foreground">
                                                            {s.season_name || "Season"}
                                                        </span>
                                                        <span className="text-muted-foreground">
                                                            {new Date(s.valid_from).toLocaleDateString("en-IN")} – {new Date(s.valid_to).toLocaleDateString("en-IN")}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-muted-foreground">
                                                        <span>Weekday: <span className="font-semibold text-foreground">{money(s.weekday_price)}</span></span>
                                                        {s.weekend_price != null && (
                                                            <span>Weekend: <span className="font-semibold text-foreground">{money(s.weekend_price)}</span></span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </SheetContent>
        </Sheet>
    );
}

// ── Table ────────────────────────────────────────────────────────────────────

export function CabInventoryTable({
    rows, currentPage, totalPages, totalCount, limit, search, status,
}: {
    rows: CabPricingGroup[];
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

    const columns: ColumnDef<CabPricingGroup>[] = [
        {
            header: "City",
            width: "w-[220px]",
            sortKey: (row) => row.location_name?.toLowerCase() ?? "",
            cell: (row) => (
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-dashboard-primary/10 flex items-center justify-center shrink-0">
                        <Car className="h-4 w-4 text-dashboard-primary" />
                    </div>
                    <div>
                        <p className="font-medium text-sm">{row.location_name}</p>
                        <p className="text-xs text-muted-foreground">
                            {row.active_count} of {row.total_count} vehicle{row.total_count !== 1 ? "s" : ""} priced
                        </p>
                    </div>
                </div>
            ),
        },
        {
            header: "Vehicle Prices",
            cell: (row) => (
                <div className="flex flex-wrap gap-1">
                    {row.pricings.map((p) => (
                        <div
                            key={p.vehicle_id}
                            className={cn(
                                "flex items-center gap-1 rounded-md border px-2 py-0.5",
                                p.is_active ? "bg-muted/40" : "bg-muted/20 opacity-60",
                            )}
                        >
                            <span className="text-[11px] font-medium text-muted-foreground">{p.vehicle_name}</span>
                            <span className="text-[11px] font-semibold text-foreground">₹{p.price.toLocaleString("en-IN")}</span>
                            <span className="text-[10px] text-muted-foreground">{p.pricing_type === "PER_KM" ? "/km" : "/day"}</span>
                            {p.seasons.length > 0 && <CalendarDays className="h-2.5 w-2.5 text-dashboard-primary ml-0.5" />}
                        </div>
                    ))}
                </div>
            ),
        },
        {
            header: "",
            align: "right",
            width: "w-[90px]",
            cell: (row) => <CabPricingDetailSheet group={row} />,
        },
    ];

    return (
        <div className="space-y-4">
            <TableFilters
                search={search}
                onSearchChange={(v) => updateParam("search", v)}
                searchPlaceholder="Search destinations…"
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
                        title="No cab pricing found"
                        description="Try adjusting your search or filters"
                    />
                }
                pagination={{ currentPage, totalPages, buildHref, label: paginationLabel }}
            />
        </div>
    );
}
