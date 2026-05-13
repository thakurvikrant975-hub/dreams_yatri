"use client";

import { useState, useTransition } from "react";
import { Plus, MapPin, ImageIcon, Search, Settings2, Pencil } from "lucide-react";
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

import {
  MultiStepModal,
  useMultiStep,
  type Step,
} from "../components/dashboard/MultiStepModel";

import {
  ImagePicker,
  type PickedImage,
} from "../components/dashboard/ImagePicker";
import { createDestination, updateDestination } from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────

type Region = {
  id:   number;
  name: string;
  slug: string;
};

type Destination = {
  id:          number;
  name:        string;
  slug:        string;
  country:     string;
  region_id:   number;
  description: string | null;
  meta_title:  string | null;
  meta_desc:   string | null;
  thumbnail:   string | null;
  cover_image: string | null;
  is_active:   boolean;
};

// ── Build initial data for edit mode ─────────────────────────────────────

function buildInitialData(
  destination?: Destination,
): Record<string, Record<string, unknown>> {
  if (!destination) return {};

  return {
    basic: {
      name:      destination.name,
      slug:      destination.slug,
      country:   destination.country,
      region_id: String(destination.region_id),
    },
    images: {
      cover: destination.cover_image ? [{
        id:         "existing-cover",
        key:        destination.cover_image,
        url:        `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${destination.cover_image}`,
        name:       "cover",
        size:       0,
        status:     "uploaded",
        is_primary: true,
      }] as PickedImage[] : [],
      thumbnail: destination.thumbnail ? [{
        id:         "existing-thumb",
        key:        destination.thumbnail,
        url:        `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${destination.thumbnail}`,
        name:       "thumbnail",
        size:       0,
        status:     "uploaded",
        is_primary: true,
      }] as PickedImage[] : [],
    },
    details: {
      description: destination.description ?? "",
      is_active:   destination.is_active,
    },
    seo: {
      meta_title: destination.meta_title ?? "",
      meta_desc:  destination.meta_desc  ?? "",
    },
  };
}

// ── Step definitions ──────────────────────────────────────────────────────

function makeSteps(): Step[] {
  return [
    {
      id:          "basic",
      title:       "Basic Info",
      description: "Name, slug and region",
      icon:        <MapPin className="h-4 w-4" />,
      validate: (data) => {
        if (!data.name)      return "Destination name is required";
        if (!data.slug)      return "Slug is required";
        if (!/^[a-z0-9-]+$/.test(data.slug as string))
          return "Slug must be lowercase letters, numbers and hyphens only";
        if (!data.country)   return "Country is required";
        if (!data.region_id) return "Please select a region";
        return null;
      },
    },
    {
      id:          "images",
      title:       "Images",
      description: "Cover and thumbnail photos",
      icon:        <ImageIcon className="h-4 w-4" />,
      optional:    true,
    },
    {
      id:          "details",
      title:       "Details",
      description: "Description and settings",
      icon:        <Settings2 className="h-4 w-4" />,
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

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — Basic Info
// ─────────────────────────────────────────────────────────────────────────────

function BasicInfoStep({
  destination,
  regions,
}: {
  destination?: Destination;
  regions:      Region[];
}) {
  const { stepData, setStepData } = useMultiStep();
  const data = stepData["basic"] ?? {};

  const name      = (data.name      as string) ?? "";
  const slug      = (data.slug      as string) ?? "";
  const country   = (data.country   as string) ?? "";
  const region_id = (data.region_id as string) ?? "";

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newName = e.target.value;
    if (destination) {
      setStepData("basic", { ...data, name: newName });
    } else {
      const newSlug = newName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim();
      setStepData("basic", { ...data, name: newName, slug: newSlug });
    }
  }

  return (
    <div className="space-y-4">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="d-name">
          Destination Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="d-name"
          placeholder="Kashmir"
          value={name}
          onChange={handleNameChange}
          autoComplete="off"
        />
      </div>

      {/* Slug */}
      <div className="space-y-1.5">
        <Label htmlFor="d-slug">
          Slug <span className="text-destructive">*</span>
        </Label>
        <Input
          id="d-slug"
          placeholder="kashmir"
          value={slug}
          onChange={e => setStepData("basic", {
            ...data,
            slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
          })}
          readOnly={!!destination}
          className={destination ? "bg-muted text-muted-foreground cursor-not-allowed" : ""}
        />
        <p className="text-xs text-muted-foreground">
          {destination
            ? "Slug cannot be changed after creation"
            : <>URL: dreamsyatri.com/destinations/<strong>{slug || "kashmir"}</strong></>
          }
        </p>
      </div>

      {/* Region */}
      <div className="space-y-1.5">
        <Label>
          Region <span className="text-destructive">*</span>
        </Label>
        <Select
          value={region_id}
          onValueChange={v => setStepData("basic", { ...data, region_id: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a region" />
          </SelectTrigger>
          <SelectContent>
            {regions.map(r => (
              <SelectItem key={r.id} value={String(r.id)}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Country */}
      <div className="space-y-1.5">
        <Label htmlFor="d-country">
          Country <span className="text-destructive">*</span>
        </Label>
        <Input
          id="d-country"
          placeholder="India"
          value={country}
          onChange={e => setStepData("basic", { ...data, country: e.target.value })}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — Images
// ─────────────────────────────────────────────────────────────────────────────

function ImagesStep() {
  const { stepData, setStepData } = useMultiStep();
  const data = stepData["images"] ?? {};

  const coverImages = (data.cover     as PickedImage[]) ?? [];
  const thumbImages = (data.thumbnail as PickedImage[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div>
          <Label>Cover Image</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Hero image shown on destination page · 1920×600 recommended
          </p>
        </div>
        <ImagePicker
          folder="destinations"
          value={coverImages}
          onChange={imgs => setStepData("images", { ...data, cover: imgs })}
          maxFiles={1}
          label="Upload Cover Image"
          hint="Wide banner image · JPG, PNG, WebP"
        />
      </div>

      <div className="space-y-2">
        <div>
          <Label>Thumbnail</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Small image used in listing cards · 400×250 recommended
          </p>
        </div>
        <ImagePicker
          folder="destinations"
          value={thumbImages}
          onChange={imgs => setStepData("images", { ...data, thumbnail: imgs })}
          maxFiles={1}
          label="Upload Thumbnail"
          hint="Card image · JPG, PNG, WebP"
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — Details
// ─────────────────────────────────────────────────────────────────────────────

function DetailsStep() {
  const { stepData, setStepData } = useMultiStep();
  const data = stepData["details"] ?? {};

  const description = (data.description as string)  ?? "";
  const is_active   = (data.is_active   as boolean) ?? true;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="d-desc">Description</Label>
        <Textarea
          id="d-desc"
          placeholder="A brief description of this destination..."
          value={description}
          onChange={e => setStepData("details", { ...data, description: e.target.value })}
          rows={4}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
        <div>
          <p className="text-sm font-medium">Active</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Destination visible on Dreams Yatri
          </p>
        </div>
        <Switch
          checked={is_active}
          onCheckedChange={v => setStepData("details", { ...data, is_active: v })}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — SEO
// ─────────────────────────────────────────────────────────────────────────────

function SEOStep() {
  const { stepData, setStepData } = useMultiStep();
  const data = stepData["seo"] ?? {};

  const meta_title = (data.meta_title as string) ?? "";
  const meta_desc  = (data.meta_desc  as string) ?? "";
  const titleLen   = meta_title.length;
  const descLen    = meta_desc.length;

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="d-meta-title">Meta Title</Label>
          <span className={`text-xs ${titleLen > 60 ? "text-destructive" : "text-muted-foreground"}`}>
            {titleLen}/60
          </span>
        </div>
        <Input
          id="d-meta-title"
          placeholder="Kashmir Tour Packages | Dreams Yatri"
          value={meta_title}
          onChange={e => setStepData("seo", { ...data, meta_title: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="d-meta-desc">Meta Description</Label>
          <span className={`text-xs ${descLen > 160 ? "text-destructive" : "text-muted-foreground"}`}>
            {descLen}/160
          </span>
        </div>
        <Textarea
          id="d-meta-desc"
          placeholder="Explore Kashmir with Dreams Yatri — Dal Lake, Gulmarg and more..."
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
          <p className="text-xs text-green-700 dark:text-green-500">
            dreamsyatri.com/destinations/kashmir
          </p>
          <p className="text-sm text-blue-600 dark:text-blue-400 font-medium leading-tight">
            {meta_title || "Page title"}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {meta_desc || "Page description..."}
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE DIALOG
// ─────────────────────────────────────────────────────────────────────────────

export function CreateDestinationDialog({ regions }: { regions: Region[] }) {
  const [open,       setOpen]         = useState(false);
  const [isPending,  startTransition] = useTransition();

  const STEPS = makeSteps();

  async function handleComplete(data: Record<string, unknown>) {
    startTransition(async () => {
      const formData = new FormData();

      formData.append("name",      (data.name      as string) ?? "");
      formData.append("slug",      (data.slug      as string) ?? "");
      formData.append("country",   (data.country   as string) ?? "India");
      formData.append("region_id", (data.region_id as string) ?? "");

      const coverImgs = (data.cover     as PickedImage[]) ?? [];
      const thumbImgs = (data.thumbnail as PickedImage[]) ?? [];
      formData.append("cover_image", coverImgs[0]?.key ?? "");
      formData.append("thumbnail",   thumbImgs[0]?.key ?? "");

      formData.append("description", (data.description as string) ?? "");
      formData.append("is_active",   String(data.is_active ?? true));
      formData.append("meta_title",  (data.meta_title as string) ?? "");
      formData.append("meta_desc",   (data.meta_desc  as string) ?? "");

      const result = await createDestination({ success: false, message: "" }, formData);

      if (result.success) {
        toast.success(result.message);
        setOpen(false);
      } else {
        toast.error(result.message);
      }
    }); 
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} size="lg" className="rounded-md bg-dashboard-primary text-dashboard-base-100 py-2.5 px-4 hover:bg-dashboard-primary hover:scale-105 duration-300 hover:text-dashboard-base-100 border border-dashboard-primary">
        <Plus className="mr-2 h-4 w-4" />
        Add Destination
      </Button>

      <MultiStepModal
        open={open}
        onOpenChange={setOpen}
        title="Create Destination"
        description="Add a new travel destination to Dreams Yatri"
        steps={STEPS}
        onComplete={handleComplete}
        isSubmitting={isPending}
        submitLabel="Create Destination"
        initialStepData={{}}
      >
        <BasicInfoStep regions={regions} />
        <ImagesStep />
        <DetailsStep />
        <SEOStep />
      </MultiStepModal>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EDIT DIALOG
// ─────────────────────────────────────────────────────────────────────────────

export function EditDestinationDialog({
  destination,
  regions,
}: {
  destination: Destination;
  regions:     Region[];
}) {
  const [open,       setOpen]         = useState(false);
  const [isPending,  startTransition] = useTransition();

  const STEPS       = makeSteps();
  const initialData = buildInitialData(destination);

  async function handleComplete(data: Record<string, unknown>) {
    startTransition(async () => {
      const formData = new FormData();

      formData.append("name",      (data.name      as string) ?? destination.name);
      formData.append("slug",      destination.slug);
      formData.append("country",   (data.country   as string) ?? destination.country);
      formData.append("region_id", (data.region_id as string) ?? String(destination.region_id));

      const coverImgs = data.cover     as PickedImage[] | undefined;
      const thumbImgs = data.thumbnail as PickedImage[] | undefined;
      formData.append("cover_image", coverImgs?.[0]?.key ?? destination.cover_image ?? "");
      formData.append("thumbnail",   thumbImgs?.[0]?.key ?? destination.thumbnail   ?? "");

      formData.append("description", (data.description as string) ?? destination.description ?? "");
      formData.append("is_active",   String(data.is_active ?? destination.is_active));
      formData.append("meta_title",  (data.meta_title as string) ?? destination.meta_title ?? "");
      formData.append("meta_desc",   (data.meta_desc  as string) ?? destination.meta_desc  ?? "");

      const result = await updateDestination(destination.id, { success: false, message: "" }, formData);

      if (result.success) {
        toast.success(result.message);
        setOpen(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>

      <MultiStepModal
        open={open}
        onOpenChange={setOpen}
        title="Edit Destination"
        description={`Editing: ${destination.name}`}
        steps={STEPS}
        onComplete={handleComplete}
        isSubmitting={isPending}
        submitLabel="Save Changes"
        initialStepData={initialData}
      >
        <BasicInfoStep destination={destination} regions={regions} />
        <ImagesStep />
        <DetailsStep />
        <SEOStep />
      </MultiStepModal>
    </>
  );
}