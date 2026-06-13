"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ImageUpload, type UploadedImage } from "../../components/dashboard/ImageUpload";
import { SearchSelect } from "../../components/dashboard/SearchSelect";
import { MultiSearchSelect } from "../../components/dashboard/MultiSearchSelect";
import {
  searchDestinations,
  searchTags,
  searchCategories,
  createTag,
  createCategory,
} from "@/app/actions/packages/search.actions";
import { createPackage, updatePackageBasicInfo } from "@/app/actions/packages/package.actions";
import { createPackageSchema } from "@/app/validators/package.validator";
import {
  Loader2,
  Plus,
  Package,
  Link2,
  AlignLeft,
  MapPin,
  Hash,
  Tag,
  CheckCircle2,
  XCircle,
  ImageIcon,
  Rocket,
  Save,
  Info,
} from "lucide-react";
import { cn, toTitleCase, capitalizeWords } from "@/app/lib/utils";
import { InclusionExclusionField } from "./InclusionExclusionField";

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

export function inputCls(hasError = false) {
  return cn(
    "w-full rounded-lg border px-3 py-2.5 text-[13.5px] outline-none",
    "transition-[border-color,box-shadow] duration-150",
    "bg-dashboard-base-100 text-dashboard-base-content",
    "placeholder:text-dashboard-base-content/25  cursor-pointer",
    hasError
      ? "border-dashboard-error focus:ring-2 focus:ring-dashboard-error/15"
      : "border-dashboard-base-300 focus:border-dashboard-primary focus:ring-2 focus:ring-dashboard-primary/12",
  );
}

const primaryBtn = cn(
  "flex items-center justify-center gap-1.5 rounded-lg px-5 py-2 text-[13px] font-semibold",
  "bg-dashboard-primary text-dashboard-primary-content",
  "transition-opacity hover:opacity-90 disabled:opacity-60 cursor-pointer",
);

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionLabel({ children, icon }: { children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-dashboard-base-content/75">
      <span className="text-dashboard-primary">{icon}</span>
      {children}
    </div>
  );
}

function Field({
  label,
  icon,
  error,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1.5 text-[12px] font-medium text-dashboard-base-content/75">
        {icon && <span className="text-dashboard-base-content/30">{icon}</span>}
        {label}
      </label>
      {children}
      <FieldError message={error} />
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-dashboard-error">
      <XCircle className="h-3 w-3 shrink-0" />
      {message}
    </p>
  );
}

export function AddButton({ onClick, variant }: { onClick: () => void; variant: "success" | "error" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-lg",
        "border border-dashboard-base-300 bg-dashboard-base-100",
        "text-dashboard-base-content/40 transition-colors",
        variant === "success" &&
        "hover:border-dashboard-success hover:bg-dashboard-success/5 hover:text-dashboard-success",
        variant === "error" &&
        "hover:border-dashboard-error hover:bg-dashboard-error/5 hover:text-dashboard-error",
      )}
    >
      <Plus className="h-4 w-4" />
    </button>
  );
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

  // In update mode the slug is already set — don't overwrite on title change
  const [slugEdited, setSlugEdited] = useState(mode === "update");

  const [thumbnailImage, setThumbnailImage] = useState<UploadedImage | null>(() => {
    if (initialData?.thumbnail) {
      return { key: initialData.thumbnail, url: `${R2_BASE}/${initialData.thumbnail}` };
    }
    return null;
  });

  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Updaters ──────────────────────────────────────────────────────────────

  function update<K extends keyof PackageFormData>(key: K, value: PackageFormData[K]) {
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setData((prev) => {
      const next = { ...prev, [key]: value };
      onChange?.(next);
      return next;
    });
  }

  function handleTitleChange(rawTitle: string) {
    const title = capitalizeWords(rawTitle);
    setErrors((prev) => ({ ...prev, title: undefined, slug: undefined }));
    setData((prev) => {
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

  // ── Submit ────────────────────────────────────────────────────────────────

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

  // ── Shared section blocks ─────────────────────────────────────────────────

  const sectionBasicInfo = (
    <div className="flex flex-col gap-5 rounded-2xl  bg-dashboard-base-100 p-6 border border-dashboard-base-content/20">
      <SectionLabel icon={<Info className="h-3.5 w-3.5" />}>Package details</SectionLabel>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Title" icon={<AlignLeft className="h-3 w-3 text-dashboard-base-content" />} error={errors.title}>
          <input
            className={`${inputCls(!!errors.title)} border border-dashboard-base-content/40`}
            value={data.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            onBlur={(e) => update("title", toTitleCase(e.target.value))}
            placeholder="e.g. Kerala Backwaters Tour"
          />
        </Field>
        <Field label="Slug" icon={<Link2 className="h-3 w-3 text-dashboard-base-content" />} error={errors.slug}>
          <div className="flex">
            <span className="flex items-center whitespace-nowrap rounded-l-lg border border-r-0 border-dashboard-base-300 bg-dashboard-base-content/80 px-3 text-[12px] font-medium text-dashboard-base-100">
              packages/
            </span>
            <input
              className={cn(inputCls(!!errors.slug), "rounded-l-none border-r border-y border-dashboard-base-content/40")}
              value={data.slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="kerala-backwaters-tour"
            />
          </div>
        </Field>
      </div>
      <Field label="Description" icon={<AlignLeft className="h-3 w-3 text-dashboard-base-content" />} error={errors.description}>
        <textarea
          className={cn(inputCls(!!errors.description), "min-h-22 border border-dashboard-base-content/40 resize-none leading-relaxed")}
          value={data.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="Describe what makes this package special..."
        />
      </Field>
      <Field label="Destination" icon={<MapPin className="h-3 w-3 text-dashboard-base-content" />} error={errors.destination_id}>
        <SearchSelect
          value={data.destination_id}
          onChange={(val) => update("destination_id", val)}
          fetchOptions={searchDestinations}
          placeholder="Search destinations..."
          initialLabel={initialDestinationLabel}
        />
      </Field>
    </div>
  );

  const sectionMedia = (
    <div className="flex flex-col gap-4 rounded-2xl border bg-dashboard-base-100 p-5 border-dashboard-base-content/20">
      <SectionLabel icon={<ImageIcon className="h-3.5 w-3.5" />}>Thumbnail image</SectionLabel>
      <div className="w-full">
        <ImageUpload
          name="thumbnail"
          label="Upload Thumbnail"
          folder="packages"
          aspectRatio="wide"
          value={thumbnailImage}
          onChange={(img) => {
            setThumbnailImage(img);
            update("thumbnail", img?.key ?? null);
          }}
        />
      </div>
      <FieldError message={errors.thumbnail} />
    </div>
  );

  const sectionCategorise = (
    <div className="flex flex-col gap-5 rounded-2xl border border-dashboard-base-content/20 bg-dashboard-base-100 p-5">
      <SectionLabel icon={<Tag className="h-3.5 w-3.5" />}>Tags &amp; Categories</SectionLabel>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Tags" icon={<Hash className="h-3 w-3 text-dashboard-base-content" />} error={errors.tags}>
          <MultiSearchSelect
            value={data.tags}
            onChange={(val) => update("tags", val)}
            fetchOptions={searchTags}
            createOption={createTag}
            placeholder="Search or create tags..."
          />
        </Field>
        <Field label="Categories" icon={<Tag className="h-3 w-3 text-dashboard-base-content" />} error={errors.category}>
          <MultiSearchSelect
            value={data.category}
            onChange={(val) => update("category", val)}
            fetchOptions={searchCategories}
            createOption={createCategory}
            placeholder="Search or create categories..."
          />
        </Field>
      </div>
    </div>
  );

  const sectionInclusions = (
    <div className="flex flex-col gap-5 rounded-2xl border border-dashboard-base-content/20 bg-dashboard-base-100 p-5">
      <SectionLabel icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
        What&apos;s included &amp; excluded
      </SectionLabel>
      <div className="grid grid-cols-2 gap-4">
        <InclusionExclusionField
          type="inclusion"
          label="Inclusions"
          Icon={CheckCircle2}
          variant="success"
          items={data.inclusions}
          onItemsChange={(val) => update("inclusions", val)}
          error={errors.inclusions}
          placeholder="e.g. Breakfast included"
        />
        <InclusionExclusionField
          type="exclusion"
          label="Exclusions"
          Icon={XCircle}
          variant="error"
          items={data.exclusions}
          onItemsChange={(val) => update("exclusions", val)}
          error={errors.exclusions}
          placeholder="e.g. Flight tickets"
        />
      </div>
    </div>
  );

  // ── Single-page form (both create and update) ─────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">

      {/* Create-mode header */}
      {mode === "create" && (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dashboard-primary">
            <Package className="h-5 w-5 text-dashboard-primary-content" />
          </div>
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight text-dashboard-base-content">Create Package</h2>
            <p className="mt-0.5 text-[13px] text-dashboard-base-content/50">Fill in the details to publish a new tour package</p>
          </div>
        </div>
      )}

      {sectionBasicInfo}
      {sectionMedia}
      {sectionCategorise}
      {sectionInclusions}

      {/* Footer */}
      <div className="flex justify-end rounded-2xl border border-dashboard-base-300 bg-dashboard-base-100 px-5 py-4">
        <button type="submit" disabled={isSubmitting} className={cn(primaryBtn, "min-w-37")}>
          {isSubmitting ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" />{mode === "create" ? "Creating…" : "Saving…"}</>
          ) : mode === "create" ? (
            <><Rocket className="h-3.5 w-3.5" />Create Package</>
          ) : (
            <><Save className="h-3.5 w-3.5" />Save Changes</>
          )}
        </button>
      </div>

    </form>
  );
}