"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Package, Plus, Pencil, ToggleLeft, ToggleRight, Search } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import { Switch } from "../components/ui/switch";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { listPackagesAction, updatePackageAction } from "@/app/actions/packages/package.actions";
import type { PackageListItem } from "@/app/types/packages";

const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";

export default function PackagesPage() {
  const [packages, setPackages] = useState<PackageListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const limit = 20;

  async function load(p: number, q: string) {
    setLoading(true);
    const result = await listPackagesAction({ page: p, limit, search: q || undefined });
    if (result.success) {
      setPackages(result.data.data);
      setTotal(result.data.meta.total);
    }
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => load(1, search), search ? 300 : 0);
    setPage(1);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(page, search); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleToggle(pkg: PackageListItem) {
    startTransition(async () => {
      const res = await updatePackageAction(pkg.id, {
        title: pkg.title,
        slug: pkg.slug,
        destination_id: pkg.destination.id,
        is_active: !pkg.is_active,
      });
      if (res.success) {
        toast.success(`Package ${!pkg.is_active ? "activated" : "deactivated"}`);
        load(page, search);
      } else {
        toast.error(res.error);
      }
    });
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Packages</h1>
            <p className="text-sm text-muted-foreground">
              {total} package{total !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/dashboard/packages/new">
            <Plus className="h-4 w-4 mr-2" /> New Package
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search packages..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : packages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border rounded-xl bg-muted/30">
          <Package className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No packages found</p>
          <p className="text-xs text-muted-foreground mt-1">
            {search ? "Try a different search term" : `Click "New Package" to get started`}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[280px]">Package</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Durations</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packages.map(pkg => (
                <TableRow key={pkg.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {pkg.thumbnail ? (
                        <img
                          src={`${base}/${pkg.thumbnail}`}
                          alt={pkg.title}
                          className="h-10 w-14 object-cover rounded-md shrink-0"
                        />
                      ) : (
                        <div className="h-10 w-14 rounded-md bg-muted flex items-center justify-center shrink-0">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{pkg.title}</p>
                        <p className="text-xs text-muted-foreground">{pkg.slug}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{pkg.destination.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {pkg.durations.slice(0, 3).map(d => (
                        <Badge
                          key={d.id}
                          variant={d.is_default ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {d.label}
                        </Badge>
                      ))}
                      {pkg.durations.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{pkg.durations.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(pkg.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={pkg.is_active}
                      disabled={isPending}
                      onCheckedChange={() => handleToggle(pkg)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/dashboard/packages/${pkg.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Page {page} of {totalPages} · {total} total
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline" size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
