"use client";

import { useState, useTransition } from "react";
import { StarIcon, ChatCircleTextIcon } from "@phosphor-icons/react";
import { cn } from "@/app/lib/utils";
import { respondToReview, type ReviewItem } from "./reviews-actions";

function initials(name: string) {
  return name.trim().split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "G";
}

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));
}

export default function ReviewCard({ review }: { review: ReviewItem }) {
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hostResponse, setHostResponse] = useState(review.hostResponse);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await respondToReview(review.id, draft);
      if (result.ok) {
        setHostResponse(draft.trim());
        setReplying(false);
      } else {
        setError(result.error ?? "Failed to send response.");
      }
    });
  }

  return (
    <div className="p-4 rounded-xl border border-neutral-100 bg-white space-y-3">
      <div className="flex items-center gap-3">
        <div className="size-9 rounded-full bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-600 shrink-0">
          {initials(review.guestName)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-neutral-800 truncate">{review.guestName}</p>
          <p className="text-xs text-neutral-400">{review.hotelName} · {formatDate(review.createdAt)}</p>
        </div>
        <div className="flex gap-0.5 shrink-0">
          {[1, 2, 3, 4, 5].map((n) => (
            <StarIcon key={n} size={13} weight={review.rating >= n ? "fill" : "regular"} className={review.rating >= n ? "text-amber-400" : "text-neutral-200"} />
          ))}
        </div>
      </div>

      {review.comment && <p className="text-sm text-neutral-600 leading-relaxed">{review.comment}</p>}

      {hostResponse ? (
        <div className="ml-4 pl-3 border-l-2 border-primary-200 bg-primary-50/40 rounded-r-lg py-2 px-3">
          <p className="text-[11px] font-semibold text-primary-600 mb-0.5">Your response</p>
          <p className="text-sm text-neutral-700">{hostResponse}</p>
        </div>
      ) : replying ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a public response to this review..."
            rows={2}
            maxLength={2000}
            className="w-full text-sm rounded-lg border border-neutral-200 px-3 py-2 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={submit}
              disabled={isPending || !draft.trim()}
              className={cn(
                "text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors",
                draft.trim() && !isPending ? "bg-primary-500 text-white hover:bg-primary-600" : "bg-neutral-100 text-neutral-300"
              )}
            >
              {isPending ? "Sending…" : "Send response"}
            </button>
            <button onClick={() => { setReplying(false); setError(null); }} className="text-xs text-neutral-400 hover:text-neutral-600">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setReplying(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700"
        >
          <ChatCircleTextIcon size={13} />
          Respond publicly
        </button>
      )}
    </div>
  );
}
