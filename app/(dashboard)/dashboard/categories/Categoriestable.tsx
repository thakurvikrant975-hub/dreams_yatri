"use client";

import { useState, useTransition } from "react";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import {
    Table, TableBody, TableCell,
    TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
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
import {
    Pagination, PaginationContent, PaginationEllipsis,
    PaginationItem, PaginationLink,
    PaginationNext, PaginationPrevious,
} from "../components/ui/pagination";
import { EditCategoryDialog } from "./Categorydialog";
import {
    deleteCategory,
    toggleCategoryActive,
    type CategoryWithRelations,
    type CategoryForSelect,
} from "./actions";

// ── Delete Dialog ─────────────────────────────────────────────────────────

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
                        Are you sure you want to delete <span className="font-semibold">{name}</span>?
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

// ── Subcategory Row ───────────────────────────────────────────────────────

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
                <Switch checked={child.is_active} disabled={isPending} onCheckedChange={handleToggle} />
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">—</TableCell>
            <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                    {full && (
                        <>
                            <EditCategoryDialog category={full} parentCategories={parentCategories} />
                            <DeleteCategoryDialog
                                id={full.id} name={full.name}
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

// ── Pagination ────────────────────────────────────────────────────────────

function TablePagination({
    currentPage, totalPages,
}: {
    currentPage: number; totalPages: number;
}) {
    if (totalPages <= 1) return null;

    function getPageNumbers(): (number | "ellipsis")[] {
        if (totalPages <= 5)
            return Array.from({ length: totalPages }, (_, i) => i + 1);

        const pages: (number | "ellipsis")[] = [1];
        if (currentPage > 3) pages.push("ellipsis");

        const start = Math.max(2, currentPage - 1);
        const end   = Math.min(totalPages - 1, currentPage + 1);
        for (let i = start; i <= end; i++) pages.push(i);

        if (currentPage < totalPages - 2) pages.push("ellipsis");
        pages.push(totalPages);
        return pages;
    }

    return (
        <div className="border-t px-4 py-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages}
            </p>
            <Pagination>
                <PaginationContent>
                    <PaginationItem>
                        <PaginationPrevious
                            href={`?page=${currentPage - 1}`}
                            aria-disabled={currentPage === 1}
                            className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                        />
                    </PaginationItem>
                    {getPageNumbers().map((p, i) =>
                        p === "ellipsis" ? (
                            <PaginationItem key={`e-${i}`}>
                                <PaginationEllipsis />
                            </PaginationItem>
                        ) : (
                            <PaginationItem key={p}>
                                <PaginationLink href={`?page=${p}`} isActive={p === currentPage}>
                                    {p}
                                </PaginationLink>
                            </PaginationItem>
                        ),
                    )}
                    <PaginationItem>
                        <PaginationNext
                            href={`?page=${currentPage + 1}`}
                            aria-disabled={currentPage === totalPages}
                            className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                        />
                    </PaginationItem>
                </PaginationContent>
            </Pagination>
        </div>
    );
}

// ── Main Table ────────────────────────────────────────────────────────────

export function CategoriesTable({
    categories,
    paginatedTopLevel,
    parentCategories,
    currentPage,
    totalPages,
    pageSize,
}: {
    categories:        CategoryWithRelations[];
    paginatedTopLevel: CategoryWithRelations[];
    parentCategories:  CategoryForSelect[];
    currentPage:       number;
    totalPages:        number;
    pageSize:          number;
}) {
    const [isPending, startTransition] = useTransition();
    const [expanded,  setExpanded]     = useState<Set<number>>(new Set());
    const [search,    setSearch]       = useState("");

    function toggleExpanded(id: number) {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function handleToggle(id: number, current: boolean) {
        startTransition(async () => {
            await toggleCategoryActive(id, !current);
            toast.success(`Category ${!current ? "activated" : "deactivated"}`);
        });
    }

    // ── Client-side search filter ─────────────────────────────────────────
    // When searching: scan all top-level + their children, show matches flat
    // When not searching: use server-paginated paginatedTopLevel as normal

    const query = search.trim().toLowerCase();

    const displayRows: CategoryWithRelations[] = query
        ? categories.filter((c) =>
              c.name.toLowerCase().includes(query) ||
              c.slug.toLowerCase().includes(query) ||
              c.parent?.name?.toLowerCase().includes(query) ||
              false,
          )
        : paginatedTopLevel;

    const isSearching = query.length > 0;

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
            {/* ── Search bar ── */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                    placeholder="Search by name, slug or parent..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 pr-9"
                />
                {search && (
                    <button
                        onClick={() => setSearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* ── Search result count ── */}
            {isSearching && (
                <p className="text-xs text-muted-foreground px-1">
                    {displayRows.length === 0
                        ? `No results for "${search}"`
                        : `${displayRows.length} result${displayRows.length !== 1 ? "s" : ""} for "${search}"`
                    }
                </p>
            )}

            <div className="rounded-xl border bg-card overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="w-[240px]">Category</TableHead>
                            <TableHead>Slug</TableHead>
                            <TableHead>Parent</TableHead>
                            <TableHead className="text-center">Subcategories</TableHead>
                            <TableHead className="text-center">Packages</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead>Order</TableHead>
                            <TableHead className="text-right w-[100px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {displayRows.length === 0 && isSearching ? (
                            <TableRow>
                                <TableCell colSpan={8} className="py-16 text-center">
                                    <Tag className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                    <p className="text-sm text-muted-foreground">
                                        No categories match your search
                                    </p>
                                </TableCell>
                            </TableRow>
                        ) : (
                            displayRows.map((cat) => {
                                const hasChildren = cat.children.length > 0;
                                const isExpanded  = expanded.has(cat.id);
                                const isTopLevel  = cat.parent_id === null;

                                return (
                                    <>
                                        <TableRow key={cat.id} className="hover:bg-muted/30">
                                            {/* Name */}
                                            <TableCell>
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
                                            </TableCell>

                                            {/* Slug */}
                                            <TableCell>
                                                <Badge variant="outline" className="font-mono text-xs">
                                                    {cat.slug}
                                                </Badge>
                                            </TableCell>

                                            {/* Parent */}
                                            <TableCell>
                                                {cat.parent ? (
                                                    <Badge variant="secondary" className="text-xs">
                                                        {cat.parent.name}
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="text-xs">
                                                        Top Level
                                                    </Badge>
                                                )}
                                            </TableCell>

                                            {/* Children */}
                                            <TableCell className="text-center">
                                                {hasChildren && isTopLevel ? (
                                                    <button
                                                        onClick={() => toggleExpanded(cat.id)}
                                                        className="flex items-center justify-center gap-1 text-xs text-primary hover:underline mx-auto"
                                                    >
                                                        <GitBranch className="h-3 w-3" />
                                                        {cat._count.children}
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">0</span>
                                                )}
                                            </TableCell>

                                            {/* Packages */}
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                                                    <Package className="h-3 w-3" /> {cat._count.packages}
                                                </div>
                                            </TableCell>

                                            {/* Status */}
                                            <TableCell className="text-center">
                                                <Switch
                                                    checked={cat.is_active}
                                                    disabled={isPending}
                                                    onCheckedChange={() => handleToggle(cat.id, cat.is_active)}
                                                />
                                            </TableCell>

                                            {/* Sort */}
                                            <TableCell className="text-xs text-muted-foreground">
                                                #{cat.sort_order}
                                            </TableCell>

                                            {/* Actions */}
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <EditCategoryDialog category={cat} parentCategories={parentCategories} />
                                                    <DeleteCategoryDialog
                                                        id={cat.id} name={cat.name}
                                                        packageCount={cat._count.packages}
                                                        childCount={cat._count.children}
                                                    />
                                                </div>
                                            </TableCell>
                                        </TableRow>

                                        {/* Subcategory rows — only shown when expanded and not searching */}
                                        {!isSearching && isExpanded && isTopLevel &&
                                            cat.children.map((child) => (
                                                <SubcategoryRow
                                                    key={child.id}
                                                    child={child}
                                                    parentCategories={parentCategories}
                                                    allCategories={categories}
                                                />
                                            ))
                                        }
                                    </>
                                );
                            })
                        )}
                    </TableBody>
                </Table>

                {/* Pagination — hidden during search since results are flat */}
                {!isSearching && (
                    <TablePagination currentPage={currentPage} totalPages={totalPages} />
                )}
            </div>
        </div>
    );
}