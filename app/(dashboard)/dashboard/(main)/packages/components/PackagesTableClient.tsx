"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Switch } from "../../components/ui/switch";
import { Input } from "../../components/ui/input";
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "../../components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../../components/ui/alert-dialog";
import {
  ChevronLeft, ChevronRight,
  ExternalLink, ImageIcon, MapPin, Pencil, Package, Route, Search, Timer, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { togglePackageActive, deletePackage } from "../actions";

// ── Types ──────────────────────────────────────────────────────────────────

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
  const dur = pkg.durations[0];
  const stay = pkg.stay_categories[0];
  const route = dur?.routes[0];
  if (!dur || !route || !stay) return null;
  return `/packages/${pkg.slug}/${dur.slug}/${route.slug}/${stay.slug}`;
}

const ROWS_PER_PAGE = 20;
const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

// ── Component ──────────────────────────────────────────────────────────────

export function PackagesTableClient({ packages: initialPackages }: { packages: PackageItem[] }) {
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState<PackageItem[]>(initialPackages);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.destination.name.toLowerCase().includes(q) ||
        (p.destination.region?.name ?? "").toLowerCase().includes(q),
    );
  }, [items, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE);

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleToggle(id: number, current: boolean) {
    setItems((prev) => prev.map((p) => p.id === id ? { ...p, is_active: !current } : p));
    startTransition(async () => {
      const result = await togglePackageActive(id, !current);
      if (!result.success) {
        setItems((prev) => prev.map((p) => p.id === id ? { ...p, is_active: current } : p));
        toast.error(result.message ?? "Failed to update package status");
      } else {
        toast.success(`Package ${!current ? "activated" : "deactivated"}`);
      }
    });
  }

  function handleDelete(id: number) {
    setItems((prev) => prev.filter((p) => p.id !== id));
    startTransition(async () => {
      const result = await deletePackage(id);
      if (result.success) toast.success(result.message);
      else {
        toast.error(result.message);
        // restore on failure — refetch not possible here, so show error only
      }
    });
  }

  if (initialPackages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 border rounded-xl bg-muted/30">
        <Package className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No packages yet</p>
        <p className="text-xs text-muted-foreground mt-1">Click "+ New Package" to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search packages…"
          className="pl-8 h-9 text-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border rounded-xl bg-muted/30">
          <Search className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm font-medium text-muted-foreground">No packages match &quot;{search}&quot;</p>
        </div>
      ) : (<>
      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[280px]">Package</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead className="text-center w-[100px]">Durations</TableHead>
              <TableHead className="text-center w-[100px]">Routes</TableHead>
              <TableHead className="text-center w-[100px]">Images</TableHead>
              <TableHead className="text-center w-[90px]">Status</TableHead>
              <TableHead className="w-[180px]">Website URL</TableHead>
              <TableHead className="text-right w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(pkg => (
              <TableRow key={pkg.id} className="hover:bg-muted/30">
                {/* Package thumbnail + title + slug */}
                <TableCell>
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
                </TableCell>

                {/* Destination + region */}
                <TableCell>
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
                </TableCell>

                {/* Durations */}
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1 text-sm">
                    <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{pkg._count.durations}</span>
                  </div>
                </TableCell>

                {/* Routes */}
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1 text-sm">
                    <Route className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{pkg._count.packageRoutes}</span>
                  </div>
                </TableCell>

                {/* Images */}
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1 text-sm">
                    <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{pkg._count.gallery}</span>
                  </div>
                </TableCell>

                {/* Status toggle */}
                <TableCell className="text-center">
                  <Switch
                    checked={pkg.is_active}
                    disabled={isPending}
                    onCheckedChange={() => handleToggle(pkg.id, pkg.is_active)}
                  />
                </TableCell>

                {/* Website URL */}
                <TableCell>
                  {pkg.is_active ? (() => {
                    const url = getWebsiteUrl(pkg);
                    return url ? (
                      <Link
                        href={url}
                        target="_blank"
                        className="flex text-dashboard-primary items-center gap-1 text-xs hover:underline truncate max-w-[160px]"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="truncate">{url}</span>
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    );
                  })() : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>

                {/* Actions */}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <Link href={`/dashboard/packages/${pkg.id}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Package</AlertDialogTitle>
                          <AlertDialogDescription>
                            Delete <span className="font-semibold">{pkg.title}</span>? This will
                            permanently remove the package along with all its durations, routes,
                            itineraries, gallery, and pricing from the database.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(pkg.id)}
                            disabled={isPending}
                            className="bg-destructive text-white hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-muted-foreground">
            Showing {(safePage - 1) * ROWS_PER_PAGE + 1}–{Math.min(safePage * ROWS_PER_PAGE, filtered.length)} of {filtered.length} packages
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={safePage === 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs px-2">
              {safePage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={safePage === totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      </>)}
    </div>
  );
}
