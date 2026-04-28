"use client";

import { useState, useTransition } from "react";
import { useRouter }  from "next/navigation";
import { Button }   from "../../../components/ui/button";
import { Input }    from "../../../components/ui/input";
import { Label }    from "../../../components/ui/label";
import { Switch }   from "../../../components/ui/switch";
import { Badge }    from "../../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "../../../components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../components/ui/alert-dialog";
import {
  Plus, Pencil, Trash2, Loader2, Route,
  Clock, ArrowRight, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { createDuration, updateDuration, deleteDuration, type RouteOption } from "../../actions";

// ── Types ─────────────────────────────────────────────────────────────────

type Duration = {
  id:          number;
  slug:        string;
  label:       string;
  days:        number;
  nights:      number;
  thumbnail?:  string | null;
  routes:      unknown;
  is_default:  boolean;
  is_active:   boolean;
  sort_order:  number;
  meta_title:  string | null;
  meta_desc:   string | null;
  itineraries: { id: number; day: number; title: string }[];
};

// ── Route builder ─────────────────────────────────────────────────────────

function RouteBuilder({
  routes,
  onChange,
}: {
  routes:   RouteOption[];
  onChange: (routes: RouteOption[]) => void;
}) {
  function addRoute() {
    const next: RouteOption = {
      id:         routes.length,
      slug:       `route-${routes.length}`,
      label:      "",
      stops:      [{ d: 1, p: "" }],
      is_default: routes.length === 0,
    };
    onChange([...routes, next]);
  }

  function updateRoute(idx: number, updates: Partial<RouteOption>) {
    onChange(routes.map((r, i) => i === idx ? { ...r, ...updates } : r));
  }

  function removeRoute(idx: number) {
    const updated = routes
      .filter((_, i) => i !== idx)
      .map((r, i) => ({ ...r, id: i, slug: `route-${i}` }));
    onChange(updated);
  }

  function addStop(routeIdx: number) {
    updateRoute(routeIdx, { stops: [...routes[routeIdx].stops, { d: 1, p: "" }] });
  }

  function updateStop(routeIdx: number, stopIdx: number, field: "d" | "p", value: string | number) {
    const stops = routes[routeIdx].stops.map((s, i) =>
      i === stopIdx ? { ...s, [field]: field === "d" ? Number(value) : value } : s
    );
    updateRoute(routeIdx, { stops });
  }

  function removeStop(routeIdx: number, stopIdx: number) {
    updateRoute(routeIdx, { stops: routes[routeIdx].stops.filter((_, i) => i !== stopIdx) });
  }

  return (
    <div className="space-y-3">
      {routes.map((route, rIdx) => (
        <div key={rIdx} className="rounded-xl border p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">Route {rIdx + 1}</Badge>
                {route.is_default && <Badge className="text-xs">Default</Badge>}
              </div>
              <Input
                placeholder="e.g. Srinagar → Gulmarg → Pahalgam → Srinagar"
                value={route.label}
                onChange={e => updateRoute(rIdx, { label: e.target.value })}
                className="text-sm"
              />
            </div>
            <div className="flex items-center gap-2 shrink-0 mt-1">
              {!route.is_default && (
                <Button type="button" variant="outline" size="sm" className="text-xs"
                  onClick={() => onChange(routes.map((r, i) => ({ ...r, is_default: i === rIdx })))}>
                  Set Default
                </Button>
              )}
              {routes.length > 1 && (
                <Button type="button" variant="ghost" size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => removeRoute(rIdx)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Stops (place · nights)</p>
            <div className="flex flex-wrap items-center gap-2">
              {route.stops.map((stop, sIdx) => (
                <div key={sIdx} className="flex items-center gap-1.5 group">
                  {sIdx > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                  <div className="flex items-center border rounded-lg overflow-hidden bg-background">
                    <Input
                      value={stop.p}
                      onChange={e => updateStop(rIdx, sIdx, "p", e.target.value)}
                      placeholder="Place"
                      className="border-0 w-24 h-7 text-xs rounded-none focus-visible:ring-0"
                    />
                    <div className="w-px h-4 bg-border" />
                    <Input
                      type="number"
                      min="1"
                      value={stop.d}
                      onChange={e => updateStop(rIdx, sIdx, "d", e.target.value)}
                      className="border-0 w-12 h-7 text-xs rounded-none text-center focus-visible:ring-0"
                    />
                    <span className="text-[10px] text-muted-foreground pr-2">N</span>
                    {route.stops.length > 1 && (
                      <button type="button" onClick={() => removeStop(rIdx, sIdx)}
                        className="px-1.5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm"
                className="h-7 text-xs border-dashed border"
                onClick={() => addStop(rIdx)}>
                <Plus className="h-3 w-3 mr-1" /> Stop
              </Button>
            </div>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm"
        className="border-dashed w-full" onClick={addRoute}>
        <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Route
      </Button>
    </div>
  );
}

// ── Duration Form Dialog ──────────────────────────────────────────────────

function DurationDialog({
  open,
  onOpenChange,
  package_id,
  existing,
  nextSortOrder,
}: {
  open:          boolean;
  onOpenChange:  (open: boolean) => void;
  package_id:    number;
  existing?:     Duration;
  nextSortOrder: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [label,        setLabel]        = useState(existing?.label        ?? "");
  const [days,         setDays]         = useState(existing?.days         ?? 1);
  const [isDefault,    setIsDefault]    = useState(existing?.is_default   ?? false);
  const [isActive,     setIsActive]     = useState(existing?.is_active    ?? true);
  const [sortOrder,    setSortOrder]    = useState(existing?.sort_order   ?? nextSortOrder);
  const [metaTitle,    setMetaTitle]    = useState(existing?.meta_title   ?? "");
  const [metaDesc,     setMetaDesc]     = useState(existing?.meta_desc    ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(existing?.thumbnail    ?? "");

  const nights = Math.max(0, days - 1);
  const [routes,    setRoutes]    = useState<RouteOption[]>(
    existing
      ? (existing.routes || []) as any
      : [{ id: 0, slug: "route-0", label: "", stops: [{ d: 1, p: "" }], is_default: true }]
  );

  function slugify(val: string) {
    return val.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "-").trim();
  }

  async function handleSave() {
    if (!label.trim()) { toast.error("Label is required"); return; }
    if (routes.some(r => !r.label.trim())) { toast.error("All routes must have a label"); return; }

    startTransition(async () => {
      const fd = new FormData();
      fd.append("slug",          existing?.slug ?? `${slugify(label)}-${days}d`);
      fd.append("label",         label);
      fd.append("days",          String(days));
      fd.append("routes",        JSON.stringify(routes));
      fd.append("meta_title",    metaTitle);
      fd.append("meta_desc",     metaDesc);
      fd.append("is_default",    String(isDefault));
      fd.append("sort_order",    String(sortOrder));
      fd.append("is_active",     String(isActive));
      fd.append("thumbnail_url", thumbnailUrl);

      const result = existing
        ? await updateDuration(existing.id, package_id, fd)
        : await createDuration(package_id, fd);

      if (result.success) {
        toast.success(result.message);
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Duration" : "Add Duration"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label>Label</Label>
            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="6 Days / 5 Nights" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Days</Label>
              <Input
                type="number"
                min="1"
                value={days}
                onChange={e => {
                  const d = Math.max(1, Number(e.target.value));
                  setDays(d);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nights <span className="text-xs text-muted-foreground">(auto)</span></Label>
              <Input
                type="number"
                value={nights}
                readOnly
                className="bg-muted/40 cursor-not-allowed"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sort Order</Label>
              <Input type="number" min="0" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Thumbnail URL</Label>
            <Input
              value={thumbnailUrl}
              onChange={e => setThumbnailUrl(e.target.value)}
              placeholder="https://... or R2 key"
            />
            <p className="text-xs text-muted-foreground">
              Optional — displayed as the duration card image
            </p>
          </div>

          <div className="space-y-2">
            <Label>Routes</Label>
            <p className="text-xs text-muted-foreground">
              Each route can have different itineraries and pricing.
            </p>
            <RouteBuilder routes={routes} onChange={setRoutes} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Meta Title</Label>
              <Input value={metaTitle} onChange={e => setMetaTitle(e.target.value)}
                placeholder="Kashmir 6 Days | Dreams Yatri" />
            </div>
            <div className="space-y-1.5">
              <Label>Meta Description</Label>
              <Input value={metaDesc} onChange={e => setMetaDesc(e.target.value)}
                placeholder="Brief description..." />
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex items-center justify-between flex-1 rounded-lg border p-3 bg-muted/30">
              <p className="text-sm">Default Duration</p>
              <Switch checked={isDefault} onCheckedChange={setIsDefault} />
            </div>
            <div className="flex items-center justify-between flex-1 rounded-lg border p-3 bg-muted/30">
              <p className="text-sm">Active</p>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Save Duration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main DurationsTab ─────────────────────────────────────────────────────

export function DurationsTab({
  package_id,
  durations: initialDurations,
}: {
  package_id: number;
  durations:  Duration[];
}) {
  const router = useRouter();
  const [durations,  setDurations]  = useState(initialDurations);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Duration | null>(null);
  const [expanded,   setExpanded]   = useState<Set<number>>(new Set());
  const [isPending,  startTransition] = useTransition();

  function toggleExpand(id: number) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      const r = await deleteDuration(id, package_id);
      if (r.success) {
        setDurations(prev => prev.filter(d => d.id !== id));
        toast.success(r.message);
        router.refresh();
      } else {
        toast.error(r.message);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">
            {durations.length} Duration{durations.length !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Each duration can have multiple routes with their own itinerary and pricing
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Duration
        </Button>
      </div>

      {durations.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-xl">
          <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-muted-foreground">No durations yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add a duration like "6 Days / 5 Nights"</p>
        </div>
      ) : (
        <div className="space-y-3">
          {durations.map(dur => {
            const routes = Array.isArray(dur.routes) ? dur.routes as any[] : [];
            const isExp  = expanded.has(dur.id);

            return (
              <Card key={dur.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => toggleExpand(dur.id)}
                        className="flex items-center gap-2">
                        {isExp
                          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        }
                        <CardTitle className="text-sm">{dur.label}</CardTitle>
                      </button>
                      {dur.is_default && <Badge className="text-xs">Default</Badge>}
                      {!dur.is_active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {routes.length} route{routes.length !== 1 ? "s" : ""} · {dur.itineraries.length} days planned
                      </span>
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => setEditTarget(dur)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Duration</AlertDialogTitle>
                            <AlertDialogDescription>
                              Delete <strong>{dur.label}</strong>? This removes all pricing and itinerary days.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(dur.id)}
                              className="bg-destructive text-white hover:bg-destructive/90">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>

                {isExp && (
                  <CardContent className="pt-0 space-y-3">
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>{dur.days} days · {dur.nights} nights · Sort #{dur.sort_order}</span>
                    </div>
                    {routes.map((r, i) => (
                      <div key={i} className="rounded-lg border p-3 bg-muted/20 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Route className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-sm font-medium">{r.label || `Route ${i + 1}`}</p>
                          {r.is_default && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {r.stops.map((stop: any, si: number) => (
                            <span key={si} className="flex items-center gap-1 text-xs text-muted-foreground">
                              {si > 0 && <ArrowRight className="h-2.5 w-2.5" />}
                              <span className="bg-muted px-2 py-0.5 rounded">{stop.p} ({stop.d}N)</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <DurationDialog
        open={showCreate}
        onOpenChange={open => {
          setShowCreate(open);
        }}
        package_id={package_id}
        nextSortOrder={durations.length}
      />

      {editTarget && (
        <DurationDialog
          open={!!editTarget}
          onOpenChange={open => !open && setEditTarget(null)}
          package_id={package_id}
          existing={editTarget}
          nextSortOrder={durations.length}
        />
      )}
    </div>
  );
}