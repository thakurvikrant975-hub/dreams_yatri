"use client";

import { useState, useTransition } from "react";
import Link     from "next/link";
import { Package as PkgIcon, Search, Pencil, Trash2, Clock, ImageIcon, Map as MapIcon } from "lucide-react";
import { Badge }   from "../components/ui/badge";
import { Button }  from "../components/ui/button";
import { Input }   from "../components/ui/input";
import { Switch }  from "../components/ui/switch";
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { toast } from "sonner";
import { togglePackageActive, deletePackage, type PackageListItem } from "./actions";

const BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-muted/50 px-4 py-3 space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

export function PackagesTableClient({ packages: initialPackages }: { packages: PackageListItem[] }) {
  const [packages,  setPackages]  = useState(initialPackages);
  const [search,    setSearch]    = useState("");
  const [filterDest, setFilterDest] = useState("all");
  const [isPending, startTransition] = useTransition();

  const destinations = [...new Map(
    packages.map(p => [p.destination.id, p.destination])
  ).values()];

  const filtered = packages.filter(p => {
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase());
    const matchDest   = filterDest === "all" || String(p.destination.id) === filterDest;
    return matchSearch && matchDest;
  });

  const activeCount = packages.filter(p => p.is_active).length;

  function handleToggle(id: number, current: boolean) {
    startTransition(async () => {
      await togglePackageActive(id, !current);
      setPackages(prev => prev.map(p => p.id === id ? { ...p, is_active: !current } : p));
      toast.success(`Package ${!current ? "activated" : "deactivated"}`);
    });
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      const r = await deletePackage(id);
      if (r.success) { setPackages(prev => prev.filter(p => p.id !== id)); toast.success(r.message); }
      else toast.error(r.message);
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Packages" value={packages.length} />
        <StatCard label="Active"          value={activeCount} />
        <StatCard label="Inactive"        value={packages.length - activeCount} />
        <StatCard label="Destinations"    value={destinations.length} />
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search packages..." value={search}
            onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterDest} onValueChange={setFilterDest}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All destinations" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Destinations</SelectItem>
            {destinations.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground ml-auto">{filtered.length} of {packages.length}</p>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border rounded-xl bg-muted/30">
          <PkgIcon className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No packages found</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[280px]">Package</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead className="text-center">Durations</TableHead>
                <TableHead className="text-center">Days Built</TableHead>
                <TableHead className="text-center">Images</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(pkg => (
                <TableRow key={pkg.id} className="hover:bg-muted/30">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {pkg.thumbnail ? (
                        <img src={`${BASE}/${pkg.thumbnail}`} alt={pkg.title}
                          className="h-10 w-16 rounded-lg object-cover shrink-0 border" />
                      ) : (
                        <div className="h-10 w-16 rounded-lg bg-muted border flex items-center justify-center shrink-0">
                          <PkgIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-sm">{pkg.title}</p>
                        <p className="text-xs text-muted-foreground">{pkg.slug}</p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div>
                      <Badge variant="secondary" className="text-xs">{pkg.destination.name}</Badge>
                      <p className="text-xs text-muted-foreground mt-0.5">{pkg.destination.region.name}</p>
                    </div>
                  </TableCell>

                  <TableCell className="text-center">
                    <span className="flex items-center justify-center gap-1 text-sm">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {pkg._count.durations}
                    </span>
                  </TableCell>

                  <TableCell className="text-center">
                    <span className="flex items-center justify-center gap-1 text-sm">
                      <MapIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      {pkg._count.itineraries}
                    </span>
                  </TableCell>

                  <TableCell className="text-center">
                    <span className="flex items-center justify-center gap-1 text-sm">
                      <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      {pkg._count.images}
                    </span>
                  </TableCell>

                  <TableCell className="text-center">
                    <Switch checked={pkg.is_active} disabled={isPending}
                      onCheckedChange={() => handleToggle(pkg.id, pkg.is_active)} />
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link href={`/dashboard/packages/${pkg.id}`}><Pencil className="h-3.5 w-3.5" /></Link>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Package</AlertDialogTitle>
                            <AlertDialogDescription>
                              Delete <span className="font-semibold">{pkg.title}</span>?
                              This removes all durations, itineraries, pricing and images permanently.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(pkg.id)} disabled={isPending}
                              className="bg-destructive text-white hover:bg-destructive/90">
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
      )}
    </div>
  );
}