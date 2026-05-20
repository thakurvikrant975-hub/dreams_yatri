"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, Pencil, Trash2, Package, Search } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
    AlertDialog, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/app/lib/utils";
import { togglePolicyActive, deletePolicy, type Policy } from "./actions";
import { EditPolicyDialog } from "./PolicyDialog";
import {
    POLICY_TYPE_LABELS, POLICY_TYPES,
    POLICY_TYPE_COLORS, type PolicyType,
} from "./constants";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableEmptyState } from "../components/dashboard/TableEmptyState";

// ── Points preview ────────────────────────────────────────────────────────

function PointsPreview({ points }: { points: string[] }) {
    const valid = points.filter(p => p.trim());
    const preview = valid.slice(0, 2);
    const more = valid.length - 2;

    if (valid.length === 0)
        return <span className="text-xs text-muted-foreground italic">No points</span>;

    return (
        <div className="space-y-0.5">
            {preview.map((pt, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <div className="h-1 w-1 rounded-full bg-muted-foreground/50 mt-1.5 shrink-0" />
                    <span className="truncate max-w-52">{pt}</span>
                </div>
            ))}
            {more > 0 && (
                <p className="text-[11px] text-muted-foreground pl-2.5">+{more} more</p>
            )}
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────

export function PoliciesTableClient({
    policies,
    totalCount,
    limit,
    currentPage,
    isFiltering,
    search,
    type,
    status,
}: {
    policies: Policy[];
    totalCount: number;
    limit: number;
    currentPage: number;
    isFiltering: boolean;
    search: string;
    type: PolicyType | "all";
    status: "active" | "inactive" | "all";
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    // Local search state — debounced push to URL
    const [localSearch, setLocalSearch] = useState(search);
    const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    useEffect(() => { setLocalSearch(search); }, [search]);

    // Edit state
    const [editTarget, setEditTarget] = useState<Policy | null>(null);

    // Delete dialog state
    const [deletePolicy_, setDeletePolicy] = useState<Policy | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // ── URL helpers ───────────────────────────────────────────────────────

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

    // ── Actions ───────────────────────────────────────────────────────────

    function handleToggle(id: number, current: boolean) {
        startTransition(async () => {
            const result = await togglePolicyActive(id, !current);
            if (result.success) {
                toast.success(result.message);
            } else {
                toast.error(result.message);
            }
        });
    }

    function openDelete(policy: Policy) {
        setDeletePolicy(policy);
        setErrorMsg(null);
    }

    function closeDelete() {
        setDeletePolicy(null);
        setErrorMsg(null);
    }

    function handleDelete() {
        if (!deletePolicy_) return;
        startTransition(async () => {
            const result = await deletePolicy(deletePolicy_.id);
            if (result.success) {
                toast.success(result.message);
                closeDelete();
            } else {
                setErrorMsg(result.message);
            }
        });
    }

    // ── Pagination ────────────────────────────────────────────────────────

    const totalPages = Math.ceil(totalCount / limit);
    const from = totalCount === 0 ? 0 : (currentPage - 1) * limit + 1;
    const to = Math.min(currentPage * limit, totalCount);
    const label = `Showing ${from}–${to} of ${totalCount} polic${totalCount !== 1 ? "ies" : "y"}`;

    // ── Columns ───────────────────────────────────────────────────────────

    const columns: ColumnDef<Policy>[] = [
        {
            header: "Title",
            width: "w-[200px]",
            cell: (p) => <p className="font-medium text-sm">{p.title}</p>,
        },
        {
            header: "Type",
            cell: (p) => (
                <span className={`text-[11px] font-medium px-2 py-1 rounded border ${POLICY_TYPE_COLORS[p.type]}`}>
                    {POLICY_TYPE_LABELS[p.type]}
                </span>
            ),
        },
        {
            header: "Points Preview",
            width: "w-[260px]",
            cell: (p) => <PointsPreview points={p.points} />,
        },
        {
            header: "Points",
            align: "center",
            cell: (p) => (
                <span className="text-sm font-medium">
                    {p.points.filter(pt => pt.trim()).length}
                </span>
            ),
        },
        {
            header: "Packages",
            align: "center",
            cell: (p) => p._count.packages > 0 ? (
                <Badge variant="secondary" className="text-xs">{p._count.packages}</Badge>
            ) : (
                <span className="text-xs text-muted-foreground">—</span>
            ),
        },
        {
            header: "Status",
            align: "center",
            cell: (p) => (
                <Switch
                    checked={p.is_active}
                    disabled={isPending}
                    onCheckedChange={() => handleToggle(p.id, p.is_active)}
                />
            ),
        },
        {
            header: "Updated",
            cell: (p) => (
                <span className="text-xs text-muted-foreground">
                    {format(new Date(p.updated_at), "dd MMM yyyy")}
                </span>
            ),
        },
        {
            header: "Actions",
            align: "right",
            width: "w-[80px]",
            cell: (p) => (
                <div className="flex items-center justify-end gap-1">
                    <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => setEditTarget(p)}
                    >
                        <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => openDelete(p)}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
        },
    ];

    // ── Render ────────────────────────────────────────────────────────────

    return (
        <div className="space-y-4">

            {/* Type filter tabs */}
            <div className="flex flex-wrap items-center gap-2">
                <button
                    onClick={() => updateParam("type", "all")}
                    className={cn(
                        "text-xs font-medium px-3 py-1.5 rounded-lg border transition-all",
                        type === "all"
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:bg-muted/50",
                    )}
                >
                    All types
                </button>
                {POLICY_TYPES.map(pt => (
                    <button
                        key={pt}
                        onClick={() => updateParam("type", pt)}
                        className={cn(
                            "text-xs font-medium px-3 py-1.5 rounded-lg border transition-all",
                            type === pt
                                ? POLICY_TYPE_COLORS[pt]
                                : "border-border text-muted-foreground hover:bg-muted/50 opacity-70",
                        )}
                    >
                        {POLICY_TYPE_LABELS[pt]}
                    </button>
                ))}
            </div>

            {/* Search + status + rows-per-page */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-52 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        className="pl-9"
                        placeholder="Search by title..."
                        value={localSearch}
                        onChange={e => handleSearch(e.target.value)}
                    />
                </div>

                <Select value={status} onValueChange={v => updateParam("status", v)}>
                    <SelectTrigger className="w-36">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                </Select>

                <div className="flex items-center gap-2 ml-auto">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Rows per page</span>
                    <Select
                        value={String(limit)}
                        onValueChange={v => updateParam("limit", v)}
                    >
                        <SelectTrigger className="w-20">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="20">20</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Table */}
            {policies.length === 0 ? (
                <TableEmptyState
                    title="No policies found"
                    description={isFiltering ? "Try adjusting your filters" : "Create your first reusable policy"}
                />

            ) : (
                <DataTable
                    columns={columns}
                    data={policies}
                    rowKey={p => p.id}
                    pagination={{
                        currentPage,
                        totalPages,
                        buildHref,
                        label,
                    }}
                />
            )}

            {/* Edit sheet */}
            {editTarget && (
                <EditPolicyDialog
                    policy={editTarget}
                    open={!!editTarget}
                    onOpenChange={open => !open && setEditTarget(null)}
                />
            )}

            {/* Delete dialog */}
            <AlertDialog open={!!deletePolicy_} onOpenChange={open => !open && closeDelete()}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Policy</AlertDialogTitle>
                        <AlertDialogDescription>
                            Delete <span className="font-semibold">{deletePolicy_?.title}</span>?
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {errorMsg && (
                        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                            {errorMsg}
                        </p>
                    )}

                    {(deletePolicy_?._count?.packages ?? 0) > 0 && !errorMsg && (
                        <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            ⚠ Used in {deletePolicy_?._count?.packages} package(s). Remove assignments first.
                        </p>
                    )}

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                        <Button
                            variant="destructive"
                            disabled={isPending || (deletePolicy_?._count?.packages ?? 0) > 0}
                            onClick={handleDelete}
                        >
                            {isPending ? "Deleting…" : "Delete"}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
