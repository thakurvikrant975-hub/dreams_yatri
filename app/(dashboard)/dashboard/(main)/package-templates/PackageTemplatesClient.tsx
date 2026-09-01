"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Check, ImageOff, MapPin, Users, Settings2, Eye,
  Clock, XCircle, ListChecks, ShieldCheck, Pencil, Loader2,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableFilters } from "../components/dashboard/Tablefilters";
import { TableEmptyState } from "../components/dashboard/TableEmptyState";
import { ManagePackageTemplateDrawer } from "./ManagePackageTemplateDrawer";
import { PackageTemplateTimelineSheet } from "./PackageTemplateTimelineSheet";
import { getOrCreateTemplateWorkingCopy } from "./actions";
import type { PackageTemplateRow } from "./actions";
import { cn } from "@/app/lib/utils";

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
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [managingId, setManagingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [openingBuilderId, setOpeningBuilderId] = useState<string | null>(null);

  const managing = rows.find((r) => r.id === managingId) ?? null;

  const byStatus = status === "all" ? rows : rows.filter((r) => r.status === status);

  const filtered = byStatus.filter((r) => {
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
  const isFiltering = search !== "" || status !== "all";

  // Skips the drawer entirely — one click from the row straight into a new
  // tab on the working copy (see getOrCreateTemplateWorkingCopy in actions.ts).
  // Team-leader-only, same as everything else that touches a working copy.
  // Approve/Reject also happen from there now, not from this list — see the
  // package-builder header for a template working copy.
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
          <span className="inline-flex items-center gap-1 text-xs font-medium" title="Can edit this template and approve/reject it from the builder">
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
      width: "w-[130px]",
      cell: (t) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <PackageTemplateTimelineSheet templateId={t.id} title={t.title} />
          {t.canManage && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              title="Edit in Builder — opens a working copy in a new tab, where you can also approve/reject"
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
      {/* Search + status filter */}
      <TableFilters
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search by title, destination, submitter, team leader..."
        filteredCount={isFiltering ? filtered.length : undefined}
        totalCount={isFiltering ? rows.length : undefined}
        filters={[
          {
            value: status,
            onChange: (v) => { setStatus(v); setPage(1); },
            placeholder: "All Statuses",
            width: "w-40",
            options: [
              { label: "Pending", value: "PENDING" },
              { label: "Approved", value: "APPROVED" },
              { label: "Rejected", value: "REJECTED" },
            ],
          },
        ]}
      />

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
