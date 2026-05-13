"use client";

import { useState, useTransition } from "react";
import {
  FileText, Search, Pencil, Trash2, Filter, Package,
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { togglePolicyActive, deletePolicy, type Policy } from "./actions";
import { EditPolicyDialog } from "./PolicyDialog";
import { POLICY_TYPE_LABELS, POLICY_TYPES, POLICY_TYPE_COLORS, type PolicyType } from "./constants";
import { StatGrid, StatCard } from "../components/dashboard/Statcard";
import { TableFilters } from "../components/dashboard/Tablefilters";



// ── Points preview — first 2 points as bullet list ────────────────────────

function PointsPreview({ points }: { points: string[] }) {
  const valid = points.filter(p => p.trim());
  const preview = valid.slice(0, 2);
  const more = valid.length - 2;

  if (valid.length === 0) {
    return <span className="text-xs text-muted-foreground italic">No points</span>;
  }

  return (
    <div className="space-y-0.5">
      {preview.map((pt, i) => (
        <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <div className="h-1 w-1 rounded-full bg-muted-foreground/50 mt-1.5 shrink-0" />
          <span className="truncate max-w-55">{pt}</span>
        </div>
      ))}
      {more > 0 && (
        <p className="text-[11px] text-muted-foreground pl-2.5">+{more} more</p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export function PoliciesTableClient({ policies: initialPolicies }: { policies: Policy[] }) {
  const [policies, setPolicies] = useState(initialPolicies);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [editTarget, setEditTarget] = useState<Policy | null>(null);
  const [isPending, startTransition] = useTransition();

  // ── Derived ───────────────────────────────────────────────────────────────

  const filtered = policies.filter(p => {
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || p.type === filterType;
    return matchSearch && matchType;
  });

  const activeCount = policies.filter(p => p.is_active).length;
  const totalUsed = policies.reduce((acc, p) => acc + p._count.packages, 0);
  const countByType = POLICY_TYPES.reduce((acc, t) => {
    acc[t] = policies.filter(p => p.type === t).length;
    return acc;
  }, {} as Record<PolicyType, number>);

  // ── Actions ───────────────────────────────────────────────────────────────

  function handleToggle(id: number, current: boolean) {
    startTransition(async () => {
      await togglePolicyActive(id, !current);
      setPolicies(prev => prev.map(p => p.id === id ? { ...p, is_active: !current } : p));
      toast.success(`Policy ${!current ? "activated" : "deactivated"}`);
    });
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      const result = await deletePolicy(id);
      if (result.success) {
        setPolicies(prev => prev.filter(p => p.id !== id));
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      <StatGrid cols={4}>
        <StatCard
          label="Total Policies"
          value={policies.length}
          icon={FileText}
        />
        <StatCard
          label="Active Policies"
          value={activeCount}
          icon={FileText}
        />
        <StatCard
          label="Package usages"
          value={totalUsed}
          icon={FileText}
        />
        <StatCard
          label="Inactive Policies"
          value={policies.length - activeCount}
          icon={FileText}
        />
      </StatGrid>



      {/* Type breakdown */}
      <div className="flex flex-wrap gap-2">
        {POLICY_TYPES.map(pt => (
          <button
            key={pt}
            onClick={() => setFilterType(filterType === pt ? "all" : pt)}
            className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border transition-opacity ${POLICY_TYPE_COLORS[pt]
              } ${filterType !== "all" && filterType !== pt ? "opacity-40" : ""}`}
          >
            {POLICY_TYPE_LABELS[pt]}
            <span className="bg-white/60 rounded px-1.5 py-0.5">{countByType[pt]}</span>
          </button>
        ))}
        {filterType !== "all" && (
          <button
            onClick={() => setFilterType("all")}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Clear filter
          </button>
        )}
      </div>

{/* Search */}
<TableFilters
  search={search}
  onSearchChange={setSearch}
  searchPlaceholder="Search by title..."
  filteredCount={filtered.length !== policies.length ? filtered.length : undefined}
  totalCount={filtered.length !== policies.length ? policies.length : undefined}
/>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border rounded-xl bg-muted/30">
          <FileText className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No policies found</p>
          <p className="text-xs text-muted-foreground mt-1">
            {policies.length === 0 ? "Create your first reusable policy" : "Try adjusting your filters"}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[200px]">Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-[260px]">Points Preview</TableHead>
                <TableHead className="text-center">Points</TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Package className="h-3.5 w-3.5" /> Packages
                  </div>
                </TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(policy => (
                <TableRow key={policy.id} className="hover:bg-muted/30 align-top">

                  {/* Title */}
                  <TableCell className="py-3">
                    <p className="font-medium text-sm">{policy.title}</p>
                  </TableCell>

                  {/* Type */}
                  <TableCell className="py-3">
                    <span className={`text-[11px] font-medium px-2 py-1 rounded border ${POLICY_TYPE_COLORS[policy.type]}`}>
                      {POLICY_TYPE_LABELS[policy.type]}
                    </span>
                  </TableCell>

                  {/* Points preview */}
                  <TableCell className="py-3">
                    <PointsPreview points={policy.points} />
                  </TableCell>

                  {/* Points count */}
                  <TableCell className="text-center py-3">
                    <span className="text-sm font-medium">
                      {policy.points.filter(p => p.trim()).length}
                    </span>
                  </TableCell>

                  {/* Package count */}
                  <TableCell className="text-center py-3">
                    {policy._count.packages > 0 ? (
                      <Badge variant="secondary" className="text-xs">
                        {policy._count.packages}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Toggle */}
                  <TableCell className="text-center py-3">
                    <Switch
                      checked={policy.is_active}
                      disabled={isPending}
                      onCheckedChange={() => handleToggle(policy.id, policy.is_active)}
                    />
                  </TableCell>

                  {/* Updated */}
                  <TableCell className="text-xs text-muted-foreground py-3">
                    {format(new Date(policy.updated_at), "dd MMM yyyy")}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditTarget(policy)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>

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
                            <AlertDialogTitle>Delete Policy</AlertDialogTitle>
                            <AlertDialogDescription>
                              Delete <span className="font-semibold">{policy.title}</span>?
                              {policy._count.packages > 0 && (
                                <span className="block mt-2 text-destructive font-medium">
                                  ⚠ Used in {policy._count.packages} package(s). Remove assignments first.
                                </span>
                              )}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(policy.id)}
                              disabled={policy._count.packages > 0 || isPending}
                              className="bg-destructive text-white hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit dialog */}
      {editTarget && (
        <EditPolicyDialog
          policy={editTarget}
          open={!!editTarget}
          onOpenChange={open => !open && setEditTarget(null)}
        />
      )}
    </div>
  );
}