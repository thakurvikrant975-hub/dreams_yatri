"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Switch } from "../../components/ui/switch";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../../components/ui/select";
import {
  AlertDialog, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import {
  ExternalLink, ImageIcon, MapPin, Package, Pencil, Route, Timer, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { togglePackageActive, deletePackage } from "../actions";
import { TableFilters } from "../../components/dashboard/Tablefilters";
import { DataTable, type ColumnDef } from "../../components/dashboard/Datatable";

// ── Types ──────────────────────────────────────────────────────────────────

type Destination = { id: number; name: string };

type PackageItem = {
  id: number;
  title: string;
  slug: string;
  thumbnail: string | null;
  is_active: boolean;
  destination: {
    id: number;
    name: string;
    region: { name: string } | null;
  };
  _count: {
    durations: number;
    packageRoutes: number;
    gallery: number;
  };
  durations: { slug: string; routes: { slug: string }[] }[];
  stay_categories: { slug: string }[];
};

function getWebsiteUrl(pkg: PackageItem): string | null {
  const dur   = pkg.durations[0];
  const stay  = pkg.stay_categories[0];
  const route = dur?.routes[0];
  if (!dur || !route || !stay) return null;
  return `/packages/${pkg.slug}/${dur.slug}/${route.slug}/${stay.slug}`;
}

const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

// ── Component ──────────────────────────────────────────────────────────────

export function PackagesTableClient({
  packages: initialPackages,
  destinations,
  totalCount,
  limit,
  currentPage,
  search,
  destination,
  status,
}: {
  packages:     PackageItem[];
  destinations: Destination[];
  totalCount:   number;
  limit:        number;
  currentPage:  number;
  search:       string;
  destination:  number | "all";
  status:       "active" | "inactive" | "all";
}) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [packages, setPackages] = useState(initialPackages);
  useEffect(() => { setPackages(initialPackages); }, [initialPackages]);

  const [localSearch, setLocalSearch] = useState(search);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => { setLocalSearch(search); }, [search]);

  const [deleteTarget, setDeleteTarget] = useState<PackageItem | null>(null);
  const [deleteError,  setDeleteError]  = useState<string | null>(null);

  // ── URL helpers ───────────────────────────────────────────────────────

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all" || value === "") params.delete(key);
    else params.set(key, value);
    params.delete("page");
    router.push(`?${params.toString()}`);
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

  // ── Actions ───────────────────────────────────────────────────────────

  function handleToggle(id: number, current: boolean) {
    setPackages(prev => prev.map(p => p.id === id ? { ...p, is_active: !current } : p));
    startTransition(async () => {
      const result = await togglePackageActive(id, !current);
      if (!result.success) {
        setPackages(prev => prev.map(p => p.id === id ? { ...p, is_active: current } : p));
        toast.error(result.message ?? "Failed to update package status");
      } else {
        toast.success(`Package ${!current ? "activated" : "deactivated"}`);
      }
    });
  }

  function openDelete(pkg: PackageItem) {
    setDeleteTarget(pkg);
    setDeleteError(null);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deletePackage(deleteTarget.id);
      if (result.success) {
        setPackages(prev => prev.filter(p => p.id !== deleteTarget.id));
        toast.success(result.message);
        setDeleteTarget(null);
      } else {
        setDeleteError(result.message);
      }
    });
  }

  // ── Pagination ────────────────────────────────────────────────────────

  const totalPages = Math.ceil(totalCount / limit);
  const from       = totalCount === 0 ? 0 : (currentPage - 1) * limit + 1;
  const to         = Math.min(currentPage * limit, totalCount);
  const label      = `Showing ${from}–${to} of ${totalCount} package${totalCount !== 1 ? "s" : ""}`;

  // ── Columns ───────────────────────────────────────────────────────────

  const columns: ColumnDef<PackageItem>[] = [
    {
      header: "Package",
      width:  "w-[280px]",
      cell: (pkg) => (
        <div className="flex items-center gap-3">
          {pkg.thumbnail ? (
            <img
              src={`${base}/${pkg.thumbnail}`}
              alt={pkg.title}
              className="h-12 w-16 rounded-lg object-cover shrink-0 border"
            />
          ) : (
            <div className="h-12 w-16 rounded-lg bg-muted border flex items-center justify-center shrink-0">
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{pkg.title}</p>
            <p className="text-xs text-muted-foreground truncate">{pkg.slug}</p>
          </div>
        </div>
      ),
    },
    {
      header: "Destination",
      cell: (pkg) => (
        <div className="space-y-0.5">
          <Badge variant="secondary" className="text-xs font-normal">
            {pkg.destination.name}
          </Badge>
          {pkg.destination.region && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {pkg.destination.region.name}
            </div>
          )}
        </div>
      ),
    },
    {
      header: "Durations",
      align:  "center",
      cell: (pkg) => (
        <span className="flex items-center justify-center gap-1 text-sm">
          <Timer className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">{pkg._count.durations}</span>
        </span>
      ),
    },
    {
      header: "Routes",
      align:  "center",
      cell: (pkg) => (
        <span className="flex items-center justify-center gap-1 text-sm">
          <Route className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">{pkg._count.packageRoutes}</span>
        </span>
      ),
    },
    {
      header: "Images",
      align:  "center",
      cell: (pkg) => (
        <span className="flex items-center justify-center gap-1 text-sm">
          <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">{pkg._count.gallery}</span>
        </span>
      ),
    },
    {
      header: "Status",
      align:  "center",
      cell: (pkg) => (
        <Switch
          checked={pkg.is_active}
          disabled={isPending}
          onCheckedChange={() => handleToggle(pkg.id, pkg.is_active)}
        />
      ),
    },
    {
      header: "Website",
      cell: (pkg) => {
        const url = getWebsiteUrl(pkg);
        return pkg.is_active && url ? (
          <Link
            href={url}
            target="_blank"
            className="flex text-dashboard-primary items-center gap-1 text-xs hover:underline truncate max-w-40"
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">{url}</span>
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
    {
      header:  "Actions",
      align:   "right",
      width:   "w-[90px]",
      cell: (pkg) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link href={`/dashboard/packages/${pkg.id}`}>
              <Pencil className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => openDelete(pkg)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Filters + rows per page */}
      <div className="flex flex-wrap items-center gap-3">
        <TableFilters
          className="flex-1 min-w-0"
          search={localSearch}
          onSearchChange={handleSearch}
          searchPlaceholder="Search packages..."
          filters={[
            {
              value: destination === "all" ? "all" : String(destination),
              onChange: (v) => updateParam("destination", v),
              placeholder: "All Destinations",
              width: "w-44",
              options: destinations.map(d => ({ label: d.name, value: String(d.id) })),
            },
            {
              value: status,
              onChange: (v) => updateParam("status", v),
              placeholder: "All Statuses",
              width: "w-36",
              options: [
                { label: "Active",   value: "active"   },
                { label: "Inactive", value: "inactive" },
              ],
            },
          ]}
        />
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Rows per page</span>
          <Select value={String(limit)} onValueChange={v => updateParam("limit", v)}>
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
      </div>

      {/* Table or empty state */}
      {packages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border rounded-xl bg-muted/30">
          <Package className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No packages found</p>
          <p className="text-xs text-muted-foreground mt-1">
            {totalCount === 0 ? 'Click "New Package" to get started' : "Try adjusting your filters"}
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={packages}
          rowKey={p => p.id}
          pagination={{ currentPage, totalPages, buildHref, label }}
        />
      )}

      {/* Delete dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Package</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <span className="font-semibold">{deleteTarget?.title}</span>? This will
              permanently remove the package along with all its durations, routes, itineraries,
              gallery, and pricing from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteError && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {deleteError}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={handleDelete}
            >
              {isPending ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
