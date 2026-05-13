"use client";

import { useState, useTransition } from "react";
import {
  MapPin, Tag, Search, Plus, Pencil,
  ImageIcon, Star, Trash2, Loader2,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Switch } from "../components/ui/switch";
import { Badge } from "../components/ui/badge";
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
import { ImagePicker, type PickedImage } from "../components/dashboard/ImagePicker";
import { toast } from "sonner";
import { cn } from "@/app/lib/utils";
import {
  MultiStepModal,
  useMultiStep,
  type Step,
} from "../components/dashboard/MultiStepModel";
import { LocationPickerField } from "../components/dashboard/LocationPickerField";
import type { LocationResult } from "../components/dashboard/LocationSearchInput";
import {
  createActivity,
  updateActivity,
  addActivityImages,
  deleteActivityImage,
  setPrimaryActivityImage,
  updateActivityImageLabel,
  type ActivityItem,
  type ActivityImage,
} from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────

type Destination = { id: number; name: string; region: { name: string } };

// ── Constants ─────────────────────────────────────────────────────────────

export const DIFFICULTIES = ["Easy", "Moderate", "Challenging", "Difficult", "Expert"];
export const CATEGORIES = [
  "Adventure", "Cultural", "Wildlife", "Water Sports",
  "Trekking", "Sightseeing", "Food & Culinary",
  "Shopping", "Spiritual", "Photography", "Other",
];

const BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

// ── Steps ─────────────────────────────────────────────────────────────────

function makeSteps(isEdit: boolean): Step[] {
  return [
    {
      id: "basic",
      title: "Basic Info",
      description: "Name, destination and category",
      icon: <MapPin className="h-4 w-4" />,
      validate: (data) => {
        if (!data.name) return "Activity name is required";
        if (!data.slug) return "Slug is required";
        if (!/^[a-z0-9-]+$/.test(data.slug as string))
          return "Slug: only lowercase, numbers and hyphens";
        if (!data.destination_id) return "Please select a destination";
        return null;
      },
    },
    {
      id: "details",
      title: "Details",
      description: "Description and settings",
      icon: <Tag className="h-4 w-4" />,
    },
    {
      id: "seo",
      title: "SEO",
      description: "Meta title and description",
      icon: <Search className="h-4 w-4" />,
      optional: true,
    },
    {
      id: "images",
      title: "Images",
      description: isEdit ? "Manage activity photos" : "Upload activity photos",
      icon: <ImageIcon className="h-4 w-4" />,
      optional: true,
    },
  ];
}

// ── Build initial data ────────────────────────────────────────────────────

function buildInitialData(
  activity: ActivityItem,
): Record<string, Record<string, unknown>> {
  const location: LocationResult | null =
    activity.latitude != null && activity.longitude != null
      ? {
        place_name: `${activity.latitude.toFixed(5)}, ${activity.longitude.toFixed(5)}`,
        place_id: "",
        address: `${activity.latitude.toFixed(5)}, ${activity.longitude.toFixed(5)}`,
        latitude: activity.latitude,
        longitude: activity.longitude,
      }
      : null;
  return {
    basic: {
      name: activity.name,
      slug: activity.slug,
      destination_id: String(activity.destination.id),
      category: activity.category ?? "",
      difficulty: activity.difficulty ?? "",
      duration_hours: activity.duration_hours != null ? String(activity.duration_hours) : "",
      is_active: activity.is_active,
      location,
    },
    details: { description: activity.description ?? "" },
    seo: { meta_title: activity.meta_title ?? "", meta_desc: activity.meta_desc ?? "" },
    images: {},
  };
}

const EMPTY_DATA: Record<string, Record<string, unknown>> = {
  basic: { name: "", slug: "", destination_id: "", category: "", difficulty: "", duration_hours: "", is_active: true, location: null },
  details: { description: "" },
  seo: { meta_title: "", meta_desc: "" },
  images: {},
};

// ─────────────────────────────────────────────────────────────────────────
// STEP 1 — Basic Info
// ─────────────────────────────────────────────────────────────────────────

function BasicStep({
  destinations,
  isEdit,
}: {
  destinations: Destination[];
  isEdit: boolean;
}) {
  const { stepData, setStepData } = useMultiStep();
  const data = stepData["basic"] ?? {};
  const name = (data.name as string) ?? "";
  const slug = (data.slug as string) ?? "";
  const destination_id = (data.destination_id as string) ?? "";
  const category = (data.category as string) ?? "";
  const difficulty = (data.difficulty as string) ?? "";
  const duration_hours = (data.duration_hours as string) ?? "";
  const is_active = (data.is_active as boolean) ?? true;
  const location = (data.location as LocationResult | null) ?? null;

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    const newSlug = isEdit ? slug : val
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
    setStepData("basic", { ...data, name: val, slug: newSlug });
    const seo = stepData["seo"] ?? {};
    if (!seo.meta_title) {
      setStepData("seo", { ...seo, meta_title: `${val} | Dreams Yatri` });
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Activity Name <span className="text-destructive">*</span></Label>
          <Input
            value={name}
            onChange={handleNameChange}
            placeholder="Valley of Flowers Trek"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Slug <span className="text-destructive">*</span></Label>
          <Input
            value={slug}
            onChange={e => setStepData("basic", { ...data, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
            placeholder="valley-of-flowers-trek"
            readOnly={isEdit}
            className={isEdit ? "bg-muted text-muted-foreground cursor-not-allowed" : ""}
          />
          {isEdit && <p className="text-xs text-muted-foreground">Cannot change after creation</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Destination <span className="text-destructive">*</span></Label>
          <Select value={destination_id} onValueChange={v => setStepData("basic", { ...data, destination_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
            <SelectContent>
              {destinations.map(d => (
                <SelectItem key={d.id} value={String(d.id)}>
                  {d.name}
                  <span className="text-muted-foreground text-xs ml-1">({d.region.name})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={category} onValueChange={v => setStepData("basic", { ...data, category: v })}>
            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Difficulty</Label>
          <Select value={difficulty} onValueChange={v => setStepData("basic", { ...data, difficulty: v })}>
            <SelectTrigger><SelectValue placeholder="Select difficulty" /></SelectTrigger>
            <SelectContent>
              {DIFFICULTIES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Duration (hours)</Label>
          <Input
            type="number"
            min="0"
            step="0.5"
            placeholder="4.5"
            value={duration_hours}
            onChange={e => setStepData("basic", { ...data, duration_hours: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Location <span className="text-xs text-muted-foreground">(optional)</span></Label>
        <LocationPickerField
          value={location}
          onChange={v => setStepData("basic", { ...data, location: v })}
          placeholder="Search activity location or pin on map…"
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
        <div>
          <p className="text-sm font-medium">Active</p>
          <p className="text-xs text-muted-foreground">Show on Dreams Yatri</p>
        </div>
        <Switch
          checked={is_active}
          onCheckedChange={v => setStepData("basic", { ...data, is_active: v })}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// STEP 2 — Details
// ─────────────────────────────────────────────────────────────────────────

function DetailsStep() {
  const { stepData, setStepData } = useMultiStep();
  const data = stepData["details"] ?? {};
  const description = (data.description as string) ?? "";

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea
          placeholder="A brief description of this activity..."
          value={description}
          onChange={e => setStepData("details", { description: e.target.value })}
          rows={8}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// STEP 4 — SEO
// ─────────────────────────────────────────────────────────────────────────

function SeoStep() {
  const { stepData, setStepData } = useMultiStep();
  const data = stepData["seo"] ?? {};
  const meta_title = (data.meta_title as string) ?? "";
  const meta_desc = (data.meta_desc as string) ?? "";

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Meta Title</Label>
          <span className={`text-xs ${meta_title.length > 60 ? "text-destructive" : "text-muted-foreground"}`}>
            {meta_title.length}/60
          </span>
        </div>
        <Input
          placeholder="Valley of Flowers Trek | Dreams Yatri"
          value={meta_title}
          onChange={e => setStepData("seo", { ...data, meta_title: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Meta Description</Label>
          <span className={`text-xs ${meta_desc.length > 160 ? "text-destructive" : "text-muted-foreground"}`}>
            {meta_desc.length}/160
          </span>
        </div>
        <Textarea
          placeholder="A breathtaking high-altitude trek..."
          value={meta_desc}
          onChange={e => setStepData("seo", { ...data, meta_desc: e.target.value })}
          rows={3}
        />
      </div>
      {(meta_title || meta_desc) && (
        <div className="rounded-lg border p-3 bg-muted/20 space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">
            Search Preview
          </p>
          <p className="text-xs text-green-700">dreamsyatri.com/activities/...</p>
          <p className="text-sm text-blue-600 font-medium">{meta_title || "Page title"}</p>
          <p className="text-xs text-muted-foreground line-clamp-2">{meta_desc || "Page description..."}</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// STEP 5 — Images (create mode: queue picks; edit mode: full management)
// ─────────────────────────────────────────────────────────────────────────

// Create mode — just pick images, keys stored for submission after activity is created
function ImagesCreateStep({
  picks,
  onChange,
}: {
  picks: PickedImage[];
  onChange: (picks: PickedImage[]) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">Activity Photos</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Images are uploaded to R2 now and linked after activity is created
        </p>
      </div>
      <ImagePicker
        folder="activities"
        value={picks}
        onChange={onChange}
        maxFiles={10}
        label="Upload Activity Photos"
        hint="JPG, PNG, WebP · Upload multiple at once"
      />
      {picks.length > 0 && (
        <div className="rounded-lg bg-muted/30 border px-3 py-2 text-xs text-muted-foreground">
          {picks.filter(p => p.status === "uploaded").length} of {picks.length} uploaded ·
          {" "}First image will be set as primary
        </div>
      )}
    </div>
  );
}

function ImageThumbEditable({
  img,
  isPending,
  onSetPrimary,
  onDelete,
}: {
  img: ActivityImage;
  isPending: boolean;
  onSetPrimary: () => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(img.label ?? "");
  const [, startLabelTransition] = useTransition();

  function saveLabel() {
    if (label === (img.label ?? "")) return;
    startLabelTransition(async () => {
      const r = await updateActivityImageLabel(img.id, label);
      if (!r.success) toast.error(r.message);
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className={cn(
        "group relative aspect-square rounded-xl overflow-hidden border-2 bg-muted",
        img.is_primary ? "border-primary" : "border-border",
      )}>
        <img
          src={`${BASE}/${img.thumbnail ?? img.url}`}
          alt={label || "Activity image"}
          className="w-full h-full object-cover"
        />
        {img.is_primary && (
          <Badge className="absolute bottom-1 left-1 text-[9px] px-1 py-0 pointer-events-none bg-primary">
            <Star className="h-2 w-2 mr-0.5" />Primary
          </Badge>
        )}
        <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
          {!img.is_primary && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="text-[10px] h-6 px-2"
              disabled={isPending}
              onClick={onSetPrimary}
            >
              <Star className="h-2.5 w-2.5 mr-1" />Primary
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" size="sm" variant="destructive" className="text-[10px] h-6 px-2">
                <Trash2 className="h-2.5 w-2.5 mr-1" />Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Image</AlertDialogTitle>
                <AlertDialogDescription>Permanently deletes from R2 storage too.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-destructive text-white hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <input
        type="text"
        value={label}
        onChange={e => setLabel(e.target.value)}
        onBlur={saveLabel}
        onKeyDown={e => e.key === "Enter" && saveLabel()}
        placeholder="Add label…"
        className="w-full text-[11px] border border-border rounded-md px-2 py-1 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}

// Edit mode — manage existing + upload new
function ImagesEditStep({ activity_id, initialImages }: { activity_id: number; initialImages: ActivityImage[] }) {
  const [images, setImages] = useState<ActivityImage[]>(initialImages);
  const [newPicks, setNewPicks] = useState<PickedImage[]>([]);
  const [isPending, startTransition] = useTransition();

  function handleDelete(img: ActivityImage) {
    startTransition(async () => {
      const r = await deleteActivityImage(img.id, activity_id, img.url, img.thumbnail ?? undefined);
      if (r.success) {
        toast.success(r.message);
        setImages(prev => prev.filter(i => i.id !== img.id));
      } else {
        toast.error(r.message);
      }
    });
  }

  function handleSetPrimary(img: ActivityImage) {
    startTransition(async () => {
      const r = await setPrimaryActivityImage(img.id, activity_id);
      if (r.success) {
        toast.success(r.message);
        setImages(prev => prev.map(i => ({ ...i, is_primary: i.id === img.id })));
      } else {
        toast.error(r.message);
      }
    });
  }

  function handleSaveNew() {
    const uploaded = newPicks.filter(p => p.status === "uploaded" && p.key);
    if (uploaded.length === 0) { toast.error("Wait for uploads to finish"); return; }

    startTransition(async () => {
      const r = await addActivityImages(
        activity_id,
        uploaded.map(p => ({ url: p.key!, thumbnail: p.key })),
      );
      if (r.success) {
        toast.success(r.message);
        setNewPicks([]);
        const added: ActivityImage[] = uploaded.map((p, i) => ({
          id: Date.now() + i,
          url: p.key!,
          thumbnail: p.key ?? null,
          is_primary: images.length === 0 && i === 0,
          sort_order: images.length + i,
          label: null,
        }));
        setImages(prev => [...prev, ...added]);
      } else {
        toast.error(r.message);
      }
    });
  }

  return (
    <div className="space-y-5">

      {/* Existing images */}
      {images.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Current Photos</p>
            <span className="text-xs text-muted-foreground">
              {images.length} photo{images.length !== 1 ? "s" : ""} · Hover to manage
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {images
              .sort((a, b) => a.sort_order - b.sort_order)
              .map(img => (
                <ImageThumbEditable
                  key={img.id}
                  img={img}
                  isPending={isPending}
                  onSetPrimary={() => handleSetPrimary(img)}
                  onDelete={() => handleDelete(img)}
                />
              ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-6 border-2 border-dashed rounded-xl">
          <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No photos yet</p>
        </div>
      )}

      {/* Upload new */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Add More Photos</p>
        <ImagePicker
          folder="activities"
          value={newPicks}
          onChange={setNewPicks}
          maxFiles={10}
          label="Upload Activity Photos"
          hint="JPG, PNG, WebP"
        />
        {newPicks.length > 0 && (
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={handleSaveNew}
              disabled={isPending || newPicks.some(p => p.status === "uploading")}
              className="gap-1.5"
            >
              {isPending
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving...</>
                : <>Save {newPicks.filter(p => p.status === "uploaded").length} Photo{newPicks.length !== 1 ? "s" : ""}</>
              }
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// BUILD FORM DATA
// ─────────────────────────────────────────────────────────────────────────

function buildFormData(data: Record<string, unknown>): FormData {
  const fd = new FormData();
  fd.append("name", (data.name as string) ?? "");
  fd.append("slug", (data.slug as string) ?? "");
  fd.append("destination_id", (data.destination_id as string) ?? "");
  fd.append("category", (data.category as string) ?? "");
  fd.append("difficulty", (data.difficulty as string) ?? "");
  fd.append("duration_hours", (data.duration_hours as string) ?? "");
  fd.append("is_active", String(data.is_active ?? true));
  fd.append("description", (data.description as string) ?? "");
  fd.append("meta_title", (data.meta_title as string) ?? "");
  fd.append("meta_desc", (data.meta_desc as string) ?? "");
  const loc = data.location as LocationResult | null;
  fd.append("latitude", loc?.latitude != null ? String(loc.latitude) : "");
  fd.append("longitude", loc?.longitude != null ? String(loc.longitude) : "");
  return fd;
}

// ─────────────────────────────────────────────────────────────────────────
// CREATE DIALOG
// ─────────────────────────────────────────────────────────────────────────

export function CreateActivityDialog({
  destinations,
}: {
  destinations: Destination[];
}) {
  const [open, setOpen] = useState(false);
  const [modalKey, setModalKey] = useState(0);
  const [isPending, startTransition] = useTransition();

  // Image picks managed outside MultiStepModal so they persist across step navigation
  const [imagePicks, setImagePicks] = useState<PickedImage[]>([]);

  const STEPS = makeSteps(false);

  function handleOpenChange(val: boolean) {
    setOpen(val);
    if (!val) {
      setModalKey(k => k + 1);
      setImagePicks([]);
    }
  }

  async function handleComplete(data: Record<string, unknown>) {
    startTransition(async () => {
      // 1. Create the activity
      const fd = buildFormData(data);
      const result = await createActivity({ success: false, message: "" }, fd);

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      // 2. If images picked, link them to the new activity
      const uploaded = imagePicks.filter(p => p.status === "uploaded" && p.key);
      if (uploaded.length > 0 && result.id) {
        await addActivityImages(
          result.id,
          uploaded.map(p => ({ url: p.key!, thumbnail: p.key })),
        );
      }

      toast.success(result.message);
      handleOpenChange(false);
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} size="lg"
        className="gap-2 bg-dashboard-primary text-dashboard-primary-content hover:bg-dashboard-primary/90 rounded-md transition-all duration-200 hover:scale-[1.02] shadow-sm">
        <Plus className="" />
        Add Activity
      </Button>

      <MultiStepModal
        key={modalKey}
        open={open}
        onOpenChange={handleOpenChange}
        title="Create Activity"
        description="Add a new activity across any destination"
        steps={STEPS}
        onComplete={handleComplete}
        isSubmitting={isPending}
        submitLabel="Create Activity"
        initialStepData={EMPTY_DATA}
      >
        <BasicStep destinations={destinations} isEdit={false} />
        <DetailsStep />
        <SeoStep />
        <ImagesCreateStep picks={imagePicks} onChange={setImagePicks} />
      </MultiStepModal>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// EDIT DIALOG
// ─────────────────────────────────────────────────────────────────────────

export function EditActivityDialog({
  activity,
  destinations,
  open,
  onOpenChange,
}: {
  activity: ActivityItem;
  destinations: Destination[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [modalKey, setModalKey] = useState(0);
  const STEPS = makeSteps(true);
  const initialData = buildInitialData(activity);

  function handleOpenChange(val: boolean) {
    onOpenChange(val);
    if (!val) setModalKey(k => k + 1);
  }

  async function handleComplete(data: Record<string, unknown>) {
    startTransition(async () => {
      const fd = buildFormData(data);
      const result = await updateActivity(activity.id, { success: false, message: "" }, fd);
      if (result.success) {
        toast.success(result.message);
        handleOpenChange(false);
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
      title="Edit Activity"
      description={activity.name}
      steps={STEPS}
      onComplete={handleComplete}
      isSubmitting={isPending}
      submitLabel="Save Changes"
      initialStepData={initialData}
    >
      <BasicStep destinations={destinations} isEdit={true} />
      <DetailsStep />
      <SeoStep />
      <ImagesEditStep activity_id={activity.id} initialImages={activity.images} />
    </MultiStepModal>
  );
}