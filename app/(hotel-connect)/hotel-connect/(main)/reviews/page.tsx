import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import ConnectHeader from "../components/ConnectHeader";
import { Card } from "@/app/components/ui/Card";
import {
  StarIcon,
  ChatsCircleIcon,
  SmileyStickerIcon,
  CalendarCheckIcon,
  ArrowRightIcon,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { cn } from "@/app/lib/utils";

// ── Data ──────────────────────────────────────────────────────────────────────

async function getReviewsData(ownerId: string) {
  const hotels = await db.hotels.findMany({
    where: { owner_id: ownerId },
    select: { id: true, name: true, listing_status: true, thumbnail: true, city: true },
  });

  const completedBookings = hotels.length
    ? await db.bookingHotel.count({
        where: {
          hotelId: { in: hotels.map((h) => h.id) },
          booking: { status: "COMPLETED" },
        },
      })
    : 0;

  return { hotels, completedBookings };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StarRow({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-xs text-neutral-500 w-12 text-right shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-amber-400 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-neutral-400 w-4 shrink-0">{count}</span>
    </div>
  );
}

function ReviewCardSkeleton() {
  return (
    <div className="p-4 rounded-xl border border-neutral-100 bg-neutral-50 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="size-9 rounded-full bg-neutral-200" />
        <div className="space-y-1.5 flex-1">
          <div className="h-3 w-24 bg-neutral-200 rounded-full" />
          <div className="h-2.5 w-16 bg-neutral-200 rounded-full" />
        </div>
        <div className="flex gap-0.5">
          {[1,2,3,4,5].map((i) => (
            <div key={i} className="size-3 rounded bg-neutral-200" />
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="h-2.5 w-full bg-neutral-200 rounded-full" />
        <div className="h-2.5 w-4/5 bg-neutral-200 rounded-full" />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ReviewsPage() {
  const session = await hotelConnectAuth();
  const ownerId = session!.user.id;

  const { hotels, completedBookings } = await getReviewsData(ownerId);
  const hasProperties = hotels.length > 0;

  return (
    <>
      <ConnectHeader title="Reviews" />

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-5xl mx-auto w-full space-y-6">

          {/* Overall rating (empty) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            {/* Big rating display */}
            <Card variant="elevated" radius="md" className="sm:col-span-1">
              <div className="p-6 flex flex-col items-center justify-center text-center gap-2">
                <p className="text-5xl font-bold text-neutral-900">—</p>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <StarIcon key={i} size={16} weight="regular" className="text-neutral-200" />
                  ))}
                </div>
                <p className="text-xs text-neutral-400 mt-1">0 reviews</p>
              </div>
            </Card>

            {/* Star breakdown */}
            <Card variant="elevated" radius="md" className="sm:col-span-2">
              <div className="p-5 space-y-3">
                <h3 className="text-sm font-semibold text-neutral-700 mb-3">Rating Breakdown</h3>
                {["5 stars", "4 stars", "3 stars", "2 stars", "1 star"].map((label) => (
                  <StarRow key={label} label={label} count={0} total={0} />
                ))}
              </div>
            </Card>
          </div>

          {/* Reviews section */}
          <Card variant="elevated" radius="md" className="overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100">
              <h3 className="text-sm font-semibold text-neutral-700">Guest Reviews</h3>
              <span className="text-xs text-neutral-400">0 total</span>
            </div>

            {/* Empty state */}
            <div className="py-14 text-center px-6">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
                <ChatsCircleIcon size={30} weight="duotone" className="text-amber-400" />
              </div>
              <h3 className="text-base font-semibold text-neutral-800 mb-2">No reviews yet</h3>
              <p className="text-sm text-neutral-500 max-w-sm mx-auto leading-relaxed">
                Reviews from guests will appear here once they complete their stay and submit feedback on DreamsYatri.
              </p>

              {/* What's coming */}
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto text-left">
                {[
                  {
                    icon: SmileyStickerIcon,
                    title: "Verified Reviews",
                    desc: "Only guests who completed a booking can leave a review.",
                  },
                  {
                    icon: StarIcon,
                    title: "Star Ratings",
                    desc: "Guests rate cleanliness, service, location, and value.",
                  },
                  {
                    icon: ChatsCircleIcon,
                    title: "Reply to Guests",
                    desc: "Respond publicly to reviews to build guest trust.",
                  },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="bg-neutral-50 rounded-xl p-3.5 border border-neutral-100">
                    <div className="w-8 h-8 rounded-lg bg-white border border-neutral-100 flex items-center justify-center mb-2">
                      <Icon size={15} weight="duotone" className="text-neutral-400" />
                    </div>
                    <p className="text-xs font-semibold text-neutral-700 mb-0.5">{title}</p>
                    <p className="text-[11px] text-neutral-400 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>

              {/* Skeleton preview of what reviews will look like */}
              {hasProperties && completedBookings > 0 && (
                <div className="mt-8 space-y-3 max-w-md mx-auto">
                  <p className="text-xs text-neutral-400 text-left font-medium mb-3">
                    Preview — {completedBookings} completed stay{completedBookings !== 1 ? "s" : ""} eligible for review
                  </p>
                  <ReviewCardSkeleton />
                  <ReviewCardSkeleton />
                </div>
              )}
            </div>
          </Card>

          {/* Tip card */}
          {hasProperties && (
            <Card variant="elevated" radius="md">
              <div className="p-5 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0 mt-0.5">
                  <CalendarCheckIcon size={17} weight="fill" className="text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-neutral-800">How to get more reviews</p>
                  <p className="text-sm text-neutral-500 mt-1 leading-relaxed">
                    Ensure every guest has a great experience. After check-out, DreamsYatri automatically
                    sends a review request email. The more bookings you complete, the more reviews you&apos;ll receive.
                  </p>
                </div>
                <Link
                  href="/hotel-connect/bookings?tab=completed"
                  className="shrink-0 flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors whitespace-nowrap mt-0.5"
                >
                  View completed
                  <ArrowRightIcon size={11} weight="bold" />
                </Link>
              </div>
            </Card>
          )}

        </div>
      </div>
    </>
  );
}
