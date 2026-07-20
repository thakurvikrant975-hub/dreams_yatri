"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { StarIcon as StarSolid } from "@heroicons/react/24/solid";
import { CameraIcon, ChatBubbleLeftEllipsisIcon, PencilSquareIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { cn } from "@/app/lib/utils";
import { Card } from "@/app/components/ui/Card";
import ImageLightbox from "@/app/components/gallery/ImageLightbox";
import type { Hotel, ReviewItem } from "./dummy";
import Button from "@/app/components/ui/Button";

const RATING_LABEL: Record<number, string> = {
  5: "Excellent",
  4: "Very Good",
  3: "Average",
  2: "Poor",
  1: "Bad",
};

// Same order booking-data.ts's REVIEW_TAG_RULES derives tags in — keeps the
// filter chip order stable regardless of which reviews happen to match first.
const TAG_ORDER = [
  "Great hospitality",
  "Clean rooms",
  "Beautiful property",
  "Tasty food",
  "Great location",
  "Value for money",
  "Needs improvement",
];

const PAGE_SIZE = 5;
const MAX_REVIEW_IMAGES = 6;

function formatToday() {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date());
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center justify-center rounded-lg font-bold text-white bg-emerald-600 px-2 py-1 text-sm">
      {score.toFixed(1)}
    </span>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="p-0.5"
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          <StarSolid className={cn("w-6 h-6 transition-colors", (hover || value) >= n ? "text-amber-400" : "text-neutral-200")} />
        </button>
      ))}
    </div>
  );
}

// Dummy stand-in for the real "Respond publicly" flow hotel owners use in the
// hotel-connect portal (see reviews/ReviewCard.tsx) — local state only, no
// server action, since this page has no real review backend wired up yet.
function HostReplyBox({ hotelName, onSubmit }: { hotelName: string; onSubmit: (text: string) => void }) {
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState("");

  if (!replying) {
    return (
      <button
        type="button"
        onClick={() => setReplying(true)}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-r00 hover:text-primary-600"
      >
        <ChatBubbleLeftEllipsisIcon className="w-3.5 h-3.5" />
        Reply as {hotelName}
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Write a public response to this review..."
        rows={2}
        maxLength={2000}
        className="w-full text-sm rounded-lg border border-neutral-200 px-3 py-2 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (!draft.trim()) return;
            onSubmit(draft.trim());
            setDraft("");
            setReplying(false);
          }}
          disabled={!draft.trim()}
          className={cn(
            "text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors",
            draft.trim() ? "bg-primary-500 text-white hover:bg-primary-600" : "bg-neutral-100 text-neutral-300"
          )}
        >
          Send response
        </button>
        <button type="button" onClick={() => { setReplying(false); setDraft(""); }} className="text-xs text-neutral-400 hover:text-neutral-600">
          Cancel
        </button>
      </div>
    </div>
  );
}

function WriteReviewForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: { rating: number; text: string; images: string[] }) => void;
  onCancel: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const urls = files.map((f) => URL.createObjectURL(f));
    setImages((prev) => [...prev, ...urls].slice(0, MAX_REVIEW_IMAGES));
    e.target.value = "";
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  function submit() {
    if (rating === 0) {
      setError("Please select a star rating.");
      return;
    }
    onSubmit({ rating, text: text.trim(), images });
  }

  return (
    <Card variant="default" radius="md" className="p-4 mb-5 border border-neutral-200 bg-neutral-50/50">
      <p className="text-sm font-semibold text-neutral-800 mb-2">Rate your experience</p>
      <StarPicker value={rating} onChange={(n) => { setRating(n); setError(null); }} />

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Share details of your own experience at this property (optional)"
        rows={3}
        maxLength={2000}
        className="w-full mt-3 text-sm rounded-lg border border-neutral-200 px-3 py-2 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
      />

      <div className="flex flex-wrap gap-2 mt-3">
        {images.map((src, idx) => (
          <div key={src} className="relative size-16 rounded-lg overflow-hidden ring-1 ring-neutral-200">
            <Image src={src} alt="" fill unoptimized className="object-cover" />
            <button
              type="button"
              onClick={() => removeImage(idx)}
              aria-label="Remove photo"
              className="absolute top-0.5 right-0.5 size-4 rounded-full bg-black/60 text-white flex items-center justify-center"
            >
              <XMarkIcon className="w-2.5 h-2.5" />
            </button>
          </div>
        ))}
        {images.length < MAX_REVIEW_IMAGES && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="size-16 rounded-lg border-2 border-dashed border-neutral-300 text-neutral-400 hover:border-primary-300 hover:text-primary-500 flex flex-col items-center justify-center gap-0.5 transition-colors"
          >
            <CameraIcon className="w-5 h-5" />
            <span className="text-[10px] font-medium">Add</span>
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={handleFiles} />
      </div>

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

      <div className="flex items-center gap-2 mt-3">
        <button
          type="button"
          onClick={submit}
          className="text-xs font-semibold px-4 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors"
        >
          Submit Review
        </button>
        <button type="button" onClick={onCancel} className="text-xs font-semibold text-neutral-500 hover:text-neutral-700">
          Cancel
        </button>
      </div>
    </Card>
  );
}

export default function ReviewsSection({ hotel }: { hotel: Hotel }) {
  const r = hotel.reviews;
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>(hotel.reviews.items);
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"recent" | "highest" | "lowest">("recent");
  const [page, setPage] = useState(1);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [showWriteForm, setShowWriteForm] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  // Flattened in review order, so an index here always lines up with the
  // same photo's position within a review's own inline thumbnail row.
  const allPhotos = useMemo(
    () => reviewItems.flatMap((item) => (item.images ?? []).map((src) => ({ src, name: item.name }))),
    [reviewItems]
  );

  function photoStartIndex(reviewId: string, localIdx: number): number {
    let idx = 0;
    for (const item of reviewItems) {
      if (item.id === reviewId) return idx + localIdx;
      idx += item.images?.length ?? 0;
    }
    return idx;
  }

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of reviewItems) {
      for (const tag of item.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return counts;
  }, [reviewItems]);

  const availableTags = TAG_ORDER.filter((t) => (tagCounts.get(t) ?? 0) > 0);

  const filtered = useMemo(() => {
    let items = reviewItems;
    if (ratingFilter != null) items = items.filter((i) => i.rating === ratingFilter);
    if (tagFilter != null) items = items.filter((i) => (i.tags ?? []).includes(tagFilter));
    if (sortBy === "highest") items = [...items].sort((a, b) => b.rating - a.rating);
    else if (sortBy === "lowest") items = [...items].sort((a, b) => a.rating - b.rating);
    return items; // "recent" — server already orders by created_at desc
  }, [reviewItems, ratingFilter, tagFilter, sortBy]);

  function resetFilters() {
    setRatingFilter(null);
    setTagFilter(null);
    setPage(1);
  }

  function toggleRating(stars: number) {
    setRatingFilter((prev) => (prev === stars ? null : stars));
    setPage(1);
  }

  function toggleTag(tag: string) {
    setTagFilter((prev) => (prev === tag ? null : tag));
    setPage(1);
  }

  function goToPage(n: number) {
    setPage(n);
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleReply(reviewId: string, text: string) {
    setReviewItems((prev) =>
      prev.map((item) => (item.id === reviewId ? { ...item, hostResponse: text, hostResponseAt: formatToday() } : item))
    );
  }

  function handleAddReview({ rating, text, images }: { rating: number; text: string; images: string[] }) {
    const newItem: ReviewItem = {
      id: `new-${Date.now()}`,
      name: "You",
      initials: "Y",
      date: formatToday(),
      rating,
      text: text || "No written feedback provided.",
      images: images.length > 0 ? images : undefined,
    };
    setReviewItems((prev) => [newItem, ...prev]);
    setShowWriteForm(false);
    resetFilters();
  }

  const hasReviews = reviewItems.length > 0;

  if (!hasReviews) {
    return (
      <section id="reviews" className="scroll-mt-32">
        <Card variant="elevated" radius="md" className="p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-bold text-neutral-800">Guest Ratings & Reviews</h2>
            {!showWriteForm && (
              <Button
                type="button"
                onClick={() => setShowWriteForm(true)}
                variant="outline"
              >
                <PencilSquareIcon className="w-3.5 h-3.5" />
                Write a Review
              </Button>
            )}
          </div>
          {showWriteForm ? (
            <WriteReviewForm onSubmit={handleAddReview} onCancel={() => setShowWriteForm(false)} />
          ) : (
            <div className="text-center">
              <p className="text-sm font-semibold text-neutral-700">No reviews yet</p>
              <p className="text-xs text-neutral-500 mt-1">Be the first to share how your stay was.</p>
            </div>
          )}
        </Card>
      </section>
    );
  }

  const hasActiveFilter = ratingFilter != null || tagFilter != null;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <section id="reviews" ref={sectionRef} className="scroll-mt-32">
      <Card variant="elevated" radius="md" className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-neutral-800">Guest Ratings & Reviews</h2>
          {!showWriteForm && (
            <button
              type="button"
              onClick={() => setShowWriteForm(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 border border-primary-200 rounded-lg px-3 py-1.5 hover:bg-primary-50 transition-colors shrink-0"
            >
              <PencilSquareIcon className="w-3.5 h-3.5" />
              Write a Review
            </button>
          )}
        </div>

        {showWriteForm && <WriteReviewForm onSubmit={handleAddReview} onCancel={() => setShowWriteForm(false)} />}

        <div className="grid lg:grid-cols-[300px_1fr] gap-6">
          {/* Summary + rating filter */}
          <div className="h-fit lg:pr-6 lg:border-r lg:border-neutral-200">
            <div className="flex items-center gap-3">
              <ScoreBadge score={r.overall} />
              <div>
                <p className="text-sm font-bold text-neutral-800">{r.label}</p>
                <p className="text-xs text-neutral-500">{reviewItems.length.toLocaleString("en-IN")} reviews</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {r.distribution.map((d) => (
                <button
                  key={d.stars}
                  type="button"
                  onClick={() => toggleRating(d.stars)}
                  className={cn(
                    "flex items-center gap-2 w-full rounded-md px-1 py-0.5 -mx-1 transition-colors",
                    ratingFilter === d.stars ? "bg-emerald-50" : "hover:bg-neutral-50"
                  )}
                >
                  <span className={cn("text-xs w-20 shrink-0 text-left", ratingFilter === d.stars ? "font-bold text-emerald-700" : "text-neutral-600")}>
                    {RATING_LABEL[d.stars]}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${d.pct}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-neutral-700 w-8 text-right">{d.pct}%</span>
                </button>
              ))}
            </div>
            {hasActiveFilter && (
              <button type="button" onClick={resetFilters} className="mt-3 text-xs font-semibold text-primary-500 hover:underline">
                Clear filters
              </button>
            )}
          </div>

          {/* Filters, sort, and the review list */}
          <div>
            {availableTags.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => { setTagFilter(null); setPage(1); }}
                    className={cn(
                      "text-xs font-semibold rounded-full px-3 py-1.5 border transition-colors",
                      tagFilter == null ? "bg-primary-50 border-primary-300 text-primary-500" : "border-neutral-200 text-neutral-600 hover:border-primary-300"
                    )}
                  >
                    All Reviews
                  </button>
                  {availableTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        "text-xs font-semibold rounded-full px-3 py-1.5 border transition-colors",
                        tagFilter === tag ? "bg-primary-50 border-primary-300 text-primary-500" : "border-neutral-200 text-neutral-600 hover:border-primary-300"
                      )}
                    >
                      {tag} <span className="text-neutral-400">({tagCounts.get(tag)})</span>
                    </button>
                  ))}
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => { setSortBy(e.target.value as typeof sortBy); setPage(1); }}
                  className="text-xs font-semibold text-neutral-700 border border-neutral-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-400"
                >
                  <option value="recent">Most Recent</option>
                  <option value="highest">Highest Rating</option>
                  <option value="lowest">Lowest Rating</option>
                </select>
              </div>
            )}

            {allPhotos.length > 0 && (
              <div className="mb-5">
                <p className="text-sm font-semibold text-neutral-800 mb-2">Guest Photos ({allPhotos.length})</p>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {allPhotos.map((photo, idx) => (
                    <button
                      key={`${photo.src}-${idx}`}
                      type="button"
                      onClick={() => setLightboxIdx(idx)}
                      className="relative size-20 shrink-0 rounded-lg overflow-hidden ring-1 ring-neutral-200 hover:ring-primary-400 transition-all"
                    >
                      <Image
                        src={photo.src}
                        alt={`Photo by ${photo.name}`}
                        fill
                        unoptimized={photo.src.startsWith("blob:")}
                        className="object-cover"
                        sizes="80px"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {visibleItems.length === 0 ? (
              <div className="rounded-xl border border-neutral-200 p-6 text-center">
                <p className="text-sm font-semibold text-neutral-700">No reviews match this filter.</p>
                <button type="button" onClick={resetFilters} className="mt-1 text-xs font-semibold text-primary-600 hover:underline">
                  Clear filters
                </button>
              </div>
            ) : (
              <div>
                <div className="divide-y divide-neutral-200">
                  {visibleItems.map((item) => (
                    <div key={item.id} className="py-5 first:pt-0">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold shrink-0">
                            {item.initials}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-neutral-800">{item.name}</p>
                            <p className="text-[11px] text-neutral-400">
                              {item.date}
                              {(item.roomType || item.travelMonth) && " · "}
                              {item.roomType}
                              {item.roomType && item.travelMonth && " · "}
                              {item.travelMonth && `Stayed ${item.travelMonth}`}
                            </p>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-white bg-emerald-600 rounded-lg px-1.5 py-0.5 shrink-0">
                          {item.rating.toFixed(1)} <StarSolid className="w-3 h-3" />
                        </span>
                      </div>
                      <p className="text-sm text-neutral-500 leading-relaxed mt-3">{item.text}</p>

                      {item.images && item.images.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {item.images.map((src, idx) => (
                            <button
                              key={src}
                              type="button"
                              onClick={() => setLightboxIdx(photoStartIndex(item.id, idx))}
                              className="relative size-16 sm:size-20 rounded-lg overflow-hidden ring-1 ring-neutral-200 hover:ring-primary-400 transition-all"
                            >
                              <Image
                                src={src}
                                alt={`Photo by ${item.name}`}
                                fill
                                unoptimized={src.startsWith("blob:")}
                                className="object-cover"
                                sizes="80px"
                              />
                            </button>
                          ))}
                        </div>
                      )}

                      {item.hostResponse ? (
                        <div className="mt-3 ml-1 pl-3 border-l-2 border-neutral-200">
                          <p className="text-xs font-semibold text-neutral-700">Response from {hotel.name}</p>
                          {item.hostResponseAt && <p className="text-[11px] text-neutral-400 mb-1">{item.hostResponseAt}</p>}
                          <p className="text-sm text-neutral-600">{item.hostResponse}</p>
                        </div>
                      ) : (
                        <HostReplyBox hotelName={hotel.name} onSubmit={(text) => handleReply(item.id, text)} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-5 flex items-center justify-center gap-1.5">
                <button
                  type="button"
                  onClick={() => goToPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="text-xs font-semibold text-neutral-600 rounded-lg px-2.5 py-1.5 hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                >
                  Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => goToPage(n)}
                    aria-current={n === currentPage ? "page" : undefined}
                    className={cn(
                      "min-w-8 text-xs font-semibold rounded-lg px-2.5 py-1.5 transition-colors",
                      n === currentPage
                        ? "bg-primary-600 text-white"
                        : "text-neutral-600 hover:bg-neutral-100"
                    )}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="text-xs font-semibold text-neutral-600 rounded-lg px-2.5 py-1.5 hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {lightboxIdx !== null && allPhotos.length > 0 && (
        <ImageLightbox
          images={allPhotos.map((photo) => ({ src: photo.src, label: `Photo by ${photo.name}` }))}
          activeIdx={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onNavigate={setLightboxIdx}
        />
      )}
    </section>
  );
}
