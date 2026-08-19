"use client";

import React, { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
    MapPin, Calendar, Users, Phone,
    Package, Clock, ArrowRight, RefreshCw, Briefcase, ArrowLeft, Plus,
} from "lucide-react";
import { Button } from "@/app/(dashboard)/dashboard/(main)/components/ui/button";
import { Badge } from "@/app/(dashboard)/dashboard/(main)/components/ui/badge";
import { DataTable, type ColumnDef } from "@/app/(dashboard)/dashboard/(main)/components/dashboard/Datatable";
import { getPackageBuilderQueries, type QueryRow, type PaginatedQueries } from "./action";
import type { Metadata } from "next";
import { StatCard, StatGrid } from "@/app/(dashboard)/dashboard/(main)/components/dashboard/Statcard";
import { TableFilters, type FilterConfig } from "@/app/(dashboard)/dashboard/(main)/components/dashboard/Tablefilters";
import { TableEmptyState } from "@/app/(dashboard)/dashboard/(main)/components/dashboard/TableEmptyState";
import { PageHeader } from "@/app/(dashboard)/dashboard/(main)/components/dashboard/PageHeader";

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

function getWaitingTime(date: Date | string) {
    const diffMs = Date.now() - new Date(date).getTime();
    const totalHours = Math.floor(diffMs / 3_600_000);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;

    let label = "";
    if (days > 0) {
        label = `${days} day${days > 1 ? "s" : ""}${hours > 0 ? ` and ${hours} hour${hours > 1 ? "s" : ""}` : ""}`;
    } else {
        label = `${hours} hour${hours !== 1 ? "s" : ""}`;
    }
    return { days, hours, label };
}

function formatDate(d: Date | string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
    });
}

function newPackageId(): string {
    return typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `pkg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getGroupSize(row: QueryRow): number | string {
    const t = row.requirements?.travellers;
    if (t) return (t.adults ?? 0) + (t.children ?? 0) + (t.infants ?? 0);
    return row.groupSize ?? "—";
}

// ── NEW: Filter helpers ───────────────────────────────────────────────────────

/** Bucket a query by how long it has been waiting for attention. */
type WaitingBucket = "all" | "fresh" | "warning" | "urgent";

function getWaitingBucket(row: QueryRow): WaitingBucket {
    const d = daysSince(row.updatedAt);
    if (d > 2)  return "urgent";
    if (d >= 1) return "warning";
    return "fresh";
}

/** Bucket a query by its travel date relative to today. */
type TravelDateBucket = "all" | "past" | "this_month" | "next_month" | "next_3_months";

function getTravelDateBucket(row: QueryRow): TravelDateBucket {
    const raw = row.requirements?.journey?.travelDate ?? row.travelDate;
    if (!raw) return "all";

    const travel = new Date(raw);
    const now = new Date();

    if (travel < now) return "past";

    const sameYear  = travel.getFullYear() === now.getFullYear();
    const sameMo    = sameYear && travel.getMonth() === now.getMonth();
    if (sameMo) return "this_month";

    const nextMo  = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMoEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    if (travel >= nextMo && travel <= nextMoEnd) return "next_month";

    const in3Months = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
    if (travel <= in3Months) return "next_3_months";

    return "all"; // beyond 3 months → treated as "all" (not hidden by any bucket)
}

/** Bucket a query by group size. */
type GroupBucket = "all" | "small" | "medium" | "large";

function getGroupBucket(row: QueryRow): GroupBucket {
    const size = getGroupSize(row);
    if (typeof size !== "number") return "all";
    if (size <= 2)  return "small";
    if (size <= 5)  return "medium";
    return "large";
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PackageBuilderClientPage() {
    const [isPending, startTransition] = useTransition();
    const [data, setData] = useState<PaginatedQueries | null>(null);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [debQ, setDebQ] = useState("");

    // ── NEW: filter states ────────────────────────────────────────────────────
    const [waitingFilter, setWaitingFilter]     = useState<WaitingBucket>("all");
    const [travelFilter,  setTravelFilter]      = useState<TravelDateBucket>("all");
    const [groupFilter,   setGroupFilter]       = useState<GroupBucket>("all");

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => setDebQ(search), 400);
        return () => clearTimeout(t);
    }, [search]);

    // Reset to page 1 whenever any filter / search changes
    useEffect(() => { setPage(1); }, [debQ, waitingFilter, travelFilter, groupFilter]);

    const load = useCallback(() => {
        startTransition(async () => {
            const result = await getPackageBuilderQueries({ page, search: debQ });
            setData(result);
        });
    }, [page, debQ]);

    useEffect(() => { load(); }, [load]);

    // ── NEW: client-side filtering ────────────────────────────────────────────
    const filteredQueries = useMemo(() => {
        if (!data?.queries) return [];
        return data.queries.filter((row) => {
            if (waitingFilter !== "all" && getWaitingBucket(row)   !== waitingFilter) return false;
            if (groupFilter   !== "all" && getGroupBucket(row)     !== groupFilter)   return false;

            // For travel date, "next_3_months" is inclusive of this_month and next_month
            if (travelFilter !== "all") {
                const bucket = getTravelDateBucket(row);
                if (travelFilter === "next_3_months") {
                    if (!["this_month", "next_month", "next_3_months"].includes(bucket)) return false;
                } else {
                    if (bucket !== travelFilter) return false;
                }
            }

            return true;
        });
    }, [data?.queries, waitingFilter, travelFilter, groupFilter]);

    // ── NEW: FilterConfig array for TableFilters ───────────────────────────────
    const filters: FilterConfig[] = [
        {
            value:       waitingFilter,
            onChange:    (v) => setWaitingFilter(v as WaitingBucket),
            placeholder: "All waiting",
            width:       "w-44",
            allValue:    "all",
            options: [
                { label: "Fresh (today)",      value: "fresh"   },
                { label: "Warning (1–2 days)", value: "warning" },
                { label: "Urgent (>2 days)",   value: "urgent"  },
            ],
        },
        {
            value:       travelFilter,
            onChange:    (v) => setTravelFilter(v as TravelDateBucket),
            placeholder: "All travel dates",
            width:       "w-44",
            allValue:    "all",
            options: [
                { label: "Past dates",       value: "past"          },
                { label: "This month",       value: "this_month"    },
                { label: "Next month",       value: "next_month"    },
                { label: "Next 3 months",    value: "next_3_months" },
            ],
        },
        {
            value:       groupFilter,
            onChange:    (v) => setGroupFilter(v as GroupBucket),
            placeholder: "All group sizes",
            width:       "w-44",
            allValue:    "all",
            options: [
                { label: "Solo / couple (1–2)", value: "small"  },
                { label: "Small group (3–5)",   value: "medium" },
                { label: "Large group (6+)",    value: "large"  },
            ],
        },
    ];

    // ── Columns ───────────────────────────────────────────────────────────────
    const columns: ColumnDef<QueryRow>[] = [
        {
            header: "Client",
            sortKey: (row) => row.name?.toLowerCase() ?? "",
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
            sortKey: (row) => (row.requirements?.journey?.destinations?.join(", ") || row.destination || "").toLowerCase(),
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
            sortKey: (row) => {
                const d = row.requirements?.journey?.travelDate ?? row.travelDate;
                return d ? new Date(d).getTime() : 0;
            },
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
        {
            header: "Waiting Time",
            align: "center",
            sortKey: (row) => new Date(row.updatedAt).getTime(),
            cell: (row) => {
                const waiting = getWaitingTime(row.updatedAt);
                return (
                    <Badge
                        variant="outline"
                        className={
                            waiting.days > 2
                                ? "border-red-300 text-red-600 bg-red-50 dark:bg-red-950/20 rounded-md"
                                : waiting.days > 1
                                    ? "border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded-md"
                                    : "border-emerald-300 text-emerald-600 bg-emerald-50 rounded-md dark:bg-emerald-950/20"
                        }
                    >
                        {waiting.label}
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
    const total  = data?.total ?? 0;
    const urgent = data?.queries.filter((q) => daysSince(q.updatedAt) > 2).length ?? 0;
    const today  = data?.queries.filter((q) => daysSince(q.updatedAt) === 0).length ?? 0;

    return (
        <div className="flex flex-col gap-6 max-w-screen-2xl mx-auto p-6">

            <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 text-xs text-dashboard-base-content/60 hover:text-dashboard-base-content transition-colors w-fit"
            >
                <ArrowLeft size={13} /> Back to Dashboard
            </Link>

            <PageHeader
                title="Package Builder"
                description="Queries pending custom package creation"
                icon={Package}
                actions={
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => window.open(`/dashboard/package-builder/${newPackageId()}`, "_blank")}
                    >
                        <Plus size={14} /> Blank Package
                    </Button>
                }
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

            {/* Search + Filters */}
            <TableFilters
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search by name, destination, phone…"
                filters={filters}
                // Shows "12 / 47" count badge when filters are active
                filteredCount={filteredQueries.length}
                totalCount={data?.queries.length ?? 0}
            />

            {/* Table — uses filteredQueries, not raw data.queries */}
            <DataTable
                data={filteredQueries}
                columns={columns}
                rowKey={(r) => r.id}
                rowClassName={() => "group hover:bg-muted/40 cursor-pointer"}
                onRowClick={(row) => {
                    // A query can have several packages now — open the most
                    // recently built one if it has any, otherwise start a
                    // brand-new one prefilled from this query's requirements.
                    const latest = row.customPackages[0];
                    const url = latest
                        ? `/dashboard/package-builder/${latest.id}`
                        : `/dashboard/package-builder/${newPackageId()}?fromQuery=${row.id}`;
                    window.open(url, "_blank");
                }}
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