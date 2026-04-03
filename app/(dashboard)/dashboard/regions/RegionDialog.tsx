"use client";

import { useState, useTransition } from "react";
import { Plus, Globe, ImageIcon, Search, Settings2, Pencil } from "lucide-react";
import { Button }   from "../components/ui/button";
import { Input }    from "../components/ui/input";
import { Label }    from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Switch }   from "../components/ui/switch";
import { toast }    from "sonner";

import {
  MultiStepModal,
  useMultiStep,
  type Step,
} from "../components/dashboard/MultiStepModel";

import {
  ImagePicker,
  type PickedImage,
} from "../components/dashboard/ImagePicker";
import { createRegion, updateRegion } from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────

type Region = {
  id:          number;
  name:        string;
  slug:        string;
  country:     string;
  description: string | null;
  meta_title:  string | null;
  meta_desc:   string | null;
  thumbnail:   string | null;
  cover_image: string | null;
  is_active:   boolean;
};

// ── Build initial step data from existing region (pure function, no hooks) ──

function buildInitialData(region?: Region): Record<string, Record<string, unknown>> {
  if (!region) return {};

  return {
    basic: {
      name:    region.name,
      slug:    region.slug,
      country: region.country,
    },
    images: {
      cover: region.cover_image ? [{
        id:         "existing-cover",
        key:        region.cover_image,
        url:        `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${region.cover_image}`,
        name:       "cover",
        size:       0,
        status:     "uploaded",
        is_primary: true,
      }] as PickedImage[] : [],

      thumbnail: region.thumbnail ? [{
        id:         "existing-thumb",
        key:        region.thumbnail,
        url:        `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${region.thumbnail}`,
        name:       "thumbnail",
        size:       0,
        status:     "uploaded",
        is_primary: true,
      }] as PickedImage[] : [],
    },
    details: {
      description: region.description ?? "",
      is_active:   region.is_active,
    },
    seo: {
      meta_title: region.meta_title ?? "",
      meta_desc:  region.meta_desc  ?? "",
    },
  };
}

// ── Step definitions ──────────────────────────────────────────────────────

const REGION_STEPS: Step[] = [
  {
    id:          "basic",
    title:       "Basic Info",
    description: "Name, slug and country",
    icon:        <Globe className="h-4 w-4" />,
    validate: (data) => {
      if (!data.name)    return "Region name is required";
      if (!data.slug)    return "Slug is required";
      if (!/^[a-z0-9-]+$/.test(data.slug as string))
        return "Slug must be lowercase letters, numbers and hyphens only";
      if (!data.country) return "Country is required";
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

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — Basic Info
// ─────────────────────────────────────────────────────────────────────────────

function BasicInfoStep({ region }: { region?: Region }) {
  const { stepData, setStepData } = useMultiStep();
  const data = stepData["basic"] ?? {};

  const name    = (data.name    as string) ?? "";
  const slug    = (data.slug    as string) ?? "";
  const country = (data.country as string) ?? "";

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newName = e.target.value;

    if (region) {
      // Edit — only update name, slug is locked
      setStepData("basic", { ...data, name: newName });
    } else {
      // Create — auto-generate slug alongside name in ONE call
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
      <div className="space-y-1.5">
        <Label htmlFor="r-name">
          Region Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="r-name"
          placeholder="North India"
          value={name}
          onChange={handleNameChange}
          autoComplete="off"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="r-slug">
          Slug <span className="text-destructive">*</span>
        </Label>
        <Input
          id="r-slug"
          placeholder="north-india"
          value={slug}
          onChange={e => setStepData("basic", {
            ...data,
            slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
          })}
          readOnly={!!region}
          className={region ? "bg-muted text-muted-foreground cursor-not-allowed" : ""}
        />
        <p className="text-xs text-muted-foreground">
          {region
            ? "Slug cannot be changed after creation to preserve URLs"
            : <>URL: dreamsyatri.com/regions/<strong>{slug || "north-india"}</strong></>
          }
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="r-country">
          Country <span className="text-destructive">*</span>
        </Label>
        <Input
          id="r-country"
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
            Hero image shown on region page · 1920×600 recommended
          </p>
        </div>
        <ImagePicker
          folder="regions"
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
          folder="regions"
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
        <Label htmlFor="r-desc">Description</Label>
        <Textarea
          id="r-desc"
          placeholder="A brief description of this region..."
          value={description}
          onChange={e => setStepData("details", { ...data, description: e.target.value })}
          rows={4}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
        <div>
          <p className="text-sm font-medium">Active</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Region visible on the Dreams Yatri website
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
          <Label htmlFor="r-meta-title">Meta Title</Label>
          <span className={`text-xs ${titleLen > 60 ? "text-destructive" : "text-muted-foreground"}`}>
            {titleLen}/60
          </span>
        </div>
        <Input
          id="r-meta-title"
          placeholder="North India Tour Packages | Dreams Yatri"
          value={meta_title}
          onChange={e => setStepData("seo", { ...data, meta_title: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Shown in browser tab and Google search results
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="r-meta-desc">Meta Description</Label>
          <span className={`text-xs ${descLen > 160 ? "text-destructive" : "text-muted-foreground"}`}>
            {descLen}/160
          </span>
        </div>
        <Textarea
          id="r-meta-desc"
          placeholder="Explore North India with Dreams Yatri — Kashmir, Himachal and more..."
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
            dreamsyatri.com/regions/north-india
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

export function CreateRegionDialog() {
  const [open,       setOpen]         = useState(false);
  const [isPending,  startTransition] = useTransition();

  async function handleComplete(data: Record<string, unknown>) {
    startTransition(async () => {
      const formData = new FormData();

      formData.append("name",    (data.name    as string) ?? "");
      formData.append("slug",    (data.slug    as string) ?? "");
      formData.append("country", (data.country as string) ?? "India");

      const coverImgs = (data.cover     as PickedImage[]) ?? [];
      const thumbImgs = (data.thumbnail as PickedImage[]) ?? [];
      formData.append("cover_image", coverImgs[0]?.key ?? "");
      formData.append("thumbnail",   thumbImgs[0]?.key ?? "");

      formData.append("description", (data.description as string) ?? "");
      formData.append("is_active",   String(data.is_active ?? true));
      formData.append("meta_title",  (data.meta_title as string) ?? "");
      formData.append("meta_desc",   (data.meta_desc  as string) ?? "");

      const result = await createRegion({ success: false, message: "" }, formData);

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
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Add Region
      </Button>

      <MultiStepModal
        open={open}
        onOpenChange={setOpen}
        title="Create Region"
        description="Add a new travel region to Dreams Yatri"
        steps={REGION_STEPS}
        onComplete={handleComplete}
        isSubmitting={isPending}
        submitLabel="Create Region"
        initialStepData={{}}
      >
        {/* 4 direct children — one per step, index must match steps array */}
        <BasicInfoStep />
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

export function EditRegionDialog({ region }: { region: Region }) {
  const [open,       setOpen]         = useState(false);
  const [isPending,  startTransition] = useTransition();

  async function handleComplete(data: Record<string, unknown>) {
    startTransition(async () => {
      const formData = new FormData();

      formData.append("name",    (data.name    as string) ?? region.name);
      formData.append("slug",    region.slug);   // never changes
      formData.append("country", (data.country as string) ?? region.country);

      const coverImgs = data.cover     as PickedImage[] | undefined;
      const thumbImgs = data.thumbnail as PickedImage[] | undefined;
      formData.append("cover_image", coverImgs?.[0]?.key ?? region.cover_image ?? "");
      formData.append("thumbnail",   thumbImgs?.[0]?.key ?? region.thumbnail   ?? "");

      formData.append("description", (data.description as string) ?? region.description ?? "");
      formData.append("is_active",   String(data.is_active ?? region.is_active));
      formData.append("meta_title",  (data.meta_title as string) ?? region.meta_title ?? "");
      formData.append("meta_desc",   (data.meta_desc  as string) ?? region.meta_desc  ?? "");

      const result = await updateRegion(region.id, { success: false, message: "" }, formData);

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
        title="Edit Region"
        description={`Editing: ${region.name}`}
        steps={REGION_STEPS}
        onComplete={handleComplete}
        isSubmitting={isPending}
        submitLabel="Save Changes"
        initialStepData={buildInitialData(region)}  // ← pre-seeded, no useEffect needed
      >
        {/* 4 direct children — same order as steps */}
        <BasicInfoStep region={region} />
        <ImagesStep />
        <DetailsStep />
        <SEOStep />
      </MultiStepModal>
    </>
  );
}