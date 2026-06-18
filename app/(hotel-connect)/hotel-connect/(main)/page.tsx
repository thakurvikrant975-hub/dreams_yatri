import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import ConnectHeader from "./components/ConnectHeader";
import Link from "next/link";
import {
  Buildings,
  CalendarBlank,
  CurrencyInr,
  ArrowRight,
  PlusCircle,
  Star,
  Clock,
} from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/app/components/ui/Card";

async function getOwnerStats(ownerId: string) {
  const hotels = await db.hotels.findMany({
    where: { owner_id: ownerId },
    select: {
      id: true,
      name: true,
      listing_status: true,
      is_active: true,
      city: true,
      thumbnail: true,
    },
    orderBy: { created_at: "desc" },
  });

  const liveCount    = hotels.filter((h) => h.listing_status === "LIVE").length;
  const draftCount   = hotels.filter((h) => h.listing_status === "DRAFT").length;
  const pendingCount = hotels.filter(
    (h) => h.listing_status === "SUBMITTED" || h.listing_status === "UNDER_REVIEW"
  ).length;

  return { hotels, liveCount, draftCount, pendingCount };
}

const statusConfig: Record<string, { label: string; className: string }> = {
  DRAFT:        { label: "Draft",        className: "bg-neutral-100 text-neutral-600" },
  SUBMITTED:    { label: "Submitted",    className: "bg-blue-50 text-blue-700" },
  UNDER_REVIEW: { label: "Under Review", className: "bg-amber-50 text-amber-700" },
  APPROVED:     { label: "Approved",     className: "bg-emerald-50 text-emerald-700" },
  REJECTED:     { label: "Rejected",     className: "bg-red-50 text-red-700" },
  LIVE:         { label: "Live",         className: "bg-emerald-100 text-emerald-800" },
};

export default async function HotelConnectDashboard() {
  const session = await hotelConnectAuth();
  const ownerId  = session!.user.id;
  const name     = session!.user.name ?? "Partner";
  const firstName = name.split(" ")[0];

  const { hotels, liveCount, draftCount, pendingCount } = await getOwnerStats(ownerId);
  const hasHotels = hotels.length > 0;

  return (
    <>
      <ConnectHeader title="Dashboard" />

      <div className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-8">

        {/* Greeting */}
        <div>
          <h2 className="text-xl font-bold text-neutral-900 tracking-tight">
            Welcome back, {firstName}
          </h2>
          <p className="text-sm text-neutral-500 mt-0.5">
            {hasHotels
              ? "Here's an overview of your properties on DreamsYatri."
              : "Get started by listing your first property on DreamsYatri."}
          </p>
        </div>

        {/* Stats strip */}
        {hasHotels && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Live",         value: liveCount,      icon: Buildings,    color: "text-emerald-600", bg: "bg-emerald-50" },
              { label: "Under Review", value: pendingCount,   icon: Clock,        color: "text-amber-600",   bg: "bg-amber-50"   },
              { label: "Drafts",       value: draftCount,     icon: Star,         color: "text-blue-600",    bg: "bg-blue-50"    },
              { label: "Total",        value: hotels.length,  icon: CalendarBlank, color: "text-violet-600", bg: "bg-violet-50"  },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <Card key={label} variant="elevated" radius="md">
                <div className="p-4 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
                    <Icon size={17} weight="fill" className={color} />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-neutral-900 leading-none mb-0.5">{value}</p>
                    <p className="text-xs text-neutral-500">{label}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!hasHotels && (
          <Card variant="elevated" radius="md" className="border-dashed">
            <div className="py-16 text-center">
              <div className="mx-auto w-14 h-14 rounded-xl bg-primary-500 flex items-center justify-center mb-4">
                <Buildings size={26} weight="fill" color="white" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 mb-1.5">
                List your first property
              </h3>
              <p className="text-sm text-neutral-500 mb-6 max-w-sm mx-auto leading-relaxed">
                Add your hotel, resort, or homestay to start receiving bookings
                from DreamsYatri travellers. It only takes a few minutes.
              </p>
              <Link
                href="/hotel-connect/properties/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 transition-colors"
              >
                <PlusCircle size={16} weight="fill" />
                Add Property
              </Link>
            </div>
          </Card>
        )}

        {/* Property list */}
        {hasHotels && (
          <Card variant="elevated" radius="md" className="overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100">
              <h3 className="text-sm font-semibold text-neutral-700">Your Properties</h3>
              <Link
                href="/hotel-connect/properties/new"
                className="flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors"
              >
                <PlusCircle size={13} weight="fill" />
                Add New
              </Link>
            </div>

            <div className="divide-y divide-neutral-50">
              {hotels.map((hotel) => {
                const s = statusConfig[hotel.listing_status] ?? statusConfig.DRAFT;
                return (
                  <Link
                    key={hotel.id}
                    href={`/hotel-connect/properties/${hotel.id}/edit`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-neutral-50/70 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-primary-50 flex items-center justify-center shrink-0">
                      {hotel.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={hotel.thumbnail} alt={hotel.name} className="w-full h-full object-cover" />
                      ) : (
                        <Buildings size={18} weight="fill" className="text-primary-300" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-neutral-800 truncate">{hotel.name}</p>
                      <p className="text-xs text-neutral-400 truncate">{hotel.city ?? "Location not set"}</p>
                    </div>

                    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${s.className}`}>
                      {s.label}
                    </span>

                    <ArrowRight size={14} className="text-neutral-300 group-hover:text-primary-500 transition-colors shrink-0" />
                  </Link>
                );
              })}
            </div>
          </Card>
        )}

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              href: "/hotel-connect/bookings",
              icon: CalendarBlank,
              label: "Bookings",
              desc: "Upcoming and past reservations",
              color: "text-blue-500",
              bg: "bg-blue-50",
            },
            {
              href: "/hotel-connect/revenue",
              icon: CurrencyInr,
              label: "Revenue",
              desc: "Track earnings and payout history",
              color: "text-emerald-500",
              bg: "bg-emerald-50",
            },
            {
              href: "/hotel-connect/reviews",
              icon: Star,
              label: "Reviews",
              desc: "Read and respond to guest feedback",
              color: "text-amber-500",
              bg: "bg-amber-50",
            },
          ].map(({ href, icon: Icon, label, desc, color, bg }) => (
            <Link key={href} href={href}>
              <Card variant="elevated" radius="md" hoverable className="h-full">
                <div className="p-4">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${bg}`}>
                    <Icon size={17} weight="fill" className={color} />
                  </div>
                  <p className="text-sm font-semibold text-neutral-800 mb-0.5">{label}</p>
                  <p className="text-xs text-neutral-400 leading-relaxed">{desc}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>

      </div>
    </>
  );
}
