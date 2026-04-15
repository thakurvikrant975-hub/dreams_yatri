"use client";

import React, { useState, useTransition } from "react";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { TableCell, TableRow } from "../components/ui/table";
import {
    Trash2, Tag, Package, GitBranch,
    ChevronDown, ChevronRight, Search, X,
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
    deleteCategory,
    toggleCategoryActive,
    type CategoryWithRelations,
    type CategoryForSelect,
} from "./actions";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableFilters } from "../components/dashboard/Tablefilters";

// ── Delete Dialog ─────────────────────────────────────────────────────────────

function DeleteCategoryDialog({
    id, name, packageCount, childCount,
}: {
    id: number; name: string; packageCount: number; childCount: number;
}) {
    const [isPending, startTransition] = useTransition();
    const isBlocked = packageCount > 0 || childCount > 0;

    function handleDelete() {
        startTransition(async () => {
            const result = await deleteCategory(id);
            if (result.success) toast.success(result.message);
            else toast.error(result.message);
        });
    }

    return (
        <AlertDialog>
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
                        {childCount > 0 && (
                            <span className="block mt-2 text-destructive font-medium">
                                ⚠ This category has {childCount} subcategory(s). Remove them first.
                            </span>
                        )}
                        {packageCount > 0 && (
                            <span className="block mt-2 text-destructive font-medium">
                                ⚠ {packageCount} package(s) are linked. Unlink them first.
                            </span>
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDelete}
                        disabled={isPending || isBlocked}
                        className="bg-destructive text-white hover:bg-destructive/90"
                    >
                        {isPending ? "Deleting..." : "Delete"}
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
    child: { id: number; name: string; slug: string; is_active: boolean };
    parentCategories: CategoryForSelect[];
    allCategories: CategoryWithRelations[];
}) {
    const [isPending, startTransition] = useTransition();
    const full = allCategories.find((c) => c.id === child.id);

    function handleToggle() {
        startTransition(async () => {
            await toggleCategoryActive(child.id, !child.is_active);
            toast.success(`Subcategory ${!child.is_active ? "activated" : "deactivated"}`);
        });
    }

    return (
        <TableRow className="hover:bg-muted/20 bg-muted/5">
            {/* Name */}
            <TableCell>
                <div className="flex items-center gap-2 pl-8">
                    <div className="w-px h-4 bg-border" />
                    <div className="w-3 h-px bg-border" />
                    <div className="h-6 w-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <Tag className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div>
                        <p className="text-sm font-medium">{child.name}</p>
                        <p className="text-xs text-muted-foreground">Subcategory</p>
                    </div>
                </div>
            </TableCell>
            {/* Slug */}
            <TableCell>
                <Badge variant="outline" className="font-mono text-xs">{child.slug}</Badge>
            </TableCell>
            {/* Parent */}
            <TableCell>
                <span className="text-xs text-muted-foreground italic">—</span>
            </TableCell>
            {/* Subcategories */}
            <TableCell className="text-center">
                <span className="text-xs text-muted-foreground">—</span>
            </TableCell>
            {/* Packages */}
            <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <Package className="h-3 w-3" /> {full?._count.packages ?? 0}
                </div>
            </TableCell>
            {/* Status */}
            <TableCell className="text-center">
                <Switch
                    checked={child.is_active}
                    disabled={isPending}
                    onCheckedChange={handleToggle}
                />
            </TableCell>
            {/* Order */}
            <TableCell className="text-xs text-muted-foreground">—</TableCell>
            {/* Actions */}
            <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                    {full && (
                        <>
                            <EditCategoryDialog
                                category={full}
                                parentCategories={parentCategories}
                            />
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
    paginatedTopLevel,
    parentCategories,
    currentPage,
    totalPages,
}: {
    categories: CategoryWithRelations[];
    paginatedTopLevel: CategoryWithRelations[];
    parentCategories: CategoryForSelect[];
    currentPage: number;
    totalPages: number;
    pageSize: number;
}) {
    const [isPending, startTransition] = useTransition();
    const [expanded, setExpanded] = useState<Set<number>>(new Set());
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [parentFilter, setParentFilter] = useState<string>("all");

    function toggleExpanded(id: number) {
        setExpanded((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    function handleToggle(id: number, current: boolean) {
        startTransition(async () => {
            await toggleCategoryActive(id, !current);
            toast.success(`Category ${!current ? "activated" : "deactivated"}`);
        });
    }

    // ── Filter logic ──────────────────────────────────────────────────────────
    const query = search.trim().toLowerCase();
    const isSearching = query.length > 0;

    const parentOptions = parentCategories.map((p) => ({
    label: p.name,
    value: String(p.id),
}));

const baseData = isSearching || statusFilter !== "all" || parentFilter !== "all"
    ? categories
    : paginatedTopLevel;

const displayRows = baseData.filter((c) => {
    const matchesSearch =
        c.name.toLowerCase().includes(query) ||
        c.slug.toLowerCase().includes(query) ||
        (c.parent?.name?.toLowerCase().includes(query) ?? false);

    const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && c.is_active) ||
        (statusFilter === "inactive" && !c.is_active);

    const matchesParent =
        parentFilter === "all" ||
        String(c.parent_id ?? "top") === parentFilter;

    return matchesSearch && matchesStatus && matchesParent;
});

    // ── Column definitions ────────────────────────────────────────────────────
    const columns: ColumnDef<CategoryWithRelations>[] = [
        {
            header: "Category",
            width: "w-[240px]",
            cell: (cat) => {
                const hasChildren = cat.children.length > 0;
                const isTopLevel = cat.parent_id === null;
                const isExpanded = expanded.has(cat.id);

                return (
                    <div className="flex items-center gap-2">
                        {hasChildren && isTopLevel ? (
                            <button
                                onClick={() => toggleExpanded(cat.id)}
                                className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted transition-colors shrink-0"
                            >
                                {isExpanded
                                    ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                    : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                }
                            </button>
                        ) : (
                            <div className="w-5 shrink-0" />
                        )}
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${isTopLevel ? "bg-primary/10" : "bg-muted"}`}>
                            <Tag className={`h-4 w-4 ${isTopLevel ? "text-primary" : "text-muted-foreground"}`} />
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
                <Badge variant="outline" className="font-mono text-xs">{cat.slug}</Badge>
            ),
        },
        {
            header: "Parent",
            cell: (cat) => (
                <Badge variant="secondary" className="text-xs">
                    {cat.parent?.name ?? "Top Level"}
                </Badge>
            ),
        },
        {
            header: "Subcategories",
            align: "center",
            cell: (cat) => {
                const hasChildren = cat.children.length > 0;
                const isTopLevel = cat.parent_id === null;
                return hasChildren && isTopLevel ? (
                    <button
                        onClick={() => toggleExpanded(cat.id)}
                        className="flex items-center justify-center gap-1 text-xs text-primary hover:underline mx-auto"
                    >
                        <GitBranch className="h-3 w-3" />
                        {cat._count.children}
                    </button>
                ) : (
                    <span className="text-xs text-muted-foreground">0</span>
                );
            },
        },
        {
            header: "Packages",
            align: "center",
            cell: (cat) => (
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <Package className="h-3 w-3" /> {cat._count.packages}
                </div>
            ),
        },
        {
            header: "Status",
            align: "center",
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
            align: "right",
            width: "w-[100px]",
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

    // ── Empty state (no data at all, not a search miss) ───────────────────────
    if (!isSearching && paginatedTopLevel.length === 0) {
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


            {/* Filters */}
<TableFilters
    search={search}
    onSearchChange={setSearch}
    searchPlaceholder="Search categories..."
    filters={[
        {
            value: statusFilter,
            onChange: setStatusFilter,
            placeholder: "All Status",
            width: "w-40",
            options: [
                { label: "All", value: "all" },
                { label: "Active", value: "active" },
                { label: "Inactive", value: "inactive" },
            ],
        },
        {
            value: parentFilter,
            onChange: setParentFilter,
            placeholder: "All Parents",
            width: "w-48",
            options: [
                { label: "Top Level", value: "top" },
                ...parentOptions,
            ],
        },
    ]}
/>

            {/* Search result count */}
            {isSearching && (
                <p className="text-xs text-muted-foreground px-1">
                    {displayRows.length === 0
                        ? `No results for "${search}"`
                        : `${displayRows.length} result${displayRows.length !== 1 ? "s" : ""} for "${search}"`
                    }
                </p>
            )}

            {/* Table */}
            <DataTable
                data={displayRows}
                columns={columns}
                rowKey={(cat) => cat.id}
                renderSubRows={(cat) => {
                    const isTopLevel = cat.parent_id === null;
                    const isExpanded = expanded.has(cat.id);

                    if (isSearching || !isExpanded || !isTopLevel) return null;

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
                    <div className="flex flex-col items-center gap-2">
                        <Tag className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                            No categories match your search
                        </p>
                    </div>
                }
                pagination={
                    isSearching
                        ? undefined
                        : { currentPage, totalPages }
                }
            />
        </div>
    );
}