"use client";

import { useState, useTransition } from "react";
import { Badge }   from "../components/ui/badge";
import { Switch }  from "@/app/(dashboard)/dashboard/(main)/components/ui/switch";
import { EditRegionSheet }   from "./RegionSheet";
import { DeleteRegionDialog } from "./Deleteregiondialog";
import { toggleRegionActive } from "./actions";
import { toast }              from "sonner";
import { Globe, MapPin }      from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ImageIcon }          from "@phosphor-icons/react";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableFilters } from "../components/dashboard/Tablefilters";

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
  _count: { destinations: number };
};

// ── Component ─────────────────────────────────────────────────────────────────
export function RegionsTable({
  regions,
  currentPage,
  totalPages,
  totalCount,      

}: {
  regions:     Region[];
  currentPage: number;
  totalPages:  number;
  totalCount:  number; 

}) {
  const [isPending, startTransition] = useTransition();

  // ── Filter state ───────────────────────────────────────────────────────────
  const [search,          setSearch]          = useState("");
  const [filterCountry,   setFilterCountry]   = useState("all");
  const [filterDestCount, setFilterDestCount] = useState("all");

  // ── Derived filter options from data ───────────────────────────────────────
  const countries = [...new Set(regions.map(r => r.country).filter(Boolean))];

  // ── Filter logic ───────────────────────────────────────────────────────────
  const filtered = regions.filter(r => {
    const matchSearch  = !search
      || r.name.toLowerCase().includes(search.toLowerCase())
      || r.slug.toLowerCase().includes(search.toLowerCase());

    const matchCountry = filterCountry === "all" || r.country === filterCountry;

    const matchDest =
      filterDestCount === "all"  ? true :
      filterDestCount === "0"    ? r._count.destinations === 0 :
      filterDestCount === "1-5"  ? r._count.destinations >= 1  && r._count.destinations <= 5 :
      filterDestCount === "6-15" ? r._count.destinations >= 6  && r._count.destinations <= 15 :
      filterDestCount === "15+"  ? r._count.destinations > 15 :
      true;

    return matchSearch && matchCountry && matchDest;
  });

  // ── Toggle ─────────────────────────────────────────────────────────────────
  function handleToggle(id: number, current: boolean) {
    startTransition(async () => {
      await toggleRegionActive(id, !current);
      toast.success(`Region ${!current ? "activated" : "deactivated"}`);
    });
  }

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: ColumnDef<Region>[] = [
    {
      header: "Region",
      width:  "w-[200px]",
      cell: (region) => (
        <div className="flex items-center gap-2">
          {region.thumbnail ? (
            <img
              src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${region.thumbnail}`}
              alt={region.name}
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
              <p className="text-xs text-muted-foreground line-clamp-1 max-w-[160px]">
                {region.description}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      header: "Slug",
      cell: (region) => (
        <Badge variant="outline" className="font-mono text-xs">{region.slug}</Badge>
      ),
    },
    {
      header: "Cover",
      width:  "w-[200px]",
      cell: (region) =>
        region.cover_image ? (
          <img
            src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${region.cover_image}`}
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
      cell: (region) => (
        <span className="text-sm text-muted-foreground">{region.country}</span>
      ),
    },
    {
      header: "Destinations",
      align:  "center",
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
      header: "Added",
      cell: (region) => (
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(region.created_at), { addSuffix: true })}
        </span>
      ),
    },
    {
      header: "Actions",
      align:  "right",
      width:  "w-[100px]",
      cell: (region) => (
        <div className="flex items-center justify-end gap-1">
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
const isFiltering = search !== "" || filterCountry !== "all" || filterDestCount !== "all";
  return (
    <div className="space-y-4">

      {/* Filters */}
      <TableFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search regions..."
        filteredCount={isFiltering ? filtered.length : undefined}
        totalCount={isFiltering ? regions.length : undefined}
        filters={[
          {
            value:       filterCountry,
            onChange:    setFilterCountry,
            placeholder: "All Countries",
            width:       "w-40",
            // Auto-derived from the data — no hardcoding needed
            options:     countries.map(c => ({ label: c, value: c })),
          },
          {
            value:       filterDestCount,
            onChange:    setFilterDestCount,
            placeholder: "All Destinations",
            width:       "w-48",
            options: [
              { label: "No destinations", value: "0"    },
              { label: "1 – 5",           value: "1-5"  },
              { label: "6 – 15",          value: "6-15" },
              { label: "15+",             value: "15+"  },
            ],
          },
        ]}
      />

      {/* Table */}
      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(r) => r.id}
        emptyState={
          <div className="flex flex-col items-center gap-2">
            <Globe className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">No regions found</p>
            <p className="text-xs text-muted-foreground">Try adjusting your filters</p>
          </div>
        }
        pagination={{ currentPage, totalPages }}
      />
    </div>
  );
}