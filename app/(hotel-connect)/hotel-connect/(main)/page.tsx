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

  const liveCount   = hotels.filter((h) => h.listing_status === "LIVE").length;
  const draftCount  = hotels.filter((h) => h.listing_status === "DRAFT").length;
  const pendingCount = hotels.filter(
    (h) => h.listing_status === "SUBMITTED" || h.listing_status === "UNDER_REVIEW"
  ).length;

  return { hotels, liveCount, draftCount, pendingCount };
}

export default async function HotelConnectDashboard() {
  const session = await hotelConnectAuth();
  const ownerId = session!.user.id;
  const name = session!.user.name ?? "Partner";

  const { hotels, liveCount, draftCount, pendingCount } = await getOwnerStats(ownerId);

  const hasHotels = hotels.length > 0;
  const firstName = name.split(" ")[0];

  return (
    <>
      <ConnectHeader />
      <div className="flex-1 p-6 max-w-5xl mx-auto w-full">

        {/* Greeting */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {firstName}!
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {hasHotels
              ? "Here's an overview of your properties on DreamsYatri."
              : "Get started by listing your first property on DreamsYatri."}
          </p>
        </div>

        {/* Stats strip */}
        {hasHotels && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              {
                label: "Live Properties",
                value: liveCount,
                icon: Buildings,
                color: "text-green-600",
                bg: "bg-green-50",
              },
              {
                label: "Under Review",
                value: pendingCount,
                icon: Clock,
                color: "text-amber-600",
                bg: "bg-amber-50",
              },
              {
                label: "Drafts",
                value: draftCount,
                icon: Star,
                color: "text-blue-600",
                bg: "bg-blue-50",
              },
              {
                label: "Total Listed",
                value: hotels.length,
                icon: CalendarBlank,
                color: "text-purple-600",
                bg: "bg-purple-50",
              },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div
                key={label}
                className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}>
                  <Icon size={20} weight="fill" className={color} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state — no hotels yet */}
        {!hasHotels && (
          <div className="bg-white rounded-3xl border border-dashed border-orange-200 p-12 text-center mb-8">
            <div
              className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "linear-gradient(135deg, #f97316, #dc2626)" }}
            >
              <Buildings size={32} weight="fill" color="white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              List your first property
            </h2>
            <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto leading-relaxed">
              Add your hotel, resort, or homestay to start receiving bookings
              from DreamsYatri travellers. It only takes a few minutes.
            </p>
            <Link
              href="/hotel-connect/properties/new"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all"
              style={{
                background: "linear-gradient(135deg, #f97316, #dc2626)",
                boxShadow: "0 8px 24px rgba(249,115,22,0.3)",
              }}
            >
              <PlusCircle size={18} weight="fill" />
              Add Property
            </Link>
          </div>
        )}

        {/* Property list */}
        {hasHotels && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Your Properties</h2>
              <Link
                href="/hotel-connect/properties/new"
                className="flex items-center gap-1.5 text-xs font-semibold text-orange-500 hover:text-orange-600 transition-colors"
              >
                <PlusCircle size={14} weight="fill" />
                Add New
              </Link>
            </div>

            <div className="divide-y divide-gray-50">
              {hotels.map((hotel) => {
                const statusMap: Record<
                  string,
                  { label: string; className: string }
                > = {
                  DRAFT:        { label: "Draft",        className: "bg-gray-100 text-gray-500" },
                  SUBMITTED:    { label: "Submitted",    className: "bg-blue-100 text-blue-600" },
                  UNDER_REVIEW: { label: "Under Review", className: "bg-amber-100 text-amber-700" },
                  APPROVED:     { label: "Approved",     className: "bg-green-100 text-green-700" },
                  REJECTED:     { label: "Rejected",     className: "bg-red-100 text-red-600" },
                  LIVE:         { label: "Live",         className: "bg-emerald-100 text-emerald-700" },
                };
                const status = statusMap[hotel.listing_status] ?? statusMap.DRAFT;

                return (
                  <Link
                    key={hotel.id}
                    href={`/hotel-connect/properties/${hotel.id}/edit`}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors group"
                  >
                    {/* Thumbnail / placeholder */}
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-orange-50 flex items-center justify-center flex-shrink-0">
                      {hotel.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={hotel.thumbnail}
                          alt={hotel.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Buildings size={22} weight="fill" className="text-orange-300" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{hotel.name}</p>
                      <p className="text-xs text-gray-400 truncate">{hotel.city ?? "Location not set"}</p>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${status.className}`}>
                      {status.label}
                    </span>

                    <ArrowRight
                      size={16}
                      className="text-gray-300 group-hover:text-orange-400 transition-colors flex-shrink-0"
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              href: "/hotel-connect/bookings",
              icon: CalendarBlank,
              label: "View Bookings",
              desc: "See all your upcoming and past reservations",
              color: "text-blue-500",
              bg: "bg-blue-50",
            },
            {
              href: "/hotel-connect/revenue",
              icon: CurrencyInr,
              label: "Revenue",
              desc: "Track earnings and payout history",
              color: "text-green-500",
              bg: "bg-green-50",
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
            <Link
              key={href}
              href={href}
              className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-orange-200 hover:shadow-sm transition-all group"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${bg}`}>
                <Icon size={20} weight="fill" className={color} />
              </div>
              <p className="text-sm font-semibold text-gray-800 mb-1">{label}</p>
              <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
