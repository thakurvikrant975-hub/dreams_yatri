"use client";

import { useState, useTransition } from "react";
import { StarIcon } from "@phosphor-icons/react";
import Button from "@/app/components/ui/Button";
import { submitHotelReview } from "./review-actions";

export default function ReviewForm({
  bookingId,
  hotelId,
  hotelName,
}: {
  bookingId: string;
  hotelId: number;
  hotelName: string;
}) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (done) {
    return (
      <div className="rounded-xl border border-success-200 bg-success-50 px-5 py-4 text-sm text-success-700">
        Thanks for reviewing <strong>{hotelName}</strong>! Your feedback helps other travellers.
      </div>
    );
  }

  function handleSubmit() {
    setError(null);
    if (rating === 0) {
      setError("Please select a star rating.");
      return;
    }
    startTransition(async () => {
      const result = await submitHotelReview(bookingId, hotelId, rating, comment);
      if (result.ok) {
        setDone(true);
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-5 py-4 space-y-3">
      <p className="text-sm font-semibold text-neutral-800">{hotelName}</p>

      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(0)}
            onClick={() => setRating(n)}
            className="p-0.5"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
          >
            <StarIcon
              size={24}
              weight={(hoverRating || rating) >= n ? "fill" : "regular"}
              className={(hoverRating || rating) >= n ? "text-amber-400" : "text-neutral-300"}
            />
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="How was your stay? (optional)"
        rows={3}
        maxLength={2000}
        className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
      />

      {error && <p className="text-sm text-error-600">{error}</p>}

      <Button variant="premium" onClick={handleSubmit} disabled={isPending}>
        {isPending ? "Submitting…" : "Submit review"}
      </Button>
    </div>
  );
}
