"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams }                  from "next/navigation";
import { Car }          from "lucide-react";
import { Badge }        from "../../components/ui/badge";
import { Switch }       from "../../components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../components/ui/select";
import { DataTable, type ColumnDef } from "../../components/dashboard/Datatable";
import { TableFilters }              from "../../components/dashboard/Tablefilters";
import { TableEmptyState }           from "../../components/dashboard/TableEmptyState";
import { EditCabPricingSheet }       from "./CabPricingSheet";
import { DeleteCabPricingDialog }    from "./DeleteCabPricingDialog";
import { toggleCabPricingActive }    from "./actions";
import { toast }                     from "sonner";
import { formatDistanceToNow }       from "date-fns";
import type { CabPricingGroup }      from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────

type Vehicle = { id: number; name: string; type: string };

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  HATCHBACK:       "Hatchback",
  SEDAN:           "Sedan",
  SUV:             "SUV",
  LUXURY_SEDAN:    "Luxury Sedan",
  LUXURY_SUV:      "Luxury SUV",
  TEMPO_TRAVELLER: "Tempo Traveller",
  MINI_BUS:        "Mini Bus",
  BUS:             "Bus",
  Rikshaw:         "Rickshaw",
};

// ── Component ─────────────────────────────────────────────────────────────

export function CabPricingTable({
  rows,
  vehicles,
  currentPage,
  totalPages,
  totalCount,
  limit,
  search,
  status,
}: {
  rows:        CabPricingGroup[];
  vehicles:    Vehicle[];
  currentPage: number;
  totalPages:  number;
  totalCount:  number;
  limit:       number;
  search:      string;
  status:      string;
}) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [localSearch, setLocalSearch] = useState(search);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => { setLocalSearch(search); }, [search]);

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

  function handleToggle(destinationId: number, current: boolean) {
    startTransition(async () => {
      const res = await toggleCabPricingActive(destinationId, !current);
      if (res.success) toast.success(res.message);
      else             toast.error(res.message);
    });
  }

  const from  = totalCount === 0 ? 0 : (currentPage - 1) * limit + 1;
  const to    = Math.min(currentPage * limit, totalCount);
  const paginationLabel = `Showing ${from}–${to} of ${totalCount} destination${totalCount !== 1 ? "s" : ""}`;

  // ── Columns ──────────────────────────────────────────────────────────────

  const columns: ColumnDef<CabPricingGroup>[] = [
    {
      header: "Destination",
      width:  "w-[200px]",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-dashboard-primary/10 flex items-center justify-center shrink-0">
            <Car className="h-4 w-4 text-dashboard-primary" />
          </div>
          <div>
            <p className="font-medium text-sm">{row.destination_name}</p>
            <p className="text-xs text-muted-foreground font-mono">{row.destination_slug}</p>
          </div>
        </div>
      ),
    },
    {
      header: "Vehicle Prices",
      cell: (row) => (
        <div className="flex flex-wrap gap-1.5">
          {row.pricings.slice(0, 4).map((p) => (
            <div
              key={p.vehicle_id}
              className="flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-0.5"
            >
              <span className="text-[11px] font-medium text-muted-foreground">
                {VEHICLE_TYPE_LABELS[p.vehicle_type] ?? p.vehicle_type}
              </span>
              <span className="text-[11px] font-semibold text-foreground">
                ₹{p.price.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {p.pricing_type === "PER_KM" ? "/km" : "/day"}
              </span>
            </div>
          ))}
          {row.pricings.length > 4 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              +{row.pricings.length - 4} more
            </Badge>
          )}
        </div>
      ),
    },
    {
      header:  "Vehicles",
      align:   "center",
      width:   "w-[100px]",
      cell: (row) => (
        <div className="flex items-center justify-center gap-1 text-sm">
          <span className="font-semibold">{row.active_count}</span>
          <span className="text-muted-foreground">/ {row.total_count}</span>
        </div>
      ),
    },
    {
      header: "Active",
      align:  "center",
      width:  "w-[80px]",
      cell: (row) => (
        <Switch
          checked={row.active_count > 0}
          disabled={isPending}
          onCheckedChange={() => handleToggle(row.destination_id, row.active_count > 0)}
        />
      ),
    },
    {
      header: "Last Updated",
      width:  "w-[140px]",
      cell: (row) => (
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(row.updated_at), { addSuffix: true })}
        </p>
      ),
    },
    {
      header: "Actions",
      align:  "right",
      width:  "w-[100px]",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <EditCabPricingSheet row={row} vehicles={vehicles} />
          <DeleteCabPricingDialog
            destinationId={row.destination_id}
            destinationName={row.destination_name}
            vehicleCount={row.total_count}
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
          search={localSearch}
          onSearchChange={handleSearch}
          searchPlaceholder="Search destinations…"
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
          ]}
        />

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
        data={rows}
        columns={columns}
        rowKey={(r) => r.destination_id}
        emptyState={
          <TableEmptyState
            title="No cab pricing found"
            description="Add pricing for a destination to get started"
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