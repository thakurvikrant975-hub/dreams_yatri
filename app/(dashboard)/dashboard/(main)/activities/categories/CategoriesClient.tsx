"use client";

import { useState, useTransition, useActionState, useRef } from "react";
import Link from "next/link";
import {
    Tag, Plus, Pencil, Trash2, ChevronRight, Loader2,
    GripVertical, Activity,
} from "lucide-react";
import { Button }   from "../../components/ui/button";
import { Input }    from "../../components/ui/input";
import { Label }    from "../../components/ui/label";
import { Switch }   from "../../components/ui/switch";
import { Badge }    from "../../components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogFooter,
} from "../../components/ui/dialog";
import {
    AlertDialog, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { PageHeader } from "../../components/dashboard/PageHeader";
import { toast } from "sonner";
import { cn }    from "@/app/lib/utils";
import {
    createCategory, updateCategory, deleteCategory, toggleCategoryActive,
    type CategoryRow, type CategoryFormState,
} from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────

type Props = { initialCategories: CategoryRow[] };

// ── Slug helper ───────────────────────────────────────────────────────────

function toSlug(name: string): string {
    return name.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

// ── Field error ───────────────────────────────────────────────────────────

function FieldError({ errors, field }: { errors?: Record<string, string[]>; field: string }) {
    const msgs = errors?.[field];
    if (!msgs?.length) return null;
    return <p className="text-xs text-destructive mt-1">{msgs[0]}</p>;
}

// ── Create form (inline at bottom of list) ────────────────────────────────

function CreateCategoryForm({ onCreated }: { onCreated: (cat: CategoryRow) => void }) {
    const [name,      setName]      = useState("");
    const [slug,      setSlug]      = useState("");
    const [sortOrder, setSortOrder] = useState("0");
    const [isActive,  setIsActive]  = useState(true);
    const [isPending, startTransition] = useTransition();
    const [errors, setErrors] = useState<Record<string, string[]>>({});

    function handleNameChange(val: string) {
        setName(val);
        setSlug(toSlug(val));
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setErrors({});
        startTransition(async () => {
            const fd = new FormData();
            fd.set("name",       name);
            fd.set("slug",       slug);
            fd.set("sort_order", sortOrder);
            fd.set("is_active",  String(isActive));
            const result = await createCategory({ success: false, message: "" }, fd);
            if (result.success) {
                toast.success(result.message);
                setName(""); setSlug(""); setSortOrder("0"); setIsActive(true);
                // Optimistic: page revalidation will update the list
            } else {
                if (result.errors) setErrors(result.errors);
                toast.error(result.message);
            }
        });
    }

    return (
        <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-5 space-y-4">
            <p className="text-sm font-semibold flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" /> New Category
            </p>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label>Name <span className="text-destructive">*</span></Label>
                    <Input
                        value={name}
                        onChange={e => handleNameChange(e.target.value)}
                        placeholder="Adventure"
                        autoComplete="off"
                    />
                    <FieldError errors={errors} field="name" />
                </div>
                <div className="space-y-1.5">
                    <Label>Slug <span className="text-destructive">*</span></Label>
                    <Input
                        value={slug}
                        onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                        placeholder="adventure"
                    />
                    <FieldError errors={errors} field="slug" />
                </div>
            </div>

            <div className="flex items-end gap-4">
                <div className="space-y-1.5 w-32">
                    <Label>Sort Order</Label>
                    <Input
                        type="number"
                        min="0"
                        value={sortOrder}
                        onChange={e => setSortOrder(e.target.value)}
                        placeholder="0"
                    />
                </div>
                <div className="flex items-center gap-2 pb-0.5">
                    <Switch checked={isActive} onCheckedChange={setIsActive} id="create-active" />
                    <Label htmlFor="create-active" className="cursor-pointer">Active</Label>
                </div>
                <div className="ml-auto">
                    <Button type="submit" disabled={isPending} className="gap-2">
                        {isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Creating…</> : "Create Category"}
                    </Button>
                </div>
            </div>
        </form>
    );
}

// ── Edit dialog ───────────────────────────────────────────────────────────

function EditCategoryDialog({
    category,
    open,
    onClose,
}: {
    category: CategoryRow;
    open:     boolean;
    onClose:  () => void;
}) {
    const [name,      setName]      = useState(category.name);
    const [slug,      setSlug]      = useState(category.slug);
    const [sortOrder, setSortOrder] = useState(String(category.sort_order));
    const [isActive,  setIsActive]  = useState(category.is_active);
    const [isPending, startTransition] = useTransition();
    const [errors, setErrors] = useState<Record<string, string[]>>({});

    function handleNameChange(val: string) {
        setName(val);
        if (slug === toSlug(category.name)) setSlug(toSlug(val));
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setErrors({});
        startTransition(async () => {
            const fd = new FormData();
            fd.set("name",       name);
            fd.set("slug",       slug);
            fd.set("sort_order", sortOrder);
            fd.set("is_active",  String(isActive));
            const result = await updateCategory(category.id, { success: false, message: "" }, fd);
            if (result.success) {
                toast.success(result.message);
                onClose();
            } else {
                if (result.errors) setErrors(result.errors);
                toast.error(result.message);
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={o => !o && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Edit Category</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-1">
                    <div className="space-y-1.5">
                        <Label>Name <span className="text-destructive">*</span></Label>
                        <Input
                            value={name}
                            onChange={e => handleNameChange(e.target.value)}
                            placeholder="Adventure"
                            autoComplete="off"
                        />
                        <FieldError errors={errors} field="name" />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Slug <span className="text-destructive">*</span></Label>
                        <Input
                            value={slug}
                            onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                            placeholder="adventure"
                        />
                        <FieldError errors={errors} field="slug" />
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="space-y-1.5">
                            <Label>Sort Order</Label>
                            <Input
                                type="number"
                                min="0"
                                className="w-24"
                                value={sortOrder}
                                onChange={e => setSortOrder(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2 pt-5">
                            <Switch checked={isActive} onCheckedChange={setIsActive} id="edit-active" />
                            <Label htmlFor="edit-active" className="cursor-pointer">Active</Label>
                        </div>
                    </div>
                    <DialogFooter className="pt-2">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Saving…</> : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ── Main client component ─────────────────────────────────────────────────

export function CategoriesClient({ initialCategories }: Props) {
    const [isPending, startTransition] = useTransition();

    const [editTarget,   setEditTarget]   = useState<CategoryRow | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null);
    const [deleteError,  setDeleteError]  = useState<string | null>(null);

    function handleToggle(id: number, current: boolean) {
        startTransition(async () => {
            const result = await toggleCategoryActive(id, !current);
            if (result.success) toast.success(result.message);
            else toast.error(result.message);
        });
    }

    function openDelete(cat: CategoryRow) {
        setDeleteTarget(cat);
        setDeleteError(null);
    }

    function closeDelete() {
        setDeleteTarget(null);
        setDeleteError(null);
    }

    function handleDelete() {
        if (!deleteTarget) return;
        startTransition(async () => {
            const result = await deleteCategory(deleteTarget.id);
            if (result.success) {
                toast.success(result.message);
                closeDelete();
            } else {
                setDeleteError(result.message);
            }
        });
    }

    return (
        <div className="space-y-6">
            {/* Breadcrumb */}
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard/activities">Activities</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Categories</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader
                title="Activity Categories"
                description="Organise activities by category"
                icon={Tag}
            />

            {/* Category list */}
            <div className="rounded-xl border bg-card overflow-hidden">
                {initialCategories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <Tag className="h-10 w-10 text-muted-foreground mb-3" />
                        <p className="text-sm font-medium text-muted-foreground">No categories yet</p>
                        <p className="text-xs text-muted-foreground mt-1">Create your first category below</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                                <th className="px-4 py-3 text-left font-medium w-8"></th>
                                <th className="px-4 py-3 text-left font-medium">Name</th>
                                <th className="px-4 py-3 text-left font-medium">Slug</th>
                                <th className="px-4 py-3 text-center font-medium">Activities</th>
                                <th className="px-4 py-3 text-center font-medium">Order</th>
                                <th className="px-4 py-3 text-center font-medium">Status</th>
                                <th className="px-4 py-3 text-right font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {initialCategories.map(cat => (
                                <tr key={cat.id} className="hover:bg-muted/20 transition-colors">
                                    <td className="px-4 py-3 text-muted-foreground">
                                        <GripVertical className="h-4 w-4" />
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="font-medium">{cat.name}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                            {cat.slug}
                                        </code>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {cat._count.activities > 0 ? (
                                            <Link
                                                href={`/dashboard/activities?category_id=${cat.id}`}
                                                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                <Activity className="h-3 w-3" />
                                                {cat._count.activities}
                                            </Link>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="text-xs text-muted-foreground">{cat.sort_order}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <Switch
                                            checked={cat.is_active}
                                            disabled={isPending}
                                            onCheckedChange={() => handleToggle(cat.id, cat.is_active)}
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                variant="ghost" size="icon" className="h-8 w-8"
                                                onClick={() => setEditTarget(cat)}
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost" size="icon"
                                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => openDelete(cat)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Create form */}
            <CreateCategoryForm onCreated={() => {}} />

            {/* Edit dialog */}
            {editTarget && (
                <EditCategoryDialog
                    category={editTarget}
                    open={!!editTarget}
                    onClose={() => setEditTarget(null)}
                />
            )}

            {/* Delete dialog */}
            <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && closeDelete()}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Category</AlertDialogTitle>
                        <AlertDialogDescription>
                            Delete <span className="font-semibold">{deleteTarget?.name}</span>?
                            {deleteTarget?._count.activities === 0
                                ? " This category has no activities assigned."
                                : null}
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {deleteError && (
                        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                            {deleteError}
                        </p>
                    )}

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                        <Button variant="destructive" disabled={isPending} onClick={handleDelete}>
                            {isPending ? "Deleting…" : "Delete"}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
