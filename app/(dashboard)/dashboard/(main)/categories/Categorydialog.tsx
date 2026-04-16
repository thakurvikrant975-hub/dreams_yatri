"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { Plus, Tag, Search, Settings2, Pencil, GitBranch } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Switch } from "../components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";
import { cn } from "@/app/lib/utils";

import {
    MultiStepModal,
    useMultiStep,
    type Step,
} from "../components/dashboard/MultiStepModel";

import {
    createCategory,
    updateCategory,
    type CategoryWithRelations,
    type CategoryForSelect,
} from "./actions";

// ── SEO title generator ───────────────────────────────────────────────────

function generateSeoTitle(name: string): string {
    if (!name.trim()) return "";
    const cleaned = name.trim();
    return `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)} Travel Packages | DreamsYatri`;
}

// ── Build initial data for edit mode ─────────────────────────────────────

function buildInitialData(
    category?: CategoryWithRelations,
): Record<string, Record<string, unknown>> {
    if (!category) return {};
    return {
        basic: {
            name:       category.name,
            slug:       category.slug,
            type:       category.parent_id ? "sub" : "parent",
            parent_id:  category.parent_id ? String(category.parent_id) : "",
            sort_order: String(category.sort_order),
        },
        details: {
            description: category.description ?? "",
            is_active:   category.is_active,
        },
        seo: {
            meta_title:       category.meta_title ?? "",
            meta_desc:        category.meta_desc  ?? "",
            seo_title_edited: !!(category.meta_title),
        },
    };
}

// ── Default empty step data (used to reset form on close) ─────────────────

const EMPTY_STEP_DATA: Record<string, Record<string, unknown>> = {
    basic:   { name: "", slug: "", type: "parent", parent_id: "", sort_order: "0" },
    details: { description: "", is_active: true },
    seo:     { meta_title: "", meta_desc: "", seo_title_edited: false },
};

// ── Step definitions ──────────────────────────────────────────────────────

function makeSteps(): Step[] {
    return [
        {
            id:          "basic",
            title:       "Basic Info",
            description: "Name, slug and type",
            icon:        <Tag className="h-4 w-4" />,
            validate: (data) => {
                if (!data.name) return "Category name is required";
                if (!data.slug) return "Slug is required";
                if (!/^[a-z0-9-]+$/.test(data.slug as string))
                    return "Slug must be lowercase letters, numbers and hyphens only";
                if (data.type === "sub" && !data.parent_id)
                    return "Please select a parent category";
                return null;
            },
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
    category,
    parentCategories,
}: {
    category?:        CategoryWithRelations;
    parentCategories: CategoryForSelect[];
}) {
    const { stepData, setStepData } = useMultiStep();
    const data = stepData["basic"] ?? {};

    const name       = (data.name       as string) ?? "";
    const slug       = (data.slug       as string) ?? "";
    const type       = (data.type       as string) ?? "parent";
    const parent_id  = (data.parent_id  as string) ?? "";
    const sort_order = (data.sort_order as string) ?? "0";

    const availableParents = parentCategories.filter((p) => p.id !== category?.id);

    function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
        const newName = e.target.value;

        // Always update auto SEO title if user hasn't overridden it
        const seoData = stepData["seo"] ?? {};
        if (!(seoData.seo_title_edited as boolean)) {
            setStepData("seo", {
                ...seoData,
                meta_title: generateSeoTitle(newName),
            });
        }

        if (category) {
            setStepData("basic", { ...data, name: newName });
            return;
        }

        // Create mode: auto-generate slug
        const newSlug = newName
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .trim();
        setStepData("basic", { ...data, name: newName, slug: newSlug });
    }

    function handleTypeChange(newType: "parent" | "sub") {
        setStepData("basic", {
            ...data,
            type:      newType,
            parent_id: newType === "parent" ? "" : parent_id,
        });
    }

    return (
        <div className="space-y-5">

            {/* ── Type selector (create mode only) ── */}
            {!category && (
                <div className="space-y-2">
                    <Label>
                        Category Type <span className="text-destructive">*</span>
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => handleTypeChange("parent")}
                            className={cn(
                                "flex flex-col items-start gap-1.5 rounded-xl border-2 p-4 text-left transition-all",
                                type === "parent"
                                    ? "border-primary bg-primary/5"
                                    : "border-border hover:border-muted-foreground/40 hover:bg-muted/30",
                            )}
                        >
                            <div className={cn(
                                "h-8 w-8 rounded-lg flex items-center justify-center",
                                type === "parent" ? "bg-primary/10" : "bg-muted",
                            )}>
                                <Tag className={cn("h-4 w-4", type === "parent" ? "text-primary" : "text-muted-foreground")} />
                            </div>
                            <div>
                                <p className={cn("text-sm font-semibold", type === "parent" ? "text-primary" : "text-foreground")}>
                                    Parent Category
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Top-level group e.g. "International"
                                </p>
                            </div>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleTypeChange("sub")}
                            className={cn(
                                "flex flex-col items-start gap-1.5 rounded-xl border-2 p-4 text-left transition-all",
                                type === "sub"
                                    ? "border-primary bg-primary/5"
                                    : "border-border hover:border-muted-foreground/40 hover:bg-muted/30",
                            )}
                        >
                            <div className={cn(
                                "h-8 w-8 rounded-lg flex items-center justify-center",
                                type === "sub" ? "bg-primary/10" : "bg-muted",
                            )}>
                                <GitBranch className={cn("h-4 w-4", type === "sub" ? "text-primary" : "text-muted-foreground")} />
                            </div>
                            <div>
                                <p className={cn("text-sm font-semibold", type === "sub" ? "text-primary" : "text-foreground")}>
                                    Subcategory
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Nested under a parent e.g. "Dubai"
                                </p>
                            </div>
                        </button>
                    </div>
                </div>
            )}

            {/* ── Parent dropdown ── */}
            {type === "sub" && (
                <div className="space-y-1.5">
                    <Label>
                        Parent Category <span className="text-destructive">*</span>
                    </Label>
                    {availableParents.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-4 text-center">
                            <p className="text-sm text-muted-foreground">No parent categories found.</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Create a parent category first, then add subcategories.
                            </p>
                        </div>
                    ) : (
                        <Select
                            value={parent_id}
                            onValueChange={(v) => setStepData("basic", { ...data, parent_id: v })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select parent category" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableParents.map((p) => (
                                    <SelectItem key={p.id} value={String(p.id)}>
                                        {p.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    {parent_id && (
                        <p className="text-xs text-muted-foreground">
                            Will appear under:{" "}
                            <span className="font-medium text-foreground">
                                {availableParents.find((p) => String(p.id) === parent_id)?.name}
                            </span>
                        </p>
                    )}
                </div>
            )}

            {/* ── Name ── */}
            <div className="space-y-1.5">
                <Label htmlFor="c-name">
                    {type === "sub" ? "Subcategory" : "Category"} Name{" "}
                    <span className="text-destructive">*</span>
                </Label>
                <Input
                    id="c-name"
                    placeholder={type === "sub" ? "Dubai" : "International Tours"}
                    value={name}
                    onChange={handleNameChange}
                    autoComplete="off"
                />
            </div>

            {/* ── Slug ── */}
            <div className="space-y-1.5">
                <Label htmlFor="c-slug">
                    Slug <span className="text-destructive">*</span>
                </Label>
                <Input
                    id="c-slug"
                    placeholder={type === "sub" ? "dubai" : "international-tours"}
                    value={slug}
                    onChange={(e) =>
                        setStepData("basic", {
                            ...data,
                            slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                        })
                    }
                    readOnly={!!category}
                    className={category ? "bg-muted text-muted-foreground cursor-not-allowed" : ""}
                />
                <p className="text-xs text-muted-foreground">
                    {category
                        ? "Slug cannot be changed after creation"
                        : <>URL: dreamsyatri.com/packages/<strong>{slug || (type === "sub" ? "dubai" : "international-tours")}</strong></>
                    }
                </p>
            </div>

            {/* ── Sort Order ── */}
            <div className="space-y-1.5">
                <Label htmlFor="c-sort">Sort Order</Label>
                <Input
                    id="c-sort"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={sort_order}
                    onChange={(e) =>
                        setStepData("basic", { ...data, sort_order: e.target.value })
                    }
                />
                <p className="text-xs text-muted-foreground">
                    Lower numbers appear first. Default is 0.
                </p>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — Details
// ─────────────────────────────────────────────────────────────────────────────

function DetailsStep() {
    const { stepData, setStepData } = useMultiStep();
    const data        = stepData["details"] ?? {};
    const description = (data.description as string)  ?? "";
    const is_active   = (data.is_active   as boolean) ?? true;

    return (
        <div className="space-y-4">
            <div className="space-y-1.5">
                <Label htmlFor="c-desc">Description</Label>
                <Textarea
                    id="c-desc"
                    placeholder="A brief description of this category..."
                    value={description}
                    onChange={(e) =>
                        setStepData("details", { ...data, description: e.target.value })
                    }
                    rows={4}
                />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
                <div>
                    <p className="text-sm font-medium">Active</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Category visible on Dreams Yatri
                    </p>
                </div>
                <Switch
                    checked={is_active}
                    onCheckedChange={(v) =>
                        setStepData("details", { ...data, is_active: v })
                    }
                />
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — SEO
// ─────────────────────────────────────────────────────────────────────────────

function SEOStep() {
    const { stepData, setStepData } = useMultiStep();
    const data      = stepData["seo"]   ?? {};
    const basicData = stepData["basic"] ?? {};

    const meta_title       = (data.meta_title       as string)  ?? "";
    const meta_desc        = (data.meta_desc        as string)  ?? "";
    const seo_title_edited = (data.seo_title_edited as boolean) ?? false;
    const categoryName     = (basicData.name        as string)  ?? "";

    const titleLen = meta_title.length;
    const descLen  = meta_desc.length;

    // Keep auto title in sync as user types name on step 1
    const prevName = useRef(categoryName);
    useEffect(() => {
        if (prevName.current !== categoryName) {
            prevName.current = categoryName;
            if (!seo_title_edited) {
                setStepData("seo", {
                    ...data,
                    meta_title: generateSeoTitle(categoryName),
                });
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [categoryName]);

    function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
        setStepData("seo", {
            ...data,
            meta_title:       e.target.value,
            seo_title_edited: true,   // lock auto-gen the moment user types
        });
    }

    function handleTitleReset() {
        setStepData("seo", {
            ...data,
            meta_title:       generateSeoTitle(categoryName),
            seo_title_edited: false,  // re-enable auto-gen
        });
    }

    return (
        <div className="space-y-5">
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="c-meta-title">Meta Title</Label>
                        {!seo_title_edited && meta_title && (
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-medium">
                                AUTO
                            </span>
                        )}
                        {seo_title_edited && (
                            <button
                                type="button"
                                onClick={handleTitleReset}
                                className="text-xs text-primary hover:underline"
                            >
                                ↩ Reset to auto
                            </button>
                        )}
                    </div>
                    <span className={`text-xs ${titleLen > 60 ? "text-destructive" : "text-muted-foreground"}`}>
                        {titleLen}/60
                    </span>
                </div>
                <Input
                    id="c-meta-title"
                    placeholder="International Travel Packages | DreamsYatri"
                    value={meta_title}
                    onChange={handleTitleChange}
                />
                {!seo_title_edited && (
                    <p className="text-xs text-muted-foreground">
                        Auto-generated from category name. Edit to override.
                    </p>
                )}
            </div>

            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <Label htmlFor="c-meta-desc">Meta Description</Label>
                    <span className={`text-xs ${descLen > 160 ? "text-destructive" : "text-muted-foreground"}`}>
                        {descLen}/160
                    </span>
                </div>
                <Textarea
                    id="c-meta-desc"
                    placeholder="Explore the best travel packages with Dreams Yatri..."
                    value={meta_desc}
                    onChange={(e) =>
                        setStepData("seo", { ...data, meta_desc: e.target.value })
                    }
                    rows={3}
                />
            </div>

            {(meta_title || meta_desc) && (
                <div className="rounded-lg border p-3 bg-muted/20 space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">
                        Search Preview
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-500">
                        dreamsyatri.com/packages/...
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
// SHARED — build FormData
// ─────────────────────────────────────────────────────────────────────────────

function buildFormData(
    data: Record<string, unknown>,
    fallback?: CategoryWithRelations,
): FormData {
    const formData  = new FormData();
    const type      = (data.type      as string) ?? (fallback?.parent_id ? "sub" : "parent");
    const parent_id = (data.parent_id as string) ?? "";

    formData.append("name",        (data.name        as string) ?? fallback?.name        ?? "");
    formData.append("slug",        (data.slug        as string) ?? fallback?.slug        ?? "");
    formData.append("sort_order",  (data.sort_order  as string) ?? String(fallback?.sort_order ?? 0));
    formData.append("description", (data.description as string) ?? fallback?.description ?? "");
    formData.append("is_active",   String(data.is_active ?? fallback?.is_active ?? true));
    formData.append("meta_title",  (data.meta_title  as string) ?? fallback?.meta_title  ?? "");
    formData.append("meta_desc",   (data.meta_desc   as string) ?? fallback?.meta_desc   ?? "");
    formData.append("parent_id",   type === "sub" && parent_id ? parent_id : "");

    return formData;
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE DIALOG
// ─────────────────────────────────────────────────────────────────────────────

export function CreateCategoryDialog({
    parentCategories,
}: {
    parentCategories: CategoryForSelect[];
}) {
    const [open,      setOpen]     = useState(false);
    const [isPending, startTransition] = useTransition();
    // Incrementing key forces full remount of modal + all step state on close
    const [modalKey,  setModalKey] = useState(0);

    const STEPS = makeSteps();

    function handleOpenChange(val: boolean) {
        setOpen(val);
        if (!val) setModalKey((k) => k + 1);
    }

    async function handleComplete(data: Record<string, unknown>) {
        startTransition(async () => {
            const formData = buildFormData(data);
            const result   = await createCategory({ success: false, message: "" }, formData);

            if (result.success) {
                toast.success(result.message);
                handleOpenChange(false);
            } else {
                toast.error(result.message);
            }
        });
    }

    return (
        <>
            <Button onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Category
            </Button>

            <MultiStepModal
                key={modalKey}
                open={open}
                onOpenChange={handleOpenChange}
                title="Create Category"
                description="Add a new category or subcategory for packages"
                steps={STEPS}
                onComplete={handleComplete}
                isSubmitting={isPending}
                submitLabel="Create Category"
                initialStepData={EMPTY_STEP_DATA}
            >
                <BasicInfoStep parentCategories={parentCategories} />
                <DetailsStep />
                <SEOStep />
            </MultiStepModal>
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// EDIT DIALOG
// ─────────────────────────────────────────────────────────────────────────────

export function EditCategoryDialog({
    category,
    parentCategories,
}: {
    category:         CategoryWithRelations;
    parentCategories: CategoryForSelect[];
}) {
    const [open,      setOpen]     = useState(false);
    const [isPending, startTransition] = useTransition();
    const [modalKey,  setModalKey] = useState(0);

    const STEPS       = makeSteps();
    const initialData = buildInitialData(category);

    function handleOpenChange(val: boolean) {
        setOpen(val);
        if (!val) setModalKey((k) => k + 1);
    }

    async function handleComplete(data: Record<string, unknown>) {
        startTransition(async () => {
            const formData = buildFormData(data, category);
            formData.set("slug", category.slug);

            const result = await updateCategory(
                category.id,
                { success: false, message: "" },
                formData,
            );

            if (result.success) {
                toast.success(result.message);
                handleOpenChange(false);
            } else {
                toast.error(result.message);
            }
        });
    }

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setOpen(true)}
            >
                <Pencil className="h-3.5 w-3.5" />
            </Button>

            <MultiStepModal
                key={modalKey}
                open={open}
                onOpenChange={handleOpenChange}
                title="Edit Category"
                description={`Editing: ${category.name}`}
                steps={STEPS}
                onComplete={handleComplete}
                isSubmitting={isPending}
                submitLabel="Save Changes"
                initialStepData={initialData}
            >
                <BasicInfoStep
                    category={category}
                    parentCategories={parentCategories}
                />
                <DetailsStep />
                <SEOStep />
            </MultiStepModal>
        </>
    );
}