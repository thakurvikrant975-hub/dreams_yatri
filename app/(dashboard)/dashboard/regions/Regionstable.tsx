"use client";

import { useTransition } from "react";
import { Badge }   from "../components/ui/badge";
import { Switch }  from "@/app/(dashboard)/dashboard/components/ui/switch";
import { EditRegionDialog }   from "./RegionDialog";
import { DeleteRegionDialog } from "./Deleteregiondialog";
import { toggleRegionActive } from "./actions";
import { toast }              from "sonner";
import { Globe, MapPin }      from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ImageIcon }          from "@phosphor-icons/react";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";

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
}: {
  regions:     Region[];
  currentPage: number;
  totalPages:  number;
}) {
  const [isPending, startTransition] = useTransition();

  function handleToggle(id: number, current: boolean) {
    startTransition(async () => {
      await toggleRegionActive(id, !current);
      toast.success(`Region ${!current ? "activated" : "deactivated"}`);
    });
  }

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
          <EditRegionDialog region={region} />
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
    <DataTable
      data={regions}
      columns={columns}
      rowKey={(r) => r.id}
      emptyState={
        <div className="flex flex-col items-center gap-2">
          <Globe className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">No regions yet</p>
          <p className="text-xs text-muted-foreground">Create your first region to get started</p>
        </div>
      }
      pagination={{ currentPage, totalPages }}
    />
  );
}