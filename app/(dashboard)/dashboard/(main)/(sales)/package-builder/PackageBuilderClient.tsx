"use client";

import React, { useCallback, useEffect, useState, useTransition } from "react";
import {
    MapPin, Calendar, Users, Phone, Search, Package,
    Clock, ArrowRight, RefreshCw, User, Briefcase,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Stats } from "../../components/dashboard/Stats";
import { DataTable, type ColumnDef } from "../../components/dashboard/Datatable";
import { getPackageBuilderQueries, type QueryRow, type PaginatedQueries } from "./action";
import type { Metadata } from "next";
import { StatCard, StatGrid } from "../../components/dashboard/Statcard";
import { TableFilters } from "../../components/dashboard/Tablefilters";
import { TableEmptyState } from "../../components/dashboard/TableEmptyState";


export const metadata: Metadata = {
    title: "Package Builder - Dashboard",
    description: "Package Builder page",
    robots: {
        index: false,
        follow: false,
        nocache: true,
        googleBot: { index: false, follow: false },
    },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysSince(date: Date | string) {
    return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
}

function formatDate(d: Date | string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
    });
}

function getGroupSize(row: QueryRow) {
    const t = row.requirements?.travellers;
    if (t) return (t.adults ?? 0) + (t.children ?? 0) + (t.infants ?? 0);
    return row.groupSize ?? "—";
}



// ── Page ──────────────────────────────────────────────────────────────────────
export default function PackageBuilderClientPage() {
    const [isPending, startTransition] = useTransition();
    const [data, setData] = useState<PaginatedQueries | null>(null);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [debQ, setDebQ] = useState("");

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => setDebQ(search), 400);
        return () => clearTimeout(t);
    }, [search]);
    useEffect(() => { setPage(1); }, [debQ]);

    const load = useCallback(() => {
        startTransition(async () => {
            const result = await getPackageBuilderQueries({ page, search: debQ });
            setData(result);
        });
    }, [page, debQ]);

    useEffect(() => { load(); }, [load]);

    // ── Columns ───────────────────────────────────────────────────────────────
    const columns: ColumnDef<QueryRow>[] = [
        {
            header: "Client",
            cell: (row) => (
                <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-sm text-foreground">{row.name}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone size={10} /> {row.phone}
                    </span>
                </div>
            ),
        },
        {
            header: "Destination",
            cell: (row) => (
                <div className="flex items-center gap-1.5">
                    <MapPin size={13} className="text-primary shrink-0" />
                    <span className="text-sm font-medium">
                        {row.requirements?.journey?.destinations?.join(", ") || row.destination || "—"}
                    </span>
                </div>
            ),
        },
        {
            header: "Travel Date",
            align: "center",
            cell: (row) => (
                <span className="text-sm">
                    {formatDate(row.requirements?.journey?.travelDate ?? row.travelDate)}
                </span>
            ),
        },
        {
            header: "Group",
            align: "center",
            cell: (row) => (
                <div className="flex items-center justify-center gap-1">
                    <Users size={13} className="text-muted-foreground" />
                    <span className="text-sm font-medium">{getGroupSize(row)}</span>
                </div>
            ),
        },
        {
            header: "Duration",
            align: "center",
            cell: (row) => {
                const j = row.requirements?.journey;
                return j
                    ? <span className="text-sm">{j.noOfDays}D / {j.noOfNights}N</span>
                    : <span className="text-muted-foreground text-sm">—</span>;
            },
        },
        {
            header: "Budget",
            align: "left",
            cell: (row) => {
                const b = row.requirements?.budget;
                if (!b) return <span className="text-muted-foreground text-sm">—</span>;
                return (
                    <div className="text-left">
                        <span className="text-xs font-semibold">
                            ₹{b.min?.toLocaleString("en-IN")}–{b.max?.toLocaleString("en-IN")}
                        </span>
                        <span className="block text-xs text-muted-foreground">{b.type}</span>
                    </div>
                );
            },
        },
        // {
        //     header: "Assigned To",
        //     cell: (row) => (
        //         <div className="flex items-center gap-1.5">
        //             <User size={13} className="text-muted-foreground" />
        //             <span className="text-sm">{row.assignedToName ?? "—"}</span>
        //         </div>
        //     ),
        // },
        {
            header: "Waiting Time",
            align: "center",
            cell: (row) => {
                const days = daysSince(row.updatedAt);
                return (
                    <Badge
                        variant="outline"
                        className={
                            days > 2
                                ? "border-red-300 text-red-600 bg-red-50 dark:bg-red-950/20 rounded-md"
                                : days > 1
                                    ? "border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded-md"
                                    : "border-emerald-300 text-emerald-600 bg-emerald-50 rounded-md dark:bg-emerald-950/20"
                        }
                    >
                        {days} days
                    </Badge>
                );
            },
        },
        {
            header: "",
            width: "w-10",
            align: "center",
            cell: () => (
                <ArrowRight size={15} className="text-muted-foreground group-hover:text-primary transition-colors" />
            ),
        },
    ];

    // ── Stats ─────────────────────────────────────────────────────────────────
    const total = data?.total ?? 0;
    const urgent = data?.queries.filter((q) => daysSince(q.updatedAt) > 2).length ?? 0;
    const today = data?.queries.filter((q) => daysSince(q.updatedAt) === 0).length ?? 0;

    return (
        <div className="flex flex-col gap-6 max-w-screen-2xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">Package Builder</h1>
                        <p className="text-sm text-muted-foreground">
                            Queries pending custom package creation
                        </p>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={load} disabled={isPending}>
                    <RefreshCw size={14} className={isPending ? "animate-spin" : ""} />
                    Refresh
                </Button>
            </div>


            <Stats
                cols={4}
                rows={[

                ]}
            />
            <StatGrid cols={3}>
                <StatCard
                    label="Pending Packages"
                    value={total}
                    icon={Briefcase}
                    iconText="text-dashboard-primary"
                />
                <StatCard
                    label="Urgent (>2 days)"
                    value={urgent}
                    icon={Clock}
                    iconText="text-dashboard-info"
                />
                <StatCard
                    label="Updated Today"
                    value={today}
                    icon={Calendar}
                    iconText="text-dashboard-warning"
                />
            </StatGrid>

            {/* Search */}

            <TableFilters
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search by name, destination, phone…"
            />

            {/* Table */}
            <DataTable
                data={data?.queries ?? []}
                columns={columns}
                rowKey={(r) => r.id}
                rowClassName={() => "group hover:bg-muted/40 cursor-pointer"}
                onRowClick={(row) => window.open(`/dashboard/package-builder/${row.id}`, "_blank")}
                emptyState={
                    isPending ? (
                        <p className="text-sm text-muted-foreground animate-pulse">Loading queries…</p>
                    ) : (
                        <div className="flex flex-col items-center gap-2 py-6">
                            <TableEmptyState
                                description="No Package builder query found."
                                title="No Package"
                            />
                        </div>
                    )
                }
                pagination={
                    data && data.totalPages > 1
                        ? {
                            currentPage: page,
                            totalPages: data.totalPages,
                            onPageChange: setPage,
                        }
                        : undefined
                }
            />
        </div>
    );
}