import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import ConnectHeader from "../components/ConnectHeader";
import { Card } from "@/app/components/ui/Card";
import Link from "next/link";
import Image from "next/image";
import {
  BuildingsIcon,
  PlusCircleIcon,
  ArrowRightIcon,
  PencilSimpleIcon,
  MapPinIcon,
  StarIcon,
  DoorIcon,
  CheckCircleIcon,
  ClockIcon,
  ProhibitIcon,
  NotePencilIcon,
  CalendarBlankIcon,
} from "@phosphor-icons/react/dist/ssr";
import { HotelListingStatus, PropertySubType } from "@/app/generated/prisma";
import { cn } from "@/app/lib/utils";

// ── Types & helpers ───────────────────────────────────────────────────────────

type PropertyCard = {
  id: number;
  name: string;
  slug: string;
  listing_status: HotelListingStatus;
  city: string | null;
  state: string | null;
  coverImage: string | null; // thumbnail field OR first uploaded photo
  property_sub_type: PropertySubType | null;
  star_rating: number | null;
  roomCount: number;
};

const STATUS_CONFIG: Record<
  HotelListingStatus,
  { label: string; icon: React.ElementType; badgeBg: string; badgeText: string }
> = {
  DRAFT:        { label: "Draft",        icon: NotePencilIcon,    badgeBg: "bg-white/75 ring-1 ring-inset ring-neutral-200/80 shadow-sm shadow-neutral-200/80", badgeText: "text-neutral-500/85" },
  SUBMITTED:    { label: "Submitted",    icon: ClockIcon,         badgeBg: "bg-blue-50/75",     badgeText: "text-blue-600/90"    },
  UNDER_REVIEW: { label: "Under Review", icon: ClockIcon,         badgeBg: "bg-amber-50/75",    badgeText: "text-amber-600/90"   },
  APPROVED:     { label: "Approved",     icon: CheckCircleIcon,   badgeBg: "bg-emerald-50/75",  badgeText: "text-emerald-600" },
  LIVE:         { label: "Live",         icon: CheckCircleIcon,   badgeBg: "bg-emerald-100/75", badgeText: "text-emerald-600" },
  REJECTED:     { label: "Rejected",     icon: ProhibitIcon,      badgeBg: "bg-error-50/75",      badgeText: "text-error-600"     },
};

function subTypeLabel(st: PropertySubType | null) {
  if (!st) return "Property";
  return st.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const FILTER_TABS = [
  { id: "all",     label: "All" },
  { id: "live",    label: "Live" },
  { id: "pending", label: "Under Review" },
  { id: "draft",   label: "Drafts" },
] as const;

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await hotelConnectAuth();
  const ownerId = session!.user.id;
  const { tab = "all" } = await searchParams;

  const raw = await db.hotels.findMany({
    where: { owner_id: ownerId },
    select: {
      id: true, name: true, slug: true, listing_status: true,
      city: true, state: true, thumbnail: true,
      property_sub_type: true, star_rating: true,
      _count: { select: { hotelRooms: true } },
      images: {
        orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
        take: 1,
        select: { url: true, thumbnail: true },
      },
    },
    orderBy: { created_at: "desc" },
  });

  const all: PropertyCard[] = raw.map((h) => ({
    id:                h.id,
    name:              h.name,
    slug:              h.slug,
    listing_status:    h.listing_status,
    city:              h.city,
    state:             h.state,
    coverImage:        h.thumbnail ?? h.images[0]?.thumbnail ?? h.images[0]?.url ?? null,
    property_sub_type: h.property_sub_type,
    star_rating:       h.star_rating,
    roomCount:         h._count.hotelRooms,
  }));

  const counts = {
    all:     all.length,
    live:    all.filter((h) => h.listing_status === "LIVE").length,
    pending: all.filter((h) => ["SUBMITTED", "UNDER_REVIEW"].includes(h.listing_status)).length,
    draft:   all.filter((h) => ["DRAFT", "REJECTED"].includes(h.listing_status)).length,
  };

  const filtered =
    tab === "live"    ? all.filter((h) => h.listing_status === "LIVE") :
    tab === "pending" ? all.filter((h) => ["SUBMITTED", "UNDER_REVIEW"].includes(h.listing_status)) :
    tab === "draft"   ? all.filter((h) => ["DRAFT", "REJECTED"].includes(h.listing_status)) :
    all;

  return (
    <>
      <ConnectHeader title="My Properties" />

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 mx-auto w-full space-y-5">

          {/* Top bar */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">
                {all.length} Propert{all.length !== 1 ? "ies" : "y"}
              </h2>
              <p className="text-sm text-neutral-400 mt-0.5">
                {counts.live} live · {counts.pending} under review · {counts.draft} draft
              </p>
            </div>
            <Link
              href="/hotel-connect/properties/new"
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-white bg-linear-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 transition-colors"
            >
              <PlusCircleIcon size={20} weight="fill" />
              Add Property
            </Link>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 bg-white border border-neutral-200 rounded-xl p-1 overflow-x-auto scrollbar-none">
            {FILTER_TABS.map((t) => (
              <Link
                key={t.id}
                href={`?tab=${t.id}`}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                  tab === t.id
                    ? "bg-primary-500 text-white shadow-sm"
                    : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800",
                )}
              >
                {t.label}
                <span
                  className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-4.5 text-center leading-none",
                    tab === t.id ? "bg-white/20 text-white" : "bg-neutral-100 text-neutral-500",
                  )}
                >
                  {counts[t.id as keyof typeof counts]}
                </span>
              </Link>
            ))}
          </div>

          {/* Property grid */}
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((hotel) => {
                const cfg = STATUS_CONFIG[hotel.listing_status];
                const StatusIcon = cfg.icon;
                return (
                  <Card key={hotel.id} variant="elevated" radius="md" className="overflow-hidden group p-px">
                    {/* Thumbnail */}
                    <div className="relative h-36 bg-neutral-100 overflow-hidden rounded-t-[inherit]">
                      {hotel.coverImage ? (
                        <Image
                          src={hotel.coverImage}
                          alt={hotel.name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="(max-width: 640px) 100vw, 50vw"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BuildingsIcon size={42} weight="duotone" className="text-neutral-400/50" />
                        </div>
                      )}
                      {/* Status badge */}
                      <span
                        className={cn(
                          "absolute top-2.5 right-2.5 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full",
                          cfg.badgeBg, cfg.badgeText,
                        )}
                      >
                        <StatusIcon size={12} weight="fill" className="opacity-85" />
                        {cfg.label}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-neutral-800 truncate">{hotel.name}</p>
                          <p className="text-xs text-neutral-400 mt-0.5">{subTypeLabel(hotel.property_sub_type)}</p>
                        </div>
                        {hotel.star_rating != null && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            {Array.from({ length: hotel.star_rating }).map((_, i) => (
                              <StarIcon key={i} size={11} weight="fill" className="text-amber-400" />
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-neutral-400 mb-4">
                        {(hotel.city || hotel.state) && (
                          <span className="flex items-center gap-1">
                            <MapPinIcon size={14} weight="fill" className="text-neutral-300" />
                            {[hotel.city, hotel.state].filter(Boolean).join(", ")}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <DoorIcon size={14} weight="bold" className="text-neutral-300" />
                          {hotel.roomCount} room{hotel.roomCount !== 1 ? "s" : ""}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/hotel-connect/properties/${hotel.id}/edit`}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-primary-50 text-primary-500 hover:bg-white transition-colors ring-1 ring-inset ring-primary-200"
                        >
                          <PencilSimpleIcon size={14} weight="fill" />
                          Edit Listing
                        </Link>
                        <Link
                          href={`/hotel-connect/properties/${hotel.id}/calendar`}
                          title="Rates & Availability"
                          className="flex items-center gap-1 py-2 px-3 rounded-lg text-xs font-semibold border border-neutral-200 text-neutral-600/90 hover:bg-neutral-50 transition-colors"
                        >
                          <CalendarBlankIcon size={13} weight="fill" className="text-neutral-400" />
                          Rates
                        </Link>
                        {hotel.listing_status === "LIVE" && (
                          <Link
                            href={`/hotels/${hotel.slug}`}
                            target="_blank"
                            title="View live page"
                            className="flex items-center gap-1 py-2 px-3 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors ring-1 ring-inset ring-emerald-200"
                          >
                            <ArrowRightIcon size={12} weight="bold" />
                            Live
                          </Link>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            /* Empty state */
            <Card variant="elevated" radius="md" className="border-dashed">
              <div className="py-14 text-center">
                <div className="mx-auto w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center mb-3">
                  <BuildingsIcon size={22} weight="duotone" className="text-neutral-300" />
                </div>
                <p className="text-sm font-semibold text-neutral-700 mb-1">
                  {tab === "all" ? "No properties yet" : `No ${tab} properties`}
                </p>
                <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                  {tab === "all"
                    ? "Get started by listing your first property to receive bookings."
                    : "No properties match this filter right now."}
                </p>
                {tab === "all" && (
                  <Link
                    href="/hotel-connect/properties/new"
                    className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-primary-500 hover:bg-primary-600 transition-colors"
                  >
                    <PlusCircleIcon size={15} weight="fill" />
                    Add Property
                  </Link>
                )}
              </div>
            </Card>
          )}

        </div>
      </div>
    </>
  );
}
