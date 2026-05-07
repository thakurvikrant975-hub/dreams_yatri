"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { RouteBuilderSidebar, type EditingRoute } from "./RouteBuilderSidebar";
import { type SelectableImage } from "../../components/dashboard/DBImageSelector";
import {
  handleDeleteRouteVariant,
  handleGetRouteData,
} from "@/app/actions/packages/route-builder.actions";
import {
  Plus,
  Route,
  MapPin,
  Pencil,
  Trash2,
  Loader2,
  Star,
  CalendarDays,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/app/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

type RouteStop = {
  id: number;
  place_name: string;
  place_id: string | null;
  address: string | null;
  stay_days: number;
  sort_order: number;
  latitude: number | null;
  longitude: number | null;
};

type RouteRow = {
  id: number;
  name: string;
  slug: string;
  meta_title: string | null;
  meta_desc: string | null;
  sort_order: number;
  is_active: boolean;
  stops: RouteStop[];
};

type Duration = {
  id: number;
  label: string;
  days: number;
  nights: number;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  thumbnail_url: string | null;
  routes: RouteRow[];
};

type Props = {
  packageId: number;
  initialData: Duration[];
  packageImages: SelectableImage[];
};

// ── Duration Card ──────────────────────────────────────────────────────────

function DurationCard({
  duration,
  onEdit,
  onDelete,
  deleting,
}: {
  duration: Duration;
  onEdit: (route: EditingRoute) => void;
  onDelete: (routeId: number) => void;
  deleting: number | null;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-xl border overflow-hidden">
      {/* Duration header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <CalendarDays className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">{duration.label}</span>
          {duration.is_default && (
            <Badge className="gap-1 text-[10px] px-1.5 py-0 h-4">
              <Star className="h-2.5 w-2.5" />
              Default
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {duration.routes.length} variant{duration.routes.length !== 1 ? "s" : ""}
        </span>
      </button>

      {/* Route rows */}
      {expanded && (
        <div className="divide-y">
          {duration.routes.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground italic">No routes yet</p>
          ) : (
            duration.routes.map((route) => (
              <div key={route.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20">
                <Route className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{route.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {route.stops.length} stop{route.stops.length !== 1 ? "s" : ""}
                    </span>
                    {route.stops.length > 0 && (
                      <span className="text-[11px] text-muted-foreground truncate max-w-xs">
                        {route.stops.map((s) => s.place_name).join(" → ")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() =>
                      onEdit({
                        routeId: route.id,
                        name: route.name,
                        meta_title: route.meta_title,
                        meta_desc: route.meta_desc,
                        durationId: duration.id,
                        durationLabel: duration.label,
                        durationDays: duration.days,
                        durationNights: duration.nights,
                        durationIsDefault: duration.is_default,
                        durationIsActive: duration.is_active,
                        durationSortOrder: duration.sort_order,
                        durationThumbnail: duration.thumbnail_url,
                        stops: route.stops,
                      })
                    }
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 hover:text-destructive"
                    disabled={deleting === route.id}
                    onClick={() => onDelete(route.id)}
                  >
                    {deleting === route.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Tab ───────────────────────────────────────────────────────────────

export function RouteBuilderTab({ packageId, initialData, packageImages }: Props) {
  const [data, setData] = useState<Duration[]>(initialData);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<EditingRoute | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [isDeleting, startDeleting] = useTransition();

  async function refresh() {
    const res = await handleGetRouteData(packageId);
    if (res.success) setData(res.data as Duration[]);
  }

  function openCreate() {
    setEditingRoute(null);
    setSidebarOpen(true);
  }

  function openEdit(route: EditingRoute) {
    setEditingRoute(route);
    setSidebarOpen(true);
  }

  function handleDeleteClick(routeId: number) {
    setConfirmDeleteId(routeId);
  }

  function confirmDelete() {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    setDeletingId(id);
    startDeleting(async () => {
      const res = await handleDeleteRouteVariant(id, packageId);
      setDeletingId(null);
      if (!res.success) { toast.error(res.message); return; }
      toast.success("Route deleted");
      await refresh();
    });
  }

  const totalVariants = data.reduce((s, d) => s + d.routes.length, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Route Variants</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totalVariants === 0
              ? "No variants yet — create one to define durations and routes"
              : `${data.length} duration${data.length !== 1 ? "s" : ""} · ${totalVariants} variant${totalVariants !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add Variant
        </Button>
      </div>

      {/* Duration cards */}
      {data.length > 0 ? (
        <div className="space-y-3">
          {data.map((duration) => (
            <DurationCard
              key={duration.id}
              duration={duration}
              onEdit={openEdit}
              onDelete={handleDeleteClick}
              deleting={deletingId}
            />
          ))}
        </div>
      ) : (
        <div className={cn(
          "flex flex-col items-center justify-center py-20 rounded-xl border border-dashed bg-muted/30",
        )}>
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
            <Route className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No route variants</p>
          <p className="text-xs text-muted-foreground/60 mt-1 mb-4">
            Add stops to auto-generate routes and durations
          </p>
          <Button size="sm" variant="outline" onClick={openCreate} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add First Variant
          </Button>
        </div>
      )}

      {/* Sidebar */}
      <RouteBuilderSidebar
        packageId={packageId}
        editing={editingRoute}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSaved={refresh}
        packageImages={packageImages}
      />

      {/* Delete confirm */}
      <AlertDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete route variant?</AlertDialogTitle>
            <AlertDialogDescription>
              This will also delete all stops. If this is the only route under its duration, the
              duration will be removed too.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
