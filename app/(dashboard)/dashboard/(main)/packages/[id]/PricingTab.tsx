"use client";

import { useState, useTransition, useCallback } from "react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Switch } from "../../components/ui/switch";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../../components/ui/alert-dialog";
import {
  Loader2, Check, Percent, Settings2, Car, Plus, Trash2,
  Wind, AlertTriangle, ChevronDown, ChevronRight, Pencil, MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { handleUpsertPackagePricing } from "@/app/actions/packages/pricing.actions";
import {
  createCabType, updateCabType, deleteCabType,
  upsertCabSegment, deleteCabSegment,
  getCabPricingOptionsForVehicle,
  type CabPricingOption,
} from "@/app/actions/packages/cab-pricing.actions";

// ── Types ──────────────────────────────────────────────────────────────────

type Duration = { id: number; label: string; days: number; nights: number };
type StayCategory = { id: number; label: string; slug: string };
type SavedPricing = {
  id: number;
  duration_id: number;
  stay_category_id: number;
  margin_percentage: number;
  gst_percentage: number;
};

type CabSeason = {
  id: number;
  valid_from: Date | string;
  valid_to: Date | string;
  pricing_type: "PER_DAY" | "PER_KM";
  weekday_price: number;
  weekend_price: number;
};

type CabSegment = {
  id: number;
  day_from: number;
  day_to: number;
  sort_order: number;
  cab_pricing: {
    id: number;
    pricing_type: "PER_DAY" | "PER_KM";
    price: number;
    destination: { id: number; name: string };
    seasons: CabSeason[];
  };
};

type CabType = {
  id: number;
  duration_id: number;
  vehicle_id: number;
  label: string | null;
  note: string | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  vehicle: { id: number; name: string; type: string; passenger_capacity: number; has_ac: boolean };
  segments: CabSegment[];
};

type VehicleOption = {
  id: number;
  name: string;
  type: string;
  passenger_capacity: number;
  has_ac: boolean;
  fuel_type: string | null;
};

type PricingTabProps = {
  packageId: number;
  durations: Duration[];
  stayCategories: StayCategory[];
  initialPricings: SavedPricing[];
  routes: { id: number; name: string; durationLabel: string }[];
  cabTypes: CabType[];
  availableVehicles: VehicleOption[];
};

// ── Helpers ────────────────────────────────────────────────────────────────

function overlaps(aFrom: number, aTo: number, bFrom: number, bTo: number) {
  return aFrom <= bTo && bFrom <= aTo;
}

function fmt(n: number) {
  return n.toLocaleString("en-IN");
}

// ── Margin/GST row ─────────────────────────────────────────────────────────

function PricingRow({
  packageId,
  durationId,
  stayCategory,
  initialMargin,
  initialGst,
  hasConfig,
}: {
  packageId: number;
  durationId: number;
  stayCategory: StayCategory;
  initialMargin: number;
  initialGst: number;
  hasConfig: boolean;
}) {
  const [margin, setMargin] = useState(String(initialMargin));
  const [gst, setGst] = useState(String(initialGst));
  const [saved, setSaved] = useState(hasConfig);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const m = parseFloat(margin);
    const g = parseFloat(gst);
    if (isNaN(m) || isNaN(g) || m < 0 || g < 0) {
      toast.error("Enter valid non-negative percentages");
      return;
    }
    startTransition(async () => {
      const result = await handleUpsertPackagePricing({
        package_id: packageId,
        duration_id: durationId,
        stay_category_id: stayCategory.id,
        margin_percentage: m,
        gst_percentage: g,
      });
      if (result.success) {
        setSaved(true);
        toast.success(`${stayCategory.label} pricing saved`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-3 py-3 border-b last:border-0">
      <div className="w-36 min-w-0 shrink-0">
        <span className="text-sm font-medium truncate block">{stayCategory.label}</span>
        {!hasConfig && !saved && (
          <span className="text-[10px] text-amber-500 font-medium">Not configured</span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-1">
        <div className="relative w-28">
          <Input
            type="number" min="0" max="100" step="0.5"
            value={margin}
            onChange={(e) => { setMargin(e.target.value); setSaved(false); }}
            className="pr-7 text-sm h-8" placeholder="10"
          />
          <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
        </div>
        <span className="text-xs text-muted-foreground">+</span>
        <div className="relative w-28">
          <Input
            type="number" min="0" max="100" step="0.5"
            value={gst}
            onChange={(e) => { setGst(e.target.value); setSaved(false); }}
            className="pr-7 text-sm h-8" placeholder="5"
          />
          <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
        </div>
        <span className="text-xs text-muted-foreground hidden sm:block">GST</span>
        <Button
          size="sm"
          variant={saved ? "outline" : "default"}
          onClick={handleSave}
          disabled={isPending || saved}
          className="h-8 w-20 shrink-0"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : saved ? (
            <><Check className="h-3.5 w-3.5 mr-1 text-green-600" /><span className="text-green-600">Saved</span></>
          ) : "Save"}
        </Button>
      </div>
    </div>
  );
}

// ── Segment pricing selector (loads options on demand) ─────────────────────

function SegmentPricingSelector({
  vehicleId,
  value,
  onChange,
  disabled,
}: {
  vehicleId: number;
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  const [options, setOptions] = useState<CabPricingOption[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleOpen(open: boolean) {
    if (open && options === null) {
      setLoading(true);
      const res = await getCabPricingOptionsForVehicle(vehicleId);
      setLoading(false);
      if (res.success) setOptions(res.data);
      else toast.error(res.error);
    }
  }

  return (
    <Select value={value} onValueChange={onChange} onOpenChange={handleOpen} disabled={disabled}>
      <SelectTrigger className="h-8 text-sm">
        {loading
          ? <span className="flex items-center gap-1 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Loading…</span>
          : <SelectValue placeholder="Select pricing source…" />}
      </SelectTrigger>
      <SelectContent>
        {options === null ? null : options.length === 0 ? (
          <SelectItem value="__none" disabled>No pricing configured for this vehicle</SelectItem>
        ) : (
          options.map((o) => (
            <SelectItem key={o.cab_pricing_id} value={String(o.cab_pricing_id)}>
              {o.destination_name} · {o.pricing_type === "PER_DAY" ? "Per Day" : "Per Km"} · ₹{fmt(o.price)}
              {o.seasons_count > 0 && ` · ${o.seasons_count} season${o.seasons_count > 1 ? "s" : ""}`}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}

// ── Segment form (inline add / edit) ──────────────────────────────────────

function SegmentForm({
  packageId,
  cabTypeId,
  vehicleId,
  durationDays,
  existingSegments,
  editingSegment,
  onSaved,
  onCancel,
}: {
  packageId: number;
  cabTypeId: number;
  vehicleId: number;
  durationDays: number;
  existingSegments: CabSegment[];
  editingSegment?: CabSegment;
  onSaved: (seg: CabSegment) => void;
  onCancel: () => void;
}) {
  const [dayFrom, setDayFrom] = useState(String(editingSegment?.day_from ?? 1));
  const [dayTo, setDayTo] = useState(String(editingSegment?.day_to ?? durationDays));
  const [cabPricingId, setCabPricingId] = useState(
    editingSegment ? String(editingSegment.cab_pricing.id) : ""
  );
  const [isPending, startTransition] = useTransition();

  const df = parseInt(dayFrom);
  const dt = parseInt(dayTo);
  const isValid = !isNaN(df) && !isNaN(dt) && df >= 1 && dt <= durationDays && df <= dt && !!cabPricingId;

  // Overlap detection (excluding self when editing)
  const hasOverlap = !isNaN(df) && !isNaN(dt) && existingSegments.some((s) => {
    if (editingSegment && s.id === editingSegment.id) return false;
    return overlaps(df, dt, s.day_from, s.day_to);
  });

  function handleSave() {
    if (!isValid) return;
    startTransition(async () => {
      const res = await upsertCabSegment({
        id: editingSegment?.id,
        cab_type_id: cabTypeId,
        package_id: packageId,
        day_from: df,
        day_to: dt,
        cab_pricing_id: parseInt(cabPricingId),
      });
      if (res.success) {
        // Build optimistic segment — we need to re-fetch or pass info back
        // For now, trigger a page revalidation (server action does revalidatePath)
        toast.success(editingSegment ? "Segment updated" : "Segment added");
        // We'll get the updated data on next render via revalidation
        // Pass back a partial shape so optimistic update works
        onSaved({
          id: res.id,
          day_from: df,
          day_to: dt,
          sort_order: editingSegment?.sort_order ?? 0,
          cab_pricing: editingSegment?.cab_pricing ?? {
            id: parseInt(cabPricingId),
            pricing_type: "PER_DAY",
            price: 0,
            destination: { id: 0, name: "—" },
            seasons: [],
          },
        });
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-muted/10 mt-2">
      {hasOverlap && (
        <div className="flex items-center gap-2 text-amber-600 text-xs bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-1.5">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Day range overlaps with another segment
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Day From <span className="text-destructive">*</span></Label>
          <Input
            className="h-8 text-sm" type="number" min={1} max={durationDays}
            value={dayFrom} onChange={(e) => setDayFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Day To <span className="text-destructive">*</span></Label>
          <Input
            className="h-8 text-sm" type="number" min={1} max={durationDays}
            value={dayTo} onChange={(e) => setDayTo(e.target.value)}
          />
        </div>
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">Pricing Source <span className="text-destructive">*</span></Label>
          <SegmentPricingSelector
            vehicleId={vehicleId}
            value={cabPricingId}
            onChange={setCabPricingId}
            disabled={isPending}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>Cancel</Button>
        <Button
          type="button" size="sm"
          disabled={!isValid || hasOverlap || isPending}
          onClick={handleSave}
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5 mr-1" />{editingSegment ? "Update" : "Add"}</>}
        </Button>
      </div>
    </div>
  );
}

// ── Single segment row ─────────────────────────────────────────────────────

function SegmentRow({
  segment,
  packageId,
  durationDays,
  allSegments,
  vehicleId,
  cabTypeId,
  onDeleted,
  onUpdated,
}: {
  segment: CabSegment;
  packageId: number;
  durationDays: number;
  allSegments: CabSegment[];
  vehicleId: number;
  cabTypeId: number;
  onDeleted: (id: number) => void;
  onUpdated: (seg: CabSegment) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (editing) {
    return (
      <SegmentForm
        packageId={packageId}
        cabTypeId={cabTypeId}
        vehicleId={vehicleId}
        durationDays={durationDays}
        existingSegments={allSegments}
        editingSegment={segment}
        onSaved={(updated) => { onUpdated(updated); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const { cab_pricing: cp } = segment;

  return (
    <div className="flex items-center gap-3 py-2 border-b last:border-0 text-sm">
      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="font-medium">Day {segment.day_from}–{segment.day_to}</span>
        <span className="text-muted-foreground mx-1.5">·</span>
        <span className="text-muted-foreground">{cp.destination.name}</span>
        <span className="text-muted-foreground mx-1.5">·</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {cp.pricing_type === "PER_DAY" ? "Per Day" : "Per Km"}
        </Badge>
        <span className="text-muted-foreground mx-1.5">·</span>
        <span className="font-semibold text-green-700">₹{fmt(cp.price)}</span>
        {cp.pricing_type === "PER_DAY" ? "/day" : "/km"}
        {cp.seasons.length > 0 && (
          <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">
            {cp.seasons.length} season{cp.seasons.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>
      <Button
        type="button" variant="ghost" size="icon" className="h-7 w-7"
        onClick={() => setEditing(true)} disabled={isPending}
      >
        <Pencil className="h-3 w-3" />
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button" variant="ghost" size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
            disabled={isPending}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Segment</AlertDialogTitle>
            <AlertDialogDescription>
              Remove day {segment.day_from}–{segment.day_to} ({cp.destination.name}) from this cab type?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                startTransition(async () => {
                  const res = await deleteCabSegment(segment.id, packageId);
                  if (res.success) onDeleted(segment.id);
                  else toast.error(res.error);
                });
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Cab type card ──────────────────────────────────────────────────────────

function CabTypeCard({
  cabType,
  packageId,
  durationDays,
  durationLabel,
  onDeleted,
  onUpdated,
}: {
  cabType: CabType;
  packageId: number;
  durationDays: number;
  durationLabel: string;
  onDeleted: (id: number) => void;
  onUpdated: (updated: CabType) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [addingSegment, setAddingSegment] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelVal, setLabelVal] = useState(cabType.label ?? "");
  const [noteVal, setNoteVal] = useState(cabType.note ?? "");
  const [segments, setSegments] = useState(cabType.segments);
  const [isPending, startTransition] = useTransition();

  const v = cabType.vehicle;

  function handleToggleActive(val: boolean) {
    startTransition(async () => {
      const res = await updateCabType(cabType.id, packageId, { is_active: val });
      if (res.success) onUpdated({ ...cabType, is_active: val, segments });
      else toast.error(res.error);
    });
  }

  function handleToggleDefault() {
    startTransition(async () => {
      const res = await updateCabType(cabType.id, packageId, { is_default: !cabType.is_default });
      if (res.success) onUpdated({ ...cabType, is_default: !cabType.is_default, segments });
      else toast.error(res.error);
    });
  }

  function handleSaveLabelNote() {
    startTransition(async () => {
      const res = await updateCabType(cabType.id, packageId, {
        label: labelVal.trim() || null,
        note: noteVal.trim() || null,
      });
      if (res.success) {
        onUpdated({ ...cabType, label: labelVal.trim() || null, note: noteVal.trim() || null, segments });
        setEditingLabel(false);
        toast.success("Updated");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Card className="mb-3">
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded((e) => !e)}
      >
        {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
        <Car className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{cabType.label ?? v.name}</span>
            {cabType.label && <span className="text-xs text-muted-foreground">({v.name})</span>}
            {v.has_ac && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5"><Wind className="h-2.5 w-2.5" />AC</Badge>}
            <span className="text-xs text-muted-foreground">{v.passenger_capacity} pax</span>
            {cabType.is_default && <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">Default</Badge>}
            {!cabType.is_active && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Inactive</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {segments.length} segment{segments.length !== 1 ? "s" : ""} · {durationLabel}
          </p>
        </div>
        {/* Right-side controls (stop propagation so card click doesn't toggle expand) */}
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={cabType.is_active}
            onCheckedChange={handleToggleActive}
            disabled={isPending}
          />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button" variant="ghost" size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                disabled={isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove Cab Type</AlertDialogTitle>
                <AlertDialogDescription>
                  Remove <span className="font-semibold">{cabType.label ?? v.name}</span> from {durationLabel}? All its segments will be deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    startTransition(async () => {
                      const res = await deleteCabType(cabType.id, packageId);
                      if (res.success) onDeleted(cabType.id);
                      else toast.error(res.error);
                    });
                  }}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <CardContent className="px-4 pt-0 pb-4 border-t space-y-4">
          {/* Label / Note editor */}
          {editingLabel ? (
            <div className="space-y-2 pt-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Display Label</Label>
                  <Input
                    className="h-8 text-sm" placeholder={v.name}
                    value={labelVal} onChange={(e) => setLabelVal(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Set as Default</Label>
                  <div className="flex items-center gap-2 h-8">
                    <Switch
                      checked={cabType.is_default}
                      onCheckedChange={handleToggleDefault}
                      disabled={isPending}
                    />
                    <span className="text-xs text-muted-foreground">
                      {cabType.is_default ? "Default option" : "Not default"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Restriction Note <span className="text-muted-foreground">(optional)</span></Label>
                <Textarea
                  className="text-sm min-h-[60px] resize-none"
                  placeholder="e.g. 4x4 required in border areas; standard cab available elsewhere"
                  value={noteVal}
                  onChange={(e) => setNoteVal(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => { setEditingLabel(false); setLabelVal(cabType.label ?? ""); setNoteVal(cabType.note ?? ""); }}>
                  Cancel
                </Button>
                <Button type="button" size="sm" onClick={handleSaveLabelNote} disabled={isPending}>
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2 pt-2">
              <div>
                {cabType.note && (
                  <p className="text-xs text-muted-foreground italic">
                    📌 {cabType.note}
                  </p>
                )}
              </div>
              <Button
                type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1 shrink-0"
                onClick={() => setEditingLabel(true)}
              >
                <Pencil className="h-3 w-3" />Edit
              </Button>
            </div>
          )}

          {/* Segments */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Day Segments</p>
            {segments.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No segments yet. Add one below.</p>
            ) : (
              segments.map((seg) => (
                <SegmentRow
                  key={seg.id}
                  segment={seg}
                  packageId={packageId}
                  durationDays={durationDays}
                  allSegments={segments}
                  vehicleId={cabType.vehicle_id}
                  cabTypeId={cabType.id}
                  onDeleted={(id) => setSegments((prev) => prev.filter((s) => s.id !== id))}
                  onUpdated={(updated) => setSegments((prev) => prev.map((s) => s.id === updated.id ? updated : s))}
                />
              ))
            )}

            {addingSegment ? (
              <SegmentForm
                packageId={packageId}
                cabTypeId={cabType.id}
                vehicleId={cabType.vehicle_id}
                durationDays={durationDays}
                existingSegments={segments}
                onSaved={(seg) => { setSegments((prev) => [...prev, seg]); setAddingSegment(false); }}
                onCancel={() => setAddingSegment(false)}
              />
            ) : (
              <Button
                type="button" variant="outline" size="sm" className="mt-2 h-7 text-xs gap-1"
                onClick={() => setAddingSegment(true)}
              >
                <Plus className="h-3 w-3" />Add Segment
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ── Add cab type form ──────────────────────────────────────────────────────

function AddCabTypeForm({
  packageId,
  duration,
  availableVehicles,
  existingVehicleIds,
  onAdded,
  onCancel,
}: {
  packageId: number;
  duration: Duration;
  availableVehicles: VehicleOption[];
  existingVehicleIds: Set<number>;
  onAdded: (cabType: CabType) => void;
  onCancel: () => void;
}) {
  const [vehicleId, setVehicleId] = useState<string>("");
  const [cabPricingId, setCabPricingId] = useState<string>("");
  const [label, setLabel] = useState("");
  const [isPending, startTransition] = useTransition();

  const eligible = availableVehicles.filter((v) => !existingVehicleIds.has(v.id));
  const selectedVehicle = eligible.find((v) => v.id === parseInt(vehicleId));
  const isValid = !!vehicleId && !!cabPricingId;

  function handleCreate() {
    if (!isValid || !selectedVehicle) return;
    startTransition(async () => {
      const res = await createCabType({
        package_id: packageId,
        duration_id: duration.id,
        vehicle_id: selectedVehicle.id,
        label: label.trim() || null,
        is_default: false,
        segments: [{
          day_from: 1,
          day_to: duration.days,
          cab_pricing_id: parseInt(cabPricingId),
          sort_order: 0,
        }],
      });
      if (res.success) {
        toast.success("Cab type added");
        onAdded({
          id: res.id,
          duration_id: duration.id,
          vehicle_id: selectedVehicle.id,
          label: label.trim() || null,
          note: null,
          is_default: false,
          is_active: true,
          sort_order: 0,
          vehicle: {
            id: selectedVehicle.id,
            name: selectedVehicle.name,
            type: selectedVehicle.type,
            passenger_capacity: selectedVehicle.passenger_capacity,
            has_ac: selectedVehicle.has_ac,
          },
          // Segments will be updated after revalidation — show placeholder
          segments: [{
            id: 0,
            day_from: 1,
            day_to: duration.days,
            sort_order: 0,
            cab_pricing: {
              id: parseInt(cabPricingId),
              pricing_type: "PER_DAY",
              price: 0,
              destination: { id: 0, name: "—" },
              seasons: [],
            },
          }],
        });
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-muted/10">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Vehicle <span className="text-destructive">*</span></Label>
          <Select value={vehicleId} onValueChange={(v) => { setVehicleId(v); setCabPricingId(""); }}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select vehicle…" /></SelectTrigger>
            <SelectContent>
              {eligible.length === 0
                ? <SelectItem value="__none" disabled>All vehicles already added</SelectItem>
                : eligible.map((v) => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.name} ({v.passenger_capacity} pax{v.has_ac ? " · AC" : ""})
                    </SelectItem>
                  ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Pricing Source (Day 1–{duration.days}) <span className="text-destructive">*</span></Label>
          {vehicleId ? (
            <SegmentPricingSelector
              vehicleId={parseInt(vehicleId)}
              value={cabPricingId}
              onChange={setCabPricingId}
              disabled={isPending}
            />
          ) : (
            <Select disabled>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select vehicle first…" /></SelectTrigger>
              <SelectContent />
            </Select>
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Display Label <span className="text-muted-foreground">(optional)</span></Label>
          <Input
            className="h-8 text-sm" placeholder={selectedVehicle?.name ?? "e.g. Standard SUV"}
            value={label} onChange={(e) => setLabel(e.target.value)}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        A single segment (Day 1–{duration.days}) will be created. You can add more segments after saving.
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>Cancel</Button>
        <Button type="button" size="sm" disabled={!isValid || isPending} onClick={handleCreate}>
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5 mr-1" />Add Cab Type</>}
        </Button>
      </div>
    </div>
  );
}

// ── Cab types section per duration ─────────────────────────────────────────

function CabTypesSection({
  packageId,
  duration,
  initialCabTypes,
  availableVehicles,
}: {
  packageId: number;
  duration: Duration;
  initialCabTypes: CabType[];
  availableVehicles: VehicleOption[];
}) {
  const [cabTypes, setCabTypes] = useState(initialCabTypes);
  const [adding, setAdding] = useState(false);

  const existingVehicleIds = new Set(cabTypes.map((ct) => ct.vehicle_id));

  return (
    <Card className="mb-3">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Cab Options — {duration.label}</CardTitle>
            <Badge variant="outline" className="text-xs">{duration.nights}N / {duration.days}D</Badge>
            {cabTypes.length > 0 && (
              <Badge variant="secondary" className="text-xs">{cabTypes.length} type{cabTypes.length !== 1 ? "s" : ""}</Badge>
            )}
          </div>
          {!adding && (
            <Button
              size="sm" variant="outline" className="h-6 text-xs gap-1"
              onClick={() => setAdding(true)}
            >
              <Plus className="h-3 w-3" />Add Cab Type
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pt-0 pb-3">
        {adding && (
          <div className="mb-3">
            <AddCabTypeForm
              packageId={packageId}
              duration={duration}
              availableVehicles={availableVehicles}
              existingVehicleIds={existingVehicleIds}
              onAdded={(ct) => { setCabTypes((prev) => [...prev, ct]); setAdding(false); }}
              onCancel={() => setAdding(false)}
            />
          </div>
        )}
        {cabTypes.length > 0 ? (
          cabTypes.map((ct) => (
            <CabTypeCard
              key={ct.id}
              cabType={ct}
              packageId={packageId}
              durationDays={duration.days}
              durationLabel={duration.label}
              onDeleted={(id) => setCabTypes((prev) => prev.filter((c) => c.id !== id))}
              onUpdated={(updated) => setCabTypes((prev) => prev.map((c) => c.id === updated.id ? updated : c))}
            />
          ))
        ) : !adding && (
          <p className="text-xs text-muted-foreground py-3 text-center">
            No cab types configured for this duration. Add one to give customers cab options.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function PricingTab({
  packageId,
  durations,
  stayCategories,
  initialPricings,
  cabTypes,
  availableVehicles,
}: PricingTabProps) {
  if (durations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 rounded-xl border border-dashed bg-muted/30">
        <Settings2 className="h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No durations found</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Add durations in the Route Builder tab first.</p>
      </div>
    );
  }

  if (stayCategories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 rounded-xl border border-dashed bg-muted/30">
        <Settings2 className="h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No stay categories found</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Add stay categories in the Itinerary Builder tab first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 bg-dashboard-base-100 p-8 rounded-xl shadow-lg border border-dashboard-base-content/20">
      {/* ── Margin & GST ── */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Margin &amp; GST Configuration</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Set the margin percentage and GST rate for each duration &amp; stay category combination.
          </p>
        </div>

        <div className="flex items-center gap-3 px-4 py-2 bg-muted/40 rounded-lg text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <span className="w-36 shrink-0">Stay Category</span>
          <div className="flex items-center gap-2 flex-1">
            <span className="w-28 text-center">Margin %</span>
            <span className="w-5" />
            <span className="w-28 text-center">GST %</span>
          </div>
        </div>

        {durations.map((duration) => (
          <Card key={duration.id}>
            <CardHeader className="py-3 px-4">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold">{duration.label}</CardTitle>
                <Badge variant="outline" className="text-xs">{duration.nights}N / {duration.days}D</Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 pt-0 pb-1">
              {stayCategories.map((cat) => {
                const existing = initialPricings.find(
                  (p) => p.duration_id === duration.id && p.stay_category_id === cat.id
                );
                return (
                  <PricingRow
                    key={`${duration.id}-${cat.id}`}
                    packageId={packageId}
                    durationId={duration.id}
                    stayCategory={cat}
                    initialMargin={existing?.margin_percentage ?? 10}
                    initialGst={existing?.gst_percentage ?? 5}
                    hasConfig={!!existing}
                  />
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Cab Options ── */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Car className="h-4 w-4" /> Cab Options
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure the cab types customers can choose from for each duration. Pricing pulls from the destination-based cab pricing system.
          </p>
        </div>

        {availableVehicles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 rounded-xl border border-dashed bg-muted/30">
            <Car className="h-7 w-7 text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">No active vehicles found. Add vehicles in the Vehicles page first.</p>
          </div>
        ) : (
          durations.map((duration) => (
            <CabTypesSection
              key={duration.id}
              packageId={packageId}
              duration={duration}
              initialCabTypes={cabTypes.filter((ct) => ct.duration_id === duration.id)}
              availableVehicles={availableVehicles}
            />
          ))
        )}
      </div>
    </div>
  );
}
