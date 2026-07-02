"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2, Pencil, FileKey, MapPin } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button }  from "../../components/ui/button";
import { Switch }  from "../../components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../components/ui/select";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { DataTable,  type ColumnDef } from "../../components/dashboard/Datatable";
import { TableFilters }               from "../../components/dashboard/Tablefilters";
import { TableEmptyState }            from "../../components/dashboard/TableEmptyState";
import { StatCard, StatGrid }         from "../../components/dashboard/Statcard";

import {
  getPermits, togglePermitActive, deletePermit,
} from "./actions";
import {
  PERMIT_CATEGORIES, CATEGORY_LABELS, VALIDITY_LABELS,
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

// ── Validity label ─────────────────────────────────────────────────────────

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

export function PermitsClient({
  initialRows,
  initialTotal,
  page,
  limit,
  search,
  category,
  status,
}: {
  initialRows:  PermitRow[];
  initialTotal: number;
  page:         number;
  limit:        number;
  search:       string;
  category:     string;
  status:       string;
}) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [rows,  setRows]  = useState(initialRows);
  const [total, setTotal] = useState(initialTotal);

  // Sheet / dialog state
  const [sheetOpen,    setSheetOpen]    = useState(false);
  const [editTarget,   setEditTarget]   = useState<PermitRow | null>(null);
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

  // ── Data refresh after mutations ───────────────────────────────────────────

  async function refreshData() {
    const res = await getPermits({ page, limit, search, category, status });
    setRows(res.rows);
    setTotal(res.total);
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  function handleToggle(id: number, current: boolean) {
    startTransition(async () => {
      const res = await togglePermitActive(id, !current);
      if (res.success) {
        setRows((prev) =>
          prev.map((r) => r.id === id ? { ...r, is_active: !current } : r),
        );
        toast.success(`Permit ${!current ? "activated" : "deactivated"}`);
      } else {
        toast.error(res.message);
      }
    });
  }

  function openEdit(row: PermitRow) {
    setEditTarget(row);
    setSheetOpen(true);
  }

  function openCreate() {
    setEditTarget(null);
    setSheetOpen(true);
  }

  function handleSaved(saved: PermitRow) {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setTotal((t) => (rows.some((r) => r.id === saved.id) ? t : t + 1));
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const res = await deletePermit(deleteTarget.id);
      if (res.success) {
        toast.success(res.message);
        setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
        setTotal((t) => t - 1);
        setDeleteTarget(null);
      } else {
        setDeleteError(res.message);
      }
    });
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  const activeCount   = rows.filter((r) => r.is_active).length;
  const inactiveCount = rows.filter((r) => !r.is_active).length;
  const withLocation  = rows.filter((r) => r.location_id).length;
  const totalPages    = Math.max(1, Math.ceil(total / limit));
  const from          = total === 0 ? 0 : (page - 1) * limit + 1;
  const to            = Math.min(page * limit, total);
  const paginationLabel = `Showing ${from}–${to} of ${total} permit${total !== 1 ? "s" : ""}`;

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
            <p className="text-xs text-muted-foreground truncate max-w-50">{r.issuing_authority}</p>
          )}
        </div>
      ),
    },
    {
      header: "Category",
      sortKey: (r) => r.category,
      cell: (r) => (
        <span className={`text-[11px] font-medium px-2 py-1 rounded border ${CATEGORY_COLORS[r.category]}`}>
          {CATEGORY_LABELS[r.category]}
        </span>
      ),
    },
    {
      header: "Location",
      sortKey: (r) => r.location_name?.toLowerCase() ?? "",
      cell: (r) => r.location_name ? (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate max-w-30">{r.location_name}</span>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground/40">—</span>
      ),
    },
    {
      header: "Vehicle Price",
      align:  "right",
      sortKey: (r) => r.price_per_vehicle,
      cell: (r) => (
        <span className="text-sm font-medium tabular-nums">₹{fmt(r.price_per_vehicle)}</span>
      ),
    },
    {
      header: "Per Person",
      align:  "right",
      sortKey: (r) => r.price_per_person ?? -1,
      cell: (r) => r.price_per_person != null ? (
        <span className="text-sm tabular-nums">₹{fmt(r.price_per_person)}</span>
      ) : (
        <span className="text-xs text-muted-foreground/40">—</span>
      ),
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
          <p className="text-xs font-medium truncate max-w-25">{r.created_by ?? "—"}</p>
          <p className="text-[10px] text-muted-foreground">
            {format(new Date(r.created_at), "dd MMM yyyy")}
          </p>
        </div>
      ),
    },
    {
      header: "Actions",
      align:  "right",
      width:  "w-[80px]",
      cell: (r) => (
        <div className="flex items-center justify-end gap-1">
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
    <div className="space-y-4">

      <StatGrid cols={4}>
        <StatCard label="Total Permits"  value={total}        icon={FileKey} />
        <StatCard label="Active"         value={activeCount}  icon={FileKey} />
        <StatCard label="Inactive"       value={inactiveCount} icon={FileKey} />
        <StatCard label="With Location"  value={withLocation} icon={MapPin}  />
      </StatGrid>

      {/* ── Filters row ── */}
      <div className="flex flex-wrap items-center gap-2">
        <TableFilters
          search={search}
          onSearchChange={(v) => updateParam("search", v)}
          searchPlaceholder="Search permits…"
          className="flex-1 min-w-52"
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
              options:     [
                { label: "Active",   value: "active" },
                { label: "Inactive", value: "inactive" },
              ],
            },
          ]}
        />

        <div className="flex items-center gap-2 ml-auto">
          <Select
            value={String(limit)}
            onValueChange={(v) => updateParam("limit", v)}
          >
            <SelectTrigger className="w-20 h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={openCreate} className="gap-1.5 h-10">
            <Plus className="h-4 w-4" />
            Add Permit
          </Button>
        </div>
      </div>

      {/* ── Table ── */}
      {rows.length === 0 ? (
        <TableEmptyState
          title="No permits found"
          description={search || category !== "all" || status !== "all"
            ? "Try adjusting your filters"
            : "Add your first permit using the button above"}
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(r) => r.id}
          pagination={{ currentPage: page, totalPages, buildHref, label: paginationLabel }}
        />
      )}

      {/* ── Create / Edit sheet ── */}
      <PermitDialog
        permit={editTarget ?? undefined}
        open={sheetOpen}
        onOpenChange={(o) => { setSheetOpen(o); if (!o) setEditTarget(null); }}
        onSaved={handleSaved}
      />

      {/* ── Delete dialog ── */}
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
    </div>
  );
}
