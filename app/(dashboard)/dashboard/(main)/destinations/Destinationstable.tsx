"use client";

import { useState, useTransition } from "react";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import { Button } from "../components/ui/button";
import { Trash2, MapPin, Package, Hotel, Activity, Package2, Globe, GlobeX, Earth } from "lucide-react";
import { ImageIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
    AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { EditDestinationDialog } from "./Destinationdialog";
import { deleteDestination, toggleDestinationActive } from "./actions";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableFilters } from "../components/dashboard/Tablefilters";
import { StatCard, StatGrid } from "../components/dashboard/Statcard";

// ── Types ─────────────────────────────────────────────────────────────────────

type Region = { id: number; name: string; slug: string };

type Destination = {
    id: number;
    name: string;
    slug: string;
    country: string;
    region_id: number;
    description: string | null;
    meta_title: string | null;
    meta_desc: string | null;
    thumbnail: string | null;
    cover_image: string | null;
    is_active: boolean;
    created_at: Date;
    location_id: string | null;
    region: { id: number; name: string; slug: string };
    _count: { packages: number; hotels: number; activities: number };
};

// ── Delete Dialog ─────────────────────────────────────────────────────────────

function DeleteDestinationDialog({
    id, name, linkedCount,
}: {
    id: number; name: string; linkedCount: number;
}) {
    const [isPending, startTransition] = useTransition();

    function handleDelete() {
        startTransition(async () => {
            const result = await deleteDestination(id);
            if (result.success) toast.success(result.message);
            else toast.error(result.message);
        });
    }

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Destination</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to delete <span className="font-semibold">{name}</span>?
                        {linkedCount > 0 && (
                            <span className="block mt-2 text-destructive font-medium">
                                ⚠ This destination has {linkedCount} linked item(s). Remove them first.
                            </span>
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDelete}
                        disabled={isPending || linkedCount > 0}
                        className="bg-destructive text-white hover:bg-destructive/90"
                    >
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

// ── Main Table ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

export function DestinationsTable({
    destinations,
    regions,
}: {
    destinations: Destination[];
    regions: Region[];
}) {
    const [isPending, startTransition] = useTransition();

    // ── Filter state ───────────────────────────────────────────────────────────
    const [search, setSearch] = useState("");
    const [filterRegion, setFilterRegion] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");
    const [page, setPage] = useState(1);

    // ── Filter logic ───────────────────────────────────────────────────────────
    const filtered = destinations.filter(d => {
        const matchSearch = !search
            || d.name.toLowerCase().includes(search.toLowerCase())
            || d.slug.toLowerCase().includes(search.toLowerCase())
            || d.country.toLowerCase().includes(search.toLowerCase());
        const matchRegion = filterRegion === "all" || String(d.region.id) === filterRegion;
        const matchStatus = filterStatus === "all"
            || (filterStatus === "active" && d.is_active)
            || (filterStatus === "inactive" && !d.is_active);
        return matchSearch && matchRegion && matchStatus;
    });

    // ── Reset to page 1 on filter change is handled via key deps below ─────────
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    const isFiltering = search !== "" || filterRegion !== "all" || filterStatus !== "all";

    // ── Stats (always from full dataset, never from filtered slice) ────────────
    const activeCount = destinations.filter(d => d.is_active).length;
    const totalPkgs = destinations.reduce((acc, d) => acc + d._count.packages, 0);

    // ── Toggle ─────────────────────────────────────────────────────────────────
    function handleToggle(id: number, current: boolean) {
        startTransition(async () => {
            const res = await toggleDestinationActive(id, !current);
            if (res.success) toast.success(res.message);
            else toast.error(res.message);
        });
    }

    // ── Columns ────────────────────────────────────────────────────────────────
    const columns: ColumnDef<Destination>[] = [
        {
            header: "Destination",
            width: "w-[220px]",
            cell: (dest) => (
                <div className="flex items-center gap-3">
                    {dest.thumbnail ? (
                        <img
                            src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${dest.thumbnail}`}
                            alt={dest.name}
                            className="h-10 w-14 rounded-lg object-cover shrink-0 border"
                        />
                    ) : (
                        <div className="h-10 w-14 rounded-lg bg-muted border flex items-center justify-center shrink-0">
                            <ImageIcon weight="duotone" className="size-5.5 text-muted-foreground/70" />
                        </div>
                    )}
                    <div>
                        <p className="font-medium text-sm">{dest.name}</p>
                        <p className="text-xs text-muted-foreground">{dest.country}</p>
                    </div>
                </div>
            ),
        },
        {
            header: "Slug",
            cell: (dest) => (
                <Badge variant="outline" className="font-mono text-xs">{dest.slug}</Badge>
            ),
        },
        {
            header: "Cover",
            cell: (dest) =>
                dest.cover_image ? (
                    <img
                        src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${dest.cover_image}`}
                        alt={dest.name}
                        className="h-10 w-14 rounded-lg object-cover shrink-0 border"
                    />
                ) : (
                    <div className="h-10 w-14 rounded-lg bg-muted border flex items-center justify-center shrink-0">
                        <ImageIcon weight="duotone" className="size-5.5 text-muted-foreground/70" />
                    </div>
                ),
        },
        {
            header: "Region",
            cell: (dest) => (
                <Badge variant="secondary" className="text-xs">{dest.region.name}</Badge>
            ),
        },
        {
            header: "Linked",
            align: "center",
            cell: (dest) => (
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                        <Package className="h-3 w-3" /> {dest._count.packages}
                    </span>
                    <span className="flex items-center gap-0.5">
                        <Hotel className="h-3 w-3" /> {dest._count.hotels}
                    </span>
                    <span className="flex items-center gap-0.5">
                        <Activity className="h-3 w-3" /> {dest._count.activities}
                    </span>
                </div>
            ),
        },
        {
            header: "Status",
            align: "center",
            cell: (dest) => (
                <Switch
                    checked={dest.is_active}
                    disabled={isPending}
                    onCheckedChange={() => handleToggle(dest.id, dest.is_active)}
                />
            ),
        },
        {
            header: "Added",
            cell: (dest) => (
                <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(dest.created_at), { addSuffix: true })}
                </span>
            ),
        },
        {
            header: "Actions",
            align: "right",
            width: "w-[100px]",
            cell: (dest) => {
                const linkedCount = dest._count.packages + dest._count.hotels + dest._count.activities;
                return (
                    <div className="flex items-center justify-end gap-1">
                        <EditDestinationDialog destination={dest} regions={regions} />
                        <DeleteDestinationDialog
                            id={dest.id}
                            name={dest.name}
                            linkedCount={linkedCount}
                        />
                    </div>
                );
            },
        },
    ];

    return (
        <div className="space-y-4">


            <StatGrid cols={4}>
                <StatCard
                    label="Total Destinations"
                    value={destinations.length}
                    icon={Earth}
                />
                <StatCard
                    label="Active Destinations"
                    value={activeCount}
                    icon={Globe}
                />
                <StatCard
                    label="Inactive Destinations"
                    value={destinations.length - activeCount}
                    icon={GlobeX}
                />
                <StatCard
                    label="Total Packages"
                    value={totalPkgs}
                    icon={Package2}
                />
            </StatGrid>

            {/* Filters */}
            <TableFilters
                search={search}
                onSearchChange={(v) => { setSearch(v); setPage(1); }}
                searchPlaceholder="Search destinations..."
                filteredCount={isFiltering ? filtered.length : undefined}
                totalCount={isFiltering ? destinations.length : undefined}
                filters={[
                    {
                        value: filterRegion,
                        onChange: (v) => { setFilterRegion(v); setPage(1); },
                        placeholder: "All Regions",
                        width: "w-40",
                        // Auto-derived from the full dataset
                        options: regions.map(r => ({ label: r.name, value: String(r.id) })),
                    },
                    {
                        value: filterStatus,
                        onChange: (v) => { setFilterStatus(v); setPage(1); },
                        placeholder: "All Statuses",
                        width: "w-36",
                        options: [
                            { label: "Active", value: "active" },
                            { label: "Inactive", value: "inactive" },
                        ],
                    },
                ]}
            />

            {/* Table with client-side pagination */}
            <DataTable
                data={paginated}
                columns={columns}
                rowKey={(d) => d.id}
                emptyState={
                    <div className="flex flex-col items-center gap-2">
                        <MapPin className="h-10 w-10 text-muted-foreground" />
                        <p className="text-sm font-medium text-muted-foreground">No destinations found</p>
                        <p className="text-xs text-muted-foreground">Try adjusting your filters</p>
                    </div>
                }
                pagination={{
                    currentPage: safePage,
                    totalPages,
                    onPageChange: setPage,
                }}
            />
        </div>
    );
}