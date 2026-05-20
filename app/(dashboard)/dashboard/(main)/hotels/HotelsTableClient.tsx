"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  AlertDialog, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { Hotel, BedDouble, ImageIcon, ExternalLink, Trash2, Pencil } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { toggleHotelActive, deleteHotel } from "./actions";
import { TableFilters } from "../components/dashboard/Tablefilters";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { CATEGORIES } from "./constants";
import { TableEmptyState } from "../components/dashboard/TableEmptyState";
// ── Constants ─────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(c => [c.value, c.label])
);

const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

// ── Types ─────────────────────────────────────────────────────────────────

type Destination = { id: number; name: string };

type HotelItem = {
  id: number;
  name: string;
  slug: string;
  thumbnail: string | null;
  category: string | null;
  stay_type: string | null;
  is_active: boolean;
  created_at: Date;
  destination: { id: number; name: string };
  _count: {
    hotelRooms: number;
    images: number;
    packageBookings: number;
  };
};

// ── Main Component ────────────────────────────────────────────────────────

export function HotelsTableClient({
  hotels: initialHotels,
  destinations,
  totalCount,
  limit,
  currentPage,
  search,
  destination,
  category,
  status,
}: {
  hotels: HotelItem[];
  destinations: Destination[];
  totalCount: number;
  limit: number;
  currentPage: number;
  search: string;
  destination: number | "all";
  category: string | "all";
  status: "active" | "inactive" | "all";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [hotels, setHotels] = useState(initialHotels);
  useEffect(() => { setHotels(initialHotels); }, [initialHotels]);

  const [localSearch, setLocalSearch] = useState(search);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => { setLocalSearch(search); }, [search]);

  const [deleteTarget, setDeleteTarget] = useState<HotelItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── URL helpers ───────────────────────────────────────────────────────

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all" || value === "") params.delete(key);
    else params.set(key, value);
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

  // ── Actions ───────────────────────────────────────────────────────────

  function handleToggle(id: number, current: boolean) {
    startTransition(async () => {
      await toggleHotelActive(id, !current);
      setHotels(prev => prev.map(h => h.id === id ? { ...h, is_active: !current } : h));
      toast.success(`Hotel ${!current ? "activated" : "deactivated"}`);
    });
  }

  function openDelete(hotel: HotelItem) {
    setDeleteTarget(hotel);
    setDeleteError(null);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteHotel(deleteTarget.id);
      if (result.success) {
        setHotels(prev => prev.filter(h => h.id !== deleteTarget.id));
        toast.success(result.message);
        setDeleteTarget(null);
      } else {
        setDeleteError(result.message);
      }
    });
  }

  // ── Pagination ────────────────────────────────────────────────────────

  const totalPages = Math.ceil(totalCount / limit);
  const from = totalCount === 0 ? 0 : (currentPage - 1) * limit + 1;
  const to = Math.min(currentPage * limit, totalCount);
  const label = `Showing ${from}–${to} of ${totalCount} hotel${totalCount !== 1 ? "s" : ""}`;

  // ── Columns ───────────────────────────────────────────────────────────

  const columns: ColumnDef<HotelItem>[] = [
    {
      header: "Hotel",
      width: "w-[260px]",
      cell: (h) => (
        <div className="flex items-center gap-3">
          {h.thumbnail ? (
            <Image
              src={`${base}/${h.thumbnail}`}
              alt={h.name}
              width={64}
              height={48}
              className="h-12 w-16 rounded-lg object-cover shrink-0 border"
            />
          ) : (
            <div className="h-12 w-16 rounded-lg bg-muted border flex items-center justify-center shrink-0">
              <Hotel className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <div>
            <p className="font-medium text-sm">{h.name}</p>
            {h.stay_type && <p className="text-xs text-muted-foreground">{h.stay_type}</p>}
          </div>
        </div>
      ),
    },
    {
      header: "Destination",
      cell: (h) => <Badge variant="secondary" className="text-xs bg-dashboard-primary/10 text-dashboard-primary">{h.destination.name}</Badge>,
    },
    {
      header: "Category",
      cell: (h) => (
        <span className="text-sm text-muted-foreground">
          {CATEGORY_LABELS[h.category ?? ""] ?? h.category ?? "—"}
        </span>
      ),
    },
    {
      header: "Rooms",
      align: "center",
      cell: (h) => (
        <span className="flex items-center justify-center gap-1 text-sm">
          <BedDouble className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">{h._count.hotelRooms}</span>
        </span>
      ),
    },
    {
      header: "Images",
      align: "center",
      cell: (h) => (
        <span className="flex items-center justify-center gap-1 text-sm">
          <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">{h._count.images}</span>
        </span>
      ),
    },
    {
      header: "Status",
      align: "center",
      cell: (h) => (
        <Switch
          checked={h.is_active}
          disabled={isPending}
          onCheckedChange={() => handleToggle(h.id, h.is_active)}
        />
      ),
    },
    {
      header: "Actions",
      align: "right",
      width: "w-[100px]",
      cell: (h) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link href={`/dashboard/hotels/${h.id}`}>
              <Pencil className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => openDelete(h)}
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
          searchPlaceholder="Search hotels..."
          filters={[
            {
              value: destination === "all" ? "all" : String(destination),
              onChange: (v) => updateParam("destination", v),
              placeholder: "All Destinations",
              width: "w-44",
              options: destinations.map(d => ({ label: d.name, value: String(d.id) })),
            },
            {
              value: category === "all" ? "all" : category,
              onChange: (v) => updateParam("category", v),
              placeholder: "All Categories",
              width: "w-40",
              options: CATEGORIES.map(c => ({ label: c.label, value: c.value })),
            },
            {
              value: status,
              onChange: (v) => updateParam("status", v),
              placeholder: "All Statuses",
              width: "w-36",
              options: [
                { label: "Active", value: "active" },
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
      {hotels.length === 0 ? (

        <TableEmptyState
          title="No hotels found"
          description={totalCount === 0 ? 'Click "Add Hotel" to get started' : "Try adjusting your filters"}
        />
      ) : (
        <DataTable
          columns={columns}
          data={hotels}
          rowKey={h => h.id}
          pagination={{ currentPage, totalPages, buildHref, label }}
        />
      )}

      {/* Delete dialog — controlled, stays open on error */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Hotel</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <span className="font-semibold">{deleteTarget?.name}</span>? This will
              permanently remove all rooms, images and categories from R2 and DB.
              {(deleteTarget?._count.packageBookings ?? 0) > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  This hotel has {deleteTarget?._count.packageBookings} package link{(deleteTarget?._count.packageBookings ?? 0) !== 1 ? "s" : ""}. Remove those before deleting.
                </span>
              )}
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
              disabled={isPending || (deleteTarget?._count.packageBookings ?? 0) > 0}
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
