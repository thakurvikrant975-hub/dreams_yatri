"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge }   from "../components/ui/badge";
import { Switch }  from "../components/ui/switch";
import { Button }  from "../components/ui/button";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Trash2, Package, Hotel, Package2, Globe, GlobeX, Earth } from "lucide-react";
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
import { DestinationHistorySheet } from "./DestinationHistory";
import { deleteDestination, toggleDestinationActive } from "./actions";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableFilters }    from "../components/dashboard/Tablefilters";
import { TableEmptyState } from "../components/dashboard/TableEmptyState";
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
    created_by: string | null;
    region: { id: number; name: string; slug: string };
    _count: { packages: number; hotels: number };
};

type Stats = { total: number; active: number; inactive: number; packages: number };

// ── Delete Dialog ─────────────────────────────────────────────────────────────

function DeleteDestinationDialog({ id, name, linkedCount }: {
    id: number; name: string; linkedCount: number;
}) {
    const [isPending, startTransition] = useTransition();
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [open, setOpen] = useState(false);

    function handleOpenChange(o: boolean) {
        setOpen(o);
        if (!o) setErrorMsg(null);
    }

    function handleDelete(e: React.MouseEvent) {
        e.preventDefault();
        startTransition(async () => {
            const result = await deleteDestination(id);
            if (result.success) {
                toast.success(result.message);
                setOpen(false);
            } else {
                setErrorMsg(result.message);
            }
        });
    }

    return (
        <AlertDialog open={open} onOpenChange={handleOpenChange}>
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
                        This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {errorMsg && (
                    <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
                        {errorMsg}
                    </p>
                )}

                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDelete}
                        disabled={isPending}
                        className="bg-destructive text-white hover:bg-destructive/90"
                    >
                        {isPending ? "Deleting…" : "Delete"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

// ── Main Table ────────────────────────────────────────────────────────────────

export function DestinationsTable({
    destinations,
    regions,
    totalCount,
    limit,
    stats,
    search,
    filterRegion,
    filterStatus,
    currentPage,
}: {
    destinations:  Destination[];
    regions:       Region[];
    totalCount:    number;
    limit:         number;
    stats:         Stats;
    search:        string;
    filterRegion:  string;
    filterStatus:  string;
    currentPage:   number;
}) {
    const router       = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const [localSearch, setLocalSearch] = useState(search);
    const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => { setLocalSearch(search); }, [search]);

    // ── URL helpers ────────────────────────────────────────────────────────────
    function updateParam(key: string, value: string) {
        const params = new URLSearchParams(searchParams.toString());
        if (value === "all" || value === "") {
            params.delete(key);
        } else {
            params.set(key, value);
        }
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

    // ── Toggle ─────────────────────────────────────────────────────────────────
    function handleToggle(id: number, current: boolean) {
        startTransition(async () => {
            const res = await toggleDestinationActive(id, !current);
            if (res.success) toast.success(res.message);
            else toast.error(res.message);
        });
    }

    // ── Pagination label ───────────────────────────────────────────────────────
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const from = totalCount === 0 ? 0 : (currentPage - 1) * limit + 1;
    const to   = Math.min(currentPage * limit, totalCount);
    const paginationLabel = `Showing ${from}–${to} of ${totalCount} destination${totalCount !== 1 ? "s" : ""}`;

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
            header: "Created By",
            cell: (dest) => (
                <div className="space-y-0.5">
                    <p className="text-xs font-medium text-foreground/80 truncate max-w-28">
                        {dest.created_by ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(dest.created_at), { addSuffix: true })}
                    </p>
                </div>
            ),
        },
        {
            header: "Actions",
            align: "right",
            width: "w-[100px]",
            cell: (dest) => {
                const linkedCount = dest._count.packages + dest._count.hotels;
                return (
                    <div className="flex items-center justify-end gap-1">
                        <DestinationHistorySheet id={dest.id} name={dest.name} />
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
                <StatCard label="Total Destinations"   value={stats.total}    icon={Earth}    />
                <StatCard label="Active Destinations"  value={stats.active}   icon={Globe}    />
                <StatCard label="Inactive Destinations" value={stats.inactive} icon={GlobeX}   />
                <StatCard label="Total Packages"       value={stats.packages} icon={Package2} />
            </StatGrid>

            {/* Filters + rows-per-page */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <TableFilters
                    search={localSearch}
                    onSearchChange={handleSearch}
                    searchPlaceholder="Search destinations..."
                    className="flex-1"
                    filters={[
                        {
                            value:       filterRegion,
                            onChange:    (v) => updateParam("region", v),
                            placeholder: "All Regions",
                            width:       "w-40",
                            options:     regions.map((r) => ({ label: r.name, value: String(r.id) })),
                        },
                        {
                            value:       filterStatus,
                            onChange:    (v) => updateParam("status", v),
                            placeholder: "All Statuses",
                            width:       "w-36",
                            options: [
                                { label: "Active",   value: "active"   },
                                { label: "Inactive", value: "inactive" },
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
                            <SelectItem
                                key={n}
                                value={String(n)}
                                className="text-sm text-dashboard-base-content focus:bg-dashboard-base-200 focus:text-dashboard-base-content rounded-lg cursor-pointer"
                            >
                                {n} / page
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <DataTable
                data={destinations}
                columns={columns}
                rowKey={(d) => d.id}
                emptyState={
                    <TableEmptyState
                        title="No destinations found"
                        description="Try adjusting your filters or create a new destination"
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
