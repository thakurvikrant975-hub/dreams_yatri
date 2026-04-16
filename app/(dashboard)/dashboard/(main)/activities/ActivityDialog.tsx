"use client";

import { useState, useTransition, useEffect } from "react";
import {
  MapPin, Tag, DollarSign, Search, Plus, Pencil,
} from "lucide-react";
import { Button }   from "../components/ui/button";
import { Input }    from "../components/ui/input";
import { Label }    from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Switch }   from "../components/ui/switch";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";
import { cn } from "@/app/lib/utils";
import {
  MultiStepModal,
  useMultiStep,
  type Step,
} from "../components/dashboard/MultiStepModel";
import {
  createActivity,
  updateActivity,
  type ActivityItem,
  type ActivityFormState,
} from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────

type Destination = { id: number; name: string; region: { name: string } };

// ── Constants ─────────────────────────────────────────────────────────────

export const DIFFICULTIES  = ["Easy", "Moderate", "Challenging", "Difficult", "Expert"];
export const CATEGORIES    = [
  "Adventure", "Cultural", "Wildlife", "Water Sports",
  "Trekking", "Sightseeing", "Food & Culinary",
  "Shopping", "Spiritual", "Photography", "Other",
];
export const PRICING_TYPES = [
  { value: "per_person",  label: "Per Person" },
  { value: "flat",        label: "Flat Rate" },
  { value: "per_vehicle", label: "Per Vehicle" },
];

// ── Steps ─────────────────────────────────────────────────────────────────

function makeSteps(): Step[] {
  return [
    {
      id:          "basic",
      title:       "Basic Info",
      description: "Name, destination and category",
      icon:        <MapPin className="h-4 w-4" />,
      validate: (data) => {
        if (!data.name)           return "Activity name is required";
        if (!data.slug)           return "Slug is required";
        if (!/^[a-z0-9-]+$/.test(data.slug as string))
          return "Slug: only lowercase, numbers and hyphens";
        if (!data.destination_id) return "Please select a destination";
        return null;
      },
    },
    {
      id:          "pricing",
      title:       "Pricing",
      description: "Price, type and capacity",
      icon:        <DollarSign className="h-4 w-4" />,
    },
    {
      id:          "details",
      title:       "Details",
      description: "Description and settings",
      icon:        <Tag className="h-4 w-4" />,
    },
    {
      id:          "seo",
      title:       "SEO",
      description: "Meta title and description",
      icon:        <Search className="h-4 w-4" />,
      optional:    true,
    },
  ];
}

// ── Build initial data for edit ───────────────────────────────────────────

function buildInitialData(
  activity: ActivityItem,
): Record<string, Record<string, unknown>> {
  return {
    basic: {
      name:           activity.name,
      slug:           activity.slug,
      destination_id: String(activity.destination.id),
      category:       activity.category       ?? "",
      difficulty:     activity.difficulty     ?? "",
      duration_hours: activity.duration_hours ? String(activity.duration_hours) : "",
      is_active:      activity.is_active,
    },
    pricing: {
      pricing_type:      activity.pricing_type      ?? "",
      price:             activity.price             != null ? String(activity.price)             : "",
      original_price:    activity.original_price    != null ? String(activity.original_price)    : "",
      margin_percentage: String(activity.margin_percentage),
      min_persons:       activity.min_persons != null ? String(activity.min_persons) : "",
      max_persons:       activity.max_persons != null ? String(activity.max_persons) : "",
    },
    details: { description: activity.description ?? "" },
    seo:     { meta_title: activity.meta_title ?? "", meta_desc: activity.meta_desc ?? "" },
  };
}

const EMPTY_DATA: Record<string, Record<string, unknown>> = {
  basic:   { name: "", slug: "", destination_id: "", category: "", difficulty: "", duration_hours: "", is_active: true },
  pricing: { pricing_type: "", price: "", original_price: "", margin_percentage: "0", min_persons: "", max_persons: "" },
  details: { description: "" },
  seo:     { meta_title: "", meta_desc: "" },
};

// ─────────────────────────────────────────────────────────────────────────
// STEP 1 — Basic Info
// ─────────────────────────────────────────────────────────────────────────

function BasicStep({
  destinations,
  isEdit,
}: {
  destinations: Destination[];
  isEdit:       boolean;
}) {
  const { stepData, setStepData } = useMultiStep();
  const data           = stepData["basic"] ?? {};
  const name           = (data.name           as string)  ?? "";
  const slug           = (data.slug           as string)  ?? "";
  const destination_id = (data.destination_id as string)  ?? "";
  const category       = (data.category       as string)  ?? "";
  const difficulty     = (data.difficulty     as string)  ?? "";
  const duration_hours = (data.duration_hours as string)  ?? "";
  const is_active      = (data.is_active      as boolean) ?? true;

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val     = e.target.value;
    const newSlug = isEdit ? slug : val
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
    setStepData("basic", { ...data, name: val, slug: newSlug });

    // Auto-fill SEO title if untouched
    const seo = stepData["seo"] ?? {};
    if (!seo.meta_title) {
      setStepData("seo", {
        ...seo,
        meta_title: `${val} | Dreams Yatri`,
      });
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
          <Select
            value={destination_id}
            onValueChange={v => setStepData("basic", { ...data, destination_id: v })}
          >
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
          <Select
            value={category}
            onValueChange={v => setStepData("basic", { ...data, category: v })}
          >
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
          <Select
            value={difficulty}
            onValueChange={v => setStepData("basic", { ...data, difficulty: v })}
          >
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

      <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
        <div>
          <p className="text-sm font-medium">Active</p>
          <p className="text-xs text-muted-foreground">Show on Dreams Yatri website</p>
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
// STEP 2 — Pricing
// ─────────────────────────────────────────────────────────────────────────

function PricingStep() {
  const { stepData, setStepData } = useMultiStep();
  const data             = stepData["pricing"] ?? {};
  const pricing_type     = (data.pricing_type     as string) ?? "";
  const price            = (data.price            as string) ?? "";
  const original_price   = (data.original_price   as string) ?? "";
  const margin_percentage = (data.margin_percentage as string) ?? "0";
  const min_persons      = (data.min_persons      as string) ?? "";
  const max_persons      = (data.max_persons      as string) ?? "";

  const discount = price && original_price && Number(original_price) > Number(price)
    ? Math.round((1 - Number(price) / Number(original_price)) * 100)
    : null;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Pricing Type</Label>
        <div className="grid grid-cols-3 gap-2">
          {PRICING_TYPES.map(pt => (
            <button
              key={pt.value}
              type="button"
              onClick={() => setStepData("pricing", { ...data, pricing_type: pt.value })}
              className={cn(
                "rounded-xl border-2 p-3 text-sm text-center transition-all",
                pricing_type === pt.value
                  ? "border-primary bg-primary/5 font-medium"
                  : "border-border hover:border-muted-foreground/40",
              )}
            >
              {pt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Price (₹)</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="2500"
            value={price}
            onChange={e => setStepData("pricing", { ...data, price: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Original Price (₹)</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="3000"
            value={original_price}
            onChange={e => setStepData("pricing", { ...data, original_price: e.target.value })}
          />
          {discount && (
            <p className="text-xs text-green-600 font-medium">{discount}% off</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Margin %</Label>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.01"
            placeholder="0"
            value={margin_percentage}
            onChange={e => setStepData("pricing", { ...data, margin_percentage: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Min Persons</Label>
          <Input
            type="number"
            min="1"
            placeholder="1"
            value={min_persons}
            onChange={e => setStepData("pricing", { ...data, min_persons: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Max Persons</Label>
          <Input
            type="number"
            min="1"
            placeholder="20"
            value={max_persons}
            onChange={e => setStepData("pricing", { ...data, max_persons: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// STEP 3 — Details
// ─────────────────────────────────────────────────────────────────────────

function DetailsStep() {
  const { stepData, setStepData } = useMultiStep();
  const data        = stepData["details"] ?? {};
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
  const data       = stepData["seo"]   ?? {};
  const meta_title = (data.meta_title  as string) ?? "";
  const meta_desc  = (data.meta_desc   as string) ?? "";

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
          placeholder="A breathtaking high-altitude trek through Uttarakhand..."
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
// BUILD FORM DATA
// ─────────────────────────────────────────────────────────────────────────

function buildFormData(data: Record<string, unknown>): FormData {
  const fd = new FormData();
  fd.append("name",              (data.name              as string) ?? "");
  fd.append("slug",              (data.slug              as string) ?? "");
  fd.append("destination_id",    (data.destination_id    as string) ?? "");
  fd.append("category",          (data.category          as string) ?? "");
  fd.append("difficulty",        (data.difficulty        as string) ?? "");
  fd.append("duration_hours",    (data.duration_hours    as string) ?? "");
  fd.append("is_active",         String(data.is_active ?? true));
  fd.append("pricing_type",      (data.pricing_type      as string) ?? "");
  fd.append("price",             (data.price             as string) ?? "");
  fd.append("original_price",    (data.original_price    as string) ?? "");
  fd.append("margin_percentage", (data.margin_percentage as string) ?? "0");
  fd.append("min_persons",       (data.min_persons       as string) ?? "");
  fd.append("max_persons",       (data.max_persons       as string) ?? "");
  fd.append("description",       (data.description       as string) ?? "");
  fd.append("meta_title",        (data.meta_title        as string) ?? "");
  fd.append("meta_desc",         (data.meta_desc         as string) ?? "");
  return fd;
}

// ─────────────────────────────────────────────────────────────────────────
// CREATE DIALOG
// ─────────────────────────────────────────────────────────────────────────

export function CreateActivityDialog({
  destinations,
  onCreated,
}: {
  destinations: Destination[];
  onCreated?:   (id: number) => void;
}) {
  const [open,     setOpen]     = useState(false);
  const [modalKey, setModalKey] = useState(0);
  const [isPending, startTransition] = useTransition();
  const STEPS = makeSteps();

  function handleOpenChange(val: boolean) {
    setOpen(val);
    if (!val) setModalKey(k => k + 1);
  }

  async function handleComplete(data: Record<string, unknown>) {
    startTransition(async () => {
      const fd     = buildFormData(data);
      const result = await createActivity({ success: false, message: "" }, fd);
      if (result.success) {
        toast.success(`${result.message} — add images in the edit panel`);
        handleOpenChange(false);
        if (result.id) onCreated?.(result.id);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
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
        <PricingStep />
        <DetailsStep />
        <SeoStep />
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
  activity:     ActivityItem;
  destinations: Destination[];
  open:         boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [modalKey,  setModalKey]     = useState(0);
  const STEPS       = makeSteps();
  const initialData = buildInitialData(activity);

  function handleOpenChange(val: boolean) {
    onOpenChange(val);
    if (!val) setModalKey(k => k + 1);
  }

  async function handleComplete(data: Record<string, unknown>) {
    startTransition(async () => {
      const fd     = buildFormData(data);
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
      <PricingStep />
      <DetailsStep />
      <SeoStep />
    </MultiStepModal>
  );
}