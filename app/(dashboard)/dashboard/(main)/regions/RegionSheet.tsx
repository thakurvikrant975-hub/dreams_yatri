"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { Globe, ImageIcon, Search, Settings2, Plus, Pencil, AlertTriangle, Info, CheckCircle2, Loader2 } from "lucide-react";
import { Button }   from "../components/ui/button";
import { Input }    from "../components/ui/input";
import { Label }    from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Switch }   from "../components/ui/switch";
import { toast }    from "sonner";
import { cn }       from "@/app/lib/utils";

import {
  MultiStepSheet,
  useMultiStepSheet,
  type SheetStep,
} from "../components/dashboard/MultiStepSheet";

import {
  ImageUploadWithCrop,
  type UploadedImage,
} from "../components/dashboard/ImageUploadWithCrop";

import { LocationSearchSelect } from "../components/location/LocationSearchSelect";
import type { LocationValue }   from "../components/location/location.types";
import { createRegion, updateRegion, checkSlugAvailability } from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Default country (India) shown pre-selected in create mode ─────────────────
const INDIA_DEFAULT: LocationValue = {
  id:         "india",
  name:       "India",
  type:       "COUNTRY",
  breadcrumb: "India",
  slug:       "india",
};

// ── Pre-seed initial data from an existing region ─────────────────────────────

function buildInitialData(region: Region): Record<string, Record<string, unknown>> {
  return {
    basic: {
      name:    region.name,
      slug:    region.slug,
      country: region.country,
      _countryLoc: region.country
        ? ({
            id:         "init",
            name:       region.country,
            type:       "COUNTRY",
            breadcrumb: region.country,
            slug:       "",
          } satisfies LocationValue)
        : null,
    },
    images: {
      cover: region.cover_image
        ? ({ key: region.cover_image, url: `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${region.cover_image}` } as UploadedImage)
        : null,
      thumbnail: region.thumbnail
        ? ({ key: region.thumbnail, url: `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${region.thumbnail}` } as UploadedImage)
        : null,
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

// ── Create-mode seed (India pre-selected) ────────────────────────────────────

function buildCreateInitialData(): Record<string, Record<string, unknown>> {
  return {
    basic: {
      country:     "India",
      _countryLoc: INDIA_DEFAULT,
    },
    details: {
      is_active: false,
    },
  };
}

// ── Step definitions ──────────────────────────────────────────────────────────

const REGION_STEPS: SheetStep[] = [
  {
    id:          "basic",
    title:       "Basic Info",
    description: "Name, slug and country",
    icon:        <Globe className="h-4 w-4" />,
    validate: (data) => {
      if (!data.name)                                      return "Region name is required";
      if ((data.name as string).length > 90)               return "Region name must be 90 characters or fewer";
      if (!data.slug)                                      return "Slug is required";
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(data.slug as string))
        return "Slug must be lowercase letters/numbers separated by hyphens — no leading or trailing hyphens";
      if (data._slugConflict)                              return "Slug is already taken — apply the suggestion or choose a different one";
      if (!data.country)                                   return "Country is required";
      return null;
    },
  },
  {
    id:          "images",
    title:       "Images",
    description: "Thumbnail (required) and cover photo",
    icon:        <ImageIcon className="h-4 w-4" />,
    validate: (data) => {
      const thumb = data.thumbnail as UploadedImage | null | undefined;
      if (!thumb?.key) return "Thumbnail image is required";
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

function BasicInfoStep({ region }: { region?: Region }) {
  const { stepData, setStepData } = useMultiStepSheet();
  const data       = stepData["basic"] ?? {};
  const name       = (data.name        as string)             ?? "";
  const slug       = (data.slug        as string)             ?? "";
  const countryLoc = (data._countryLoc as LocationValue|null) ?? null;
  const slugSuggestion = (data._slugSuggestion as string) ?? "";

  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const dataRef = useRef<Record<string, unknown>>(data);
  useEffect(() => { dataRef.current = data; });

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

  function handleNameChange(value: string) {
    const capitalised = capitalise(value);
    const currentSlug = (data.slug as string) ?? "";
    const isManual    = (data._slugManual as boolean) ?? false;
    const newSlug     = isManual ? currentSlug : toSlug(capitalised);
    setStepData("basic", {
      ...data,
      name: capitalised,
      slug: newSlug,
      // Clear stale conflict immediately whenever the slug auto-changes
      ...(newSlug !== currentSlug && { _slugConflict: false, _slugSuggestion: "" }),
    });
  }

  function handleCountrySelect(loc: LocationValue | null) {
    setStepData("basic", {
      ...data,
      _countryLoc: loc,
      country:     loc?.name ?? "",
    });
  }

  // Live slug availability check (create mode only)
  useEffect(() => {
    if (!!region || !slug) {
      setSlugStatus("idle");
      return;
    }

    setSlugStatus("checking");

    const timer = setTimeout(async () => {
      try {
        const result = await checkSlugAvailability(slug);
        setSlugStatus(result.exists ? "taken" : "available");
        setStepData("basic", {
          ...dataRef.current,
          _slugConflict:   result.exists,
          _slugSuggestion: result.suggestion,
        });
      } catch {
        setSlugStatus("idle");
      }
    }, 600);

    return () => {
      clearTimeout(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  function applySuggestion() {
    setStepData("basic", {
      ...data,
      slug:            slugSuggestion,
      _slugConflict:   false,
      _slugSuggestion: "",
      _slugManual:     false, // re-enable auto-follow so name changes keep updating the slug
    });
  }

  const nameLen = name.length;

  return (
    <div className="space-y-4">
      {/* Region Name */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>
            Region Name <span className="text-destructive">*</span>
          </Label>
          <span className={cn(
            "text-xs tabular-nums",
            nameLen >= 90 ? "text-destructive font-medium" :
            nameLen > 75  ? "text-amber-600 dark:text-amber-400" :
            "text-muted-foreground",
          )}>
            {nameLen}/90
          </span>
        </div>
        <Input
          placeholder="North India"
          value={name}
          onChange={(e) => {
            const val = e.target.value.slice(0, 90);
            if (region) {
              setStepData("basic", { ...data, name: capitalise(val) });
            } else {
              handleNameChange(val);
            }
          }}
          autoComplete="off"
        />
      </div>

      {/* Slug */}
      <div className="space-y-1.5">
        <Label htmlFor="r-slug">
          Slug <span className="text-destructive">*</span>
        </Label>
        <Input
          id="r-slug"
          placeholder="north-india"
          value={slug}
          onChange={(e) =>
            !region &&
            setStepData("basic", {
              ...data,
              slug:            e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/--+/g, "-"),
              _slugManual:     true,
              _slugConflict:   false,
              _slugSuggestion: "",
            })
          }
          readOnly={!!region}
          className={cn(
            region && "bg-muted text-muted-foreground cursor-not-allowed",
            slugStatus === "taken" && "border-destructive focus-visible:ring-destructive",
          )}
        />
        {region ? (
          <p className="text-xs text-muted-foreground">
            Slug cannot be changed after creation to preserve URLs
          </p>
        ) : slugStatus === "checking" ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin shrink-0" />
            Checking availability…
          </p>
        ) : slugStatus === "taken" ? (
          <div className="space-y-0.5">
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span><strong>{slug}</strong> is already taken.</span>
            </p>
            {slugSuggestion && (
              <p className="text-xs text-muted-foreground">
                Try:{" "}
                <button
                  type="button"
                  onClick={applySuggestion}
                  className="font-medium text-primary underline underline-offset-2 hover:no-underline"
                >
                  {slugSuggestion}
                </button>
              </p>
            )}
          </div>
        ) : slugStatus === "available" ? (
          <p className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3 shrink-0" />
            Slug is available · URL: dreamsyatri.com/regions/<strong>{slug}</strong>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            URL: dreamsyatri.com/regions/<strong>{slug || "north-india"}</strong>
          </p>
        )}
      </div>

      {/* Country */}
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
      </div>
    </div>
  );
}

// ── Step 2: Images ────────────────────────────────────────────────────────────

function ImagesStep() {
  const { stepData, setStepData } = useMultiStepSheet();
  const data     = stepData["images"] ?? {};
  const thumbImg = (data.thumbnail as UploadedImage | null) ?? null;
  const coverImg = (data.cover     as UploadedImage | null) ?? null;
  const thumbMissing = !thumbImg?.key;

  return (
    <div className="space-y-6">
      {/* Thumbnail — required */}
      <div className="space-y-2">
        <div>
          <Label>
            Thumbnail <span className="text-destructive">*</span>
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Card image shown in listings · will be cropped to 400 × 250 px
          </p>
        </div>
        <ImageUploadWithCrop
          name="_thumb_unused"
          folder="regions"
          value={thumbImg}
          onChange={(img) => setStepData("images", { ...data, thumbnail: img })}
          label="Upload Thumbnail"
          aspectRatio="video"
          crop={{ width: 400, height: 250 }}
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
            Hero banner on the region page · will be cropped to 1920 × 600 px
          </p>
        </div>
        <ImageUploadWithCrop
          name="_cover_unused"
          folder="regions"
          value={coverImg}
          onChange={(img) => setStepData("images", { ...data, cover: img })}
          label="Upload Cover Image"
          aspectRatio="wide"
          crop={{ width: 1920, height: 600 }}
        />
      </div>
    </div>
  );
}

// ── Step 3: Details ───────────────────────────────────────────────────────────

function DetailsStep() {
  const { stepData, setStepData, allData } = useMultiStepSheet();
  const data        = stepData["details"] ?? {};
  const description = (data.description as string)  ?? "";
  const is_active   = (data.is_active   as boolean) ?? false;

  const seoData     = stepData["seo"] ?? {};
  const hasSeoTitle = !!((seoData.meta_title ?? allData.meta_title) as string);
  const hasSeoDesc  = !!((seoData.meta_desc  ?? allData.meta_desc)  as string);
  const seoMissing  = is_active && (!hasSeoTitle || !hasSeoDesc);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="r-desc">Description</Label>
        <Textarea
          id="r-desc"
          placeholder="A brief description of this region..."
          value={description}
          onChange={(e) => setStepData("details", { ...data, description: e.target.value.slice(0, 2000) })}
          rows={5}
        />
        <p className={cn(
          "text-xs tabular-nums text-right",
          description.length >= 2000 ? "text-destructive font-medium" :
          description.length > 1800  ? "text-amber-600 dark:text-amber-400" :
          "text-muted-foreground",
        )}>
          {description.length}/2000
        </p>
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
          onCheckedChange={(v) => setStepData("details", { ...data, is_active: v })}
        />
      </div>

      {seoMissing && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20 px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            SEO title and description are required to make this region active.
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

  const titleLen = meta_title.length;
  const descLen  = meta_desc.length;

  // Auto-fill from name / description the first time this step is visited
  useEffect(() => {
    const currentTitle = (data.meta_title as string) ?? "";
    const currentDesc  = (data.meta_desc  as string) ?? "";

    const regionName = ((basicData.name as string) ?? "").trim();
    const autoTitle = currentTitle || (regionName ? `Explore ${regionName} Travel Packages | Dreams Yatri` : "").slice(0, 60);
    const autoDesc  = currentDesc  || ((detailData.description as string) ?? "").slice(0, 160).trim();

    if (autoTitle !== currentTitle || autoDesc !== currentDesc) {
      setStepData("seo", { ...data, meta_title: autoTitle, meta_desc: autoDesc });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      {/* SEO title */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="r-meta-title">
            Meta Title
            <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">(max 60 chars)</span>
          </Label>
          <span className={cn(
            "text-xs tabular-nums",
            titleLen > 60  ? "text-destructive font-medium" :
            titleLen > 50  ? "text-amber-600 dark:text-amber-400" :
            "text-muted-foreground"
          )}>
            {titleLen}/60
          </span>
        </div>
        <Input
          id="r-meta-title"
          placeholder="Explore North India Packages | Dreams Yatri"
          value={meta_title}
          onChange={(e) =>
            setStepData("seo", { ...data, meta_title: e.target.value.slice(0, 60) })
          }
        />
        <p className="text-xs text-muted-foreground">
          Shown in browser tab and Google search results
        </p>
      </div>

      {/* SEO description */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="r-meta-desc">
            Meta Description
            <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">(max 160 chars)</span>
          </Label>
          <span className={cn(
            "text-xs tabular-nums",
            descLen > 160  ? "text-destructive font-medium" :
            descLen > 130  ? "text-amber-600 dark:text-amber-400" :
            "text-muted-foreground"
          )}>
            {descLen}/160
          </span>
        </div>
        <Textarea
          id="r-meta-desc"
          placeholder="Explore North India with Dreams Yatri — Kashmir, Himachal and more..."
          value={meta_desc}
          onChange={(e) =>
            setStepData("seo", { ...data, meta_desc: e.target.value.slice(0, 160) })
          }
          rows={3}
        />
      </div>

      {/* Info banner when both fields are empty */}
      {!meta_title && !meta_desc && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-900/20 px-3 py-2.5">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            SEO details are optional but required to make the region active.
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
            dreamsyatri.com/regions/{slug || "region-slug"}
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

export function CreateRegionSheet() {
  const [open,      setOpen]         = useState(false);
  const [sheetKey,  setSheetKey]     = useState(0);
  const [isPending, startTransition] = useTransition();

  async function handleComplete(data: Record<string, unknown>) {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("name",        (data.name        as string) ?? "");
      formData.append("slug",        (data.slug        as string) ?? "");
      formData.append("country",     (data.country     as string) ?? "");
      formData.append("cover_image", (data.cover      as UploadedImage | null)?.key ?? "");
      formData.append("thumbnail",   (data.thumbnail  as UploadedImage | null)?.key ?? "");
      formData.append("description", (data.description as string) ?? "");
      formData.append("is_active",   String(data.is_active ?? false));
      formData.append("meta_title",  (data.meta_title  as string) ?? "");
      formData.append("meta_desc",   (data.meta_desc   as string) ?? "");

      const result = await createRegion({ success: false, message: "" }, formData);
      if (result.success) {
        toast.success(result.message);
        setSheetKey((k) => k + 1); // force remount → guaranteed clean slate
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
        Add Region
      </Button>

      <MultiStepSheet
        key={sheetKey}
        open={open}
        onOpenChange={setOpen}
        title="Create Region"
        description="Add a new travel region to Dreams Yatri"
        steps={REGION_STEPS}
        onComplete={handleComplete}
        isSubmitting={isPending}
        submitLabel="Create Region"
        initialStepData={buildCreateInitialData()}
      >
        <BasicInfoStep />
        <ImagesStep />
        <DetailsStep />
        <SEOStep />
      </MultiStepSheet>
    </>
  );
}

// ── Edit Sheet ────────────────────────────────────────────────────────────────

export function EditRegionSheet({ region }: { region: Region }) {
  const [open,      setOpen]         = useState(false);
  const [sheetKey,  setSheetKey]     = useState(0);
  const [isPending, startTransition] = useTransition();

  async function handleComplete(data: Record<string, unknown>) {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("name",        (data.name        as string) ?? region.name);
      formData.append("slug",        region.slug);
      formData.append("country",     (data.country     as string) ?? region.country);
      formData.append("cover_image", (data.cover      as UploadedImage | null)?.key ?? region.cover_image ?? "");
      formData.append("thumbnail",   (data.thumbnail  as UploadedImage | null)?.key ?? region.thumbnail   ?? "");
      formData.append("description", (data.description as string) ?? region.description ?? "");
      formData.append("is_active",   String(data.is_active ?? region.is_active));
      formData.append("meta_title",  (data.meta_title  as string) ?? region.meta_title  ?? "");
      formData.append("meta_desc",   (data.meta_desc   as string) ?? region.meta_desc   ?? "");

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
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSheetKey((k) => k + 1); setOpen(true); }}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>

      <MultiStepSheet
        key={sheetKey}
        open={open}
        onOpenChange={setOpen}
        title="Edit Region"
        description={`Editing: ${region.name}`}
        steps={REGION_STEPS}
        onComplete={handleComplete}
        isSubmitting={isPending}
        submitLabel="Save Changes"
        initialStepData={buildInitialData(region)}
      >
        <BasicInfoStep region={region} />
        <ImagesStep />
        <DetailsStep />
        <SEOStep />
      </MultiStepSheet>
    </>
  );
}
