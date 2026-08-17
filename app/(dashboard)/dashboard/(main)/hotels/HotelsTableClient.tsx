"use client";

import { useEffect, useState, useTransition } from "react";
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
import { Hotel, BedDouble, ImageIcon, Trash2, Pencil, SearchIcon, Loader2, Navigation } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  toggleHotelActive, deleteHotel, updateHotelSeo, getHotelHistory,
  type HotelApprovalFilter,
} from "./actions";
import { ApprovalBadge } from "../hotel-approvals/ApprovalBadge";
import { TableFilters } from "../components/dashboard/Tablefilters";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { CATEGORIES, STAY_TYPES } from "./constants";
import { TableEmptyState } from "../components/dashboard/TableEmptyState";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../components/ui/sheet";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { HistorySheet } from "../components/dashboard/HistorySheet";
import { LocationSearchSelect } from "../components/location/LocationSearchSelect";
import type { LocationValue } from "../components/location/location.types";
// ── Constants ─────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(c => [c.value, c.label])
);

const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

// ── Types ─────────────────────────────────────────────────────────────────

type Destination = { id: number; name: string };
type NearSort = "distance" | "price";
type NearLocation = { id: string; name: string; type: string; lat: number; lng: number };
type Uploader = { id: string; name: string };

type HotelItem = {
  id: number;
  name: string;
  slug: string;
  thumbnail: string | null;
  category: string | null;
  stay_type: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  meta_title: string | null;
  meta_desc: string | null;
  location: { name: string; city: { name: string } | null; state: { name: string } | null; country: { name: string } | null } | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
  approval_status: string;
  approval_notes: string | null;
  approval_flags: string[];
  approval_reviewed_at: Date | null;
  approval_reviewed_by_id: string | null;
  destination: { id: number; name: string } | null;
  _count: {
    hotelRooms: number;
    images: number;
    packageBookings: number;
  };
  /** Only set in "near a location" mode — see getHotels. */
  distanceKm?: number | null;
  priceFrom?:  number | null;
};

// ── Main Component ────────────────────────────────────────────────────────

export function HotelsTableClient({
  hotels: initialHotels,
  memberNames,
  destinations,
  uploaders,
  totalCount,
  limit,
  currentPage,
  search,
  destination,
  category,
  status,
  approval,
  near,
  nearSort,
  uploadedBy,
  stayType,
}: {
  hotels: HotelItem[];
  memberNames: Record<string, string>;
  destinations: Destination[];
  uploaders: Uploader[];
  totalCount: number;
  limit: number;
  currentPage: number;
  search: string;
  destination: number | "all";
  category: string | "all";
  status: "active" | "inactive" | "all";
  approval: HotelApprovalFilter;
  near: NearLocation | null;
  nearSort: NearSort;
  uploadedBy: string;
  stayType: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [hotels, setHotels] = useState(initialHotels);
  useEffect(() => { setHotels(initialHotels); }, [initialHotels]);


  const [deleteTarget, setDeleteTarget] = useState<HotelItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [seoTarget,    setSeoTarget]    = useState<HotelItem | null>(null);
  const [seoTitle,     setSeoTitle]     = useState("");
  const [seoDesc,      setSeoDesc]      = useState("");
  const [seoSaving,    setSeoSaving]    = useState(false);

  // ── URL helpers ───────────────────────────────────────────────────────

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all" || value === "") params.delete(key);
    else params.set(key, value);
    params.delete("page");
    startTransition(() => router.replace(`?${params.toString()}`));
  }

  // Text search and "near a location" are two different ways of finding the
  // same hotel — whichever the exec touches most recently wins, rather than
  // trying to combine a typed name with a distance ranking.
  function handleSearch(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("search", value); else params.delete("search");
    params.delete("nearLat"); params.delete("nearLng");
    params.delete("nearName"); params.delete("nearId"); params.delete("nearType");
    params.delete("page");
    startTransition(() => router.replace(`?${params.toString()}`));
  }

  function handleNearChange(loc: LocationValue | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (loc && loc.latitude != null && loc.longitude != null) {
      params.set("nearLat", String(loc.latitude));
      params.set("nearLng", String(loc.longitude));
      params.set("nearName", loc.name);
      params.set("nearId", loc.id);
      params.set("nearType", loc.type);
      params.delete("search");
    } else {
      params.delete("nearLat"); params.delete("nearLng");
      params.delete("nearName"); params.delete("nearId"); params.delete("nearType");
    }
    params.delete("page");
    startTransition(() => router.replace(`?${params.toString()}`));
  }

  const nearValue: LocationValue | null = near ? {
    id: near.id, name: near.name, type: near.type as LocationValue["type"],
    breadcrumb: near.name, slug: "", latitude: near.lat, longitude: near.lng,
  } : null;

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

  function openSeo(hotel: HotelItem) {
    setSeoTarget(hotel);
    setSeoTitle(hotel.meta_title ?? "");
    setSeoDesc(hotel.meta_desc ?? "");
  }

  async function handleSeoSave() {
    if (!seoTarget) return;
    setSeoSaving(true);
    const fd = new FormData();
    fd.append("meta_title", seoTitle);
    fd.append("meta_desc",  seoDesc);
    const result = await updateHotelSeo(seoTarget.id, { success: false, message: "" }, fd);
    setSeoSaving(false);
    if (result.success) {
      setHotels(prev => prev.map(h => h.id === seoTarget.id ? { ...h, meta_title: seoTitle || null, meta_desc: seoDesc || null } : h));
      toast.success("SEO updated");
      setSeoTarget(null);
    } else {
      toast.error(result.message);
    }
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
      sortKey: (h) => h.name?.toLowerCase() ?? "",
      cell: (h) => (
        <div className="flex items-center gap-3">
          {h.thumbnail ? (
            <Image
              src={`${base}/${h.thumbnail}`}
              alt={h.name}
              width={0}
              height={0}
              sizes="80px"
              className="h-auto max-h-12 w-auto max-w-20 rounded-lg shrink-0 border"
            />
          ) : (
            <div className="h-12 w-16 rounded-lg bg-muted border flex items-center justify-center shrink-0">
              <Hotel className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <div>
            <p className="font-medium text-sm">{h.name}</p>
            {h.stay_type && <p className="text-xs text-muted-foreground">{h.stay_type}</p>}
            {(() => {
              const city    = h.location?.city?.name    ?? h.city;
              const state   = h.location?.state?.name   ?? h.state;
              const country = h.location?.country?.name ?? h.country;
              const parts   = [city, state, country].filter(Boolean);
              return parts.length > 0 ? (
                <p className="text-xs text-muted-foreground/70">{parts.join(", ")}</p>
              ) : null;
            })()}
          </div>
        </div>
      ),
    },
    {
      header: "Destination",
      sortKey: (h) => h.destination?.name?.toLowerCase() ?? "",
      cell: (h) => h.destination ? <Badge variant="secondary" className="text-xs bg-dashboard-primary/10 text-dashboard-primary">{h.destination.name}</Badge> : <span className="text-muted-foreground text-xs">—</span>,
    },
    ...(near ? [{
      header: "Distance",
      align: "center" as const,
      width: "w-[130px]",
      sortKey: (h: HotelItem) => h.distanceKm ?? Infinity,
      cell: (h: HotelItem) => (
        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
            <Navigation className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            {h.distanceKm != null ? `${h.distanceKm} km` : "—"}
          </div>
          <span className="text-[10px] text-muted-foreground/70">
            {h.priceFrom != null ? `from ₹${h.priceFrom.toLocaleString("en-IN")}` : "no priced room"}
          </span>
        </div>
      ),
    }] : []),
    {
      header: "Category",
      sortKey: (h) => h.category?.toLowerCase() ?? "",
      cell: (h) => (
        <span className="text-sm text-muted-foreground">
          {CATEGORY_LABELS[h.category ?? ""] ?? h.category ?? "—"}
        </span>
      ),
    },
    {
      header: "Rooms",
      align: "center",
      sortKey: (h) => h._count.hotelRooms ?? 0,
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
      // Manager sign-off, not visibility: an "Awaiting review" hotel is still
      // live and bookable. Review happens in /dashboard/hotel-approvals.
      header: "Approval",
      sortKey: (h) => h.approval_status,
      cell: (h) => (
        <Link
          href={`/dashboard/hotel-approvals/${h.id}`}
          title={h.approval_notes ?? "Open the approval review"}
          className="inline-flex flex-col gap-0.5"
        >
          <ApprovalBadge status={h.approval_status} className="hover:opacity-80 transition-opacity" />
          {h.approval_reviewed_at && (
            <span className="text-[11px] text-muted-foreground">
              {h.approval_reviewed_by_id ? (memberNames[h.approval_reviewed_by_id] ?? "—") : "—"}
            </span>
          )}
        </Link>
      ),
    },
    {
      header: "Created By",
      sortKey: (h) => new Date(h.created_at).getTime(),
      cell: (h) => (
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-foreground/80 truncate max-w-30">
            {h.created_by ? (memberNames[h.created_by] ?? h.created_by) : "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(h.created_at), { addSuffix: true })}
          </p>
        </div>
      ),
    },
    {
      header: "Actions",
      align: "right",
      width: "w-[150px]",
      cell: (h) => (
        <div className="flex items-center justify-end gap-1">
          <HistorySheet
            id={h.id}
            title={h.name}
            entityLabel="hotel"
            fetchHistory={getHotelHistory}
            createdBy={h.created_by ? (memberNames[h.created_by] ?? h.created_by) : null}
            createdAt={h.created_at}
            updatedBy={h.updated_by ? (memberNames[h.updated_by] ?? h.updated_by) : null}
            updatedAt={h.updated_at}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Edit SEO"
            onClick={() => openSeo(h)}
          >
            <SearchIcon className="h-3.5 w-3.5" />
          </Button>
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
          search={search}
          onSearchChange={handleSearch}
          searchPlaceholder="Search by name, city, state, country…"
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
              value: stayType === "all" ? "all" : stayType,
              onChange: (v) => updateParam("stayType", v),
              placeholder: "All Star Ratings",
              width: "w-40",
              options: STAY_TYPES.map(s => ({ label: s, value: s })),
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
            {
              value: approval,
              onChange: (v) => updateParam("approval", v),
              placeholder: "All Approvals",
              width: "w-44",
              options: [
                { label: "Awaiting review", value: "pending" },
                { label: "Approved", value: "approved" },
                { label: "Changes requested", value: "changes" },
              ],
            },
            ...(near ? [{
              value: nearSort,
              onChange: (v: string) => updateParam("nearSort", v),
              placeholder: "Nearest first",
              width: "w-40",
              allValue: "distance",
              options: [
                { label: "Cheapest first", value: "price" },
              ],
            }] : []),
            ...(uploaders.length > 0 ? [{
              value: uploadedBy,
              onChange: (v: string) => updateParam("uploadedBy", v),
              placeholder: "Uploaded by anyone",
              width: "w-48",
              options: uploaders.map((u) => ({ label: u.name, value: u.id })),
            }] : []),
          ]}
        />
        {/* Proximity search — picks any mapped location and ranks hotels by
           distance from it, instead of matching a typed name. Same picker
           and semantics as hotel-inventory's "near a location" search. */}
        <LocationSearchSelect
          value={nearValue}
          onChange={handleNearChange}
          placeholder="Or search hotels near a location…"
          className="w-full sm:w-72 shrink-0"
          hideRecent
        />
        <div className="flex items-center gap-2 shrink-0">
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

      {near && (
        <div className="flex items-center gap-2 rounded-lg border border-dashboard-primary/30 bg-dashboard-primary/5 px-3 py-2 text-xs text-dashboard-base-content/80">
          <Navigation className="h-3.5 w-3.5 shrink-0 text-dashboard-primary" />
          Showing hotels with a mapped location near <span className="font-medium">{near.name}</span>, {nearSort === "price" ? "cheapest first" : "nearest first"}.
        </div>
      )}

      {/* Table or empty state */}
      {hotels.length === 0 ? (

        <TableEmptyState
          title="No hotels found"
          description={
            near
              ? "No hotels with a mapped location were found near this place yet."
              : (totalCount === 0 ? 'Click "Add Hotel" to get started' : "Try adjusting your filters")
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={hotels}
          rowKey={h => h.id}
          pagination={{ currentPage, totalPages, buildHref, label }}
        />
      )}

      {/* SEO sidebar */}
      <Sheet open={!!seoTarget} onOpenChange={open => !open && setSeoTarget(null)}>
        <SheetContent className="w-[420px] sm:w-[480px] flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 py-5 border-b">
            <SheetTitle className="text-base">SEO — {seoTarget?.name}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Meta Title</Label>
                <span className={`text-xs ${seoTitle.length > 60 ? "text-destructive" : "text-muted-foreground"}`}>
                  {seoTitle.length}/60
                </span>
              </div>
              <Input
                value={seoTitle}
                onChange={e => setSeoTitle(e.target.value)}
                placeholder={`${seoTarget?.name ?? ""} | Dreams Yatri`}
                maxLength={70}
              />
              <p className="text-xs text-muted-foreground">Keep under 60 characters for Google</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Meta Description</Label>
                <span className={`text-xs ${seoDesc.length > 160 ? "text-destructive" : "text-muted-foreground"}`}>
                  {seoDesc.length}/160
                </span>
              </div>
              <Textarea
                value={seoDesc}
                onChange={e => setSeoDesc(e.target.value)}
                placeholder="A brief description shown in Google search results..."
                rows={5}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">Keep under 160 characters for Google</p>
            </div>
          </div>
          <div className="px-6 py-4 border-t flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSeoTarget(null)} disabled={seoSaving}>
              Cancel
            </Button>
            <Button onClick={handleSeoSave} disabled={seoSaving} className="min-w-24 bg-dashboard-primary">
              {seoSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : "Save SEO"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

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
