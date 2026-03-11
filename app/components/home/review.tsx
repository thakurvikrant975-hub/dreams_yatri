"use client";

import {  useRef } from "react";
import { Review , ReviewCardProps} from "@/app/types/home";
import useScrollVisible from "@/app/hooks/useScrollVisible";

const REVIEWS: Review[] = [
  {
    id: 1,
    name: "Rahul Sharma",
    package: "Manali Tour Package",
    date: "27 July, 2025",
    rating: 5,
    text: "Dreams Yatri made our Himachal honeymoon absolutely perfect. From the itinerary to the hotels, everything was flawless. The Avanti AI feature helped us customize everything to our liking! It was such an awesome experience.",
    images: [
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=120&h=80&fit=crop",
      "https://images.unsplash.com/photo-1605649487212-47bdab064df7?w=120&h=80&fit=crop",
      "https://images.unsplash.com/photo-1571536802807-30451e3955d8?w=120&h=80&fit=crop",
      "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=120&h=80&fit=crop",
    ],
  },
  {
    id: 2,
    name: "Priya Mehta",
    package: "Kashmir Tour Package",
    date: "14 August, 2025",
    rating: 5,
    text: "Absolutely breathtaking experience! The Dal Lake houseboat stay was beyond our expectations. Dreams Yatri handled every detail perfectly — highly recommend to anyone planning a Kashmir trip.",
    images: [
      "https://images.unsplash.com/photo-1548013146-72479768bada?w=120&h=80&fit=crop",
      "https://images.unsplash.com/photo-1590077428593-a55bb07c4665?w=120&h=80&fit=crop",
      "https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=120&h=80&fit=crop",
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=120&h=80&fit=crop",
    ],
  },
  {
    id: 3,
    name: "Amit Verma",
    package: "Rajasthan Tour Package",
    date: "3 September, 2025",
    rating: 5,
    text: "The royal Rajasthan tour was an absolute dream. Palace hotels, camel safaris, everything was top-tier. The team was responsive and made changes on the fly. 10/10 would book again.",
    images: [
      "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=120&h=80&fit=crop",
      "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=120&h=80&fit=crop",
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=120&h=80&fit=crop",
      "https://images.unsplash.com/photo-1605649487212-47bdab064df7?w=120&h=80&fit=crop",
    ],
  },
];

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} className="w-4 h-4 text-amber-400 fill-amber-400" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}


function ReviewCard({ review }: ReviewCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm min-w-[300px] max-w-[320px] flex-shrink-0 snap-start">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {review.name[0]}
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm leading-none mb-0.5">{review.name}</p>
            <div className="flex items-center gap-1.5">
              <p className="text-slate-400 text-[11px]">{review.package}</p>
              <span className="text-slate-300 text-[11px]">·</span>
              <p className="text-slate-400 text-[11px]">{review.date}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <StarRating count={review.rating} />
          <span className="text-amber-500 font-bold text-sm">{review.rating}</span>
        </div>
      </div>

      {/* Text */}
      <p className="text-slate-600 text-sm leading-relaxed mb-4 line-clamp-3">{review.text}</p>

      {/* Images */}
      <div className="flex gap-2">
        {review.images.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            className="w-16 h-12 rounded-lg object-cover flex-shrink-0"
          />
        ))}
      </div>
    </div>
  );
}

export default function TestimonialsSection() {
  const { ref, visible } = useScrollVisible();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "right" ? 340 : -340, behavior: "smooth" });
  };

  return (
    <section ref={ref} className="py-20 lg:py-24 bg-white overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 lg:px-10">
        {/* Header row */}
        <div
          className={`flex items-end justify-between mb-8 transition-all duration-700 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <div className="flex items-start gap-4">
            {/* Google G logo */}
            <div className="w-12 h-12 shrink-0 mt-1">
              <svg viewBox="0 0 48 48" className="w-full h-full">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-rose-500 mb-1">Real Traveler Reviews</p>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-slate-900 leading-tight">
                What Our Guests Say
              </h2>
            </div>
          </div>

          {/* Nav arrows */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => scroll("left")}
              className="w-9 h-9 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:border-rose-300 hover:text-rose-500 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              className="w-9 h-9 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:border-rose-300 hover:text-rose-500 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable cards */}
        <div
          ref={scrollRef}
          className={`flex gap-5 overflow-x-auto snap-x snap-mandatory pb-4 scrollbar-hide transition-all duration-700 delay-200 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {REVIEWS.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      </div>
    </section>
  );
}
