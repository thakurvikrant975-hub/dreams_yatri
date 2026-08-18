"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Hotel, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { TableFilters } from "../components/dashboard/Tablefilters";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableEmptyState } from "../components/dashboard/TableEmptyState";
import { ApprovalBadge, ReadinessBar } from "./ApprovalBadge";
import { summarizeChecklist, SECTION_LABELS, type ApprovalSectionKey } from "./approval-checklist";
import type { ApprovalStatusFilter, HotelApprovalListItem } from "./actions";
import { RATE_WINDOWS, DATA_ISSUES, type RateWindow, type DataIssue } from "./filters";

const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

export function HotelApprovalsTableClient({
  hotels,
  reviewers,
  destinations,
  totalCount,
  limit,
  currentPage,
  search,
  status,
  destination,
  rateWindow,
  dataIssue,
}: {
  hotels: HotelApprovalListItem[];
  reviewers: Record<string, string>;
  destinations: { id: number; name: string }[];
  totalCount: number;
  limit: number;
  currentPage: number;
  search: string;
  status: ApprovalStatusFilter;
  destination: number | "all";
  rateWindow: RateWindow;
  dataIssue: DataIssue;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "" || (key !== "status" && value === "all")) params.delete(key);
    else params.set(key, value);
    params.delete("page");
    startTransition(() => router.replace(`?${params.toString()}`));
  }

  function buildHref(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    return `?${params.toString()}`;
  }

  const totalPages = Math.ceil(totalCount / limit);
  const from = totalCount === 0 ? 0 : (currentPage - 1) * limit + 1;
  const to = Math.min(currentPage * limit, totalCount);
  const label = `Showing ${from}–${to} of ${totalCount} hotel${totalCount !== 1 ? "s" : ""}`;

  const columns: ColumnDef<HotelApprovalListItem>[] = [
    {
      header: "Hotel",
      width: "w-[280px]",
      sortKey: (h) => h.name.toLowerCase(),
      cell: (h) => (
        <div className="flex items-center gap-3">
          {h.thumbnail ? (
            <Image
              src={h.thumbnail.startsWith("http") ? h.thumbnail : `${base}/${h.thumbnail}`}
              alt={h.name}
              width={0}
              height={0}
              sizes="80px"
              className="h-auto max-h-12 w-auto max-w-20 rounded-lg shrink-0 border"
            />
          ) : (
            <div className="h-12 w-16 rounded-lg bg-muted border flex items-center justify-center shrink-0">
              <Hotel className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{h.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {[h.city, h.state].filter(Boolean).join(", ") || "No city set"}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {h.destination && (
                <Badge variant="secondary" className="text-[10px] bg-dashboard-primary/10 text-dashboard-primary">
                  {h.destination.name}
                </Badge>
              )}
              {!h.is_active && <Badge variant="outline" className="text-[10px] text-muted-foreground">Inactive</Badge>}
              {h.owner && <Badge variant="outline" className="text-[10px] text-muted-foreground">Owner-listed</Badge>}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: "Rooms / Rates",
      align: "center",
      sortKey: (h) => h.rooms.length,
      cell: (h) => {
        const unpriced = h.rooms.filter((r) => r.pricingCount === 0).length;
        return (
          <div className="text-sm">
            <p className="font-medium">{h.rooms.length} room{h.rooms.length === 1 ? "" : "s"}</p>
            <p className={`text-xs ${unpriced > 0 ? "text-red-600" : "text-muted-foreground"}`}>
              {h.rooms.length === 0 ? "—" : unpriced > 0 ? `${unpriced} without rates` : "all priced"}
            </p>
          </div>
        );
      },
    },
    {
      header: "Content readiness",
      sortKey: (h) => summarizeChecklist(h).readinessPct,
      cell: (h) => {
        const { readinessPct, requiredFailed } = summarizeChecklist(h);
        return <ReadinessBar pct={readinessPct} issues={requiredFailed} />;
      },
    },
    {
      header: "Approval",
      cell: (h) => (
        <div className="space-y-1">
          <ApprovalBadge status={h.approval_status} />
          {h.approval_status === "CHANGES_REQUESTED" && h.approval_flags.length > 0 && (
            <p className="text-[11px] text-muted-foreground max-w-40 truncate">
              {h.approval_flags.map((f) => SECTION_LABELS[f as ApprovalSectionKey] ?? f).join(", ")}
            </p>
          )}
        </div>
      ),
    },
    {
      header: "Reviewed",
      sortKey: (h) => (h.approval_reviewed_at ? new Date(h.approval_reviewed_at).getTime() : 0),
      cell: (h) => (
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-foreground/80 truncate max-w-32">
            {h.approval_reviewed_by_id ? (reviewers[h.approval_reviewed_by_id] ?? "—") : "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {h.approval_reviewed_at
              ? formatDistanceToNow(new Date(h.approval_reviewed_at), { addSuffix: true })
              : "Never reviewed"}
          </p>
        </div>
      ),
    },
    {
      header: "Actions",
      align: "right",
      width: "w-[120px]",
      cell: (h) => (
        <Button variant="outline" size="sm" className="gap-1.5" asChild>
          <Link href={`/dashboard/hotel-approvals/${h.id}`}>
            <Eye className="size-3.5" />
            Review
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <TableFilters
        collapsible
        search={search}
        onSearchChange={(v) => updateParam("search", v)}
        searchPlaceholder="Search by hotel, city or state…"
        filters={[
            {
              value: status,
              onChange: (v) => updateParam("status", v),
              placeholder: "All approval states",
              width: "w-48",
              allValue: "all",
              options: [
                { label: "Awaiting review", value: "pending" },
                { label: "Approved", value: "approved" },
                { label: "Changes requested", value: "changes" },
              ],
            },
            {
              value: destination === "all" ? "all" : String(destination),
              onChange: (v) => updateParam("destination", v),
              placeholder: "All Destinations",
              width: "w-44",
              options: destinations.map((d) => ({ label: d.name, value: String(d.id) })),
            },
            {
              value: rateWindow,
              onChange: (v) => updateParam("rateWindow", v),
              placeholder: "Any rate status",
              width: "w-52",
              options: RATE_WINDOWS.map((w) => ({ label: w.label, value: w.value })),
            },
            {
              value: dataIssue,
              onChange: (v) => updateParam("dataIssue", v),
              placeholder: "Any data issue",
              width: "w-56",
              options: DATA_ISSUES.map((d) => ({ label: d.label, value: d.value })),
            },
          ]}
        filteredCount={hotels.length}
        totalCount={totalCount}
      >
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-dashboard-base-content/50 whitespace-nowrap">Rows</span>
          <Select value={String(limit)} onValueChange={(v) => updateParam("limit", v)}>
            <SelectTrigger className="w-20 h-10 border-dashboard-base-300 bg-dashboard-base-100 text-dashboard-base-content/70 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </TableFilters>

      {hotels.length === 0 ? (
        <TableEmptyState
          title="No hotels here"
          description={status === "pending" ? "Every hotel has been reviewed" : "Try adjusting your filters"}
        />
      ) : (
        <DataTable
          columns={columns}
          data={hotels}
          rowKey={(h) => h.id}
          pagination={{ currentPage, totalPages, buildHref, label }}
        />
      )}
    </div>
  );
}
