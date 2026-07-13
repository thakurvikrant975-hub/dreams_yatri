"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Trash2, Pencil, FileKey, MapPin } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Button } from "../../components/ui/button";
import { Switch } from "../../components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../components/ui/select";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { DataTable, type ColumnDef } from "../../components/dashboard/Datatable";
import { TableFilters }               from "../../components/dashboard/Tablefilters";
import { TableEmptyState }            from "../../components/dashboard/TableEmptyState";

import { togglePermitActive, deletePermit, getPermitHistory } from "./actions";
import { HistorySheet } from "../../components/dashboard/HistorySheet";
import {
  PERMIT_CATEGORIES, CATEGORY_LABELS, VALIDITY_LABELS, displayCategory,
  type PermitRow, type PermitCategory,
} from "./permit.types";
import { PermitDialog } from "./PermitDialog";

// ── Category badge colors ──────────────────────────────────────────────────

const CATEGORY_COLORS: Record<PermitCategory, string> = {
  ENTRY_FEE:     "bg-sky-100 text-sky-700 border-sky-200",
  MOUNTAIN_PASS: "bg-violet-100 text-violet-700 border-violet-200",
  WILDLIFE:      "bg-emerald-100 text-emerald-700 border-emerald-200",
  BORDER_AREA:   "bg-red-100 text-red-700 border-red-200",
  NATIONAL_PARK: "bg-green-100 text-green-700 border-green-200",
  FOREST:        "bg-lime-100 text-lime-700 border-lime-200",
  OTHER:         "bg-gray-100 text-gray-600 border-gray-200",
};

function fmt(n: number) {
  return n.toLocaleString("en-IN");
}

function ValidityCell({ row }: { row: PermitRow }) {
  const base = VALIDITY_LABELS[row.validity_type];
  if (row.validity_type === "MULTI_DAY" && row.validity_days) {
    return (
      <span className="text-xs">
        {row.validity_days} {row.validity_days === 1 ? "day" : "days"}
      </span>
    );
  }
  return <span className="text-xs">{base}</span>;
}

// ── Main component ─────────────────────────────────────────────────────────

export function PermitsTable({
  permits,
  memberNames,
  totalCount,
  currentPage,
  totalPages,
  limit,
  search,
  category,
  status,
}: {
  permits:     PermitRow[];
  memberNames: Record<string, string>;
  totalCount:  number;
  currentPage: number;
  totalPages:  number;
  limit:       number;
  search:      string;
  category:    string;
  status:      string;
}) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [editTarget,   setEditTarget]   = useState<PermitRow | null>(null);
  const [editOpen,     setEditOpen]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PermitRow | null>(null);
  const [deleteError,  setDeleteError]  = useState<string | null>(null);

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

  function buildHref(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    return `?${params.toString()}`;
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  function handleToggle(id: number, current: boolean) {
    startTransition(async () => {
      const res = await togglePermitActive(id, !current);
      if (res.success) {
        toast.success(`Permit ${!current ? "activated" : "deactivated"}`);
      } else {
        toast.error(res.message);
      }
    });
  }

  function openEdit(row: PermitRow) {
    setEditTarget(row);
    setEditOpen(true);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const res = await deletePermit(deleteTarget.id);
      if (res.success) {
        toast.success(res.message);
        setDeleteTarget(null);
      } else {
        setDeleteError(res.message);
      }
    });
  }

  // ── Pagination label ───────────────────────────────────────────────────────

  const from = totalCount === 0 ? 0 : (currentPage - 1) * limit + 1;
  const to   = Math.min(currentPage * limit, totalCount);
  const paginationLabel = `Showing ${from}–${to} of ${totalCount} permit${totalCount !== 1 ? "s" : ""}`;

  // ── Columns ────────────────────────────────────────────────────────────────

  const columns: ColumnDef<PermitRow>[] = [
    {
      header: "Permit Name",
      width:  "w-[220px]",
      sortKey: (r) => r.name.toLowerCase(),
      cell: (r) => (
        <div>
          <p className="font-medium text-sm">{r.name}</p>
          {r.issuing_authority && (
            <p className="text-xs text-muted-foreground truncate max-w-48">{r.issuing_authority}</p>
          )}
        </div>
      ),
    },
    {
      header: "Category",
      sortKey: (r) => r.category,
      cell: (r) => (
        <span className={`text-[11px] font-medium px-2 py-1 rounded border ${CATEGORY_COLORS[r.category]}`}>
          {displayCategory(r)}
        </span>
      ),
    },
    {
      header: "Location",
      sortKey: (r) => r.location_name?.toLowerCase() ?? "",
      cell: (r) => r.location_name ? (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate max-w-28">{r.location_name}</span>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground/40">—</span>
      ),
    },
    {
      header: "Vehicle Rates",
      align:  "right",
      sortKey: (r) => r.vehicle_rates.length,
      cell: (r) => {
        if (r.vehicle_rates.length === 0) {
          return <span className="text-xs text-muted-foreground/40">No vehicles priced</span>;
        }
        const rates = r.vehicle_rates.map((v) => v.price_per_km);
        const min = Math.min(...rates);
        const max = Math.max(...rates);
        return (
          <div className="text-right">
            <p className="text-sm font-medium tabular-nums">
              ₹{fmt(min)}{min !== max ? `–₹${fmt(max)}` : ""}/km
            </p>
            <p className="text-xs text-muted-foreground">
              {r.vehicle_rates.length} vehicle{r.vehicle_rates.length !== 1 ? "s" : ""}
            </p>
          </div>
        );
      },
    },
    {
      header: "Validity",
      sortKey: (r) => r.validity_type,
      cell: (r) => <ValidityCell row={r} />,
    },
    {
      header: "Status",
      align:  "center",
      sortKey: (r) => (r.is_active ? 0 : 1),
      cell: (r) => (
        <Switch
          checked={r.is_active}
          disabled={isPending}
          onCheckedChange={() => handleToggle(r.id, r.is_active)}
        />
      ),
    },
    {
      header: "Created By",
      sortKey: (r) => new Date(r.created_at).getTime(),
      cell: (r) => (
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-foreground/80 truncate max-w-28">
            {r.created_by ? (memberNames[r.created_by] ?? r.created_by) : "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
          </p>
        </div>
      ),
    },
    {
      header: "Actions",
      align:  "right",
      width:  "w-[120px]",
      cell: (r) => (
        <div className="flex items-center justify-end gap-1">
          <HistorySheet
            id={r.id}
            title={r.name}
            entityLabel="permit"
            fetchHistory={getPermitHistory}
            createdBy={r.created_by ? (memberNames[r.created_by] ?? r.created_by) : null}
            createdAt={r.created_at}
            updatedBy={r.updated_by ? (memberNames[r.updated_by] ?? r.updated_by) : null}
            updatedAt={r.updated_at}
          />
          <Button
            variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => openEdit(r)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost" size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => { setDeleteTarget(r); setDeleteError(null); }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Filters + rows per page */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <TableFilters
          search={search}
          onSearchChange={(v) => updateParam("search", v)}
          searchPlaceholder="Search permits…"
          className="flex-1"
          filters={[
            {
              value:       category,
              onChange:    (v) => updateParam("category", v),
              placeholder: "All Categories",
              width:       "w-44",
              options:     PERMIT_CATEGORIES.map((c) => ({ label: CATEGORY_LABELS[c], value: c })),
            },
            {
              value:       status,
              onChange:    (v) => updateParam("status", v),
              placeholder: "All Statuses",
              width:       "w-36",
              options: [
                { label: "Active",   value: "active" },
                { label: "Inactive", value: "inactive" },
              ],
            },
          ]}
        />

        <Select
          value={String(limit)}
          onValueChange={(v) => updateParam("limit", v)}
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

      {/* Table */}
      <DataTable
        columns={columns}
        data={permits}
        rowKey={(r) => r.id}
        emptyState={
          <TableEmptyState
            title="No permits found"
            description={search || category !== "all" || status !== "all"
              ? "Try adjusting your filters"
              : "Add your first permit using the button above"}
          />
        }
        pagination={{ currentPage, totalPages, buildHref, label: paginationLabel }}
      />

      {/* Edit sheet */}
      <PermitDialog
        permit={editTarget ?? undefined}
        open={editOpen}
        onOpenChange={(o) => { setEditOpen(o); if (!o) setEditTarget(null); }}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Permit</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <span className="font-semibold">{deleteTarget?.name}</span>?
              This action cannot be undone.
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
    </>
  );
}
