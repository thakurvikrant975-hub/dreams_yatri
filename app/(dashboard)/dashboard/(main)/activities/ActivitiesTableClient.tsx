"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
    Trash2, Clock,
    ImageIcon, Zap,
    Pencil,
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from "../components/ui/select";
import { TableFilters } from "../components/dashboard/Tablefilters";
import { TableEmptyState } from "../components/dashboard/TableEmptyState";
import {
    AlertDialog, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog";
import Image from "next/image";
import { toast } from "sonner";
import { cn } from "@/app/lib/utils";
import { toggleActivityActive, deleteActivity, type ActivityItem } from "./actions";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";

// ── Constants ─────────────────────────────────────────────────────────────

const DIFFICULTY_COLORS: Record<string, string> = {
    Easy: "bg-green-50 text-green-700 border-green-200",
    Moderate: "bg-blue-50 text-blue-700 border-blue-200",
    Challenging: "bg-yellow-50 text-yellow-700 border-yellow-200",
    Difficult: "bg-orange-50 text-orange-700 border-orange-200",
    Expert: "bg-red-50 text-red-700 border-red-200",
};

// ── Types ─────────────────────────────────────────────────────────────────

type CategoryOption = { id: number; name: string; slug: string };
type _Status = "active" | "inactive" | "all";

// ── Thumbnail ─────────────────────────────────────────────────────────────

const BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

function ThumbnailCell({ activity }: { activity: ActivityItem }) {
    const primary = activity.images.find(i => i.is_primary) ?? activity.images[0];
    if (!primary) {
        return (
            <div className="h-10 w-14 rounded-lg bg-muted border flex items-center justify-center shrink-0">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
            </div>
        );
    }
    return (
        <Image
            src={`${BASE}/${primary.thumbnail ?? primary.url}`}
            alt={activity.name}
            width={56}
            height={40}
            className="h-10 w-14 rounded-lg object-cover shrink-0 border"
        />
    );
}

// ── Main component ────────────────────────────────────────────────────────

export function ActivitiesTableClient({
    activities,
    categories,
    totalCount,
    limit,
    currentPage,
    isFiltering,
    search,
    category_id,
    status,
}: {
    activities: ActivityItem[];
    categories: CategoryOption[];
    totalCount: number;
    limit: number;
    currentPage: number;
    isFiltering: boolean;
    search: string;
    category_id: number | "all";
    status: _Status;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    // Debounced search
    const [localSearch, setLocalSearch] = useState(search);
    const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    useEffect(() => { setLocalSearch(search); }, [search]);

    // Delete dialog state
    const [deleteTarget, setDeleteTarget] = useState<ActivityItem | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // ── URL helpers ───────────────────────────────────────────────────────

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

    // ── Actions ───────────────────────────────────────────────────────────

    function handleToggle(id: number, current: boolean) {
        startTransition(async () => {
            const result = await toggleActivityActive(id, !current);
            if (result.success) toast.success(result.message);
            else toast.error(result.message);
        });
    }

    function openDelete(activity: ActivityItem) {
        setDeleteTarget(activity);
        setErrorMsg(null);
    }

    function closeDelete() {
        setDeleteTarget(null);
        setErrorMsg(null);
    }

    function handleDelete() {
        if (!deleteTarget) return;
        startTransition(async () => {
            const result = await deleteActivity(deleteTarget.id);
            if (result.success) {
                toast.success(result.message);
                closeDelete();
            } else {
                setErrorMsg(result.message);
            }
        });
    }

    // ── Pagination ────────────────────────────────────────────────────────

    const totalPages = Math.ceil(totalCount / limit);
    const from = totalCount === 0 ? 0 : (currentPage - 1) * limit + 1;
    const to = Math.min(currentPage * limit, totalCount);
    const label = `Showing ${from}–${to} of ${totalCount} activit${totalCount !== 1 ? "ies" : "y"}`;

    // ── Columns ───────────────────────────────────────────────────────────

    const columns: ColumnDef<ActivityItem>[] = [
        {
            header: "Activity",
            width: "w-[280px]",
            cell: (a) => (
                <div className="flex items-center gap-3">
                    <ThumbnailCell activity={a} />
                    <div className="min-w-0">
                        <p className="font-medium text-sm truncate max-w-45">{a.name}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-45">{a.slug}</p>
                    </div>
                </div>
            ),
        },
        {
            header: "Category",
            cell: (a) => a.category
                ? <Badge variant="outline" className="text-xs whitespace-nowrap">{a.category.name}</Badge>
                : <span className="text-xs text-muted-foreground">—</span>,
        },
        {
            header: "Difficulty",
            cell: (a) => a.difficulty
                ? <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded border", DIFFICULTY_COLORS[a.difficulty] ?? "bg-muted text-muted-foreground")}>{a.difficulty}</span>
                : <span className="text-xs text-muted-foreground">—</span>,
        },
        {
            header: "Duration",
            cell: (a) => a.duration_hours
                ? <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{a.duration_hours}h</span>
                : <span className="text-xs text-muted-foreground">—</span>,
        },
        {
            header: "Variants",
            align: "center",
            cell: (a) => a._count.variants > 0
                ? <span className="flex items-center justify-center gap-1 text-xs font-medium"><Zap className="h-3 w-3 text-muted-foreground" />{a._count.variants}</span>
                : <span className="text-xs text-muted-foreground">—</span>,
        },
        {
            header: "Images",
            align: "center",
            cell: (a) => (
                <Link
                    href={`/dashboard/activities/${a.id}`}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ImageIcon className="h-3 w-3" />
                    {a._count.images}
                </Link>
            ),
        },
        {
            header: "Status",
            align: "center",
            cell: (a) => (
                <Switch
                    checked={a.is_active}
                    disabled={isPending}
                    onCheckedChange={() => handleToggle(a.id, a.is_active)}
                />
            ),
        },
        {
            header: "Actions",
            align: "right",
            width: "w-[80px]",
            cell: (a) => (
                <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link href={`/dashboard/activities/${a.id}`}>
                            <Pencil className="h-3.5 w-3.5" />
                        </Link>
                    </Button>
                    <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => openDelete(a)}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
        },
    ];

    // ── Render ────────────────────────────────────────────────────────────

    return (
        <div className="space-y-4">

            {/* Filters + rows-per-page */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <TableFilters
                    search={localSearch}
                    onSearchChange={handleSearch}
                    searchPlaceholder="Search activities…"
                    className="flex-1"
                    filters={[
                        {
                            value: String(category_id),
                            onChange: (v) => updateParam("category_id", v),
                            placeholder: "All Categories",
                            width: "w-44",
                            options: categories.map(c => ({ label: c.name, value: String(c.id) })),
                        },
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

                <Select
                    value={String(limit)}
                    onValueChange={(v) => updateParam("limit", v)}
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

            {/* Table */}
            <DataTable
                columns={columns}
                data={activities}
                rowKey={a => a.id}
                emptyState={
                    <TableEmptyState
                        title="No activities found"
                        description={isFiltering ? "Try adjusting your filters" : "Create your first activity to get started"}
                    />
                }
                pagination={{
                    currentPage,
                    totalPages,
                    buildHref,
                    label,
                }}
            />

            {/* Delete dialog — controlled, stays open on error */}
            <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && closeDelete()}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Activity</AlertDialogTitle>
                        <AlertDialogDescription>
                            Delete <span className="font-semibold">{deleteTarget?.name}</span>?
                            All images, variants, and add-ons will be permanently removed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {errorMsg && (
                        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                            {errorMsg}
                        </p>
                    )}

                    {(deleteTarget?._count.variants ?? 0) > 0 && !errorMsg && (
                        <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            ⚠ This activity has {deleteTarget?._count.variants} variant{(deleteTarget?._count.variants ?? 0) !== 1 ? "s" : ""} — all will be deleted.
                        </p>
                    )}

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                        <Button
                            variant="destructive"
                            disabled={isPending}
                            onClick={handleDelete}
                        >
                            {isPending ? "Deleting…" : "Delete"}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
