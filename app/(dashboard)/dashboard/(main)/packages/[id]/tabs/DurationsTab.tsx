"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { Switch } from "../../../components/ui/switch";
import { Badge } from "../../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import {
  MultiStepModal,
  useMultiStep,
  type Step,
} from "../../../components/dashboard/MultiStepModel";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../components/ui/alert-dialog";
import {
  Plus, Pencil, Trash2, Loader2, Route,
  Clock, ArrowRight, ChevronDown, ChevronUp, Check,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/app/lib/utils";
import { createDuration, updateDuration, deleteDuration } from "../../actions";
import type { RouteOption } from "../../actions";

const BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

// ── Types ─────────────────────────────────────────────────────────────────

type PackageImage = {
  id: number; url: string; thumbnail: string | null;
  title: string | null; is_primary: boolean;
};

type Duration = {
  id: number;
  slug: string;
  label: string;
  h1_title: string | null;
  days: number;
  nights: number;
  routes: unknown;
  thumbnail: string | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  meta_title: string | null;
  meta_desc: string | null;
  pricing: { stay_map_id: number; route_index: number; price: number }[];
  itineraries: { id: number; day: number; title: string }[];
};

// ── Steps ─────────────────────────────────────────────────────────────────

function makeSteps(): Step[] {
  return [
    {
      id: "basic", title: "Basic Info", description: "Label, days and nights",
      icon: <Clock className="h-4 w-4" />,
      validate: (data) => {
        if (!data.label) return "Label is required";
        if (!data.days || Number(data.days) < 1) return "Days must be at least 1";
        return null;
      },
    },
    {
      id: "routes", title: "Routes", description: "Define travel routes",
      icon: <Route className="h-4 w-4" />,
      validate: (data) => {
        const routes = data.routes as RouteOption[];
        if (!routes || routes.length === 0) return "Add at least one route";
        if (routes.some(r => !r.label.trim())) return "All routes must have a label";
        return null;
      },
    },
    {
      id: "thumbnail", title: "Thumbnail", description: "Pick from package gallery",
      icon: <Check className="h-4 w-4" />,
      optional: true,
    },
    {
      id: "seo", title: "SEO", description: "Meta title and description",
      icon: <Check className="h-4 w-4" />,
      optional: true,
    },
    {
      id: "settings", title: "Settings", description: "Default, active, sort order",
      icon: <Check className="h-4 w-4" />,
      optional: true,
    },
  ];
}

// ── Step 1 — Basic ────────────────────────────────────────────────────────

function BasicStep({ isEdit }: { isEdit: boolean }) {
  const { stepData, setStepData } = useMultiStep();
  const data = stepData["basic"] ?? {};
  const label = (data.label as string) ?? "";
  const h1 = (data.h1_title as string) ?? "";
  const days = (data.days as string) ?? "";
  const nights = (data.nights as string) ?? "";
  const [nightsEdited, setNightsEdited] = useState(false);

  function handleDaysChange(val: string) {
    const d = Number(val);
    setStepData("basic", {
      ...data,
      days: val,
      nights: nightsEdited ? nights : String(Math.max(0, d - 1)),
    });
  }

  function handleNightsChange(val: string) {
    setNightsEdited(true);
    setStepData("basic", { ...data, nights: val });
  }

  // Auto-fill meta_title from h1_title
  function handleH1Change(val: string) {
    const seo = stepData["seo"] ?? {};
    setStepData("basic", { ...data, h1_title: val });
    if (!seo.meta_title_edited) {
      setStepData("seo", { ...seo, meta_title: val ? `${val} | Dreams Yatri` : "" });
    }
  }

  // Auto-fill label from days/nights
  function handleLabelAutoFill() {
    if (!label && days && nights) {
      setStepData("basic", { ...data, label: `${days} Days / ${nights} Nights` });
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Days <span className="text-destructive">*</span></Label>
          <Input type="number" min="1" value={days}
            onChange={e => handleDaysChange(e.target.value)}
            onBlur={handleLabelAutoFill}
            placeholder="4" />
        </div>
        <div className="space-y-1.5">
          <Label>Nights <span className="text-destructive">*</span></Label>
          <Input type="number" min="0" value={nights}
            onChange={e => handleNightsChange(e.target.value)}
            placeholder="3" />
          <p className="text-xs text-muted-foreground">Auto-fills as Days − 1</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Label <span className="text-destructive">*</span></Label>
        <Input value={label}
          onChange={e => setStepData("basic", { ...data, label: e.target.value })}
          placeholder="4 Days / 3 Nights" />
        <p className="text-xs text-muted-foreground">Auto-filled from days/nights — edit if needed</p>
      </div>

      <div className="space-y-1.5">
        <Label>Page Heading (H1)</Label>
        <Input value={h1} onChange={e => handleH1Change(e.target.value)}
          placeholder="Kashmir 4 Days Tour Package" />
        <p className="text-xs text-muted-foreground">
          Main heading shown on the package detail page for this duration. Auto-fills SEO title.
        </p>
      </div>
    </div>
  );
}

// ── Step 2 — Routes ───────────────────────────────────────────────────────

function RoutesStep() {
  const { stepData, setStepData } = useMultiStep();
  const data = stepData["routes"] ?? {};
  const routes = (data.routes as RouteOption[]) ?? [
    { id: 0, slug: "route-0", label: "", stops: [{ d: 1, p: "" }], is_default: true },
  ];

  function setRoutes(r: RouteOption[]) {
    setStepData("routes", { routes: r });
  }

  function addRoute() {
    setRoutes([...routes, {
      id: routes.length, slug: `route-${routes.length}`,
      label: "", stops: [{ d: 1, p: "" }], is_default: false,
    }]);
  }

  function updateRoute(idx: number, updates: Partial<RouteOption>) {
    setRoutes(routes.map((r, i) => i === idx ? { ...r, ...updates } : r));
  }

  function removeRoute(idx: number) {
    const updated = routes.filter((_, i) => i !== idx)
      .map((r, i) => ({ ...r, id: i, slug: `route-${i}` }));
    setRoutes(updated);
  }

  function addStop(rIdx: number) {
    updateRoute(rIdx, { stops: [...routes[rIdx].stops, { d: 1, p: "" }] });
  }

  function updateStop(rIdx: number, sIdx: number, field: "d" | "p", val: string | number) {
    const stops = routes[rIdx].stops.map((s, i) =>
      i === sIdx ? { ...s, [field]: field === "d" ? Number(val) : val } : s
    );
    updateRoute(rIdx, { stops });
  }

  function removeStop(rIdx: number, sIdx: number) {
    updateRoute(rIdx, { stops: routes[rIdx].stops.filter((_, i) => i !== sIdx) });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Each route gets its own itinerary and pricing. Route 0 is default.
      </p>

      {routes.map((route, rIdx) => (
        <div key={rIdx} className="rounded-xl border p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">Route {rIdx + 1}</Badge>
                {route.is_default && <Badge className="text-xs">Default</Badge>}
              </div>
              <Input
                placeholder="Srinagar → Gulmarg → Pahalgam → Srinagar"
                value={route.label}
                onChange={e => updateRoute(rIdx, { label: e.target.value })}
              />
            </div>
            <div className="flex gap-2 mt-1 shrink-0">
              {!route.is_default && (
                <Button type="button" variant="outline" size="sm" className="text-xs"
                  onClick={() => setRoutes(routes.map((r, i) => ({ ...r, is_default: i === rIdx })))}>
                  Set Default
                </Button>
              )}
              {routes.length > 1 && (
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => removeRoute(rIdx)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {route.stops.map((stop, sIdx) => (
              <div key={sIdx} className="flex items-center gap-1.5 group">
                {sIdx > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                <div className="flex items-center border rounded-lg overflow-hidden bg-background">
                  <Input value={stop.p} onChange={e => updateStop(rIdx, sIdx, "p", e.target.value)}
                    placeholder="Place" className="border-0 w-24 h-7 text-xs rounded-none focus-visible:ring-0" />
                  <div className="w-px h-4 bg-border" />
                  <Input type="number" min="1" value={stop.d}
                    onChange={e => updateStop(rIdx, sIdx, "d", e.target.value)}
                    className="border-0 w-12 h-7 text-xs rounded-none text-center focus-visible:ring-0" />
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
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs border-dashed border"
              onClick={() => addStop(rIdx)}>
              <Plus className="h-3 w-3 mr-1" /> Stop
            </Button>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" className="border-dashed w-full" onClick={addRoute}>
        <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Route
      </Button>
    </div>
  );
}

// ── Step 3 — Thumbnail (pick from package gallery) ────────────────────────

function ThumbnailStep({ packageImages }: { packageImages: PackageImage[] }) {
  const { stepData, setStepData } = useMultiStep();
  const data = stepData["thumbnail"] ?? {};
  const selected = (data.thumbnail as string) ?? "";

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Select one image from the package gallery to use as the thumbnail for this duration.
        Shown in the duration selector card on the frontend.
      </p>

      {packageImages.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed rounded-xl">
          <p className="text-sm text-muted-foreground">No package images yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add images to the package gallery first
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {packageImages.map(img => (
            <button
              key={img.id}
              type="button"
              onClick={() => setStepData("thumbnail", {
                thumbnail: selected === img.url ? "" : img.url,
              })}
              className={cn(
                "relative aspect-square rounded-xl overflow-hidden border-2 transition-all",
                selected === img.url
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border hover:border-muted-foreground/40",
              )}
            >
              <img
                src={`${BASE}/${img.thumbnail ?? img.url}`}
                alt={img.title ?? ""}
                className="w-full h-full object-cover"
              />
              {selected === img.url && (
                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                  <Check className="h-6 w-6 text-white drop-shadow" />
                </div>
              )}
              {img.is_primary && (
                <Badge className="absolute bottom-1 left-1 text-[9px] px-1 py-0 pointer-events-none bg-primary">
                  Primary
                </Badge>
              )}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="flex items-center gap-2 rounded-lg border p-2 bg-muted/20">
          <img src={`${BASE}/${selected}`} alt="" className="h-10 w-14 rounded object-cover" />
          <p className="text-xs text-muted-foreground">Selected as thumbnail</p>
          <Button type="button" variant="ghost" size="sm" className="ml-auto text-xs"
            onClick={() => setStepData("thumbnail", { thumbnail: "" })}>
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Step 4 — SEO ──────────────────────────────────────────────────────────

function SeoStep() {
  const { stepData, setStepData } = useMultiStep();
  const data = stepData["seo"] ?? {};
  const title = (data.meta_title as string) ?? "";
  const desc = (data.meta_desc as string) ?? "";

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <Label>Meta Title</Label>
          <span className={`text-xs ${title.length > 60 ? "text-destructive" : "text-muted-foreground"}`}>
            {title.length}/60
          </span>
        </div>
        <Input value={title}
          onChange={e => setStepData("seo", { ...data, meta_title: e.target.value, meta_title_edited: true })}
          placeholder="Kashmir 4 Days Package | Dreams Yatri" />
        <p className="text-xs text-muted-foreground">Auto-filled from H1 title</p>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <Label>Meta Description</Label>
          <span className={`text-xs ${desc.length > 160 ? "text-destructive" : "text-muted-foreground"}`}>
            {desc.length}/160
          </span>
        </div>
        <Textarea value={desc}
          onChange={e => setStepData("seo", { ...data, meta_desc: e.target.value })}
          placeholder="Book Kashmir 4 Days package..." rows={3} />
      </div>
    </div>
  );
}

// ── Step 5 — Settings ─────────────────────────────────────────────────────

function SettingsStep() {
  const { stepData, setStepData } = useMultiStep();
  const data = stepData["settings"] ?? {};
  const is_default = (data.is_default as boolean) ?? false;
  const is_active = (data.is_active as boolean) ?? true;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
        <div>
          <p className="text-sm font-medium">Default Duration</p>
          <p className="text-xs text-muted-foreground">Pre-selected when page loads</p>
        </div>
        <Switch checked={is_default}
          onCheckedChange={v => setStepData("settings", { ...data, is_default: v })} />
      </div>
      <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
        <div>
          <p className="text-sm font-medium">Active</p>
          <p className="text-xs text-muted-foreground">Visible to users</p>
        </div>
        <Switch checked={is_active}
          onCheckedChange={v => setStepData("settings", { ...data, is_active: v })} />
      </div>
      <p className="text-xs text-muted-foreground">
        Sort order is auto-assigned based on creation order. Edit it from the duration card if needed.
      </p>
    </div>
  );
}

// ── Build initial step data ───────────────────────────────────────────────

function buildInitialData(existing?: Duration): Record<string, Record<string, unknown>> {
  if (!existing) {
    return {
      basic: { label: "", h1_title: "", days: "", nights: "" },
      routes: { routes: [{ id: 0, slug: "route-0", label: "", stops: [{ d: 1, p: "" }], is_default: true }] },
      thumbnail: { thumbnail: "" },
      seo: { meta_title: "", meta_desc: "", meta_title_edited: false },
      settings: { is_default: false, is_active: true },
    };
  }
  return {
    basic: { label: existing.label, h1_title: existing.h1_title ?? "", days: String(existing.days), nights: String(existing.nights) },
    routes: { routes: existing.routes as RouteOption[] },
    thumbnail: { thumbnail: existing.thumbnail ?? "" },
    seo: { meta_title: existing.meta_title ?? "", meta_desc: existing.meta_desc ?? "", meta_title_edited: true },
    settings: { is_default: existing.is_default, is_active: existing.is_active },
  };
}

// ── Duration Modal ────────────────────────────────────────────────────────

function DurationModal({
  open,
  onOpenChange,
  package_id,
  packageImages,
  existing,
  nextSortOrder,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  package_id: number;
  packageImages: PackageImage[];
  existing?: Duration;
  nextSortOrder: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalKey, setModalKey] = useState(0);
  const STEPS = makeSteps();

  function handleOpenChange(val: boolean) {
    onOpenChange(val);
    if (!val) setModalKey(k => k + 1);
  }

  function slugify(val: string) {
    if (!val) return "";
    return val.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "-").trim();
  }

async function handleComplete(data: Record<string, unknown>) {
  startTransition(async () => {
    const label  = (data["label"]    as string) ?? "";
    const days   = Number(data["days"]   ?? 1);
    const nights = Number(data["nights"] ?? 0);

    if (!label.trim()) { toast.error("Label is required"); return; }

    const payload = {
      slug:       existing?.slug ?? `${slugify(label)}-${days}d`,
      label,
      h1_title:   (data["h1_title"]   as string)    || null,
      days,
      nights,
      routes:     (data["routes"]     as RouteOption[]) ?? [],
      thumbnail:  (data["thumbnail"]  as string)    || null,
      meta_title: (data["meta_title"] as string)    || null,
      meta_desc:  (data["meta_desc"]  as string)    || null,
      is_default: (data["is_default"] as boolean)   ?? false,
      sort_order: nextSortOrder,
      is_active:  (data["is_active"]  as boolean)   ?? true,
    };

    const result = existing
      ? await updateDuration(existing.id, package_id, payload)
      : await createDuration(package_id, payload);

    if (result.success) {
      toast.success(result.message);
      handleOpenChange(false);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  });
}

  return (
    <MultiStepModal
      key={modalKey}
      open={open}
      onOpenChange={handleOpenChange}
      title={existing ? "Edit Duration" : "Add Duration"}
      description={existing ? existing.label : "Set up days, routes and SEO for this duration"}
      steps={STEPS}
      onComplete={handleComplete}
      isSubmitting={isPending}
      submitLabel={existing ? "Save Duration" : "Create Duration"}
      initialStepData={buildInitialData(existing)}
    >
      <BasicStep isEdit={!!existing} />
      <RoutesStep />
      <ThumbnailStep packageImages={packageImages} />
      <SeoStep />
      <SettingsStep />
    </MultiStepModal>
  );
}

// ── Main DurationsTab ─────────────────────────────────────────────────────

export function DurationsTab({
  package_id,
  durations: initialDurations,
  packageImages,
}: {
  package_id: number;
  durations: Duration[];
  packageImages: PackageImage[];
}) {
  const router = useRouter();
  const [durations, setDurations] = useState(initialDurations);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Duration | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [isPending, startTransition] = useTransition();

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
          <p className="text-sm font-medium">{durations.length} Duration{durations.length !== 1 ? "s" : ""}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Each duration has its own routes, pricing and itinerary
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
          <p className="text-xs text-muted-foreground mt-1">Add "4 Days / 3 Nights", "6 Days / 5 Nights" etc.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {durations.map(dur => {
            const routes = dur.routes as RouteOption[];
            const isExp = expanded.has(dur.id);

            return (
              <Card key={dur.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => toggleExpand(dur.id)} className="flex items-center gap-2">
                        {isExp ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        <CardTitle className="text-sm">{dur.label}</CardTitle>
                      </button>
                      {dur.is_default && <Badge className="text-xs">Default</Badge>}
                      {!dur.is_active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {dur.thumbnail && (
                        <img src={`${BASE}/${dur.thumbnail}`} alt=""
                          className="h-8 w-12 rounded object-cover border" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {routes.length} route{routes.length !== 1 ? "s" : ""} · {dur.itineraries.length} days
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
                              Delete <strong>{dur.label}</strong>? Removes all pricing and itinerary days.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(dur.id)}
                              className="bg-destructive text-white hover:bg-destructive/90">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>

                {isExp && (
                  <CardContent className="pt-0 space-y-3">
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>{dur.days}D · {dur.nights}N</span>
                      {dur.h1_title && <span>H1: {dur.h1_title}</span>}
                    </div>
                    {routes.map((r, i) => (
                      <div key={i} className="rounded-lg border p-3 bg-muted/20 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Route className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-sm font-medium">{r.label || `Route ${i + 1}`}</p>
                          {r.is_default && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {r.stops.map((stop, si) => (
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

      <DurationModal
        open={showCreate}
        onOpenChange={setShowCreate}
        package_id={package_id}
        packageImages={packageImages}
        nextSortOrder={durations.length}
      />

      {editTarget && (
        <DurationModal
          open={!!editTarget}
          onOpenChange={o => !o && setEditTarget(null)}
          package_id={package_id}
          packageImages={packageImages}
          existing={editTarget}
          nextSortOrder={durations.length}
        />
      )}
    </div>
  );
}