"use client";

import React, { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge }   from "../components/ui/badge";
import { Switch }  from "../components/ui/switch";
import { Button }  from "../components/ui/button";
import { TableCell, TableRow } from "../components/ui/table";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
    Trash2, Tag, Package, GitBranch, ChevronDown, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader,
    AlertDialogTitle, AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { EditCategoryDialog } from "./Categorydialog";
import {
    deleteCategory, toggleCategoryActive,
    type CategoryWithRelations, type CategoryForSelect,
} from "./actions";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableFilters } from "../components/dashboard/Tablefilters";
import { TableEmptyState } from "../components/dashboard/TableEmptyState";

// ── Delete Dialog ─────────────────────────────────────────────────────────────

function DeleteCategoryDialog({
    id, name, packageCount, childCount,
}: {
    id: number; name: string; packageCount: number; childCount: number;
}) {
    const [open,      setOpen]         = useState(false);
    const [errorMsg,  setErrorMsg]     = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    function handleOpenChange(o: boolean) {
        setOpen(o);
        if (!o) setErrorMsg(null);
    }

    function handleDelete(e: React.MouseEvent) {
        e.preventDefault();
        startTransition(async () => {
            const result = await deleteCategory(id);
            if (result.success) {
                toast.success(result.message);
                setOpen(false);
            } else {
                setErrorMsg(result.message);
            }
        });
    }

    return (
        <AlertDialog open={open} onOpenChange={handleOpenChange}>
            <AlertDialogTrigger asChild>
                <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Category</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to delete{" "}
                        <span className="font-semibold">{name}</span>?
                        This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {!errorMsg && (childCount > 0 || packageCount > 0) && (
                    <div className="text-sm text-amber-700 dark:text-amber-400 rounded-md border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 space-y-1">
                        {childCount > 0 && (
                            <p>⚠ This category has {childCount} subcategory(s). Remove them first.</p>
                        )}
                        {packageCount > 0 && (
                            <p>⚠ {packageCount} package(s) are linked. Unlink them first.</p>
                        )}
                    </div>
                )}

                {errorMsg && (
                    <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
                        {errorMsg}
                    </p>
                )}

                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDelete}
                        disabled={isPending}
                        className="bg-destructive text-white hover:bg-destructive/90"
                    >
                        {isPending ? "Deleting…" : "Delete"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

// ── Subcategory Row ───────────────────────────────────────────────────────────

function SubcategoryRow({
    child, parentCategories, allCategories,
}: {
    child:            { id: number; name: string; slug: string; is_active: boolean };
    parentCategories: CategoryForSelect[];
    allCategories:    CategoryWithRelations[];
}) {
    const [isPending, startTransition] = useTransition();
    const full = allCategories.find((c) => c.id === child.id);

    function handleToggle() {
        startTransition(async () => {
            const res = await toggleCategoryActive(child.id, !child.is_active);
            if (res.success) toast.success(res.message);
            else toast.error(res.message);
        });
    }

    return (
        <TableRow className="hover:bg-muted/20 bg-muted/5">
            <TableCell>
                <div className="flex items-center gap-2 pl-8">
                    <div className="w-px h-4 bg-border" />
                    <div className="w-3 h-px bg-border" />
                    <div className="h-6 w-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <Tag className="h-3 w-3 text-dashboard-primary" />
                    </div>
                    <div>
                        <p className="text-sm font-medium">{child.name}</p>
                        <p className="text-xs text-muted-foreground">Subcategory</p>
                    </div>
                </div>
            </TableCell>
            <TableCell>
                <Badge variant="outline" className="font-mono text-xs">{child.slug}</Badge>
            </TableCell>
            <TableCell>
                <span className="text-xs text-muted-foreground italic">—</span>
            </TableCell>
            <TableCell className="text-center">
                <span className="text-xs text-muted-foreground">—</span>
            </TableCell>
            <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <Package className="h-3 w-3" /> {full?._count.packages ?? 0}
                </div>
            </TableCell>
            <TableCell className="text-center">
                <Switch
                    checked={child.is_active}
                    disabled={isPending}
                    onCheckedChange={handleToggle}
                />
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">—</TableCell>
            <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                    {full && (
                        <>
                            <EditCategoryDialog category={full} parentCategories={parentCategories} />
                            <DeleteCategoryDialog
                                id={full.id}
                                name={full.name}
                                packageCount={full._count.packages}
                                childCount={full._count.children}
                            />
                        </>
                    )}
                </div>
            </TableCell>
        </TableRow>
    );
}

// ── Main Table ────────────────────────────────────────────────────────────────

export function CategoriesTable({
    categories,
    parentCategories,
    totalCount,
    limit,
    currentPage,
    isFiltering,
    search,
    status,
    parentFilter,
}: {
    categories:       CategoryWithRelations[];
    parentCategories: CategoryForSelect[];
    totalCount:       number;
    limit:            number;
    currentPage:      number;
    isFiltering:      boolean;
    search:           string;
    status:           string;
    parentFilter:     string;
}) {
    const router       = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();
    const [expanded,  setExpanded]     = useState<Set<number>>(new Set());

    const [localSearch, setLocalSearch] = useState(search);
    const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => { setLocalSearch(search); }, [search]);

    // ── URL helpers ────────────────────────────────────────────────────────────
    function updateParam(key: string, value: string) {
        const params = new URLSearchParams(searchParams.toString());
        if (value === "all" || value === "") {
            params.delete(key);
        } else {
            params.set(key, value);
        }
        params.delete("page");
        startTransition(() => router.replace(`?${params.toString()}`));
    }

    function handleSearch(value: string) {
        setLocalSearch(value);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => updateParam("search", value), 400);
    }

    function buildHref(p: number) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("page", String(p));
        return `?${params.toString()}`;
    }

    // ── Expand/collapse (top-level only, not when filtering) ───────────────────
    function toggleExpanded(id: number) {
        setExpanded((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    // ── Toggle active ──────────────────────────────────────────────────────────
    function handleToggle(id: number, current: boolean) {
        startTransition(async () => {
            const res = await toggleCategoryActive(id, !current);
            if (res.success) toast.success(res.message);
            else toast.error(res.message);
        });
    }

    // ── Pagination ─────────────────────────────────────────────────────────────
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const from = totalCount === 0 ? 0 : (currentPage - 1) * limit + 1;
    const to   = Math.min(currentPage * limit, totalCount);
    const paginationLabel = `Showing ${from}–${to} of ${totalCount} categor${totalCount !== 1 ? "ies" : "y"}`;

    const parentOptions = parentCategories.map((p) => ({
        label: p.name,
        value: String(p.id),
    }));

    // ── Columns ────────────────────────────────────────────────────────────────
    const columns: ColumnDef<CategoryWithRelations>[] = [
        {
            header: "Category",
            width:  "w-[240px]",
            cell: (cat) => {
                const hasChildren = cat.children.length > 0;
                const isTopLevel  = cat.parent_id === null;
                const isExpanded  = expanded.has(cat.id);

                return (
                    <div className="flex items-center gap-2">
                        {hasChildren && isTopLevel && !isFiltering ? (
                            <button
                                onClick={() => toggleExpanded(cat.id)}
                                className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted transition-colors shrink-0"
                            >
                                {isExpanded
                                    ? <ChevronDown  className="h-3.5 w-3.5 text-dashboard-primary" />
                                    : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                }
                            </button>
                        ) : (
                            <div className="w-5 shrink-0" />
                        )}
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-dashboard-primary ${isTopLevel ? "bg-dashboard-primary/10" : "bg-muted"}`}>
                            <Tag className={`h-4 w-4 ${isTopLevel ? "text-dashboard-primary" : "text-dashboard-primary"}`} />
                        </div>
                        <div>
                            <p className="font-medium text-sm">{cat.name}</p>
                            <p className="text-xs text-muted-foreground">/{cat.slug}</p>
                        </div>
                    </div>
                );
            },
        },
        {
            header: "Slug",
            cell: (cat) => (
                <Badge variant="outline" className="font-mono text-xs border-dashboard-neutral/75 text-dashboard-neutral/75">{cat.slug}</Badge>
            ),
        },
        {
            header: "Parent",
            cell: (cat) => (
                <Badge variant="secondary" className="text-xs bg-dashboard-primary/10 text-dashboard-primary">
                    {cat.parent?.name ?? "Top Level"}
                </Badge>
            ),
        },
        {
            header: "Subcategories",
            align:  "center",
            cell: (cat) => {
                const hasChildren = cat.children.length > 0;
                const isTopLevel  = cat.parent_id === null;
                return hasChildren && isTopLevel && !isFiltering ? (
                    <button
                        onClick={() => toggleExpanded(cat.id)}
                        className="flex items-center justify-center gap-1 text-xs text-primary hover:underline mx-auto"
                    >
                        <GitBranch className="h-3 w-3" />
                        {cat._count.children}
                    </button>
                ) : (
                    <span className="text-xs text-muted-foreground">
                        {cat._count.children || 0}
                    </span>
                );
            },
        },
        {
            header: "Packages",
            align:  "center",
            cell: (cat) => (
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <Package className="h-3 w-3" /> {cat._count.packages}
                </div>
            ),
        },
        {
            header: "Status",
            align:  "center",
            cell: (cat) => (
                <Switch
                    checked={cat.is_active}
                    disabled={isPending}
                    onCheckedChange={() => handleToggle(cat.id, cat.is_active)}
                />
            ),
        },
        {
            header: "Order",
            cell: (cat) => (
                <span className="text-xs text-muted-foreground">#{cat.sort_order}</span>
            ),
        },
        {
            header: "Actions",
            align:  "right",
            width:  "w-[100px]",
            cell: (cat) => (
                <div className="flex items-center justify-end gap-1">
                    <EditCategoryDialog category={cat} parentCategories={parentCategories} />
                    <DeleteCategoryDialog
                        id={cat.id}
                        name={cat.name}
                        packageCount={cat._count.packages}
                        childCount={cat._count.children}
                    />
                </div>
            ),
        },
    ];

    if (!isFiltering && categories.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 border rounded-xl bg-muted/30">
                <Tag className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No categories yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                    Create your first category to get started
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">

            {/* Filters + rows-per-page */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <TableFilters
                    search={localSearch}
                    onSearchChange={handleSearch}
                    searchPlaceholder="Search categories..."
                    className="flex-1"
                    filters={[
                        {
                            value:       status,
                            onChange:    (v) => updateParam("status", v),
                            placeholder: "All Statuses",
                            width:       "w-36",
                            options: [
                                { label: "Active",   value: "active"   },
                                { label: "Inactive", value: "inactive" },
                            ],
                        },
                        {
                            value:       parentFilter,
                            onChange:    (v) => updateParam("parent", v),
                            placeholder: "All Parents",
                            width:       "w-44",
                            options: [
                                { label: "Top Level Only", value: "top" },
                                ...parentOptions,
                            ],
                        },
                    ]}
                />

                <Select
                    value={String(limit)}
                    onValueChange={(v) => {
                        const params = new URLSearchParams(searchParams.toString());
                        params.set("limit", v);
                        params.delete("page");
                        startTransition(() => router.replace(`?${params.toString()}`));
                    }}
                >
                    <SelectTrigger className="w-32 h-10 text-sm shrink-0 border-dashboard-base-300 bg-dashboard-base-100 text-dashboard-base-content/70 rounded-lg focus:ring-dashboard-primary/30 focus:border-dashboard-primary">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-dashboard-base-300 bg-dashboard-base-100">
                        {[10, 20, 50].map((n) => (
                            <SelectItem
                                key={n}
                                value={String(n)}
                                className="text-sm text-dashboard-base-content focus:bg-dashboard-base-200 focus:text-dashboard-base-content rounded-lg cursor-pointer"
                            >
                                {n} / page
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <DataTable
                data={categories}
                columns={columns}
                rowKey={(cat) => cat.id}
                renderSubRows={(cat) => {
                    if (isFiltering || !expanded.has(cat.id) || cat.parent_id !== null) return null;
                    return cat.children.map((child) => (
                        <SubcategoryRow
                            key={child.id}
                            child={child}
                            parentCategories={parentCategories}
                            allCategories={categories}
                        />
                    ));
                }}
                emptyState={
                    <TableEmptyState
                        title="No Categories Found"
                        description="Try adjusting your filters or adding a new category."
                    />

                }
                pagination={{
                    currentPage,
                    totalPages,
                    buildHref,
                    label: paginationLabel,
                }}
            />
        </div>
    );
}
