"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Check, ImageOff, MapPin, Users, Settings2, Eye,
  Clock, XCircle, ListChecks, ShieldCheck, Pencil, Loader2,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { Input } from "../components/ui/input";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableFilters } from "../components/dashboard/Tablefilters";
import { TableEmptyState } from "../components/dashboard/TableEmptyState";
import { ManagePackageTemplateDrawer } from "./ManagePackageTemplateDrawer";
import { approvePackageTemplate, rejectPackageTemplate, getOrCreateTemplateWorkingCopy } from "./actions";
import type { PackageTemplateRow } from "./actions";
import { cn } from "@/app/lib/utils";

const TABS = ["PENDING", "APPROVED", "REJECTED", "ALL"] as const;
const PAGE_SIZE = 10;

const STATUS_BADGE: Record<PackageTemplateRow["status"], { label: string; icon: React.ElementType; className: string }> = {
  PENDING: { label: "Pending", icon: Clock, className: "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800" },
  APPROVED: { label: "Approved", icon: Check, className: "bg-green-500/10 text-green-600 border-green-200 dark:border-green-800" },
  REJECTED: { label: "Rejected", icon: XCircle, className: "bg-red-500/10 text-red-600 border-red-200 dark:border-red-800" },
};

function TemplateStatusBadge({ status }: { status: PackageTemplateRow["status"] }) {
  const cfg = STATUS_BADGE[status];
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={cn("gap-1 text-[11px] font-medium py-0.5 rounded-md", cfg.className)}>
      <Icon className="h-3 w-3" /> {cfg.label}
    </Badge>
  );
}

export function PackageTemplatesClient({ rows }: { rows: PackageTemplateRow[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<typeof TABS[number]>("PENDING");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [managingId, setManagingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectingBulk, setRejectingBulk] = useState(false);
  const [bulkReason, setBulkReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [openingBuilderId, setOpeningBuilderId] = useState<string | null>(null);

  const managing = rows.find((r) => r.id === managingId) ?? null;

  const byTab = tab === "ALL" ? rows : rows.filter((r) => r.status === tab);

  const filtered = byTab.filter((r) => {
    const s = search.toLowerCase();
    return !search
      || r.title.toLowerCase().includes(s)
      || (r.destination ?? "").toLowerCase().includes(s)
      || r.submittedByName.toLowerCase().includes(s)
      || (r.submittedByTeamName ?? "").toLowerCase().includes(s)
      || (r.teamLeaderName ?? "").toLowerCase().includes(s);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const isFiltering = search !== "";

  // Only a template's own team leader can act on it — see `canManage` —
  // so bulk selection only ever offers rows this viewer is allowed to
  // approve/reject anyway.
  const selectableIds = paginated.filter((r) => r.canManage).map((r) => r.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const someSelected = selectableIds.some((id) => selected.has(id));
  const selectedCount = Array.from(selected).filter((id) => selectableIds.includes(id)).length;

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) selectableIds.forEach((id) => next.delete(id));
      else selectableIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setRejectingBulk(false);
    setBulkReason("");
  }

  function bulkApprove() {
    const ids = Array.from(selected);
    startTransition(async () => {
      const results = await Promise.all(ids.map((id) => approvePackageTemplate(id)));
      const failed = results.filter((r) => !r.success).length;
      if (failed === 0) toast.success(`${ids.length} template${ids.length === 1 ? "" : "s"} approved`);
      else toast.error(`${failed} of ${ids.length} failed to approve`);
      clearSelection();
      router.refresh();
    });
  }

  function bulkReject() {
    if (!bulkReason.trim()) { toast.error("A reason is required"); return; }
    const ids = Array.from(selected);
    startTransition(async () => {
      const results = await Promise.all(ids.map((id) => rejectPackageTemplate(id, bulkReason)));
      const failed = results.filter((r) => !r.success).length;
      if (failed === 0) toast.success(`${ids.length} template${ids.length === 1 ? "" : "s"} rejected`);
      else toast.error(`${failed} of ${ids.length} failed to reject`);
      clearSelection();
      router.refresh();
    });
  }

  // Skips the drawer entirely — one click from the row straight into a new
  // tab on the working copy (see getOrCreateTemplateWorkingCopy in actions.ts).
  // Team-leader-only, same as everything else that touches a working copy.
  function openInBuilder(templateId: string) {
    setOpeningBuilderId(templateId);
    startTransition(async () => {
      const result = await getOrCreateTemplateWorkingCopy(templateId);
      if (result.success) window.open(`/dashboard/package-builder/${result.packageId}`, "_blank", "noopener,noreferrer");
      else toast.error(result.error ?? "Failed to open in builder");
      setOpeningBuilderId(null);
    });
  }

  const columns: ColumnDef<PackageTemplateRow>[] = [
    {
      header: (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected && !allSelected}
            onChange={toggleAll}
            disabled={selectableIds.length === 0}
          />
        </div>
      ),
      width: "w-10",
      cell: (t) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selected.has(t.id)} onChange={() => toggleRow(t.id)} disabled={!t.canManage} />
        </div>
      ),
    },
    {
      header: "Package",
      sortKey: (t) => t.title.toLowerCase(),
      cell: (t) => (
        <div className="flex items-center gap-3">
          <div className="relative h-11 w-11 rounded-md overflow-hidden bg-muted shrink-0 flex items-center justify-center">
            {t.coverImage ? (
              <Image src={t.coverImage} alt={t.title} fill className="object-cover" />
            ) : (
              <ImageOff className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate max-w-55">{t.title}</p>
            <p className="text-xs text-muted-foreground">{t.totalDays}D / {t.totalNights}N</p>
          </div>
        </div>
      ),
    },
    {
      header: "Destination",
      sortKey: (t) => (t.destination ?? "").toLowerCase(),
      cell: (t) => (
        <div className="space-y-1">
          {t.destination ? (
            <Badge variant="outline" className="gap-1 text-[11px] font-medium rounded-md">
              <MapPin className="h-3 w-3" /> {t.destination}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground italic">—</span>
          )}
          {/* The route itself, e.g. "North Goa (2N) → South Goa (1N)" — the
              destination badge above says where the trip is broadly, this
              says the actual path through it. Absent for anything saved
              before templates carried stops. */}
          {t.stops.length > 0 && (
            <p className="text-[10.5px] text-muted-foreground truncate max-w-55">
              {t.stops.map((s) => `${s.name} (${s.nights}N)`).join(" → ")}
            </p>
          )}
        </div>
      ),
    },
    {
      header: "Activities",
      align: "center" as const,
      width: "w-[110px]",
      sortKey: (t) => t.activityCount,
      cell: (t) => (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ListChecks className="h-3 w-3" /> {t.activityCount}
        </span>
      ),
    },
    {
      header: "Created on",
      width: "w-[120px]",
      sortKey: (t) => new Date(t.submittedAt).getTime(),
      cell: (t) => (
        <div className="text-xs leading-tight">
          <p className="font-medium text-foreground whitespace-nowrap">{format(new Date(t.submittedAt), "dd-MM-yyyy")}</p>
          <p className="text-muted-foreground whitespace-nowrap">{format(new Date(t.submittedAt), "hh:mm a")}</p>
        </div>
      ),
    },
    {
      header: "Created by",
      sortKey: (t) => t.submittedByName.toLowerCase(),
      cell: (t) => (
        <div className="text-xs leading-tight">
          <p className="font-medium text-foreground flex items-center gap-1">
            <Users className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="truncate max-w-35">{t.submittedByName}</span>
          </p>
          {t.submittedByTeamName && <p className="text-muted-foreground truncate max-w-35">{t.submittedByTeamName}</p>}
        </div>
      ),
    },
    {
      header: "Team Leader",
      sortKey: (t) => (t.teamLeaderName ?? "").toLowerCase(),
      cell: (t) =>
        t.teamLeaderName ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium" title="Can edit and approve/reject this template">
            <ShieldCheck className="h-3 w-3 text-primary shrink-0" />
            <span className="truncate max-w-35">{t.teamLeaderName}</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground italic">No leader assigned</span>
        ),
    },
    {
      header: "Status",
      sortKey: (t) => t.status,
      cell: (t) => (
        <div className="space-y-1">
          <TemplateStatusBadge status={t.status} />
          {t.status === "REJECTED" && t.rejectionNote && (
            <p className="text-[10px] text-red-600 dark:text-red-400 max-w-35 truncate" title={t.rejectionNote}>
              {t.rejectionNote}
            </p>
          )}
          {t.status === "APPROVED" && t.approvedByName && (
            <p className="text-[10px] text-muted-foreground truncate max-w-35">by {t.approvedByName}</p>
          )}
        </div>
      ),
    },
    {
      header: "Action",
      align: "right" as const,
      width: "w-[100px]",
      cell: (t) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {t.canManage && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              title="Edit in Builder — opens a working copy in a new tab"
              disabled={openingBuilderId === t.id}
              onClick={() => openInBuilder(t.id)}
            >
              {openingBuilderId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            title={t.canManage ? "Manage" : "View"}
            onClick={() => setManagingId(t.id)}
          >
            {t.canManage ? <Settings2 className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-5 border-b border-dashboard-base-300">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setPage(1); }}
            className={cn(
              "relative pb-2.5 text-sm font-medium transition-colors cursor-pointer",
              tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "ALL" ? "All" : t.charAt(0) + t.slice(1).toLowerCase()}
            <span className="ml-1.5 text-xs text-muted-foreground">
              ({t === "ALL" ? rows.length : rows.filter((r) => r.status === t).length})
            </span>
            {tab === t && <span className="absolute left-0 -bottom-px h-0.5 w-full bg-primary rounded-full" />}
          </button>
        ))}
      </div>

      {/* Search */}
      <TableFilters
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search by title, destination, submitter, team leader..."
        filteredCount={isFiltering ? filtered.length : undefined}
        totalCount={isFiltering ? byTab.length : undefined}
      />

      {/* Bulk actions — appears once at least one selectable row is checked */}
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <p className="text-xs font-medium text-primary shrink-0">{selectedCount} selected</p>
          {!rejectingBulk ? (
            <div className="flex items-center gap-2">
              <Button size="sm" className="gap-1.5 h-8" disabled={isPending} onClick={bulkApprove}>
                <Check className="h-3.5 w-3.5" /> Approve
              </Button>
              <Button
                size="sm" variant="outline"
                className="gap-1.5 h-8 text-destructive hover:text-destructive"
                disabled={isPending}
                onClick={() => setRejectingBulk(true)}
              >
                <XCircle className="h-3.5 w-3.5" /> Reject
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={clearSelection}>Clear</Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1 min-w-60">
              <Input
                value={bulkReason}
                onChange={(e) => setBulkReason(e.target.value)}
                placeholder="Reason for rejecting..."
                className="h-8 text-xs flex-1"
                autoFocus
              />
              <Button
                size="sm" className="h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={isPending || !bulkReason.trim()}
                onClick={bulkReject}
              >
                Confirm
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => { setRejectingBulk(false); setBulkReason(""); }}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <DataTable
        data={paginated}
        columns={columns}
        rowKey={(t) => t.id}
        onRowClick={(t) => setManagingId(t.id)}
        emptyState={
          <TableEmptyState
            title="Nothing here"
            description="Packages saved to the library from an approved package will show up here."
          />
        }
        pagination={{ currentPage: safePage, totalPages, onPageChange: setPage }}
      />

      <ManagePackageTemplateDrawer
        key={managingId ?? "none"}
        template={managing}
        open={managingId !== null}
        onOpenChange={(o) => { if (!o) setManagingId(null); }}
      />
    </div>
  );
}
