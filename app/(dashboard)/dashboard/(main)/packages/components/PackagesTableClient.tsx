"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ImageIcon, MapPin, Package, Pencil, Route, Timer, Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Badge }  from "../../components/ui/badge";
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
import { toast } from "sonner";
import { togglePackageActive, deletePackage, getPackageHistory } from "../actions";
import { TableFilters } from "../../components/dashboard/Tablefilters";
import { DataTable, type ColumnDef } from "../../components/dashboard/Datatable";
import { TableEmptyState } from "../../components/dashboard/TableEmptyState";
import { HistorySheet } from "../../components/dashboard/HistorySheet";

// ── Types ──────────────────────────────────────────────────────────────────

type Destination = { id: number; name: string };

type PackageItem = {
    id:         number;
    title:      string;
    slug:       string;
    thumbnail:  string | null;
    is_active:  boolean;
    created_at: Date;
    created_by: string | null;
    updated_at: Date;
    updated_by: string | null;
    destination: {
        id:     number;
        name:   string;
        region: { name: string } | null;
    };
    _count: {
        durations:     number;
        packageRoutes: number;
        gallery:       number;
    };
    durations:        { slug: string; routes: { slug: string }[] }[];
    stay_categories:  { slug: string }[];
};

// ── Helpers ───────────────────────────────────────────────────────────────

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
      cell: (pkg) => {
        const url = getWebsiteUrl(pkg);
        return (
          <div className="flex items-center gap-3">
            {pkg.thumbnail ? (
              <Image
                src={`${base}/${pkg.thumbnail}`}
                alt={pkg.title}
                width={112}
                height={84}
                className="h-21 w-28 rounded-lg object-cover shrink-0 border"
              />
            ) : (
              <div className="h-21 w-28 rounded-lg bg-dashboard-base-200 border border-dashboard-base-content/15 flex items-center justify-center shrink-0">
                <Package className="h-5 w-5 text-dashboard-base-content/30" />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate text-dashboard-base-content">{pkg.title}</p>
              {pkg.is_active && url ? (
                <Link
                  href={url}
                  target="_blank"
                  className="text-xs text-blue-600 hover:text-blue-700 hover:underline truncate block"
                >
                  {pkg.slug}
                </Link>
              ) : (
                <p className="text-xs text-dashboard-base-content/50 truncate">{pkg.slug}</p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: "Destination",
      cell: (pkg) => (
        <div className="space-y-0.5">
          <Badge variant="secondary" className="text-xs font-normal bg-dashboard-primary/10 text-dashboard-primary">
            {pkg.destination.name}
          </Badge>
          {pkg.destination.region && (
            <div className="flex items-center gap-1 text-xs text-dashboard-base-content/50">
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
          <Timer className="h-3.5 w-3.5 text-dashboard-base-content/40" />
          <span className="font-medium">{pkg._count.durations}</span>
        </span>
      ),
    },
    {
      header: "Routes",
      align:  "center",
      cell: (pkg) => (
        <span className="flex items-center justify-center gap-1 text-sm">
          <Route className="h-3.5 w-3.5 text-dashboard-base-content/40" />
          <span className="font-medium">{pkg._count.packageRoutes}</span>
        </span>
      ),
    },
    {
      header: "Images",
      align:  "center",
      cell: (pkg) => (
        <span className="flex items-center justify-center gap-1 text-sm">
          <ImageIcon className="h-3.5 w-3.5 text-dashboard-base-content/40" />
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
      header: "Created By",
      cell: (pkg) => (
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-dashboard-base-content/80 truncate max-w-28">
            {pkg.created_by ?? "—"}
          </p>
          <p className="text-xs text-dashboard-base-content/50">
            {formatDistanceToNow(new Date(pkg.created_at), { addSuffix: true })}
          </p>
        </div>
      ),
    },
    {
      header:  "Actions",
      align:   "right",
      width:   "w-[120px]",
      cell: (pkg) => (
        <div className="flex items-center justify-end gap-1">
          <HistorySheet
            id={pkg.id}
            title={pkg.title}
            entityLabel="package"
            fetchHistory={getPackageHistory}
            createdBy={pkg.created_by}
            createdAt={pkg.created_at}
            updatedBy={pkg.updated_by}
            updatedAt={pkg.updated_at}
          />
          <Button variant="ghost" size="icon" className="h-8 w-8 text-dashboard-base-content/50 hover:text-dashboard-primary hover:bg-dashboard-primary/10 cursor-pointer" asChild>
            <Link href={`/dashboard/packages/${pkg.id}`}>
              <Pencil className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-dashboard-base-content/50 hover:text-dashboard-error hover:bg-dashboard-error/10 cursor-pointer"
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
        <div className="flex items-center gap-2 shrink-0 rounded-lg">
          <Select value={String(limit)} onValueChange={v => updateParam("limit", v)}>
            <SelectTrigger className="w-32 cursor-pointer h-10 border-dashboard-base-300 bg-dashboard-base-100 text-dashboard-base-content/70 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-lg cursor-pointer">
              <SelectItem className="cursor-pointer" value="10">10 / Page</SelectItem>
              <SelectItem className="cursor-pointer" value="20">20 / Page</SelectItem>
              <SelectItem className="cursor-pointer" value="50">50 / Page</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table or empty state */}
      {packages.length === 0 ? (

        <TableEmptyState
          title="No packages found"
          description={totalCount === 0 ? 'Click "New Package" to get started' : "Try adjusting your filters"}
        />
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
            <p className="text-sm text-dashboard-error bg-dashboard-error/10 border border-dashboard-error/20 rounded-xl px-3 py-2">
              {deleteError}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending} className="cursor-pointer">Cancel</AlertDialogCancel>
            <Button
              disabled={isPending}
              onClick={handleDelete}
              className="bg-dashboard-error text-dashboard-error-content hover:bg-dashboard-error/90 cursor-pointer"
            >
              {isPending ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
