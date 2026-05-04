"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { Button } from "../../../components/ui/button";
import { Switch } from "../../../components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../../../components/ui/select";
import { Loader2, Plus, X, AlertCircle } from "lucide-react";
import { ImagePicker, type PickedImage } from "../../../components/dashboard/ImagePicker";
import { toast } from "sonner";
import {
  updatePackageAction,
  createDurationAction,
  updateDurationAction,
  deleteDurationAction,
} from "@/app/actions/packages/package.actions";
import { UpdatePackageSchema, type UpdatePackageDTO } from "@/app/lib/validators/packages";
import type { PackageWithRelations } from "@/app/types/packages";

type Destination = { id: number; name: string; slug: string; region: { name: string } };
const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";

// ── Duration sub-form ─────────────────────────────────────────────────────────

type DurationForm = { label: string; days: string; nights: string; is_default: boolean };

function DurationRow({
  d,
  onEdit,
  onDelete,
  disabled,
}: {
  d: { id: number; label: string; days: number; nights: number; is_default: boolean };
  onEdit: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3 bg-card">
      <div>
        <p className="font-medium text-sm">{d.label}</p>
        <p className="text-xs text-muted-foreground">
          {d.days}D / {d.nights}N{d.is_default ? " · Default" : ""}
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onEdit}>Edit</Button>
        <Button
          size="sm" variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
          disabled={disabled}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export function BasicTab({
  pkg,
  destinations,
}: {
  pkg: PackageWithRelations;
  destinations: Destination[];
}) {
  const [isPending, startTransition] = useTransition();
  const [thumbnail, setThumbnail] = useState<PickedImage[]>(
    pkg.thumbnail
      ? [{ id: "thumb", key: pkg.thumbnail, url: `${base}/${pkg.thumbnail}`, name: "thumbnail", size: 0, status: "uploaded" as const, is_primary: true }]
      : []
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<UpdatePackageDTO>({
    resolver: zodResolver(UpdatePackageSchema),
    defaultValues: {
      title: pkg.title,
      slug: pkg.slug,
      destination_id: pkg.destination.id,
      description: pkg.description ?? "",
      is_active: pkg.is_active,
    },
  });

  const isActive = watch("is_active");
  const titleValue = watch("title");

  function handleTitleBlur() {
    const slugVal = watch("slug");
    if (!slugVal) {
      setValue("slug", titleValue.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    }
  }

  function onSubmit(data: UpdatePackageDTO) {
    startTransition(async () => {
      const res = await updatePackageAction(pkg.id, {
        ...data,
        thumbnail: thumbnail[0]?.key || undefined,
      });
      if (res.success) toast.success("Package saved");
      else toast.error(res.error);
    });
  }

  // ── Durations ─────────────────────────────────────────────────────────────────
  const [durations, setDurations] = useState(pkg.durations);
  const [showDurForm, setShowDurForm] = useState(false);
  const [editingDurId, setEditingDurId] = useState<number | null>(null);
  const [durForm, setDurForm] = useState<DurationForm>({ label: "", days: "", nights: "", is_default: false });
  const [durPending, startDurTransition] = useTransition();

  function openNewDur() {
    setEditingDurId(null);
    setDurForm({ label: "", days: "", nights: "", is_default: false });
    setShowDurForm(true);
  }

  function openEditDur(d: typeof durations[number]) {
    setEditingDurId(d.id);
    setDurForm({ label: d.label, days: String(d.days), nights: String(d.nights), is_default: d.is_default });
    setShowDurForm(true);
  }

  function handleDaysChange(val: string) {
    const n = parseInt(val);
    setDurForm(f => ({ ...f, days: val, nights: !isNaN(n) ? String(n - 1) : f.nights }));
  }

  function saveDuration() {
    const days = parseInt(durForm.days);
    const nights = parseInt(durForm.nights);
    if (!durForm.label.trim()) return toast.error("Label required");
    if (isNaN(days) || days < 1) return toast.error("Invalid days");
    if (nights !== days - 1) return toast.error(`Nights must be ${days - 1}`);

    const slugVal = durForm.label.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    startDurTransition(async () => {
      if (editingDurId) {
        const res = await updateDurationAction(editingDurId, pkg.id, {
          slug: slugVal, label: durForm.label, days, nights, is_default: durForm.is_default,
        });
        if (res.success) {
          toast.success("Duration updated");
          setDurations(d => d.map(x => x.id === editingDurId
            ? { ...x, label: durForm.label, days, nights, is_default: durForm.is_default }
            : (durForm.is_default ? { ...x, is_default: false } : x)
          ));
        } else toast.error(res.error);
      } else {
        const res = await createDurationAction({
          package_id: pkg.id, slug: slugVal, label: durForm.label, days, nights,
          is_default: durForm.is_default, sort_order: durations.length, is_active: true,
        });
        if (res.success) {
          toast.success("Duration added");
          setDurations(d => [
            ...(durForm.is_default ? d.map(x => ({ ...x, is_default: false })) : d),
            {
              id: res.data.id, package_id: pkg.id, slug: slugVal, label: durForm.label,
              days, nights, is_default: durForm.is_default, sort_order: d.length,
              is_active: true, thumbnail_url: null, created_at: new Date(), updated_at: new Date(),
            },
          ]);
        } else toast.error(res.error);
      }
      setShowDurForm(false);
      setEditingDurId(null);
    });
  }

  function deleteDuration(id: number) {
    startDurTransition(async () => {
      const res = await deleteDurationAction(id, pkg.id);
      if (res.success) {
        toast.success("Duration deleted");
        setDurations(d => d.filter(x => x.id !== id));
      } else toast.error(res.error);
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* ── Basic Info ──────────────────────────────────────────── */}
      <Card>
        <CardHeader><CardTitle className="text-base">Basic Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Title <span className="text-destructive">*</span></Label>
              <Input
                {...register("title")}
                onBlur={handleTitleBlur}
                placeholder="Kashmir Valley Explorer"
              />
              {errors.title && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />{errors.title.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Slug <span className="text-destructive">*</span></Label>
              <Input
                {...register("slug")}
                className="font-mono text-sm"
                placeholder="kashmir-valley-explorer"
              />
              {errors.slug && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />{errors.slug.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Destination <span className="text-destructive">*</span></Label>
            <Select
              defaultValue={String(pkg.destination.id)}
              onValueChange={v => setValue("destination_id", Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {destinations.map(d => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}{d.region ? ` · ${d.region.name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.destination_id && (
              <p className="text-xs text-destructive">{errors.destination_id.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea {...register("description")} rows={4} placeholder="Package overview for customers..." />
          </div>

          {/* Thumbnail */}
          <div className="space-y-1.5">
            <Label>Thumbnail</Label>
            <p className="text-xs text-muted-foreground">Listing card image · 4:3 recommended</p>
            <ImagePicker
              folder="packages"
              value={thumbnail}
              onChange={setThumbnail}
              maxFiles={1}
              label="Upload Thumbnail"
              hint="800×600 · JPG, PNG, WebP"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">Visible to customers on Dreams Yatri</p>
            </div>
            <Switch
              checked={isActive}
              onCheckedChange={v => setValue("is_active", v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Durations ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Trip Durations</CardTitle>
            <Button type="button" size="sm" variant="outline" onClick={openNewDur}>
              <Plus className="h-4 w-4 mr-1" /> Add Duration
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {durations.length === 0 && !showDurForm && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No durations yet — add one to enable routes and itineraries
            </p>
          )}

          {durations.map(d => (
            <DurationRow
              key={d.id}
              d={d}
              onEdit={() => openEditDur(d)}
              onDelete={() => deleteDuration(d.id)}
              disabled={durPending}
            />
          ))}

          {showDurForm && (
            <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
              <p className="text-sm font-medium">{editingDurId ? "Edit Duration" : "New Duration"}</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1 space-y-1.5">
                  <Label className="text-xs">Label</Label>
                  <Input
                    value={durForm.label}
                    onChange={e => setDurForm(f => ({ ...f, label: e.target.value }))}
                    placeholder="5 Days 4 Nights"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Days</Label>
                  <Input
                    type="number" min={1}
                    value={durForm.days}
                    onChange={e => handleDaysChange(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nights</Label>
                  <Input
                    type="number" min={0}
                    value={durForm.nights}
                    onChange={e => setDurForm(f => ({ ...f, nights: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={durForm.is_default}
                  onCheckedChange={v => setDurForm(f => ({ ...f, is_default: v }))}
                />
                <Label className="text-sm">Set as default duration</Label>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={saveDuration} disabled={durPending}>
                  {durPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                  {editingDurId ? "Update" : "Add"}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setShowDurForm(false); setEditingDurId(null); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending || !isDirty}>
          {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
