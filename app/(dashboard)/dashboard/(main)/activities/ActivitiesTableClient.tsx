"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams }                  from "next/navigation";
import Link from "next/link";
import {
    Activity, Search, Trash2, Tag, Clock,
    ImageIcon, Zap, ExternalLink,
} from "lucide-react";
import { Badge }   from "../components/ui/badge";
import { Button }  from "../components/ui/button";
import { Input }   from "../components/ui/input";
import { Switch }  from "../components/ui/switch";
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
    AlertDialog, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { toast } from "sonner";
import { cn }    from "@/app/lib/utils";
import { toggleActivityActive, deleteActivity, type ActivityItem } from "./actions";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";

// ── Constants ─────────────────────────────────────────────────────────────

const CATEGORIES = [
    "Adventure", "Cultural", "Wildlife", "Water Sports",
    "Trekking", "Sightseeing", "Food & Culinary",
    "Shopping", "Spiritual", "Photography", "Other",
];

const DIFFICULTY_COLORS: Record<string, string> = {
    Easy:        "bg-green-50 text-green-700 border-green-200",
    Moderate:    "bg-blue-50 text-blue-700 border-blue-200",
    Challenging: "bg-yellow-50 text-yellow-700 border-yellow-200",
    Difficult:   "bg-orange-50 text-orange-700 border-orange-200",
    Expert:      "bg-red-50 text-red-700 border-red-200",
};

// ── Types ─────────────────────────────────────────────────────────────────

type Destination = { id: number; name: string; region: { name: string } };
type _Status     = "active" | "inactive" | "all";

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
        <img
            src={`${BASE}/${primary.thumbnail ?? primary.url}`}
            alt={activity.name}
            className="h-10 w-14 rounded-lg object-cover shrink-0 border"
        />
    );
}

// ── Main component ────────────────────────────────────────────────────────

export function ActivitiesTableClient({
    activities,
    destinations,
    totalCount,
    limit,
    currentPage,
    isFiltering,
    search,
    destination_id,
    category,
    status,
}: {
    activities:     ActivityItem[];
    destinations:   Destination[];
    totalCount:     number;
    limit:          number;
    currentPage:    number;
    isFiltering:    boolean;
    search:         string;
    destination_id: number | "all";
    category:       string;
    status:         _Status;
}) {
    const router       = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    // Debounced search
    const [localSearch, setLocalSearch] = useState(search);
    const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    useEffect(() => { setLocalSearch(search); }, [search]);

    // Delete dialog state
    const [deleteTarget, setDeleteTarget] = useState<ActivityItem | null>(null);
    const [errorMsg,     setErrorMsg]     = useState<string | null>(null);

    // ── URL helpers ───────────────────────────────────────────────────────

    function updateParam(key: string, value: string) {
        const params = new URLSearchParams(searchParams.toString());
        if (value === "all" || value === "") {
            params.delete(key);
        } else {
            params.set(key, value);
        }
        params.delete("page");
        router.push(`?${params.toString()}`);
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
    const from       = totalCount === 0 ? 0 : (currentPage - 1) * limit + 1;
    const to         = Math.min(currentPage * limit, totalCount);
    const label      = `Showing ${from}–${to} of ${totalCount} activit${totalCount !== 1 ? "ies" : "y"}`;

    // ── Columns ───────────────────────────────────────────────────────────

    const columns: ColumnDef<ActivityItem>[] = [
        {
            header: "Activity",
            width:  "w-[280px]",
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
            header: "Destination",
            cell: (a) => (
                <Badge variant="secondary" className="text-xs whitespace-nowrap">
                    {a.destination.name}
                </Badge>
            ),
        },
        {
            header: "Category",
            cell: (a) => a.category
                ? <span className="flex items-center gap-1 text-xs text-muted-foreground"><Tag className="h-3 w-3" />{a.category}</span>
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
            align:  "center",
            cell: (a) => a._count.variants > 0
                ? <span className="flex items-center justify-center gap-1 text-xs font-medium"><Zap className="h-3 w-3 text-muted-foreground" />{a._count.variants}</span>
                : <span className="text-xs text-muted-foreground">—</span>,
        },
        {
            header: "Images",
            align:  "center",
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
            align:  "center",
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
            align:  "right",
            width:  "w-[80px]",
            cell: (a) => (
                <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link href={`/dashboard/activities/${a.id}`}>
                            <ExternalLink className="h-3.5 w-3.5" />
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

            {/* Search + destination + category + status + rows-per-page */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-52 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        className="pl-9"
                        placeholder="Search activities…"
                        value={localSearch}
                        onChange={e => handleSearch(e.target.value)}
                    />
                </div>

                <Select
                    value={String(destination_id)}
                    onValueChange={v => updateParam("destination_id", v)}
                >
                    <SelectTrigger className="w-44">
                        <SelectValue placeholder="All Destinations" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Destinations</SelectItem>
                        {destinations.map(d => (
                            <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={category} onValueChange={v => updateParam("category", v)}>
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {CATEGORIES.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={status} onValueChange={v => updateParam("status", v)}>
                    <SelectTrigger className="w-36">
                        <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                </Select>

                <div className="flex items-center gap-2 ml-auto">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Rows per page</span>
                    <Select
                        value={String(limit)}
                        onValueChange={v => updateParam("limit", v)}
                    >
                        <SelectTrigger className="w-20">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="20">20</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Table */}
            {activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 border rounded-xl bg-muted/30">
                    <Activity className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">No activities found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        {isFiltering ? "Try adjusting your filters" : "Create your first activity"}
                    </p>
                </div>
            ) : (
                <DataTable
                    columns={columns}
                    data={activities}
                    rowKey={a => a.id}
                    pagination={{
                        currentPage,
                        totalPages,
                        buildHref,
                        label,
                    }}
                />
            )}

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
