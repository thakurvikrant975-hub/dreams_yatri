import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import ConnectHeader from "./components/ConnectHeader";
import Link from "next/link";
import {
  BuildingsIcon,
  CalendarBlankIcon,
  CurrencyInrIcon,
  ArrowRightIcon,
  PlusCircleIcon,
  ClockIcon,
  CheckCircleIcon,
  WarningCircleIcon,
  CalendarCheckIcon,
  TrendUpIcon,
  HouseLineIcon,
} from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/app/components/ui/Card";
import { BookingStatus } from "@/app/generated/prisma";
import { cn } from "@/app/lib/utils";

// ── Data ──────────────────────────────────────────────────────────────────────

async function getDashboardData(ownerId: string) {
  const hotels = await db.hotels.findMany({
    where: { owner_id: ownerId },
    select: {
      id: true, name: true, listing_status: true,
      city: true, thumbnail: true, property_sub_type: true,
    },
    orderBy: { created_at: "desc" },
  });

  const hotelIds = hotels.map((h) => h.id);

  if (!hotelIds.length) {
    return {
      hotels,
      stats: { liveCount: 0, pendingCount: 0, thisMonthBookings: 0, upcomingCheckins: 0, thisMonthRevenue: 0 },
      recentBookings: [],
      alerts: [],
    };
  }

  // Get booking IDs for this owner's hotels
  const links = await db.bookingHotel.findMany({
    where: { hotelId: { in: hotelIds } },
    select: { bookingId: true },
    distinct: ["bookingId"],
  });
  const bookingIds = links.map((l) => l.bookingId);

  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekEnd    = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // All-booking stats
  const allBookings = bookingIds.length
    ? await db.booking.findMany({
        where: { id: { in: bookingIds } },
        select: { status: true, totalAmount: true, createdAt: true },
      })
    : [];

  const thisMonthBookings = allBookings.filter(
    (b) => new Date(b.createdAt) >= monthStart,
  ).length;

  const thisMonthRevenue = allBookings
    .filter(
      (b) =>
        new Date(b.createdAt) >= monthStart &&
        !(["CANCELLED", "REJECTED"] as string[]).includes(b.status),
    )
    .reduce((sum, b) => sum + Number(b.totalAmount), 0);

  const upcomingCheckins = await db.bookingHotel.count({
    where: {
      hotelId: { in: hotelIds },
      checkInDate: { gte: now, lte: weekEnd },
    },
  });

  // Recent bookings (last 4)
  const recentBookings = bookingIds.length
    ? await db.booking.findMany({
        where: { id: { in: bookingIds } },
        select: {
          id: true, bookingNumber: true, status: true, totalAmount: true,
          travellersList: { where: { isLead: true }, take: 1, select: { fullName: true } },
          hotelBookings: {
            where: { hotelId: { in: hotelIds } },
            take: 1,
            select: { checkInDate: true, hotel: { select: { name: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 4,
      })
    : [];

  // Alerts: draft properties, rejected
  const alerts: { type: "warning" | "info"; message: string; href: string }[] = [];
  const draftCount    = hotels.filter((h) => h.listing_status === "DRAFT").length;
  const rejectedCount = hotels.filter((h) => h.listing_status === "REJECTED").length;
  if (draftCount)    alerts.push({ type: "warning", message: `${draftCount} propert${draftCount === 1 ? "y is" : "ies are"} incomplete — finish your listing to go live.`, href: "/hotel-connect/properties" });
  if (rejectedCount) alerts.push({ type: "warning", message: `${rejectedCount} propert${rejectedCount === 1 ? "y was" : "ies were"} rejected — review the feedback and resubmit.`, href: "/hotel-connect/properties" });
  if (upcomingCheckins > 0) alerts.push({ type: "info", message: `${upcomingCheckins} check-in${upcomingCheckins !== 1 ? "s" : ""} scheduled in the next 7 days.`, href: "/hotel-connect/bookings?tab=upcoming" });

  return {
    hotels,
    stats: {
      liveCount:         hotels.filter((h) => h.listing_status === "LIVE").length,
      pendingCount:      hotels.filter((h) => ["SUBMITTED", "UNDER_REVIEW"].includes(h.listing_status)).length,
      thisMonthBookings,
      thisMonthRevenue,
      upcomingCheckins,
    },
    recentBookings,
    alerts,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const BOOKING_STATUS: Partial<Record<BookingStatus, { label: string; className: string }>> = {
  UPCOMING:   { label: "Upcoming",  className: "bg-blue-50 text-blue-700"     },
  ONGOING:    { label: "Ongoing",   className: "bg-emerald-50 text-emerald-700"},
  CONFIRMED:  { label: "Confirmed", className: "bg-emerald-50 text-emerald-700"},
  COMPLETED:  { label: "Completed", className: "bg-neutral-100 text-neutral-500"},
  CANCELLED:  { label: "Cancelled", className: "bg-red-50 text-red-600"       },
  REJECTED:   { label: "Rejected",  className: "bg-red-50 text-red-600"       },
};

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

function formatShortDate(d: Date) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(d));
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function HotelConnectDashboard() {
  const session  = await hotelConnectAuth();
  const ownerId  = session!.user.id;
  const name     = session!.user.name ?? "Partner";
  const firstName = name.split(" ")[0];

  const { hotels, stats, recentBookings, alerts } = await getDashboardData(ownerId);
  const hasHotels = hotels.length > 0;

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <>
      <ConnectHeader title="Dashboard" />

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-5xl mx-auto w-full space-y-6">

          {/* Greeting */}
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-neutral-900 tracking-tight">
                {getGreeting()}, {firstName} 👋
              </h2>
              <p className="text-sm text-neutral-400 mt-0.5">{today}</p>
            </div>
            {hasHotels && (
              <Link
                href="/hotel-connect/properties/new"
                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 transition-colors"
              >
                <PlusCircleIcon size={15} weight="fill" />
                Add Property
              </Link>
            )}
          </div>

          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="space-y-2">
              {alerts.map((alert, i) => (
                <Link
                  key={i}
                  href={alert.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-opacity hover:opacity-90",
                    alert.type === "warning"
                      ? "bg-amber-50 border-amber-200 text-amber-800"
                      : "bg-blue-50 border-blue-200 text-blue-800",
                  )}
                >
                  {alert.type === "warning"
                    ? <WarningCircleIcon size={16} weight="fill" className="shrink-0 text-amber-500" />
                    : <CalendarCheckIcon size={16} weight="fill" className="shrink-0 text-blue-500" />}
                  {alert.message}
                  <ArrowRightIcon size={13} weight="bold" className="ml-auto shrink-0" />
                </Link>
              ))}
            </div>
          )}

          {/* Stats */}
          {hasHotels && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Live Properties",  value: stats.liveCount,         icon: BuildingsIcon,    color: "text-primary-600",  bg: "bg-primary-50"  },
                { label: "Upcoming Check-ins", value: stats.upcomingCheckins, icon: CalendarCheckIcon, color: "text-blue-600",     bg: "bg-blue-50"    },
                { label: "Bookings This Month", value: stats.thisMonthBookings, icon: CalendarBlankIcon, color: "text-violet-600", bg: "bg-violet-50"  },
                { label: "Month Revenue",    value: formatINR(stats.thisMonthRevenue), icon: CurrencyInrIcon, color: "text-emerald-600", bg: "bg-emerald-50" },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <Card key={label} variant="elevated" radius="md">
                  <div className="p-4 flex items-center gap-3">
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", bg)}>
                      <Icon size={17} weight="fill" className={color} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg font-bold text-neutral-900 leading-none mb-0.5 truncate">{value}</p>
                      <p className="text-xs text-neutral-500">{label}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* No hotels → onboarding card */}
          {!hasHotels && (
            <Card variant="elevated" radius="md" className="border-dashed">
              <div className="py-16 text-center">
                <div className="mx-auto w-14 h-14 rounded-xl bg-primary-500 flex items-center justify-center mb-4">
                  <BuildingsIcon size={26} weight="fill" color="white" />
                </div>
                <h3 className="text-lg font-bold text-neutral-900 mb-1.5">List your first property</h3>
                <p className="text-sm text-neutral-500 mb-6 max-w-sm mx-auto leading-relaxed">
                  Add your hotel, resort, or homestay to start receiving bookings from DreamsYatri travellers.
                </p>
                <Link
                  href="/hotel-connect/properties/new"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 transition-colors"
                >
                  <PlusCircleIcon size={16} weight="fill" />
                  Add Property
                </Link>
              </div>
            </Card>
          )}

          {/* Two-column: recent bookings + quick links */}
          {hasHotels && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Recent bookings */}
              <div className="lg:col-span-2">
                <Card variant="elevated" radius="md" className="overflow-hidden h-full">
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100">
                    <h3 className="text-sm font-semibold text-neutral-700">Recent Bookings</h3>
                    <Link href="/hotel-connect/bookings" className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1">
                      View all <ArrowRightIcon size={11} weight="bold" />
                    </Link>
                  </div>

                  {recentBookings.length > 0 ? (
                    <div className="divide-y divide-neutral-50">
                      {recentBookings.map((b) => {
                        const lead = b.travellersList[0];
                        const stay = b.hotelBookings[0];
                        const statusCfg = BOOKING_STATUS[b.status] ?? { label: b.status, className: "bg-neutral-100 text-neutral-500" };
                        const guestName = lead?.fullName ?? "Guest";
                        const initials  = guestName.split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase();
                        return (
                          <div key={b.id} className="flex items-center gap-3 px-5 py-3.5">
                            <div className="size-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-bold text-primary-600">{initials || "G"}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-neutral-800 truncate">{guestName}</p>
                              <p className="text-xs text-neutral-400 truncate">
                                {stay?.hotel?.name ?? "—"}
                                {stay?.checkInDate ? ` · ${formatShortDate(stay.checkInDate)}` : ""}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-semibold text-neutral-900">{formatINR(Number(b.totalAmount))}</p>
                              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", statusCfg.className)}>
                                {statusCfg.label}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-10 text-center">
                      <CalendarBlankIcon size={28} weight="duotone" className="text-neutral-300 mx-auto mb-2" />
                      <p className="text-sm text-neutral-400">No bookings yet</p>
                    </div>
                  )}
                </Card>
              </div>

              {/* Quick actions */}
              <div className="space-y-3">
                {[
                  { href: "/hotel-connect/bookings",         icon: CalendarBlankIcon, label: "Bookings",       desc: "View reservations",    color: "text-blue-500",    bg: "bg-blue-50"    },
                  { href: "/hotel-connect/revenue",          icon: TrendUpIcon,       label: "Revenue",        desc: "Track your earnings",  color: "text-emerald-500", bg: "bg-emerald-50" },
                  { href: "/hotel-connect/reviews",          icon: ClockIcon,         label: "Reviews",        desc: "Guest feedback",       color: "text-amber-500",   bg: "bg-amber-50"   },
                  { href: "/hotel-connect/properties",       icon: BuildingsIcon,     label: "Properties",     desc: "Manage listings",      color: "text-primary-500", bg: "bg-primary-50" },
                ].map(({ href, icon: Icon, label, desc, color, bg }) => (
                  <Link key={href} href={href}>
                    <Card variant="elevated" radius="md" hoverable>
                      <div className="flex items-center gap-3 p-4">
                        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", bg)}>
                          <Icon size={17} weight="fill" className={color} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-neutral-800">{label}</p>
                          <p className="text-xs text-neutral-400">{desc}</p>
                        </div>
                        <ArrowRightIcon size={14} className="text-neutral-300 shrink-0" />
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
