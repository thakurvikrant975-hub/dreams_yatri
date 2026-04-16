"use client";

import { useState, useTransition } from "react";
import {
  Activity, Search, Pencil, Trash2, Tag,
  Clock, Users, ImageIcon,
} from "lucide-react";
import { Badge }   from "../components/ui/badge";
import { Button }  from "../components/ui/button";
import { Input }   from "../components/ui/input";
import { Switch }  from "../components/ui/switch";
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { toast } from "sonner";
import { toggleActivityActive, deleteActivity, type ActivityItem } from "./actions";
import { EditActivityDialog }   from "./ActivityDialog";
import { ActivityImagesSheet }  from "./ActivityImagesSheet";

// ── Types ─────────────────────────────────────────────────────────────────

type Destination = { id: number; name: string; region: { name: string } };

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy:        "bg-green-50 text-green-700 border-green-200",
  Moderate:    "bg-blue-50 text-blue-700 border-blue-200",
  Challenging: "bg-yellow-50 text-yellow-700 border-yellow-200",
  Difficult:   "bg-orange-50 text-orange-700 border-orange-200",
  Expert:      "bg-red-50 text-red-700 border-red-200",
};

// ── Delete Dialog (extracted — fixes Radix hydration mismatch) ────────────────

function DeleteActivityDialog({
    activity,
    onDelete,
    isPending,
}: {
    activity: ActivityItem;
    onDelete: (id: number) => void;
    isPending: boolean;
}) {
    const isBlocked = activity._count.packages > 0;

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
                    <AlertDialogTitle>Delete Activity</AlertDialogTitle>
                    <AlertDialogDescription>
                        Delete <span className="font-semibold">{activity.name}</span>?
                        This also removes all its images.
                        {isBlocked && (
                            <span className="block mt-2 font-medium text-destructive">
                                ⚠ Used in {activity._count.packages} package(s). Remove from packages first.
                            </span>
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={() => onDelete(activity.id)}
                        disabled={isBlocked || isPending}
                        className="bg-destructive text-white hover:bg-destructive/90"
                    >
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

const BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

// ── Stat card ─────────────────────────────────────────────────────────────

function StatCard({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="rounded-xl bg-muted/50 px-4 py-3 space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold ${muted ? "text-muted-foreground" : ""}`}>{value}</p>
    </div>
  );
}

// ── Thumbnail cell ────────────────────────────────────────────────────────

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
  activities:   initialActivities,
  destinations,
}: {
  activities:   ActivityItem[];
  destinations: Destination[];
}) {
  const [activities,        setActivities]        = useState(initialActivities);
  const [search,            setSearch]            = useState("");
  const [filterDestination, setFilterDestination] = useState("all");
  const [filterCategory,    setFilterCategory]    = useState("all");
  const [editTarget,        setEditTarget]        = useState<ActivityItem | null>(null);
  const [imagesTarget,      setImagesTarget]      = useState<ActivityItem | null>(null);
  const [isPending,         startTransition]      = useTransition();

  // ── Derived ───────────────────────────────────────────────────────────────

  const filtered = activities.filter(a => {
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase());
    const matchDest   = filterDestination === "all" || String(a.destination.id) === filterDestination;
    const matchCat    = filterCategory    === "all" || a.category === filterCategory;
    return matchSearch && matchDest && matchCat;
  });

  const activeCount = activities.filter(a => a.is_active).length;
  const categories  = [...new Set(activities.map(a => a.category).filter(Boolean))] as string[];

  // ── Actions ───────────────────────────────────────────────────────────────

  function handleToggle(id: number, current: boolean) {
    startTransition(async () => {
      await toggleActivityActive(id, !current);
      setActivities(prev =>
        prev.map(a => a.id === id ? { ...a, is_active: !current } : a)
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Activities" value={activities.length} />
        <StatCard label="Active"           value={activeCount} />
        <StatCard label="Inactive"         value={activities.length - activeCount} muted />
        <StatCard label="In Packages"      value={activities.reduce((acc, a) => acc + a._count.packages, 0)} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search activities..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={filterDestination} onValueChange={setFilterDestination}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All destinations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Destinations</SelectItem>
            {destinations.map(d => (
              <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <p className="text-sm text-muted-foreground ml-auto">
          {filtered.length} of {activities.length}
        </p>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border rounded-xl bg-muted/30">
          <Activity className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No activities found</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[300px]">Activity</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Difficulty</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Price</TableHead>
                <TableHead className="text-center">Images</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(activity => {
                const price    = activity.price ? `₹${activity.price.toLocaleString()}` : null;
                const duration = activity.duration_hours ? `${activity.duration_hours}h` : null;

                return (
                  <TableRow key={activity.id} className="hover:bg-muted/30">

                    {/* Activity + thumbnail */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <ThumbnailCell activity={activity} />
                        <div>
                          <p className="font-medium text-sm">{activity.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">
                            {activity.slug}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {activity.destination.name}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      {activity.category ? (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Tag className="h-3 w-3" />
                          {activity.category}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>

                    <TableCell>
                      {activity.difficulty ? (
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${DIFFICULTY_COLORS[activity.difficulty] ?? "bg-muted text-muted-foreground"}`}>
                          {activity.difficulty}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>

                    <TableCell>
                      {duration ? (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {duration}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>

                    <TableCell>
                      {price ? (
                        <div>
                          <p className="text-sm font-medium">{price}</p>
                          {activity.pricing_type && (
                            <p className="text-[11px] text-muted-foreground capitalize">
                              {activity.pricing_type.replace("_", " ")}
                            </p>
                          )}
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>

                    {/* Images — clickable to open sheet */}
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 gap-1 text-xs"
                        onClick={() => setImagesTarget(activity)}
                      >
                        <ImageIcon className="h-3 w-3" />
                        {activity._count.images}
                      </Button>
                    </TableCell>

                    <TableCell className="text-center">
                      <Switch
                        checked={activity.is_active}
                        disabled={isPending}
                        onCheckedChange={() => handleToggle(activity.id, activity.is_active)}
                      />
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setEditTarget(activity)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
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
                                All images will be removed from R2.
                                {activity._count.packages > 0 && (
                                  <span className="block mt-2 text-destructive font-medium">
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
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit dialog */}
      {editTarget && (
        <EditActivityDialog
          activity={editTarget}
          destinations={destinations}
          open={!!editTarget}
          onOpenChange={open => !open && setEditTarget(null)}
        />
      )}

      {/* Images sheet */}
      {imagesTarget && (
        <ActivityImagesSheet
          activity={imagesTarget}
          open={!!imagesTarget}
          onOpenChange={open => !open && setImagesTarget(null)}
        />
      )}
    </div>
  );
}