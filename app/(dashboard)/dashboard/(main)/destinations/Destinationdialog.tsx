"use client";

import { useState, useTransition, useEffect } from "react";
import { Plus, MapPin, ImageIcon, Search, Settings2, Pencil, AlertTriangle, Info } from "lucide-react";
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
import { cn }    from "@/app/lib/utils";

import {
  MultiStepSheet,
  useMultiStepSheet,
  type SheetStep,
} from "../components/dashboard/MultiStepSheet";

import {
  ImagePicker,
  type PickedImage,
} from "../components/dashboard/ImagePicker";

import { LocationSearchSelect } from "../components/location/LocationSearchSelect";
import type { LocationValue }   from "../components/location/location.types";
import { createDestination, updateDestination } from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────────

type Region = { id: number; name: string; slug: string };

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
  location_id: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function capitalise(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function toSlug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ── Initial data seed for edit mode ──────────────────────────────────────────

function buildInitialData(dest: Destination): Record<string, Record<string, unknown>> {
  return {
    basic: {
      name:        dest.name,
      slug:        dest.slug,
      country:     dest.country,
      region_id:   String(dest.region_id),
      location_id: dest.location_id ?? null,
      _locationLoc: dest.location_id
        ? ({
            id:         dest.location_id,
            name:       dest.name,
            type:       "CITY",
            breadcrumb: dest.name,
            slug:       dest.slug,
          } satisfies LocationValue)
        : null,
      _countryLoc: dest.country
        ? ({
            id:         "init",
            name:       dest.country,
            type:       "COUNTRY",
            breadcrumb: dest.country,
            slug:       "",
          } satisfies LocationValue)
        : null,
    },
    images: {
      cover: dest.cover_image
        ? ([{
            id: "existing-cover", key: dest.cover_image,
            url: `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${dest.cover_image}`,
            name: "cover", size: 0, status: "uploaded", is_primary: true,
          }] as PickedImage[])
        : [],
      thumbnail: dest.thumbnail
        ? ([{
            id: "existing-thumb", key: dest.thumbnail,
            url: `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${dest.thumbnail}`,
            name: "thumbnail", size: 0, status: "uploaded", is_primary: true,
          }] as PickedImage[])
        : [],
    },
    details: {
      description: dest.description ?? "",
      is_active:   dest.is_active,
    },
    seo: {
      meta_title: dest.meta_title ?? "",
      meta_desc:  dest.meta_desc  ?? "",
    },
  };
}

// ── Step definitions ──────────────────────────────────────────────────────────

const DEST_STEPS: SheetStep[] = [
  {
    id:          "basic",
    title:       "Basic Info",
    description: "Location, slug and region",
    icon:        <MapPin className="h-4 w-4" />,
    validate: (data) => {
      if (!data.name)      return "Destination name is required";
      if (!data.slug)      return "Slug is required";
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(data.slug as string))
        return "Slug must be lowercase letters/numbers separated by hyphens — no leading or trailing hyphens";
      if (!data.country)   return "Country is required";
      if (!data.region_id) return "Please select a region";
      return null;
    },
  },
  {
    id:          "images",
    title:       "Images",
    description: "Thumbnail (required) and cover photo",
    icon:        <ImageIcon className="h-4 w-4" />,
    validate: (data) => {
      const thumbs = data.thumbnail as PickedImage[] | undefined;
      if (!thumbs?.[0]?.key) return "Thumbnail image is required";
      return null;
    },
  },
  {
    id:          "details",
    title:       "Details",
    description: "Description and status",
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

// ── Step 1: Basic Info ────────────────────────────────────────────────────────

function BasicInfoStep({
  destination,
  regions,
}: {
  destination?: Destination;
  regions:      Region[];
}) {
  const { stepData, setStepData } = useMultiStepSheet();
  const data        = stepData["basic"] ?? {};
  const slug        = (data.slug        as string)              ?? "";
  const region_id   = (data.region_id   as string)              ?? "";
  const locationLoc = (data._locationLoc as LocationValue|null) ?? null;
  const countryLoc  = (data._countryLoc  as LocationValue|null) ?? null;

  function handleLocationSelect(loc: LocationValue | null) {
    if (!loc) {
      setStepData("basic", { ...data, _locationLoc: null, location_id: null, name: "" });
      return;
    }

    // Derive country from breadcrumb — last segment is typically the country
    const breadParts     = loc.breadcrumb.split(", ");
    const derivedCountry =
      loc.type === "COUNTRY"
        ? loc.name
        : breadParts.length > 1
          ? breadParts[breadParts.length - 1]
          : "";

    const derivedCountryLoc: LocationValue | null = derivedCountry
      ? { id: "derived", name: derivedCountry, type: "COUNTRY", breadcrumb: derivedCountry, slug: "" }
      : countryLoc;

    setStepData("basic", {
      ...data,
      _locationLoc: loc,
      location_id:  loc.id,
      name:         capitalise(loc.name),
      // Auto-generate slug in create mode only
      ...(!destination ? { slug: toSlug(loc.name) } : {}),
      // Suggest country from location — LocationSearchSelect stays editable so user can override
      ...(derivedCountry ? { country: derivedCountry, _countryLoc: derivedCountryLoc } : {}),
    });
  }

  function handleCountrySelect(loc: LocationValue | null) {
    setStepData("basic", {
      ...data,
      _countryLoc: loc,
      country:     loc?.name ?? "",
    });
  }

  return (
    <div className="space-y-4">

      {/* Destination Name via location search */}
      <div className="space-y-1.5">
        <Label>
          Destination Name <span className="text-destructive">*</span>
        </Label>
        <LocationSearchSelect
          value={locationLoc}
          onChange={handleLocationSelect}
          placeholder="Search cities, towns, attractions…"
        />
        <p className="text-xs text-muted-foreground">
          Search and select the location — country will auto-fill
        </p>
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
          onChange={(e) =>
            !destination &&
            setStepData("basic", {
              ...data,
              slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/--+/g, "-"),
            })
          }
          readOnly={!!destination}
          className={cn(destination && "bg-muted text-muted-foreground cursor-not-allowed")}
        />
        <p className="text-xs text-muted-foreground">
          {destination
            ? "Slug cannot be changed after creation to preserve URLs"
            : <span>URL: dreamsyatri.com/destinations/<strong>{slug || "kashmir"}</strong></span>
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
          onValueChange={(v) => setStepData("basic", { ...data, region_id: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a region" />
          </SelectTrigger>
          <SelectContent>
            {regions.map((r) => (
              <SelectItem key={r.id} value={String(r.id)}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Country — LocationSearchSelect, auto-filled from name selection */}
      <div className="space-y-1.5">
        <Label>
          Country <span className="text-destructive">*</span>
        </Label>
        <LocationSearchSelect
          value={countryLoc}
          onChange={handleCountrySelect}
          placeholder="Search country…"
          types={["COUNTRY"]}
        />
        {locationLoc && (
          <p className="text-xs text-muted-foreground">
            Auto-filled from location — you can change this
          </p>
        )}
      </div>
    </div>
  );
}

// ── Step 2: Images ────────────────────────────────────────────────────────────

function ImagesStep() {
  const { stepData, setStepData } = useMultiStepSheet();
  const data        = stepData["images"] ?? {};
  const coverImages = (data.cover     as PickedImage[]) ?? [];
  const thumbImages = (data.thumbnail as PickedImage[]) ?? [];
  const thumbMissing = thumbImages.length === 0 || !thumbImages[0]?.key;

  return (
    <div className="space-y-6">
      {/* Thumbnail — required */}
      <div className="space-y-2">
        <div>
          <Label>
            Thumbnail <span className="text-destructive">*</span>
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Card image shown in listings · 400×250 recommended
          </p>
        </div>
        <ImagePicker
          folder="destinations"
          value={thumbImages}
          onChange={(imgs) => setStepData("images", { ...data, thumbnail: imgs })}
          maxFiles={1}
          label="Upload Thumbnail"
          hint="JPG, PNG, WebP"
        />
        {thumbMissing && (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            Thumbnail is required to continue
          </p>
        )}
      </div>

      {/* Cover image — optional */}
      <div className="space-y-2">
        <div>
          <Label>
            Cover Image
            <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">(optional)</span>
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Hero banner on the destination page · 1920×600 recommended
          </p>
        </div>
        <ImagePicker
          folder="destinations"
          value={coverImages}
          onChange={(imgs) => setStepData("images", { ...data, cover: imgs })}
          maxFiles={1}
          label="Upload Cover Image"
          hint="Wide banner · JPG, PNG, WebP"
        />
      </div>
    </div>
  );
}

// ── Step 3: Details ───────────────────────────────────────────────────────────

function DetailsStep() {
  const { stepData, setStepData } = useMultiStepSheet();
  const data        = stepData["details"] ?? {};
  const seoData     = stepData["seo"]     ?? {};
  const description = (data.description as string)  ?? "";
  const is_active   = (data.is_active   as boolean) ?? true;

  const hasSeoTitle = !!((seoData.meta_title as string) || "");
  const hasSeoDesc  = !!((seoData.meta_desc  as string) || "");
  const seoMissing  = is_active && (!hasSeoTitle || !hasSeoDesc);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="d-desc">Description</Label>
        <Textarea
          id="d-desc"
          placeholder="A brief description of this destination..."
          value={description}
          onChange={(e) => setStepData("details", { ...data, description: e.target.value })}
          rows={5}
        />
        <p className="text-xs text-muted-foreground text-right">
          {description.length} / 2000
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
        <div>
          <p className="text-sm font-medium">Active</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Destination visible on the Dreams Yatri website
          </p>
        </div>
        <Switch
          checked={is_active}
          onCheckedChange={(v) => setStepData("details", { ...data, is_active: v })}
        />
      </div>

      {seoMissing && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20 px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            SEO title and description are required to make this destination active.
            Fill them in on the next step.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Step 4: SEO ───────────────────────────────────────────────────────────────

function SEOStep() {
  const { stepData, setStepData } = useMultiStepSheet();
  const data       = stepData["seo"]     ?? {};
  const basicData  = stepData["basic"]   ?? {};
  const detailData = stepData["details"] ?? {};

  const meta_title = (data.meta_title as string) ?? "";
  const meta_desc  = (data.meta_desc  as string) ?? "";
  const slug       = (basicData.slug  as string) ?? "";
  const titleLen   = meta_title.length;
  const descLen    = meta_desc.length;

  // Auto-fill from name / description on first visit to this step
  useEffect(() => {
    const currentTitle = (data.meta_title as string) ?? "";
    const currentDesc  = (data.meta_desc  as string) ?? "";
    const autoTitle = currentTitle || ((basicData.name        as string) ?? "").slice(0, 60).trim();
    const autoDesc  = currentDesc  || ((detailData.description as string) ?? "").slice(0, 160).trim();
    if (autoTitle !== currentTitle || autoDesc !== currentDesc) {
      setStepData("seo", { ...data, meta_title: autoTitle, meta_desc: autoDesc });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      {/* Meta title */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="d-meta-title">
            Meta Title
            <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">(max 60 chars)</span>
          </Label>
          <span className={cn(
            "text-xs tabular-nums",
            titleLen > 60 ? "text-destructive font-medium" :
            titleLen > 50 ? "text-amber-600 dark:text-amber-400" :
            "text-muted-foreground"
          )}>
            {titleLen}/60
          </span>
        </div>
        <Input
          id="d-meta-title"
          placeholder="Kashmir Tour Packages | Dreams Yatri"
          value={meta_title}
          onChange={(e) =>
            setStepData("seo", { ...data, meta_title: e.target.value.slice(0, 60) })
          }
        />
        <p className="text-xs text-muted-foreground">
          Shown in browser tab and Google search results
        </p>
      </div>

      {/* Meta description */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="d-meta-desc">
            Meta Description
            <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">(max 160 chars)</span>
          </Label>
          <span className={cn(
            "text-xs tabular-nums",
            descLen > 160 ? "text-destructive font-medium" :
            descLen > 130 ? "text-amber-600 dark:text-amber-400" :
            "text-muted-foreground"
          )}>
            {descLen}/160
          </span>
        </div>
        <Textarea
          id="d-meta-desc"
          placeholder="Explore Kashmir with Dreams Yatri — Dal Lake, Gulmarg and more..."
          value={meta_desc}
          onChange={(e) =>
            setStepData("seo", { ...data, meta_desc: e.target.value.slice(0, 160) })
          }
          rows={3}
        />
      </div>

      {/* Info banner when both empty */}
      {!meta_title && !meta_desc && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-900/20 px-3 py-2.5">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            SEO details are optional but recommended for better discoverability.
          </p>
        </div>
      )}

      {/* Live search preview */}
      {(meta_title || meta_desc) && (
        <div className="rounded-lg border p-3 bg-muted/20 space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">
            Search Preview
          </p>
          <p className="text-xs text-green-700 dark:text-green-500 truncate">
            dreamsyatri.com/destinations/{slug || "destination-slug"}
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

// ── Create Sheet ──────────────────────────────────────────────────────────────

export function CreateDestinationDialog({ regions }: { regions: Region[] }) {
  const [open,      setOpen]         = useState(false);
  const [sheetKey,  setSheetKey]     = useState(0);
  const [isPending, startTransition] = useTransition();

  async function handleComplete(data: Record<string, unknown>) {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("name",        (data.name        as string) ?? "");
      formData.append("slug",        (data.slug        as string) ?? "");
      formData.append("country",     (data.country     as string) ?? "India");
      formData.append("region_id",   (data.region_id   as string) ?? "");
      formData.append("location_id", (data.location_id as string) ?? "");
      formData.append("thumbnail",   ((data.thumbnail  as PickedImage[])?.[0]?.key) ?? "");
      formData.append("cover_image", ((data.cover      as PickedImage[])?.[0]?.key) ?? "");
      formData.append("description", (data.description as string) ?? "");
      formData.append("is_active",   String(data.is_active ?? true));
      formData.append("meta_title",  (data.meta_title  as string) ?? "");
      formData.append("meta_desc",   (data.meta_desc   as string) ?? "");

      const result = await createDestination({ success: false, message: "" }, formData);
      if (result.success) {
        toast.success(result.message);
        setSheetKey((k) => k + 1); // force remount → clean slate
        setOpen(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="lg"
        className="rounded-md bg-dashboard-primary text-dashboard-base-100 py-2.5 px-4 hover:bg-dashboard-primary hover:scale-105 duration-300 hover:text-dashboard-base-100 border border-dashboard-primary"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Destination
      </Button>

      <MultiStepSheet
        key={sheetKey}
        open={open}
        onOpenChange={setOpen}
        title="Create Destination"
        description="Add a new travel destination to Dreams Yatri"
        steps={DEST_STEPS}
        onComplete={handleComplete}
        isSubmitting={isPending}
        submitLabel="Create Destination"
        initialStepData={{}}
      >
        <BasicInfoStep regions={regions} />
        <ImagesStep />
        <DetailsStep />
        <SEOStep />
      </MultiStepSheet>
    </>
  );
}

// ── Edit Sheet ────────────────────────────────────────────────────────────────

export function EditDestinationDialog({
  destination,
  regions,
}: {
  destination: Destination;
  regions:     Region[];
}) {
  const [open,      setOpen]         = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleComplete(data: Record<string, unknown>) {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("name",        (data.name        as string) ?? destination.name);
      formData.append("slug",        destination.slug);
      formData.append("country",     (data.country     as string) ?? destination.country);
      formData.append("region_id",   (data.region_id   as string) ?? String(destination.region_id));
      formData.append("location_id", (data.location_id as string) ?? destination.location_id ?? "");
      formData.append("thumbnail",   ((data.thumbnail  as PickedImage[])?.[0]?.key) ?? destination.thumbnail   ?? "");
      formData.append("cover_image", ((data.cover      as PickedImage[])?.[0]?.key) ?? destination.cover_image ?? "");
      formData.append("description", (data.description as string) ?? destination.description ?? "");
      formData.append("is_active",   String(data.is_active ?? destination.is_active));
      formData.append("meta_title",  (data.meta_title  as string) ?? destination.meta_title  ?? "");
      formData.append("meta_desc",   (data.meta_desc   as string) ?? destination.meta_desc   ?? "");

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

      <MultiStepSheet
        key={destination.id}
        open={open}
        onOpenChange={setOpen}
        title="Edit Destination"
        description={`Editing: ${destination.name}`}
        steps={DEST_STEPS}
        onComplete={handleComplete}
        isSubmitting={isPending}
        submitLabel="Save Changes"
        initialStepData={buildInitialData(destination)}
      >
        <BasicInfoStep destination={destination} regions={regions} />
        <ImagesStep />
        <DetailsStep />
        <SEOStep />
      </MultiStepSheet>
    </>
  );
}
