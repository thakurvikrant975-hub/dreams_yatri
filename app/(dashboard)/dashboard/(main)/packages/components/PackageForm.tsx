"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import { Button } from "../../components/ui/button";
import { ImageUpload, type UploadedImage } from "../../components/dashboard/ImageUpload";
import { SearchSelect } from "../../components/dashboard/SearchSelect";
import { MultiSearchSelect } from "../../components/dashboard/MultiSearchSelect";
import {
  searchDestinations,
  searchTags,
  searchCategories,
} from "@/app/actions/packages/search.actions";
import { createPackage, updatePackageBasicInfo } from "@/app/actions/packages/package.actions";
import { createPackageSchema } from "@/app/validators/package.validator";
import { Loader2, Plus, X } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

export type PackageFormData = {
  title: string;
  slug: string;
  thumbnail: string | null;
  description: string;
  destination_id: number | null;
  inclusions: string[];
  exclusions: string[];
  tags: string[];
  category: string[];
};

const defaultData: PackageFormData = {
  title: "",
  slug: "",
  thumbnail: null,
  description: "",
  destination_id: null,
  inclusions: [],
  exclusions: [],
  tags: [],
  category: [],
};

type Props = {
  mode?: "create" | "update";
  packageId?: number;
  initialData?: Partial<PackageFormData>;
  initialDestinationLabel?: string;
  onChange?: (data: PackageFormData) => void;
  onSuccess?: (result: unknown) => void;
};

type FieldErrors = Partial<Record<keyof PackageFormData, string>>;

const R2_BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";

// ── Helpers ────────────────────────────────────────────────────────────────

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive mt-1">{message}</p>;
}

// ── Component ──────────────────────────────────────────────────────────────

export function PackageForm({
  mode = "create",
  packageId,
  initialData,
  initialDestinationLabel,
  onChange,
  onSuccess,
}: Props) {
  const [data, setData] = useState<PackageFormData>({
    ...defaultData,
    ...initialData,
  });

  // In update mode the slug is already set — don't overwrite it on title change
  const [slugEdited, setSlugEdited] = useState(mode === "update");

  const [thumbnailImage, setThumbnailImage] = useState<UploadedImage | null>(() => {
    if (initialData?.thumbnail) {
      return { key: initialData.thumbnail, url: `${R2_BASE}/${initialData.thumbnail}` };
    }
    return null;
  });

  const [newInclusion, setNewInclusion] = useState("");
  const [newExclusion, setNewExclusion] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function update<K extends keyof PackageFormData>(key: K, value: PackageFormData[K]) {
    setErrors(prev => ({ ...prev, [key]: undefined }));
    setData(prev => {
      const next = { ...prev, [key]: value };
      onChange?.(next);
      return next;
    });
  }

  function handleTitleChange(title: string) {
    setErrors(prev => ({ ...prev, title: undefined, slug: undefined }));
    setData(prev => {
      const next: PackageFormData = {
        ...prev,
        title,
        slug: slugEdited ? prev.slug : slugify(title),
      };
      onChange?.(next);
      return next;
    });
  }

  function handleSlugChange(slug: string) {
    setSlugEdited(true);
    update("slug", slug);
  }

  function addItem(
    field: "inclusions" | "exclusions",
    rawValue: string,
    clear: () => void,
  ) {
    const val = rawValue.trim();
    if (!val) return;
    update(field, [...data[field], val]);
    clear();
  }

  function removeItem(field: "inclusions" | "exclusions", index: number) {
    update(field, data[field].filter((_, i) => i !== index));
  }

  // Zod v4 path is PropertyKey[] (string | number | symbol) — accept the broadest shape
  function mapZodErrors(issues: { path: readonly PropertyKey[]; message: string }[]) {
    const fieldErrors: FieldErrors = {};
    for (const issue of issues) {
      const raw = issue.path[0];
      if (raw == null) continue;
      const field = raw as unknown as keyof PackageFormData;
      if (!fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return fieldErrors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (!data.destination_id) {
      setErrors({ destination_id: "Please select a destination" });
      return;
    }

    const payload = {
      title: data.title,
      slug: data.slug,
      thumbnail: data.thumbnail ?? undefined,
      description: data.description || undefined,
      destination_id: data.destination_id,
      inclusions: data.inclusions,
      exclusions: data.exclusions,
      tags: data.tags,
      category: data.category,
    };

    // Client-side validation before hitting the server
    const parsed = createPackageSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(mapZodErrors(parsed.error.issues));
      return;
    }

    setIsSubmitting(true);
    try {
      const result =
        mode === "update" && packageId != null
          ? await updatePackageBasicInfo(packageId, payload)
          : await createPackage(payload);

      if (!result.success) {
        if (result.type === "validation" && "error" in result && result.error) {
          setErrors(mapZodErrors(result.error));
        } else if (result.type === "conflict") {
          setErrors({ slug: "message" in result ? (result.message as string) : "Slug already exists" });
        } else {
          toast.error("message" in result ? (result.message as string) : "Something went wrong");
        }
        return;
      }

      toast.success(mode === "update" ? "Package updated" : "Package created successfully");
      onSuccess?.(result);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Title + Slug */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="pkg-title">Title</Label>
          <Input
            id="pkg-title"
            value={data.title}
            onChange={e => handleTitleChange(e.target.value)}
            placeholder="e.g. Kerala Backwaters Tour"
          />
          <FieldError message={errors.title} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pkg-slug">Slug</Label>
          <Input
            id="pkg-slug"
            value={data.slug}
            onChange={e => handleSlugChange(e.target.value)}
            placeholder="kerala-backwaters-tour"
          />
          <FieldError message={errors.slug} />
        </div>
      </div>

      {/* Thumbnail */}
      <div className="space-y-1.5">
        <Label>Thumbnail</Label>
        <div className="w-full max-w-sm">
          <ImageUpload
            name="thumbnail"
            label="Upload Thumbnail"
            folder="packages"
            aspectRatio="wide"
            value={thumbnailImage}
            onChange={img => {
              setThumbnailImage(img);
              update("thumbnail", img?.key ?? null);
            }}
          />
        </div>
        <FieldError message={errors.thumbnail} />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="pkg-description">Description</Label>
        <Textarea
          id="pkg-description"
          value={data.description}
          onChange={e => update("description", e.target.value)}
          placeholder="Describe what makes this package special..."
        />
        <FieldError message={errors.description} />
      </div>

      {/* Destination */}
      <div className="space-y-1.5">
        <Label>Destination</Label>
        <SearchSelect
          value={data.destination_id}
          onChange={val => update("destination_id", val)}
          fetchOptions={searchDestinations}
          placeholder="Search destinations..."
          initialLabel={initialDestinationLabel}
        />
        <FieldError message={errors.destination_id} />
      </div>

      {/* Tags + Categories */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Tags</Label>
          <MultiSearchSelect
            value={data.tags}
            onChange={val => update("tags", val)}
            fetchOptions={searchTags}
            placeholder="Search tags..."
          />
          <FieldError message={errors.tags} />
        </div>
        <div className="space-y-1.5">
          <Label>Categories</Label>
          <MultiSearchSelect
            value={data.category}
            onChange={val => update("category", val)}
            fetchOptions={searchCategories}
            placeholder="Search categories..."
          />
          <FieldError message={errors.category} />
        </div>
      </div>

      {/* Inclusions + Exclusions */}
      <div className="grid grid-cols-2 gap-4">
        {/* Inclusions */}
        <div className="space-y-2">
          <Label>Inclusions</Label>
          <div className="flex gap-2">
            <Input
              value={newInclusion}
              onChange={e => setNewInclusion(e.target.value)}
              placeholder="e.g. Breakfast included"
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem("inclusions", newInclusion, () => setNewInclusion(""));
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 px-3"
              onClick={() => addItem("inclusions", newInclusion, () => setNewInclusion(""))}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <FieldError message={errors.inclusions} />
          {data.inclusions.length > 0 && (
            <ul className="space-y-1">
              {data.inclusions.map((item, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 dark:border-green-900/40 dark:bg-green-950/20"
                >
                  <span className="text-xs text-green-700 dark:text-green-400 flex-1 min-w-0">
                    ✓ {item}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem("inclusions", i)}
                    className="shrink-0 rounded p-0.5 hover:bg-green-200 dark:hover:bg-green-900/40"
                  >
                    <X className="h-3 w-3 text-green-700 dark:text-green-400" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Exclusions */}
        <div className="space-y-2">
          <Label>Exclusions</Label>
          <div className="flex gap-2">
            <Input
              value={newExclusion}
              onChange={e => setNewExclusion(e.target.value)}
              placeholder="e.g. Flight tickets"
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem("exclusions", newExclusion, () => setNewExclusion(""));
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 px-3"
              onClick={() => addItem("exclusions", newExclusion, () => setNewExclusion(""))}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <FieldError message={errors.exclusions} />
          {data.exclusions.length > 0 && (
            <ul className="space-y-1">
              {data.exclusions.map((item, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900/40 dark:bg-red-950/20"
                >
                  <span className="text-xs text-red-600 dark:text-red-400 flex-1 min-w-0">
                    ✕ {item}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem("exclusions", i)}
                    className="shrink-0 rounded p-0.5 hover:bg-red-200 dark:hover:bg-red-900/40"
                  >
                    <X className="h-3 w-3 text-red-600 dark:text-red-400" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isSubmitting} className="min-w-36">
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              {mode === "update" ? "Saving..." : "Creating..."}
            </>
          ) : (
            mode === "update" ? "Save Changes" : "Create Package"
          )}
        </Button>
      </div>
    </form>
  );
}
