"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ChangeEvent } from "react";
import Image from "next/image";
import { StarIcon, CameraIcon, XIcon } from "@phosphor-icons/react";
import Button from "@/app/components/ui/Button";
import { submitHotelReview } from "./review-actions";

const MAX_PHOTOS = 6;

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
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos]);
  useEffect(() => {
    return () => { previews.forEach((url) => URL.revokeObjectURL(url)); };
  }, [previews]);

  if (done) {
    return (
      <div className="rounded-xl border border-success-200 bg-success-50 px-5 py-4 text-sm text-success-700">
        Thanks for reviewing <strong>{hotelName}</strong>! Your feedback helps other travellers.
      </div>
    );
  }

  function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setPhotos((prev) => [...prev, ...files].slice(0, MAX_PHOTOS));
    e.target.value = "";
  }

  function removePhoto(idx: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit() {
    setError(null);
    if (rating === 0) {
      setError("Please select a star rating.");
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      for (const file of photos) formData.append("photos", file);
      const result = await submitHotelReview(bookingId, hotelId, rating, comment, formData);
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

      <div className="flex flex-wrap gap-2">
        {previews.map((src, idx) => (
          <div key={src} className="relative size-16 rounded-lg overflow-hidden ring-1 ring-neutral-200">
            <Image src={src} alt="" fill unoptimized className="object-cover" />
            <button
              type="button"
              onClick={() => removePhoto(idx)}
              aria-label="Remove photo"
              className="absolute top-0.5 right-0.5 size-4 rounded-full bg-black/60 text-white flex items-center justify-center"
            >
              <XIcon size={10} weight="bold" />
            </button>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="size-16 rounded-lg border-2 border-dashed border-neutral-300 text-neutral-400 hover:border-primary-300 hover:text-primary-500 flex flex-col items-center justify-center gap-0.5 transition-colors"
          >
            <CameraIcon size={20} />
            <span className="text-[10px] font-medium">Add</span>
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={handleFiles} />
      </div>

      {error && <p className="text-sm text-error-600">{error}</p>}

      <Button variant="premium" onClick={handleSubmit} disabled={isPending}>
        {isPending ? "Submitting…" : "Submit review"}
      </Button>
    </div>
  );
}
