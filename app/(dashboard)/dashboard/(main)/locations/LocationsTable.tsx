"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import { Button } from "../components/ui/button";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Trash2, MapPin, MapPinned, MapPinCheck, MapPinOff, Table2, Map as MapIcon } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
    AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { EditLocationDialog, type LocationRow } from "./LocationDialog";
import { HistorySheet } from "../components/dashboard/HistorySheet";
import { deleteLocation, toggleLocationActive, getLocationHistory } from "./actions";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableFilters } from "../components/dashboard/Tablefilters";
import { TableEmptyState } from "../components/dashboard/TableEmptyState";
import { StatCard, StatGrid } from "../components/dashboard/Statcard";
import { LOCATION_TYPES } from "@/app/lib/validators/locations";

const LocationsOverviewMap = dynamic(
    () => import("../components/location/LocationsOverviewMap"),
    { ssr: false, loading: () => <div className="h-[520px] w-full rounded-xl bg-muted animate-pulse" /> },
);

// ── Types ─────────────────────────────────────────────────────────────────────

type Location = LocationRow & {
    created_at: Date;
    updated_at: Date;
    linkedCount: number;
};

type Stats = { total: number; used: number; active: number; inactive: number };

// ── Delete Dialog ─────────────────────────────────────────────────────────────

function DeleteLocationDialog({ id, name }: { id: string; name: string }) {
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
            const result = await deleteLocation(id);
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
                    <AlertDialogTitle>Delete Location</AlertDialogTitle>
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

export function LocationsTable({
    locations,
    totalCount,
    limit,
    stats,
    search,
    filterType,
    filterScope,
    filterStatus,
    currentPage,
}: {
    locations: Location[];
    totalCount: number;
    limit: number;
    stats: Stats;
    search: string;
    filterType: string;
    filterScope: "used" | "all";
    filterStatus: string;
    currentPage: number;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();
    const [view, setView] = useState<"table" | "map">("table");
    const [mapEditId, setMapEditId] = useState<string | null>(null);

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

    function handleToggle(id: string, current: boolean) {
        startTransition(async () => {
            const res = await toggleLocationActive(id, !current);
            if (res.success) toast.success(res.message);
            else toast.error(res.message);
        });
    }

    // ── Pagination label ───────────────────────────────────────────────────────
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const from = totalCount === 0 ? 0 : (currentPage - 1) * limit + 1;
    const to = Math.min(currentPage * limit, totalCount);
    const paginationLabel = `Showing ${from}–${to} of ${totalCount} location${totalCount !== 1 ? "s" : ""}`;

    const mapEditLocation = locations.find((l) => l.id === mapEditId) ?? null;

    // ── Columns ────────────────────────────────────────────────────────────────
    const columns: ColumnDef<Location>[] = [
        {
            header: "Location",
            width: "w-[260px]",
            cell: (loc) => (
                <div>
                    <p className="font-medium text-sm">{loc.name}</p>
                    {loc.official_name && (
                        <p className="text-xs text-muted-foreground">{loc.official_name}</p>
                    )}
                </div>
            ),
        },
        {
            header: "Type",
            cell: (loc) => (
                <Badge variant="secondary" className="text-xs bg-dashboard-primary/10 text-dashboard-primary">
                    {loc.type.replace(/_/g, " ")}
                </Badge>
            ),
        },
        {
            header: "Slug",
            cell: (loc) => (
                <Badge variant="outline" className="font-mono text-xs text-dashboard-neutral/75 border border-dashboard-neutral/75">{loc.slug}</Badge>
            ),
        },
        {
            header: "Coordinates",
            cell: (loc) => (
                loc.latitude != null && loc.longitude != null ? (
                    <span className="text-xs text-muted-foreground tabular-nums">
                        {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                    </span>
                ) : (
                    <span className="text-xs text-muted-foreground/50">Not set</span>
                )
            ),
        },
        {
            header: "Linked",
            align: "center",
            cell: (loc) => (
                <span className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {loc.linkedCount}
                </span>
            ),
        },
        {
            header: "Status",
            align: "center",
            cell: (loc) => (
                <Switch
                    checked={loc.is_active}
                    disabled={isPending}
                    onCheckedChange={() => handleToggle(loc.id, loc.is_active)}
                />
            ),
        },
        {
            header: "Updated",
            cell: (loc) => (
                <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(loc.updated_at), { addSuffix: true })}
                </p>
            ),
        },
        {
            header: "Actions",
            align: "right",
            width: "w-[100px]",
            cell: (loc) => (
                <div className="flex items-center justify-end gap-1">
                    <HistorySheet
                        id={Number(loc.id)}
                        title={loc.name}
                        entityLabel="location"
                        fetchHistory={(id) => getLocationHistory(String(id))}
                    />
                    <EditLocationDialog location={loc} />
                    <DeleteLocationDialog id={loc.id} name={loc.name} />
                </div>
            ),
        },
    ];

    const mapPoints = locations
        .filter((l) => l.latitude != null && l.longitude != null)
        .map((l) => ({ id: l.id, name: l.name, type: l.type, latitude: l.latitude as number, longitude: l.longitude as number }));

    return (
        <div className="space-y-4">

            <StatGrid cols={4}>
                <StatCard label="Total Locations (all data)" value={stats.total} icon={MapPinned} />
                <StatCard label="In Use" value={stats.used} icon={MapPinCheck} />
                <StatCard label="Active" value={stats.active} icon={MapPin} />
                <StatCard label="Inactive" value={stats.inactive} icon={MapPinOff} />
            </StatGrid>

            {/* Filters + rows-per-page + view toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <TableFilters
                    search={localSearch}
                    onSearchChange={handleSearch}
                    searchPlaceholder="Search locations..."
                    className="flex-1"
                    filters={[
                        {
                            value: filterScope,
                            onChange: (v) => updateParam("scope", v),
                            placeholder: "My Locations",
                            width: "w-44",
                            allValue: "used",
                            options: [{ label: "All locations (incl. world data)", value: "all" }],
                        },
                        {
                            value: filterType,
                            onChange: (v) => updateParam("type", v),
                            placeholder: "All Types",
                            width: "w-40",
                            options: LOCATION_TYPES.map((t) => ({ label: t.replace(/_/g, " "), value: t })),
                        },
                        {
                            value: filterStatus,
                            onChange: (v) => updateParam("status", v),
                            placeholder: "All Statuses",
                            width: "w-36",
                            options: [
                                { label: "Active", value: "active" },
                                { label: "Inactive", value: "inactive" },
                            ],
                        },
                    ]}
                />

                <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center rounded-lg border border-dashboard-base-300 overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setView("table")}
                            className={`flex items-center gap-1.5 px-3 h-10 text-sm transition-colors cursor-pointer ${view === "table" ? "bg-dashboard-primary text-dashboard-primary-content" : "bg-dashboard-base-100 text-dashboard-base-content/70 hover:bg-dashboard-base-200"}`}
                        >
                            <Table2 className="h-3.5 w-3.5" /> Table
                        </button>
                        <button
                            type="button"
                            onClick={() => setView("map")}
                            className={`flex items-center gap-1.5 px-3 h-10 text-sm transition-colors cursor-pointer ${view === "map" ? "bg-dashboard-primary text-dashboard-primary-content" : "bg-dashboard-base-100 text-dashboard-base-content/70 hover:bg-dashboard-base-200"}`}
                        >
                            <MapIcon className="h-3.5 w-3.5" /> Map
                        </button>
                    </div>

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
            </div>

            {view === "table" ? (
                <DataTable
                    data={locations}
                    columns={columns}
                    rowKey={(l) => l.id}
                    emptyState={
                        <TableEmptyState
                            title="No locations found"
                            description="Try adjusting your filters, or switch to 'All locations' to search the full dataset"
                        />
                    }
                    pagination={{
                        currentPage,
                        totalPages,
                        buildHref,
                        label: paginationLabel,
                    }}
                />
            ) : (
                <div className="space-y-2">
                    <div className="h-[520px] rounded-xl border border-dashboard-base-300 overflow-hidden">
                        <LocationsOverviewMap points={mapPoints} onEdit={setMapEditId} />
                    </div>
                    <p className="text-xs text-dashboard-base-content/60">
                        Showing {mapPoints.length} of {locations.length} locations on this page that have coordinates. Use the filters above or pagination to see more.
                    </p>
                </div>
            )}

            {mapEditLocation && (
                <EditLocationDialog
                    location={mapEditLocation}
                    open={!!mapEditId}
                    onOpenChange={(o) => !o && setMapEditId(null)}
                    hideTrigger
                />
            )}
        </div>
    );
}
