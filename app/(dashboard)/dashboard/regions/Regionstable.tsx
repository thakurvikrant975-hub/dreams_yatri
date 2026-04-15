"use client";

import { useTransition } from "react";
import { Badge } from "../components/ui/badge";
import { Switch } from "@/app/(dashboard)/dashboard/components/ui/switch";
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import { EditRegionDialog } from "./RegionDialog";
import { DeleteRegionDialog } from "./Deleteregiondialog";
import { toggleRegionActive } from "./actions";
import { toast } from "sonner";
import { Globe, MapPin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ImageIcon } from "@phosphor-icons/react";


type Region = {
  id: number;
  name: string;
  slug: string;
  country: string;
  description: string | null;
  meta_title: string | null;
  meta_desc: string | null;
  thumbnail: string | null;   // ← add
  cover_image: string | null;   // ← add
  is_active: boolean;
  created_at: Date;
  _count: { destinations: number };
};

export function RegionsTable({ regions }: { regions: Region[] }) {
  const [isPending, startTransition] = useTransition();

  function handleToggle(id: number, current: boolean) {
    startTransition(async () => {
      await toggleRegionActive(id, !current);
      toast.success(`Region ${!current ? "activated" : "deactivated"}`);
    });
  }

  if (regions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center border rounded-xl bg-muted/30">
        <Globe className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No regions yet</p>
        <p className="text-xs text-muted-foreground mt-1">Create your first region to get started</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[200px]">Region</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead className="w-[200px]">Cover</TableHead>
            <TableHead>Country</TableHead>
            <TableHead className="text-center">Destinations</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead>Added</TableHead>
            <TableHead className="text-right w-25">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {regions.map(region => (
            <TableRow key={region.id} className="hover:bg-muted/30">
              {/* Name */}
              <TableCell>
                <div className="flex items-center gap-2">
                  {
                    region.thumbnail ? (
                      <img
                        src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${region.thumbnail}`}
                        alt={region.name}
                        className="h-10 w-14 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-14 rounded-lg bg-muted border flex items-center justify-center shrink-0">
                        <ImageIcon weight="duotone" className="size-5.5 text-muted-foreground/70" />
                      </div>
                    )
                  }
                  <div>
                    <p className="font-medium text-sm">{region.name}</p>
                    {region.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 max-w-[160px]">
                        {region.description}
                      </p>
                    )}
                  </div>
                </div>
              </TableCell>

              {/* Slug */}
              <TableCell>
                <Badge variant="outline" className="font-mono text-xs">
                  {region.slug}
                </Badge>
              </TableCell>

              {/* Cover image */}
              <TableCell>
                {region.cover_image ? (
                  <img
                    src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${region.cover_image}`}
                    alt={`${region.name} cover`}
                    className="h-10 w-14 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div className="h-10 w-14 rounded-lg bg-muted border flex items-center justify-center shrink-0">
                    <ImageIcon weight="duotone" className="size-5.5 text-muted-foreground/70" />
                  </div>
                )}
              </TableCell>

              {/* Country */}
              <TableCell className="text-sm text-muted-foreground">
                {region.country}
              </TableCell>

              {/* Destinations count */}
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1 text-sm">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">{region._count.destinations}</span>
                </div>
              </TableCell>

              {/* Status toggle */}
              <TableCell className="text-center">
                <Switch
                  checked={region.is_active}
                  disabled={isPending}
                  onCheckedChange={() => handleToggle(region.id, region.is_active)}
                />
              </TableCell>

              {/* Created */}
              <TableCell className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(region.created_at), { addSuffix: true })}
              </TableCell>

              {/* Actions */}
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <EditRegionDialog region={region} />
                  <DeleteRegionDialog
                    id={region.id}
                    name={region.name}
                    destinationCount={region._count.destinations}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}