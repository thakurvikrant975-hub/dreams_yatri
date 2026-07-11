import ConnectHeader from "../components/ConnectHeader";
import { Card } from "@/app/components/ui/Card";
import {
  StarIcon,
  ChatsCircleIcon,
  CalendarCheckIcon,
  ArrowRightIcon,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { cn } from "@/app/lib/utils";
import { getOwnerReviews } from "./reviews-actions";
import ReviewCard from "./ReviewCard";

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const { reviews, stats, completedBookings, hasProperties, totalPages } = await getOwnerReviews(page);

  return (
    <>
      <ConnectHeader title="Reviews" />

      <div className="flex-1 overflow-y-auto">
        <div className="p-6  mx-auto w-full space-y-6">

          {/* Overall rating */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            <Card variant="elevated" radius="md" className="sm:col-span-1">
              <div className="p-6 flex flex-col items-center justify-center text-center gap-2">
                <p className="text-5xl font-bold text-neutral-900">
                  {stats.total > 0 ? stats.average.toFixed(1) : "—"}
                </p>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <StarIcon
                      key={i}
                      size={16}
                      weight={stats.total > 0 && stats.average >= i - 0.5 ? "fill" : "regular"}
                      className={stats.total > 0 && stats.average >= i - 0.5 ? "text-amber-400" : "text-neutral-200"}
                    />
                  ))}
                </div>
                <p className="text-xs text-neutral-400 mt-1">{stats.total} review{stats.total !== 1 ? "s" : ""}</p>
              </div>
            </Card>

            <Card variant="elevated" radius="md" className="sm:col-span-2">
              <div className="p-5 space-y-3">
                <h3 className="text-sm font-semibold text-neutral-700 mb-3">Rating Breakdown</h3>
                {([5, 4, 3, 2, 1] as const).map((n) => (
                  <StarRow key={n} label={`${n} star${n !== 1 ? "s" : ""}`} count={stats.breakdown[n]} total={stats.total} />
                ))}
              </div>
            </Card>
          </div>

          {/* Reviews section */}
          <Card variant="elevated" radius="md" className="overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100">
              <h3 className="text-sm font-semibold text-neutral-700">Guest Reviews</h3>
              <span className="text-xs text-neutral-400">{stats.total} total</span>
            </div>

            {reviews.length === 0 ? (
              <div className="py-14 text-center px-6">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
                  <ChatsCircleIcon size={30} weight="duotone" className="text-amber-400" />
                </div>
                <h3 className="text-base font-semibold text-neutral-800 mb-2">No reviews yet</h3>
                <p className="text-sm text-neutral-500 max-w-sm mx-auto leading-relaxed">
                  Reviews from guests will appear here once they complete their stay and submit feedback on DreamsYatri.
                </p>
                {hasProperties && completedBookings > 0 && (
                  <p className="text-xs text-neutral-400 mt-4">
                    {completedBookings} completed stay{completedBookings !== 1 ? "s" : ""} eligible for review
                  </p>
                )}
              </div>
            ) : (
              <div className="p-5 space-y-3">
                {reviews.map((r) => (
                  <ReviewCard key={r.id} review={r} />
                ))}
              </div>
            )}

            {reviews.length > 0 && totalPages > 1 && (
              <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50/50 flex items-center justify-end gap-2">
                <Link
                  href={`?page=${Math.max(1, page - 1)}`}
                  aria-disabled={page <= 1}
                  className={cn(
                    "text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors",
                    page <= 1
                      ? "text-neutral-300 border-neutral-100 pointer-events-none"
                      : "text-neutral-600 border-neutral-200 hover:bg-neutral-100"
                  )}
                >
                  Previous
                </Link>
                <span className="text-xs text-neutral-400">Page {page} of {totalPages}</span>
                <Link
                  href={`?page=${Math.min(totalPages, page + 1)}`}
                  aria-disabled={page >= totalPages}
                  className={cn(
                    "text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors",
                    page >= totalPages
                      ? "text-neutral-300 border-neutral-100 pointer-events-none"
                      : "text-neutral-600 border-neutral-200 hover:bg-neutral-100"
                  )}
                >
                  Next
                </Link>
              </div>
            )}
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
                    Ensure every guest has a great experience. Once a stay is marked complete, guests can leave a
                    review from their booking page. The more bookings you complete, the more reviews you&apos;ll receive.
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
