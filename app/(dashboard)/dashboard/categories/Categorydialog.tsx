"use client";

import { useState, useTransition } from "react";
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

// ── Build initial data for edit mode ─────────────────────────────────────

function buildInitialData(
    category?: CategoryWithRelations,
): Record<string, Record<string, unknown>> {
    if (!category) return {};

    return {
        basic: {
            name: category.name,
            slug: category.slug,
            parent_id: category.parent_id ? String(category.parent_id) : "none",
            sort_order: String(category.sort_order),
        },
        details: {
            description: category.description ?? "",
            is_active: category.is_active,
        },
        seo: {
            meta_title: category.meta_title ?? "",
            meta_desc: category.meta_desc ?? "",
        },
    };
}

// ── Step definitions ──────────────────────────────────────────────────────

function makeSteps(): Step[] {
    return [
        {
            id: "basic",
            title: "Basic Info",
            description: "Name, slug and parent",
            icon: <Tag className="h-4 w-4" />,
            validate: (data) => {
                if (!data.name) return "Category name is required";
                if (!data.slug) return "Slug is required";
                if (!/^[a-z0-9-]+$/.test(data.slug as string))
                    return "Slug must be lowercase letters, numbers and hyphens only";
                return null;
            },
        },
        {
            id: "details",
            title: "Details",
            description: "Description and settings",
            icon: <Settings2 className="h-4 w-4" />,
        },
        {
            id: "seo",
            title: "SEO",
            description: "Meta title and description",
            icon: <Search className="h-4 w-4" />,
            optional: true,
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
    category?: CategoryWithRelations;
    parentCategories: CategoryForSelect[];
}) {
    const { stepData, setStepData } = useMultiStep();
    const data = stepData["basic"] ?? {};

    const name = (data.name as string) ?? "";
    const slug = (data.slug as string) ?? "";
    const parent_id = (data.parent_id as string) ?? "none";
    const sort_order = (data.sort_order as string) ?? "0";

    function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
        const newName = e.target.value;
        if (category) {
            // Edit mode: don't auto-update slug
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

    // Filter out the current category from parent options (can't be own parent)
    const availableParents = parentCategories.filter(
        (p) => p.id !== category?.id,
    );

    return (
        <div className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
                <Label htmlFor="c-name">
                    Category Name <span className="text-destructive">*</span>
                </Label>
                <Input
                    id="c-name"
                    placeholder="International Tours"
                    value={name}
                    onChange={handleNameChange}
                    autoComplete="off"
                />
            </div>

            {/* Slug */}
            <div className="space-y-1.5">
                <Label htmlFor="c-slug">
                    Slug <span className="text-destructive">*</span>
                </Label>
                <Input
                    id="c-slug"
                    placeholder="international-tours"
                    value={slug}
                    onChange={(e) =>
                        setStepData("basic", {
                            ...data,
                            slug: e.target.value
                                .toLowerCase()
                                .replace(/[^a-z0-9-]/g, "-"),
                        })
                    }
                    readOnly={!!category}
                    className={
                        category
                            ? "bg-muted text-muted-foreground cursor-not-allowed"
                            : ""
                    }
                />
                <p className="text-xs text-muted-foreground">
                    {category ? (
                        "Slug cannot be changed after creation"
                    ) : (
                        <>
                            URL:{" "}
                            dreamsyatri.com/packages/
                            <strong>{slug || "international-tours"}</strong>
                        </>
                    )}
                </p>
            </div>

            {/* Parent Category */}
            <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                    <GitBranch className="h-3.5 w-3.5" />
                    Parent Category
                    <span className="text-xs text-muted-foreground font-normal">
                        (optional — leave empty for top-level)
                    </span>
                </Label>
                <Select
                    value={parent_id}
                    onValueChange={(v) =>
                        setStepData("basic", { ...data, parent_id: v })
                    }
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Top-level category" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">
                            <span className="text-muted-foreground">
                                — No parent (top-level)
                            </span>
                        </SelectItem>
                        {availableParents.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                                {p.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                    {parent_id === "none"
                        ? "This will be a top-level category."
                        : `This will appear as a subcategory under "${availableParents.find((p) => String(p.id) === parent_id)?.name ?? ""}".`}
                </p>
            </div>

            {/* Sort Order */}
            <div className="space-y-1.5">
                <Label htmlFor="c-sort">Sort Order</Label>
                <Input
                    id="c-sort"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={sort_order}
                    onChange={(e) =>
                        setStepData("basic", {
                            ...data,
                            sort_order: e.target.value,
                        })
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
    const data = stepData["details"] ?? {};

    const description = (data.description as string) ?? "";
    const is_active = (data.is_active as boolean) ?? true;

    return (
        <div className="space-y-4">
            <div className="space-y-1.5">
                <Label htmlFor="c-desc">Description</Label>
                <Textarea
                    id="c-desc"
                    placeholder="A brief description of this category..."
                    value={description}
                    onChange={(e) =>
                        setStepData("details", {
                            ...data,
                            description: e.target.value,
                        })
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
    const data = stepData["seo"] ?? {};

    const meta_title = (data.meta_title as string) ?? "";
    const meta_desc = (data.meta_desc as string) ?? "";
    const titleLen = meta_title.length;
    const descLen = meta_desc.length;

    return (
        <div className="space-y-5">
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <Label htmlFor="c-meta-title">Meta Title</Label>
                    <span
                        className={`text-xs ${titleLen > 60 ? "text-destructive" : "text-muted-foreground"}`}
                    >
                        {titleLen}/60
                    </span>
                </div>
                <Input
                    id="c-meta-title"
                    placeholder="International Tour Packages | Dreams Yatri"
                    value={meta_title}
                    onChange={(e) =>
                        setStepData("seo", {
                            ...data,
                            meta_title: e.target.value,
                        })
                    }
                />
            </div>

            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <Label htmlFor="c-meta-desc">Meta Description</Label>
                    <span
                        className={`text-xs ${descLen > 160 ? "text-destructive" : "text-muted-foreground"}`}
                    >
                        {descLen}/160
                    </span>
                </div>
                <Textarea
                    id="c-meta-desc"
                    placeholder="Explore international destinations with Dreams Yatri..."
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
                        dreamsyatri.com/packages/international-tours
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

export function CreateCategoryDialog({
    parentCategories,
}: {
    parentCategories: CategoryForSelect[];
}) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    const STEPS = makeSteps();

    async function handleComplete(data: Record<string, unknown>) {
        startTransition(async () => {
            const formData = new FormData();

            formData.append("name", (data.name as string) ?? "");
            formData.append("slug", (data.slug as string) ?? "");
            formData.append(
                "parent_id",
                data.parent_id && data.parent_id !== "none"
                    ? (data.parent_id as string)
                    : "",
            );
            formData.append("sort_order", (data.sort_order as string) ?? "0");
            formData.append("description", (data.description as string) ?? "");
            formData.append("is_active", String(data.is_active ?? true));
            formData.append("meta_title", (data.meta_title as string) ?? "");
            formData.append("meta_desc", (data.meta_desc as string) ?? "");

            const result = await createCategory(
                { success: false, message: "" },
                formData,
            );

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
                Add Category
            </Button>

            <MultiStepModal
                open={open}
                onOpenChange={setOpen}
                title="Create Category"
                description="Add a new category or subcategory for packages"
                steps={STEPS}
                onComplete={handleComplete}
                isSubmitting={isPending}
                submitLabel="Create Category"
                initialStepData={{}}
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
    category: CategoryWithRelations;
    parentCategories: CategoryForSelect[];
}) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    const STEPS = makeSteps();
    const initialData = buildInitialData(category);

    async function handleComplete(data: Record<string, unknown>) {
        startTransition(async () => {
            const formData = new FormData();

            formData.append("name", (data.name as string) ?? category.name);
            formData.append("slug", category.slug); // slug locked
            formData.append(
                "parent_id",
                data.parent_id && data.parent_id !== "none"
                    ? (data.parent_id as string)
                    : "",
            );
            formData.append(
                "sort_order",
                (data.sort_order as string) ?? String(category.sort_order),
            );
            formData.append(
                "description",
                (data.description as string) ?? category.description ?? "",
            );
            formData.append(
                "is_active",
                String(data.is_active ?? category.is_active),
            );
            formData.append(
                "meta_title",
                (data.meta_title as string) ?? category.meta_title ?? "",
            );
            formData.append(
                "meta_desc",
                (data.meta_desc as string) ?? category.meta_desc ?? "",
            );

            const result = await updateCategory(
                category.id,
                { success: false, message: "" },
                formData,
            );

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
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setOpen(true)}
            >
                <Pencil className="h-3.5 w-3.5" />
            </Button>

            <MultiStepModal
                open={open}
                onOpenChange={setOpen}
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