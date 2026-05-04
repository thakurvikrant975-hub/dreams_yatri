"use client";

import { useState, useTransition } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Switch } from "../../../components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../../../components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../components/ui/alert-dialog";
import { Plus, X, Loader2, Route, MapPin, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import {
  createRouteAction,
  updateRouteAction,
  deleteRouteAction,
} from "@/app/actions/packages/package.actions";
import type { PackageDuration, RouteWithStops } from "@/app/types/packages";

type Destination = { id: number; name: string; slug: string; region: { name: string } };

type Props = {
  packageId: number;
  durations: PackageDuration[];
  routes: RouteWithStops[];
  destinations: Destination[];
};

type StopForm = {
  destination_id: string;
  stay_days: string;
  sort_order: number;
};

type RouteForm = {
  duration_id: string;
  name: string;
  slug: string;
  is_active: boolean;
  stops: StopForm[];
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}


export function RoutesTab({ packageId, durations, routes: initRoutes, destinations }: Props) {
  const [routes, setRoutes] = useState(initRoutes);
  const [expandedRoute, setExpandedRoute] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [slugEdited, setSlugEdited] = useState(false);
  const [form, setForm] = useState<RouteForm>({
    duration_id: durations[0]?.id ? String(durations[0].id) : "",
    name: "",
    slug: "",
    is_active: true,
    stops: [
      { destination_id: "", stay_days: "1", sort_order: 0 },
      { destination_id: "", stay_days: "1", sort_order: 1 },
    ],
  });
  const [isPending, startTransition] = useTransition();

  function handleNameChange(val: string) {
    setForm(f => ({ ...f, name: val, slug: slugEdited ? f.slug : slugify(val) }));
  }

  function addStop() {
    setForm(f => ({
      ...f,
      stops: [...f.stops, { destination_id: "", stay_days: "1", sort_order: f.stops.length }],
    }));
  }

  function removeStop(idx: number) {
    setForm(f => ({
      ...f,
      stops: f.stops.filter((_, i) => i !== idx).map((s, i) => ({ ...s, sort_order: i })),
    }));
  }

  function updateStop(idx: number, key: keyof StopForm, val: string | number) {
    setForm(f => {
      const stops = [...f.stops];
      stops[idx] = { ...stops[idx], [key]: val };
      return { ...f, stops };
    });
  }

  function openNew() {
    setEditingId(null);
    setSlugEdited(false);
    setForm({
      duration_id: durations[0]?.id ? String(durations[0].id) : "",
      name: "",
      slug: "",
      is_active: true,
      stops: [
        { destination_id: "", stay_days: "1", sort_order: 0 },
        { destination_id: "", stay_days: "1", sort_order: 1 },
      ],
    });
    setShowForm(true);
  }

  function openEdit(route: RouteWithStops) {
    setEditingId(route.id);
    setSlugEdited(true);
    setForm({
      duration_id: String(route.duration_id),
      name: route.name,
      slug: route.slug,
      is_active: route.is_active,
      stops: route.stops.map((s, i) => ({
        destination_id: String(s.destination_id),
        stay_days: String(s.stay_days),
        sort_order: i,
      })),
    });
    setShowForm(true);
  }

  // Compute total stay days and get duration nights for validation hint
  const selectedDuration = durations.find(d => String(d.id) === form.duration_id);
  const totalStayDays = form.stops.reduce((s, stop) => s + (parseInt(stop.stay_days) || 0), 0);
  const nightsMismatch = selectedDuration && totalStayDays !== selectedDuration.nights;

  function handleSave() {
    if (!form.name.trim()) return toast.error("Route name is required");
    if (!form.slug.trim()) return toast.error("Slug is required");
    if (!form.duration_id) return toast.error("Duration is required");
    if (form.stops.some(s => !s.destination_id)) return toast.error("All stops need a destination");
    if (nightsMismatch) return toast.error(`Total stay days must equal ${selectedDuration?.nights} nights`);

    const stopsData = form.stops.map((s, i) => ({
      destination_id: parseInt(s.destination_id),
      stay_days: parseInt(s.stay_days) || 1,
      sort_order: i,
    }));

    startTransition(async () => {
      if (editingId) {
        const res = await updateRouteAction(editingId, packageId, {
          name: form.name,
          slug: form.slug,
          is_active: form.is_active,
          stops: stopsData,
        });
        if (res.success) {
          toast.success("Route updated");
          setRoutes(rs => rs.map(r => r.id === editingId
            ? {
                ...r,
                name: form.name,
                slug: form.slug,
                is_active: form.is_active,
                stops: stopsData.map((s) => ({
                  ...s,
                  id: r.stops[s.sort_order]?.id ?? 0,
                  route_id: editingId,
                  latitude: null,
                  longitude: null,
                  created_at: new Date(),
                  updated_at: new Date(),
                  destination: destinations.find(d => d.id === s.destination_id)!,
                })),
              }
            : r
          ));
          setShowForm(false);
        } else {
          toast.error(res.error);
        }
      } else {
        const res = await createRouteAction(packageId, {
          duration_id: parseInt(form.duration_id),
          name: form.name,
          slug: form.slug,
          is_active: form.is_active,
          sort_order: routes.length,
          stops: stopsData,
        });
        if (res.success) {
          toast.success("Route created");
          setRoutes(rs => [...rs, {
            id: res.data.id,
            duration_id: parseInt(form.duration_id),
            name: form.name,
            slug: form.slug,
            is_active: form.is_active,
            sort_order: rs.length,
            meta_title: null,
            meta_desc: null,
            polyline: null,
            packagesId: null,
            total_distance_km: null,
            total_duration_min: null,
            created_at: new Date(),
            updated_at: new Date(),
            stops: stopsData.map((s, i) => ({
              id: 0,
              route_id: res.data.id,
              destination_id: s.destination_id,
              stay_days: s.stay_days,
              sort_order: i,
              latitude: null,
              longitude: null,
              created_at: new Date(),
              updated_at: new Date(),
              destination: destinations.find(d => d.id === s.destination_id)!,
            })),
          }]);
          setShowForm(false);
        } else {
          toast.error(res.error);
        }
      }
    });
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      const res = await deleteRouteAction(id, packageId);
      if (res.success) {
        toast.success("Route deleted");
        setRoutes(rs => rs.filter(r => r.id !== id));
      } else {
        toast.error(res.error);
      }
    });
  }

  if (durations.length === 0) {
    return (
      <Card>
        <CardContent className="pt-8 pb-8 text-center">
          <Route className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-muted-foreground">No durations defined</p>
          <p className="text-xs text-muted-foreground">Add durations in the Basic tab first</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Routes</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Define the stop sequence for each duration variant
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" /> Add Route
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {routes.length === 0 && !showForm && (
            <div className="flex flex-col items-center py-10 text-center">
              <Route className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No routes yet</p>
              <p className="text-xs text-muted-foreground">Routes define the day-by-day destination order</p>
            </div>
          )}

          {routes.map(route => {
            const dur = durations.find(d => d.id === route.duration_id);
            return (
              <div key={route.id} className="rounded-lg border overflow-hidden">
                <div
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30"
                  onClick={() => setExpandedRoute(expandedRoute === route.id ? null : route.id)}
                >
                  <div className="flex items-center gap-3">
                    {expandedRoute === route.id
                      ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{route.name}</p>
                        {!route.is_active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {dur ? `${dur.label} · ` : ""}{route.stops.length} stops
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                    <Button size="sm" variant="outline" onClick={() => openEdit(route)}>Edit</Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Route?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete "{route.name}" and all its stops. Routes with itinerary days cannot be deleted.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => handleDelete(route.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {expandedRoute === route.id && (
                  <div className="border-t px-4 py-3 bg-muted/20 space-y-1">
                    {route.stops.map((stop, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium">{stop.destination.name}</span>
                        <span className="text-muted-foreground text-xs">· {stop.stay_days} night{stop.stay_days !== 1 ? "s" : ""}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {showForm && (
            <div className="rounded-lg border p-4 space-y-4 bg-muted/30">
              <p className="text-sm font-medium">{editingId ? "Edit Route" : "New Route"}</p>

              <div className="space-y-1.5">
                <Label className="text-xs">Duration</Label>
                <Select
                  value={form.duration_id}
                  onValueChange={v => setForm(f => ({ ...f, duration_id: v }))}
                  disabled={!!editingId}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    {durations.map(d => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.label} ({d.days}D/{d.nights}N)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Route Name</Label>
                  <Input
                    value={form.name}
                    onChange={e => handleNameChange(e.target.value)}
                    placeholder="e.g. Srinagar – Gulmarg – Pahalgam"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Slug</Label>
                  <Input
                    value={form.slug}
                    onChange={e => { setForm(f => ({ ...f, slug: e.target.value })); setSlugEdited(true); }}
                    className="h-8 text-sm font-mono"
                  />
                </div>
              </div>

              {/* Stops */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Stops</Label>
                  {selectedDuration && (
                    <span className={`text-xs font-medium ${nightsMismatch ? "text-destructive" : "text-green-600"}`}>
                      {totalStayDays} / {selectedDuration.nights} nights
                    </span>
                  )}
                </div>

                {form.stops.map((stop, i) => (
                  <div key={i} className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs text-muted-foreground">Stop {i + 1}</Label>
                      <Select
                        value={stop.destination_id}
                        onValueChange={v => updateStop(i, "destination_id", v)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select destination" />
                        </SelectTrigger>
                        <SelectContent>
                          {destinations.map(d => (
                            <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-24 space-y-1">
                      <Label className="text-xs text-muted-foreground">Nights</Label>
                      <Input
                        type="number" min={1}
                        value={stop.stay_days}
                        onChange={e => updateStop(i, "stay_days", e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <Button
                      size="icon" variant="ghost"
                      className="h-8 w-8 text-muted-foreground"
                      disabled={form.stops.length <= 2}
                      onClick={() => removeStop(i)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}

                <Button size="sm" variant="outline" onClick={addStop} className="w-full">
                  <Plus className="h-4 w-4 mr-1" /> Add Stop
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                <Label className="text-sm">Active</Label>
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={isPending || !!nightsMismatch}>
                  {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                  {editingId ? "Update Route" : "Create Route"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
