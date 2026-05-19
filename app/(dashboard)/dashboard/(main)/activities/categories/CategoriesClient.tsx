"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
    Tag, Plus, Pencil, Trash2, Loader2, Activity,
} from "lucide-react";
import { Button }   from "../../components/ui/button";
import { Input }    from "../../components/ui/input";
import { Label }    from "../../components/ui/label";
import { Switch }   from "../../components/ui/switch";
import {
    Sheet, SheetContent, SheetHeader,
    SheetTitle, SheetDescription, SheetFooter,
} from "../../components/ui/sheet";
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
import { DataTable, type ColumnDef } from "../../components/dashboard/Datatable";
import { TableFilters } from "../../components/dashboard/Tablefilters";
import { toast } from "sonner";
import {
    createCategory, updateCategory, deleteCategory, toggleCategoryActive,
    type CategoryRow,
} from "./actions";
import { TableEmptyState } from "../../components/dashboard/TableEmptyState";

// ── Types ─────────────────────────────────────────────────────────────────

type Status = "active" | "inactive" | "all";

type Props = {
    initialCategories: CategoryRow[];
    totalCount:        number;
    search:            string;
    status:            Status;
};

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

// ── Category Sheet (create + edit) ───────────────────────────────────────

function CategorySheet({
    open,
    onClose,
    category,
}: {
    open:      boolean;
    onClose:   () => void;
    category?: CategoryRow;
}) {
    const isEdit = !!category;

    const [name,      setName]      = useState(category?.name      ?? "");
    const [slug,      setSlug]      = useState(category?.slug      ?? "");
    const [sortOrder, setSortOrder] = useState(String(category?.sort_order ?? "0"));
    const [isActive,  setIsActive]  = useState(category?.is_active ?? true);
    const [isPending, startTransition] = useTransition();
    const [errors,    setErrors]    = useState<Record<string, string[]>>({});

    function handleNameChange(val: string) {
        const titled = val.replace(/\b\w/g, c => c.toUpperCase());
        setName(titled);
        if (!isEdit) setSlug(toSlug(val));
        else if (slug === toSlug(category!.name)) setSlug(toSlug(val));
    }

    function handleClose() {
        setErrors({});
        onClose();
    }

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setErrors({});
        startTransition(async () => {
            const fd = new FormData();
            fd.set("name",       name);
            fd.set("slug",       slug);
            fd.set("sort_order", sortOrder);
            fd.set("is_active",  String(isActive));

            const result = isEdit
                ? await updateCategory(category!.id, { success: false, message: "" }, fd)
                : await createCategory({ success: false, message: "" }, fd);

            if (result.success) {
                toast.success(result.message);
                if (!isEdit) {
                    setName(""); setSlug(""); setSortOrder("0"); setIsActive(true);
                }
                handleClose();
            } else {
                if (result.errors) setErrors(result.errors);
                toast.error(result.message);
            }
        });
    }

    return (
        <Sheet open={open} onOpenChange={o => !o && handleClose()}>
            <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
                <SheetHeader className="border-b pb-4">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-dashboard-primary/10">
                            <Tag className="h-4 w-4 text-dashboard-primary" />
                        </div>
                        <div>
                            <SheetTitle>{isEdit ? "Edit Category" : "Add Category"}</SheetTitle>
                            <SheetDescription>
                                {isEdit ? `Editing: ${category!.name}` : "Create a new activity category"}
                            </SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto">
                    <div className="flex-1 space-y-5 p-4">

                        {/* Name */}
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

                        {/* Slug */}
                        <div className="space-y-1.5">
                            <Label>Slug <span className="text-destructive">*</span></Label>
                            <Input
                                value={slug}
                                onChange={e => !isEdit && setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                                placeholder="adventure"
                                readOnly={isEdit}
                                className={isEdit ? "bg-muted text-muted-foreground cursor-not-allowed" : ""}
                            />
                            {isEdit && (
                                <p className="text-xs text-muted-foreground">
                                    Slug cannot be changed after creation
                                </p>
                            )}
                            <FieldError errors={errors} field="slug" />
                        </div>

                        {/* Sort Order */}
                        <div className="space-y-1.5">
                            <Label>Sort Order</Label>
                            <Input
                                type="number"
                                min="0"
                                value={sortOrder}
                                onChange={e => setSortOrder(e.target.value)}
                                placeholder="0"
                                className="w-32"
                            />
                        </div>

                        {/* Active toggle */}
                        <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
                            <div>
                                <p className="text-sm font-medium">Active</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Category visible on Dreams Yatri
                                </p>
                            </div>
                            <Switch
                                checked={isActive}
                                onCheckedChange={setIsActive}
                            />
                        </div>
                    </div>

                    <SheetFooter className="border-t pt-4 flex-row gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            className="flex-1"
                            onClick={handleClose}
                            disabled={isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isPending}
                            className="flex-1 bg-dashboard-primary text-dashboard-base-100 hover:bg-dashboard-primary/90"
                        >
                            {isPending
                                ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />{isEdit ? "Saving…" : "Creating…"}</>
                                : isEdit ? "Save Changes" : "Create Category"
                            }
                        </Button>
                    </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>
    );
}

// ── Add Category button (for PageHeader) ──────────────────────────────────

function AddCategoryButton() {
    const [open, setOpen] = useState(false);
    return (
        <>
            <Button
                onClick={() => setOpen(true)}
                size="lg"
                className="rounded-md bg-dashboard-primary text-dashboard-base-100 py-2.5 px-4 hover:bg-dashboard-primary hover:scale-105 duration-300 hover:text-dashboard-base-100 border border-dashboard-primary"
            >
                <Plus className="mr-2 h-4 w-4" />
                Add Category
            </Button>
            <CategorySheet open={open} onClose={() => setOpen(false)} />
        </>
    );
}

// ── Edit button (used inside the table) ───────────────────────────────────

function EditCategoryButton({ category }: { category: CategoryRow }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <Button
                variant="ghost" size="icon" className="h-8 w-8"
                onClick={e => { e.stopPropagation(); setOpen(true); }}
            >
                <Pencil className="h-3.5 w-3.5" />
            </Button>
            <CategorySheet
                open={open}
                onClose={() => setOpen(false)}
                category={category}
            />
        </>
    );
}

// ── Main client component ─────────────────────────────────────────────────

export function CategoriesClient({ initialCategories, totalCount, search, status }: Props) {
    const router       = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const [localSearch, setLocalSearch] = useState(search);
    const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    useEffect(() => { setLocalSearch(search); }, [search]);

    const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null);
    const [deleteError,  setDeleteError]  = useState<string | null>(null);

    function updateParam(key: string, value: string) {
        const params = new URLSearchParams(searchParams.toString());
        if (value === "all" || value === "") params.delete(key);
        else params.set(key, value);
        router.push(`?${params.toString()}`);
    }

    function handleSearch(value: string) {
        setLocalSearch(value);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => updateParam("search", value), 400);
    }

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

    // ── Columns ───────────────────────────────────────────────────────────

    const columns: ColumnDef<CategoryRow>[] = [
        {
            header: "Name",
            cell: (cat) => <span className="font-medium">{cat.name}</span>,
        },
        {
            header: "Slug",
            cell: (cat) => (
                <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {cat.slug}
                </code>
            ),
        },
        {
            header: "Activities",
            align:  "center",
            cell: (cat) => cat._count.activities > 0 ? (
                <Link
                    href={`/dashboard/activities?category_id=${cat.id}`}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={e => e.stopPropagation()}
                >
                    <Activity className="h-3 w-3" />
                    {cat._count.activities}
                </Link>
            ) : (
                <span className="text-xs text-muted-foreground">—</span>
            ),
        },
        {
            header: "Order",
            align:  "center",
            width:  "w-20",
            cell: (cat) => <span className="text-xs text-muted-foreground">{cat.sort_order}</span>,
        },
        {
            header: "Status",
            align:  "center",
            width:  "w-24",
            cell: (cat) => (
                <Switch
                    checked={cat.is_active}
                    disabled={isPending}
                    onCheckedChange={() => handleToggle(cat.id, cat.is_active)}
                    onClick={e => e.stopPropagation()}
                />
            ),
        },
        {
            header: "Actions",
            align:  "right",
            width:  "w-[80px]",
            cell: (cat) => (
                <div className="flex items-center justify-end gap-1">
                    <EditCategoryButton category={cat} />
                    <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={e => { e.stopPropagation(); openDelete(cat); }}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
        },
    ];

    // ── Render ────────────────────────────────────────────────────────────

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
                actions={<AddCategoryButton />}
            />

            {/* Filters */}
            <TableFilters
                search={localSearch}
                onSearchChange={handleSearch}
                searchPlaceholder="Search categories…"
                filteredCount={initialCategories.length}
                totalCount={totalCount}
                filters={[
                    {
                        value:       status,
                        onChange:    (v) => updateParam("status", v),
                        placeholder: "All Statuses",
                        width:       "w-38",
                        options: [
                            { label: "Active",   value: "active"   },
                            { label: "Inactive", value: "inactive" },
                        ],
                    },
                ]}
            />

            {/* DataTable */}
            <DataTable
                data={initialCategories}
                columns={columns}
                rowKey={cat => cat.id}
                emptyState={
                    <TableEmptyState
                        title="No Categories Yet"
                        description="Add your first category using the button above"
                    />
                }
            />

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
