"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Building2, Eye, Inbox, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { TableFilters } from "../components/dashboard/Tablefilters";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableEmptyState } from "../components/dashboard/TableEmptyState";
import type { SubmissionListItem, SubmissionStatusFilter } from "./actions";

const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  SUBMITTED: { label: "Submitted", icon: Inbox, className: "bg-slate-500/10 text-slate-600 border-slate-200" },
  UNDER_REVIEW: { label: "Under Review", icon: Clock, className: "bg-amber-500/10 text-amber-600 border-amber-200" },
  APPROVED: { label: "Approved", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-600 border-emerald-200" },
  LIVE: { label: "Live", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-700 border-emerald-200" },
  REJECTED: { label: "Rejected", icon: XCircle, className: "bg-red-500/10 text-red-600 border-red-200" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, icon: Inbox, className: "bg-muted text-muted-foreground" };
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={cfg.className}>
      <Icon className="size-3" />
      {cfg.label}
    </Badge>
  );
}

export function SubmissionsTableClient({
  hotels,
  totalCount,
  limit,
  currentPage,
  search,
  status,
}: {
  hotels: SubmissionListItem[];
  totalCount: number;
  limit: number;
  currentPage: number;
  search: string;
  status: SubmissionStatusFilter;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [localSearch, setLocalSearch] = useState(search);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => { setLocalSearch(search); }, [search]);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all" || value === "") params.delete(key);
    else params.set(key, value);
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

  const totalPages = Math.ceil(totalCount / limit);
  const from = totalCount === 0 ? 0 : (currentPage - 1) * limit + 1;
  const to = Math.min(currentPage * limit, totalCount);
  const label = `Showing ${from}–${to} of ${totalCount} submission${totalCount !== 1 ? "s" : ""}`;

  const columns: ColumnDef<SubmissionListItem>[] = [
    {
      header: "Property",
      width: "w-[280px]",
      cell: (h) => (
        <div className="flex items-center gap-3">
          {h.thumbnail ? (
            <Image
              src={h.thumbnail.startsWith("http") ? h.thumbnail : `${base}/${h.thumbnail}`}
              alt={h.name}
              width={64}
              height={48}
              className="h-12 w-16 rounded-lg object-cover shrink-0 border"
            />
          ) : (
            <div className="h-12 w-16 rounded-lg bg-muted border flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{h.name}</p>
            <p className="text-xs text-muted-foreground">
              {h.property_category === "HOMESTAY_VILLA" ? "Homestay/Villa" : "Hotel"}
              {h.city ? ` · ${h.city}${h.state ? `, ${h.state}` : ""}` : ""}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: "Owner",
      cell: (h) => (
        <div className="min-w-0">
          <p className="text-sm truncate">{h.owner?.name ?? "—"}</p>
          <p className="text-xs text-muted-foreground truncate">{h.owner?.email ?? ""}</p>
        </div>
      ),
    },
    {
      header: "Photos",
      align: "center",
      cell: (h) => <span className="text-sm font-medium">{h._count.images}</span>,
    },
    {
      header: "Status",
      cell: (h) => <StatusBadge status={h.listing_status} />,
    },
    {
      header: "Submitted",
      cell: (h) => (
        <span className="text-xs text-muted-foreground">
          {h.submitted_at ? formatDistanceToNow(new Date(h.submitted_at), { addSuffix: true }) : "—"}
        </span>
      ),
    },
    {
      header: "Actions",
      align: "right",
      width: "w-[120px]",
      cell: (h) => (
        <Button variant="outline" size="sm" className="gap-1.5" asChild>
          <Link href={`/dashboard/property-submissions/${h.id}`}>
            <Eye className="size-3.5" />
            Review
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <TableFilters
          className="flex-1 min-w-0"
          search={localSearch}
          onSearchChange={handleSearch}
          searchPlaceholder="Search by property, city, or owner..."
          filters={[
            {
              value: status,
              onChange: (v) => updateParam("status", v),
              placeholder: "Awaiting Review",
              width: "w-44",
              allValue: "pending",
              options: [
                { label: "Approved / Live", value: "approved" },
                { label: "Rejected", value: "rejected" },
                { label: "All submitted", value: "all" },
              ],
            },
          ]}
          filteredCount={hotels.length}
          totalCount={totalCount}
        />
      </div>

      {hotels.length === 0 ? (
        <TableEmptyState
          title="No submissions found"
          description={status === "pending" ? "Nothing is waiting for review right now" : "Try adjusting your filters"}
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
