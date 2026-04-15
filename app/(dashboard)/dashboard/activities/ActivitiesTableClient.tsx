"use client";

import { useState, useTransition } from "react";
import { Badge }  from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
    AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import {
    Activity, Pencil, Trash2,
    Clock, Users, Tag,
} from "lucide-react";
import { toast } from "sonner";
import { toggleActivityActive, deleteActivity } from "./actions";
import { EditActivityDialog }  from "./ActivityDialog";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableFilters } from "../components/dashboard/Tablefilters";
import { Stats }               from "../components/dashboard/Stats";

// ── Types ─────────────────────────────────────────────────────────────────────

type ActivityItem = {
    id:                number;
    name:              string;
    slug:              string;
    description:       string | null;
    meta_title:        string | null;
    meta_desc:         string | null;
    category:          string | null;
    difficulty:        string | null;
    duration_hours:    number | null;
    price:             number | null;
    original_price:    number | null;
    margin_percentage: number;
    pricing_type:      string | null;
    min_persons:       number | null;
    max_persons:       number | null;
    is_active:         boolean;
    created_at:        Date;
    destination:       { id: number; name: string };
    _count:            { images: number; packages: number };
};

type Destination = { id: number; name: string; region: { name: string } };

const DIFFICULTY_COLORS: Record<string, string> = {
    Easy:        "bg-green-50 text-green-700 border-green-200",
    Moderate:    "bg-blue-50 text-blue-700 border-blue-200",
    Challenging: "bg-yellow-50 text-yellow-700 border-yellow-200",
    Difficult:   "bg-orange-50 text-orange-700 border-orange-200",
    Expert:      "bg-red-50 text-red-700 border-red-200",
};

// ── Main Component ────────────────────────────────────────────────────────────

export function ActivitiesTableClient({
    activities: initialActivities,
    destinations,
}: {
    activities:   ActivityItem[];
    destinations: Destination[];
}) {
    const [activities,         setActivities]         = useState(initialActivities);
    const [search,             setSearch]             = useState("");
    const [filterDestination,  setFilterDestination]  = useState("all");
    const [filterCategory,     setFilterCategory]     = useState("all");
    const [editTarget,         setEditTarget]         = useState<ActivityItem | null>(null);
    const [isPending,          startTransition]       = useTransition();

    // ── Derived ───────────────────────────────────────────────────────────────
    const categories = [...new Set(activities.map(a => a.category).filter(Boolean))] as string[];

    const filtered = activities.filter(a => {
        const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase());
        const matchDest   = filterDestination === "all" || String(a.destination.id) === filterDestination;
        const matchCat    = filterCategory    === "all" || a.category === filterCategory;
        return matchSearch && matchDest && matchCat;
    });

    const activeCount = activities.filter(a => a.is_active).length;

    // ── Actions ───────────────────────────────────────────────────────────────
    function handleToggle(id: number, current: boolean) {
        startTransition(async () => {
            await toggleActivityActive(id, !current);
            setActivities(prev =>
                prev.map(a => a.id === id ? { ...a, is_active: !current } : a),
            );
            toast.success(`Activity ${!current ? "activated" : "deactivated"}`);
        });
    }

    function handleDelete(id: number) {
        startTransition(async () => {
            const result = await deleteActivity(id);
            if (result.success) {
                setActivities(prev => prev.filter(a => a.id !== id));
                toast.success(result.message);
            } else {
                toast.error(result.message);
            }
        });
    }

    // ── Column definitions ────────────────────────────────────────────────────
    const columns: ColumnDef<ActivityItem>[] = [
        {
            header: "Activity",
            width:  "w-[280px]",
            cell: (activity) => (
                <div>
                    <p className="font-medium text-sm text-foreground">{activity.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[240px]">
                        {activity.slug}
                    </p>
                </div>
            ),
        },
        {
            header: "Destination",
            cell: (activity) => (
                <Badge variant="secondary" className="text-xs">
                    {activity.destination.name}
                </Badge>
            ),
        },
        {
            header: "Category",
            cell: (activity) =>
                activity.category ? (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Tag className="h-3 w-3" />
                        {activity.category}
                    </span>
                ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                ),
        },
        {
            header: "Difficulty",
            cell: (activity) =>
                activity.difficulty ? (
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${DIFFICULTY_COLORS[activity.difficulty] ?? "bg-muted text-muted-foreground"}`}>
                        {activity.difficulty}
                    </span>
                ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                ),
        },
        {
            header: "Duration",
            cell: (activity) =>
                activity.duration_hours ? (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {activity.duration_hours}h
                    </span>
                ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                ),
        },
        {
            header: "Price",
            cell: (activity) =>
                activity.price ? (
                    <div>
                        <p className="text-sm font-medium text-foreground">
                            ₹{activity.price.toLocaleString()}
                        </p>
                        {activity.pricing_type && (
                            <p className="text-[11px] text-muted-foreground">
                                {activity.pricing_type.replace("_", " ")}
                            </p>
                        )}
                    </div>
                ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                ),
        },
        {
            header: "Packages",
            align:  "center",
            cell: (activity) =>
                activity._count.packages > 0 ? (
                    <span className="flex items-center justify-center gap-1 text-xs">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        {activity._count.packages}
                    </span>
                ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                ),
        },
        {
            header: "Status",
            align:  "center",
            cell: (activity) => (
                <Switch
                    checked={activity.is_active}
                    disabled={isPending}
                    onCheckedChange={() => handleToggle(activity.id, activity.is_active)}
                />
            ),
        },
        {
            header: "Actions",
            align:  "right",
            width:  "w-[90px]",
            cell: (activity) => (
                <div className="flex items-center justify-end gap-1">
                    <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditTarget(activity)}
                    >
                        <Pencil className="h-3.5 w-3.5" />
                    </Button>

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
                                <AlertDialogTitle>Delete Activity</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Delete <span className="font-semibold">{activity.name}</span>?
                                    This also removes all its images.
                                    {activity._count.packages > 0 && (
                                        <span className="block mt-2 font-medium text-destructive">
                                            ⚠ Used in {activity._count.packages} package(s). Remove from packages first.
                                        </span>
                                    )}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={() => handleDelete(activity.id)}
                                    disabled={activity._count.packages > 0 || isPending}
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

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">

            {/* Stats */}
            <Stats
                rows={[
                    { label: "Total Activities", value: activities.length },
                    { label: "Active",            value: activeCount },
                    { label: "Inactive",          value: activities.length - activeCount, muted: true },
                    { label: "In Packages",       value: activities.reduce((acc, a) => acc + a._count.packages, 0) },
                ]}
            />

            {/* Filters */}
            <TableFilters
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search activities..."
                filteredCount={filtered.length}
                totalCount={activities.length}
                filters={[
                    {
                        value:       filterDestination,
                        onChange:    setFilterDestination,
                        placeholder: "All Destinations",
                        width:       "w-44",
                        options:     destinations.map(d => ({
                            label: d.name,
                            value: String(d.id),
                        })),
                    },
                    {
                        value:       filterCategory,
                        onChange:    setFilterCategory,
                        placeholder: "All Categories",
                        width:       "w-36",
                        options:     categories.map(c => ({ label: c, value: c })),
                    },
                ]}
            />

            {/* Table */}
            <DataTable
                data={filtered}
                columns={columns}
                rowKey={(a) => a.id}
                emptyState={
                    <div className="flex flex-col items-center gap-2">
                        <Activity className="h-10 w-10 text-muted-foreground" />
                        <p className="text-sm font-medium text-muted-foreground">No activities found</p>
                        <p className="text-xs text-muted-foreground">Try adjusting your filters</p>
                    </div>
                }
            />

            {/* Edit Dialog */}
            {editTarget && (
                <EditActivityDialog
                    activity={editTarget}
                    destinations={destinations}
                    open={!!editTarget}
                    onOpenChange={(open) => !open && setEditTarget(null)}
                />
            )}
        </div>
    );
}