"use client";

import { useState, useTransition } from "react";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../components/ui/table";
import { Button } from "../components/ui/button";
import {
    Trash2,
    Tag,
    Package,
    GitBranch,
    ChevronDown,
    ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { EditCategoryDialog } from "./Categorydialog";

import {
    deleteCategory,
    toggleCategoryActive,
    type CategoryWithRelations,
    type CategoryForSelect,
} from "./actions";

// ── Delete Dialog ─────────────────────────────────────────────────────────

function DeleteCategoryDialog({
    id,
    name,
    packageCount,
    childCount,
}: {
    id: number;
    name: string;
    packageCount: number;
    childCount: number;
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
                    variant="ghost"
                    size="icon"
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
                                ⚠ This category has {childCount} subcategory(s). Remove
                                them first.
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

// ── Subcategory Row (indented) ────────────────────────────────────────────

function SubcategoryRow({
    child,
    parentCategories,
    allCategories,
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
            toast.success(
                `Subcategory ${!child.is_active ? "activated" : "deactivated"}`,
            );
        });
    }

    return (
        <TableRow className="hover:bg-muted/20 bg-muted/5">
            {/* Name — indented */}
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
                <Badge variant="outline" className="font-mono text-xs">
                    {child.slug}
                </Badge>
            </TableCell>

            {/* Parent — self */}
            <TableCell>
                <span className="text-xs text-muted-foreground italic">—</span>
            </TableCell>

            {/* Children count */}
            <TableCell className="text-center">
                <span className="text-xs text-muted-foreground">—</span>
            </TableCell>

            {/* Packages */}
            <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <Package className="h-3 w-3" />
                    {full?._count.packages ?? 0}
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

            {/* Added — empty for sub */}
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

// ── Main Table ────────────────────────────────────────────────────────────

export function CategoriesTable({
    categories,
    parentCategories,
}: {
    categories: CategoryWithRelations[];
    parentCategories: CategoryForSelect[];
}) {
    const [isPending, startTransition] = useTransition();
    // Track which parent rows are expanded to show children
    const [expanded, setExpanded] = useState<Set<number>>(new Set());

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
            toast.success(
                `Category ${!current ? "activated" : "deactivated"}`,
            );
        });
    }

    // Only top-level categories in the main rows
    const topLevel = categories.filter((c) => c.parent_id === null);

    if (topLevel.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 border rounded-xl bg-muted/30">
                <Tag className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                    No categories yet
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                    Create your first category to get started
                </p>
            </div>
        );
    }

    return (
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
                        <TableHead>Added</TableHead>
                        <TableHead className="text-right w-[100px]">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {topLevel.map((cat) => {
                        const hasChildren = cat.children.length > 0;
                        const isExpanded = expanded.has(cat.id);

                        return (
                            <>
                                {/* ── Parent Row ── */}
                                <TableRow
                                    key={cat.id}
                                    className="hover:bg-muted/30"
                                >
                                    {/* Name + expand toggle */}
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {hasChildren ? (
                                                <button
                                                    onClick={() => toggleExpanded(cat.id)}
                                                    className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted transition-colors shrink-0"
                                                    aria-label={
                                                        isExpanded
                                                            ? "Collapse subcategories"
                                                            : "Expand subcategories"
                                                    }
                                                >
                                                    {isExpanded ? (
                                                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                                    ) : (
                                                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                                    )}
                                                </button>
                                            ) : (
                                                <div className="w-5 shrink-0" />
                                            )}
                                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                                <Tag className="h-4 w-4 text-primary" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">
                                                    {cat.name}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Sort: {cat.sort_order}
                                                </p>
                                            </div>
                                        </div>
                                    </TableCell>

                                    {/* Slug */}
                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className="font-mono text-xs"
                                        >
                                            {cat.slug}
                                        </Badge>
                                    </TableCell>

                                    {/* Parent */}
                                    <TableCell>
                                        <Badge
                                            variant="secondary"
                                            className="text-xs"
                                        >
                                            Top Level
                                        </Badge>
                                    </TableCell>

                                    {/* Children count */}
                                    <TableCell className="text-center">
                                        {hasChildren ? (
                                            <button
                                                onClick={() => toggleExpanded(cat.id)}
                                                className="flex items-center justify-center gap-1 text-xs text-primary hover:underline mx-auto"
                                            >
                                                <GitBranch className="h-3 w-3" />
                                                {cat._count.children}
                                            </button>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">
                                                0
                                            </span>
                                        )}
                                    </TableCell>

                                    {/* Packages */}
                                    <TableCell className="text-center">
                                        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                                            <Package className="h-3 w-3" />
                                            {cat._count.packages}
                                        </div>
                                    </TableCell>

                                    {/* Status toggle */}
                                    <TableCell className="text-center">
                                        <Switch
                                            checked={cat.is_active}
                                            disabled={isPending}
                                            onCheckedChange={() =>
                                                handleToggle(cat.id, cat.is_active)
                                            }
                                        />
                                    </TableCell>

                                    {/* Added — categories don't have created_at in your schema,
                                        so we show sort_order instead. If you add created_at, swap this. */}
                                    <TableCell className="text-xs text-muted-foreground">
                                        Order #{cat.sort_order}
                                    </TableCell>

                                    {/* Actions */}
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <EditCategoryDialog
                                                category={cat}
                                                parentCategories={parentCategories}
                                            />
                                            <DeleteCategoryDialog
                                                id={cat.id}
                                                name={cat.name}
                                                packageCount={cat._count.packages}
                                                childCount={cat._count.children}
                                            />
                                        </div>
                                    </TableCell>
                                </TableRow>

                                {/* ── Subcategory Rows (expanded) ── */}
                                {isExpanded &&
                                    cat.children.map((child) => (
                                        <SubcategoryRow
                                            key={child.id}
                                            child={child}
                                            parentCategories={parentCategories}
                                            allCategories={categories}
                                        />
                                    ))}
                            </>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}