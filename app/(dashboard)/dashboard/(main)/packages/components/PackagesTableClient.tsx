"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import {
    ExternalLink, ImageIcon, MapPin, Package,
    Pencil, Route, Timer, Trash2,
} from "lucide-react";
import { Badge }  from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Switch } from "../../components/ui/switch";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
    AlertDialogTrigger,
} from "../../components/ui/alert-dialog";
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from "../../components/ui/select";
import { DataTable, type ColumnDef } from "../../components/dashboard/Datatable";
import { TableFilters }    from "../../components/dashboard/Tablefilters";
import { TableEmptyState } from "../../components/dashboard/TableEmptyState";
import Image from "next/image";
import { toast } from "sonner";
import { togglePackageActive, deletePackage } from "../actions";

// ── Types ─────────────────────────────────────────────────────────────────

type PackageItem = {
    id:        number;
    title:     string;
    slug:      string;
    thumbnail: string | null;
    is_active: boolean;
    destination: {
        id:     number;
        name:   string;
        region: { name: string } | null;
    };
    _count: {
        durations:     number;
        packageRoutes: number;
        gallery:       number;
    };
    durations:        { slug: string; routes: { slug: string }[] }[];
    stay_categories:  { slug: string }[];
};

// ── Helpers ───────────────────────────────────────────────────────────────

function getWebsiteUrl(pkg: PackageItem): string | null {
    const dur   = pkg.durations[0];
    const stay  = pkg.stay_categories[0];
    const route = dur?.routes[0];
    if (!dur || !route || !stay) return null;
    return `/packages/${pkg.slug}/${dur.slug}/${route.slug}/${stay.slug}`;
}

const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

// ── Component ─────────────────────────────────────────────────────────────

export function PackagesTableClient({ packages }: { packages: PackageItem[] }) {
    const [isPending, startTransition] = useTransition();
    const [page,        setPage]        = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(20);
    const [search,      setSearch]      = useState("");
    const [status,      setStatus]      = useState<"active" | "inactive" | "all">("all");

    // ── Client-side filter ────────────────────────────────────────────────

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return packages.filter(pkg => {
            const matchesSearch = !q
                || pkg.title.toLowerCase().includes(q)
                || pkg.slug.toLowerCase().includes(q)
                || pkg.destination.name.toLowerCase().includes(q)
                || (pkg.destination.region?.name.toLowerCase().includes(q) ?? false);
            const matchesStatus =
                status === "all"      ? true :
                status === "active"   ? pkg.is_active :
                                        !pkg.is_active;
            return matchesSearch && matchesStatus;
        });
    }, [packages, search, status]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
    const safePage   = Math.min(page, totalPages);

    // ── Actions ───────────────────────────────────────────────────────────

    function handleToggle(id: number, current: boolean) {
        startTransition(async () => {
            const result = await togglePackageActive(id, !current);
            if (result.success) toast.success(`Package ${!current ? "activated" : "deactivated"}`);
            else toast.error(result.message ?? "Failed to update package status");
        });
    }

    function handleDelete(id: number) {
        startTransition(async () => {
            const result = await deletePackage(id);
            if (result.success) toast.success(result.message);
            else toast.error(result.message);
        });
    }

    // ── Columns ───────────────────────────────────────────────────────────

    const columns: ColumnDef<PackageItem>[] = [
        {
            header: "Package",
            width:  "w-[280px]",
            cell: (pkg) => (
                <div className="flex items-center gap-3">
                    {pkg.thumbnail ? (
                        <Image
                            src={`${base}/${pkg.thumbnail}`}
                            alt={pkg.title}
                            width={64}
                            height={48}
                            className="h-12 w-16 rounded-lg object-cover shrink-0 border"
                        />
                    ) : (
                        <div className="h-12 w-16 rounded-lg bg-muted border flex items-center justify-center shrink-0">
                            <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                    )}
                    <div className="min-w-0">
                        <p className="font-medium text-sm truncate max-w-44">{pkg.title}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-44">{pkg.slug}</p>
                    </div>
                </div>
            ),
        },
        {
            header: "Destination",
            cell: (pkg) => (
                <div className="space-y-0.5">
                    <Badge variant="secondary" className="text-xs font-normal bg-dashboard-primary/10 text-dashboard-primary">
                        {pkg.destination.name}
                    </Badge>
                    {pkg.destination.region && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {pkg.destination.region.name}
                        </div>
                    )}
                </div>
            ),
        },
        {
            header: "Durations",
            align:  "center",
            width:  "w-[100px]",
            cell: (pkg) => (
                <div className="flex items-center justify-center gap-1 text-sm">
                    <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{pkg._count.durations}</span>
                </div>
            ),
        },
        {
            header: "Routes",
            align:  "center",
            width:  "w-[100px]",
            cell: (pkg) => (
                <div className="flex items-center justify-center gap-1 text-sm">
                    <Route className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{pkg._count.packageRoutes}</span>
                </div>
            ),
        },
        {
            header: "Images",
            align:  "center",
            width:  "w-[100px]",
            cell: (pkg) => (
                <div className="flex items-center justify-center gap-1 text-sm">
                    <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{pkg._count.gallery}</span>
                </div>
            ),
        },
        {
            header: "Status",
            align:  "center",
            width:  "w-[90px]",
            cell: (pkg) => (
                <Switch
                    checked={pkg.is_active}
                    disabled={isPending}
                    onCheckedChange={() => handleToggle(pkg.id, pkg.is_active)}
                    onClick={e => e.stopPropagation()}
                />
            ),
        },
        {
            header: "Website URL",
            width:  "w-[180px]",
            cell: (pkg) => {
                if (!pkg.is_active) return <span className="text-xs text-muted-foreground">—</span>;
                const url = getWebsiteUrl(pkg);
                return url ? (
                    <Link
                        href={url}
                        target="_blank"
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1 text-xs text-dashboard-primary hover:underline truncate max-w-[160px]"
                    >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="truncate">{url}</span>
                    </Link>
                ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                );
            },
        },
        {
            header: "Actions",
            align:  "right",
            width:  "w-[100px]",
            cell: (pkg) => (
                <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link href={`/dashboard/packages/${pkg.id}`} onClick={e => e.stopPropagation()}>
                            <Pencil className="h-3.5 w-3.5" />
                        </Link>
                    </Button>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="ghost" size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={e => e.stopPropagation()}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete Package</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Delete <span className="font-semibold">{pkg.title}</span>? This will
                                    permanently remove the package along with all its durations, routes,
                                    itineraries, gallery, and pricing.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={() => handleDelete(pkg.id)}
                                    disabled={isPending}
                                    className="bg-destructive text-white hover:bg-destructive/90"
                                >
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            ),
        },
    ];

    // ── Pagination label ──────────────────────────────────────────────────

    const from  = filtered.length === 0 ? 0 : (safePage - 1) * rowsPerPage + 1;
    const to    = Math.min(safePage * rowsPerPage, filtered.length);
    const label = `Showing ${from}–${to} of ${filtered.length} package${filtered.length !== 1 ? "s" : ""}`;

    // ── Render ────────────────────────────────────────────────────────────

    return (
        <div className="space-y-4">
            {/* Filters + rows-per-page */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <TableFilters
                    search={search}
                    onSearchChange={(v) => { setSearch(v); setPage(1); }}
                    searchPlaceholder="Search packages…"
                    filteredCount={filtered.length}
                    totalCount={packages.length}
                    className="flex-1"
                    filters={[
                        {
                            value:       status,
                            onChange:    (v) => { setStatus(v as typeof status); setPage(1); },
                            placeholder: "All Statuses",
                            width:       "w-38",
                            options: [
                                { label: "Active",   value: "active"   },
                                { label: "Inactive", value: "inactive" },
                            ],
                        },
                    ]}
                />

                {/* Rows-per-page selector */}
                <Select
                    value={String(rowsPerPage)}
                    onValueChange={(v) => { setRowsPerPage(Number(v)); setPage(1); }}
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
                data={filtered.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage)}
                columns={columns}
                rowKey={pkg => pkg.id}
                emptyState={
                    <TableEmptyState
                        title="No packages found"
                        description={search || status !== "all" ? "Try adjusting your filters" : "Click \"+ New Package\" to get started"}
                    />
                }
                pagination={totalPages > 1 ? {
                    currentPage: safePage,
                    totalPages,
                    onPageChange: setPage,
                    label,
                } : undefined}
            />
        </div>
    );
}
