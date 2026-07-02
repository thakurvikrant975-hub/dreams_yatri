"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge }              from "../components/ui/badge";
import { Switch }             from "@/app/(dashboard)/dashboard/(main)/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { EditRegionSheet }    from "./RegionSheet";
import { DeleteRegionDialog } from "./Deleteregiondialog";
import { toggleRegionActive, getRegionHistory } from "./actions";
import { toast }              from "sonner";
import { MapPin }             from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ImageIcon }          from "@phosphor-icons/react";
import Image                  from "next/image";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableFilters }       from "../components/dashboard/Tablefilters";
import { TableEmptyState }   from "../components/dashboard/TableEmptyState";
import { HistorySheet }       from "../components/dashboard/HistorySheet";

// ── Type ──────────────────────────────────────────────────────────────────────
type Region = {
  id:          number;
  name:        string;
  slug:        string;
  country:     string;
  description: string | null;
  meta_title:  string | null;
  meta_desc:   string | null;
  thumbnail:   string | null;
  cover_image: string | null;
  is_active:   boolean;
  created_at:  Date;
  created_by:  string | null;
  updated_at:  Date;
  updated_by:  string | null;
  _count: { destinations: number };
};

// ── Component ─────────────────────────────────────────────────────────────────
export function RegionsTable({
  regions,
  currentPage,
  totalPages,
  totalCount,
  limit,
  search,
  country,
  status,
  destCount,
}: {
  regions:     Region[];
  currentPage: number;
  totalPages:  number;
  totalCount:  number;
  limit:       number;
  search:      string;
  country:     string;
  status:      string;
  destCount:   string;
}) {
  const router        = useRouter();
  const searchParams  = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // ── URL helpers ───────────────────────────────────────────────────────────
  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all" || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.delete("page"); // reset to page 1 on any filter change
    startTransition(() => router.replace(`?${params.toString()}`));
  }

  function handleSearch(value: string) {
    updateParam("search", value);
  }

  function buildHref(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    return `?${params.toString()}`;
  }

  // ── Toggle ─────────────────────────────────────────────────────────────────
  function handleToggle(id: number, current: boolean) {
    startTransition(async () => {
      const res = await toggleRegionActive(id, !current);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    });
  }

  // ── Pagination footer label ────────────────────────────────────────────────
  const from  = totalCount === 0 ? 0 : (currentPage - 1) * limit + 1;
  const to    = Math.min(currentPage * limit, totalCount);
  const paginationLabel = `Showing ${from}–${to} of ${totalCount} region${totalCount !== 1 ? "s" : ""}`;

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: ColumnDef<Region>[] = [
    {
      header: "Region",
      width:  "w-[220px]",
      sortKey: (region) => region.name?.toLowerCase() ?? "",
      cell: (region) => (
        <div className="flex items-center gap-2">
          {region.thumbnail ? (
            <Image
              src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${region.thumbnail}`}
              alt={region.name}
              width={56}
              height={40}
              className="h-10 w-14 rounded-lg object-cover shrink-0"
            />
          ) : (
            <div className="h-10 w-14 rounded-lg bg-muted border flex items-center justify-center shrink-0">
              <ImageIcon weight="duotone" className="size-5.5 text-muted-foreground/70" />
            </div>
          )}
          <div>
            <p className="font-medium text-sm">{region.name}</p>
            {region.description && (
              <p className="text-xs text-muted-foreground line-clamp-1 max-w-40">
                {region.description}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      header: "Slug",
      sortKey: (region) => region.slug?.toLowerCase() ?? "",
      cell: (region) => (
        <Badge variant="outline" className="font-mono text-xs border border-dashboard-neutral/75">{region.slug}</Badge>
      ),
    },
    {
      header: "Cover",
      width:  "w-[100px]",
      cell: (region) =>
        region.cover_image ? (
          <Image
            src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${region.cover_image}`}
            width={56}
            height={40}
            alt={`${region.name} cover`}
            className="h-10 w-14 rounded-lg object-cover shrink-0"
          />
        ) : (
          <div className="h-10 w-14 rounded-lg bg-muted border flex items-center justify-center shrink-0">
            <ImageIcon weight="duotone" className="size-5.5 text-muted-foreground/70" />
          </div>
        ),
    },
    {
      header: "Country",
      sortKey: (region) => region.country?.toLowerCase() ?? "",
      cell: (region) => (
        <span className="text-sm text-muted-foreground">{region.country}</span>
      ),
    },
    {
      header: "Destinations",
      align:  "center",
      sortKey: (region) => region._count.destinations ?? 0,
      cell: (region) => (
        <div className="flex items-center justify-center gap-1 text-sm">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">{region._count.destinations}</span>
        </div>
      ),
    },
    {
      header: "Status",
      align:  "center",
      cell: (region) => (
        <Switch
          checked={region.is_active}
          disabled={isPending}
          onCheckedChange={() => handleToggle(region.id, region.is_active)}
        />
      ),
    },
    {
      header: "Created By",
      sortKey: (region) => new Date(region.created_at).getTime(),
      cell: (region) => (
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-foreground/80 truncate max-w-30">
            {region.created_by ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(region.created_at), { addSuffix: true })}
          </p>
        </div>
      ),
    },
    {
      header: "Actions",
      align:  "right",
      width:  "w-[120px]",
      cell: (region) => (
        <div className="flex items-center justify-end gap-1">
          <HistorySheet
            id={region.id}
            title={region.name}
            entityLabel="region"
            fetchHistory={getRegionHistory}
            createdBy={region.created_by}
            createdAt={region.created_at}
            updatedBy={region.updated_by}
            updatedAt={region.updated_at}
          />
          <EditRegionSheet region={region} />
          <DeleteRegionDialog
            id={region.id}
            name={region.name}
            destinationCount={region._count.destinations}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">

      {/* Filters + rows-per-page */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <TableFilters
          search={search}
          onSearchChange={handleSearch}
          searchPlaceholder="Search regions..."
          className="flex-1"
          filters={[
            {
              value:       status,
              onChange:    (v) => updateParam("status", v),
              placeholder: "All Statuses",
              width:       "w-38",
              options: [
                { label: "Active",   value: "active"   },
                { label: "Inactive", value: "inactive" },
              ],
            },
            {
              value:       destCount,
              onChange:    (v) => updateParam("destCount", v),
              placeholder: "All Destinations",
              width:       "w-46",
              options: [
                { label: "No destinations", value: "0"    },
                { label: "1 – 5",           value: "1-5"  },
                { label: "6 – 15",          value: "6-15" },
                { label: "15+",             value: "15+"  },
              ],
            },
          ]}
        />

        {/* Rows-per-page selector */}
        <Select
          value={String(limit)}
          onValueChange={(v) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set("limit", v);
            params.delete("page");
            startTransition(() => router.replace(`?${params.toString()}`));
          }}
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
        data={regions}
        columns={columns}
        rowKey={(r) => r.id}
        emptyState={
          <TableEmptyState
            title="No regions found"
            description="Try adjusting your filters or create a new region"
          />
        }
        pagination={{
          currentPage,
          totalPages,
          buildHref,
          label: paginationLabel,
        }}
      />
    </div>
  );
}