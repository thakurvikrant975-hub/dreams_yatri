"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { Hotel, Pencil, Trash2, BedDouble, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { toggleHotelActive, deleteHotel } from "./actions";
import { TableFilters } from "../components/dashboard/Tablefilters";
import { CATEGORIES } from "./constants";

// ── Constants ─────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(c => [c.value, c.label])
);

const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

// ── Types ─────────────────────────────────────────────────────────────────

type Destination = { id: number; name: string };

type HotelItem = {
  id:          number;
  name:        string;
  slug:        string;
  thumbnail:   string | null;
  category:    string | null;
  stay_type:   string | null;
  is_active:   boolean;
  created_at:  Date;
  destination: { id: number; name: string };
  _count: {
    hotelRooms:      number;
    images:          number;
    packageBookings: number;
  };
};

// ── Delete Dialog ─────────────────────────────────────────────────────────

function DeleteHotelDialog({
  hotel,
  onDelete,
  isPending,
}: {
  hotel:     HotelItem;
  onDelete:  (id: number) => void;
  isPending: boolean;
}) {
  return (
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
          <AlertDialogTitle>Delete Hotel</AlertDialogTitle>
          <AlertDialogDescription>
            Delete <span className="font-semibold">{hotel.name}</span>? This will
            permanently remove all rooms, images and categories from R2 and DB.
            {hotel._count.packageBookings > 0 && (
              <span className="block mt-2 text-destructive font-medium">
                This hotel is linked to {hotel._count.packageBookings} package(s). Remove those links before deleting.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onDelete(hotel.id)}
            disabled={hotel._count.packageBookings > 0 || isPending}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────

function Pagination({
  currentPage,
  totalPages,
  buildHref,
}: {
  currentPage: number;
  totalPages:  number;
  buildHref:   (p: number) => string;
}) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2);

  return (
    <div className="flex items-center justify-center gap-2 pt-4 border-t">
      <Button variant="outline" size="sm" asChild disabled={currentPage <= 1}>
        <Link href={buildHref(currentPage - 1)}>← Prev</Link>
      </Button>

      {pages.map((p, i) => {
        const prev = pages[i - 1];
        const showEllipsis = prev && p - prev > 1;
        return (
          <span key={p} className="flex items-center gap-2">
            {showEllipsis && <span className="text-muted-foreground text-sm">…</span>}
            <Button
              variant={p === currentPage ? "default" : "outline"}
              size="icon"
              className="h-8 w-8 text-sm"
              asChild={p !== currentPage}
            >
              {p === currentPage ? <span>{p}</span> : <Link href={buildHref(p)}>{p}</Link>}
            </Button>
          </span>
        );
      })}

      <Button variant="outline" size="sm" asChild disabled={currentPage >= totalPages}>
        <Link href={buildHref(currentPage + 1)}>Next →</Link>
      </Button>
    </div>
  );
}

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
  hotels:       HotelItem[];
  destinations: Destination[];
  totalCount:   number;
  limit:        number;
  currentPage:  number;
  search:       string;
  destination:  number | "all";
  category:     string | "all";
  status:       "active" | "inactive" | "all";
}) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Local optimistic state for toggle/delete
  const [hotels, setHotels] = useState(initialHotels);
  useEffect(() => { setHotels(initialHotels); }, [initialHotels]);

  // Debounced search
  const [localSearch, setLocalSearch] = useState(search);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => { setLocalSearch(search); }, [search]);

  // ── URL helpers ───────────────────────────────────────────────────────

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all" || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
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
    startTransition(async () => {
      await toggleHotelActive(id, !current);
      setHotels(prev => prev.map(h => h.id === id ? { ...h, is_active: !current } : h));
      toast.success(`Hotel ${!current ? "activated" : "deactivated"}`);
    });
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      const result = await deleteHotel(id);
      if (result.success) {
        setHotels(prev => prev.filter(h => h.id !== id));
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    });
  }

  // ── Derived ───────────────────────────────────────────────────────────

  const totalPages = Math.ceil(totalCount / limit);
  const from       = totalCount === 0 ? 0 : (currentPage - 1) * limit + 1;
  const to         = Math.min(currentPage * limit, totalCount);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Filters */}
      <TableFilters
        search={localSearch}
        onSearchChange={handleSearch}
        searchPlaceholder="Search hotels..."
        filteredCount={undefined}
        totalCount={undefined}
        filters={[
          {
            value: destination === "all" ? "all" : String(destination),
            onChange: (v) => updateParam("destination", v),
            placeholder: "All Destinations",
            width: "w-44",
            options: [
              { label: "All Destinations", value: "all" },
              ...destinations.map(d => ({ label: d.name, value: String(d.id) })),
            ],
          },
          {
            value: category === "all" ? "all" : category,
            onChange: (v) => updateParam("category", v),
            placeholder: "All Categories",
            width: "w-40",
            options: [
              { label: "All Categories", value: "all" },
              ...CATEGORIES.map(c => ({ label: c.label, value: c.value })),
            ],
          },
          {
            value: status,
            onChange: (v) => updateParam("status", v),
            placeholder: "All Statuses",
            width: "w-36",
            options: [
              { label: "All Statuses", value: "all"      },
              { label: "Active",       value: "active"   },
              { label: "Inactive",     value: "inactive" },
            ],
          },
        ]}
      />

      {/* Empty state */}
      {hotels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border rounded-xl bg-muted/30">
          <Hotel className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No hotels found</p>
          <p className="text-xs text-muted-foreground mt-1">
            {totalCount === 0
              ? 'Click "Add Hotel" to get started'
              : "Try adjusting your filters"}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[260px]">Hotel</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-center">Rooms</TableHead>
                <TableHead className="text-center">Images</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hotels.map(hotel => (
                <TableRow key={hotel.id} className="hover:bg-muted/30">

                  {/* Hotel name + thumbnail */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {hotel.thumbnail ? (
                        <img
                          src={`${base}/${hotel.thumbnail}`}
                          alt={hotel.name}
                          className="h-12 w-16 rounded-lg object-cover shrink-0 border"
                        />
                      ) : (
                        <div className="h-12 w-16 rounded-lg bg-muted border flex items-center justify-center shrink-0">
                          <Hotel className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-sm">{hotel.name}</p>
                        {hotel.stay_type && <p className="text-xs text-muted-foreground">{hotel.stay_type}</p>}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {hotel.destination.name}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground">
                    {CATEGORY_LABELS[hotel.category ?? ""] ?? hotel.category ?? "—"}
                  </TableCell>

                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1 text-sm">
                      <BedDouble className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">{hotel._count.hotelRooms}</span>
                    </div>
                  </TableCell>

                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1 text-sm">
                      <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">{hotel._count.images}</span>
                    </div>
                  </TableCell>

                  <TableCell className="text-center">
                    <Switch
                      checked={hotel.is_active}
                      disabled={isPending}
                      onCheckedChange={() => handleToggle(hotel.id, hotel.is_active)}
                    />
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link href={`/dashboard/hotels/${hotel.id}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <DeleteHotelDialog
                        hotel={hotel}
                        onDelete={handleDelete}
                        isPending={isPending}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
              <span>Showing {from}–{to} of {totalCount} hotel{totalCount !== 1 ? "s" : ""}</span>
            </div>
            <Pagination currentPage={currentPage} totalPages={totalPages} buildHref={buildHref} />
          </div>
        </div>
      )}
    </div>
  );
}
