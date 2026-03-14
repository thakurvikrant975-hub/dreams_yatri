"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { Review } from "@/app/types/home";
import { FcGoogle } from "react-icons/fc";
import SectionHeader from "../ui/SectionHeader";
import ReviewCard from "../ui/ReviewCard";
import { fadeLeft, fadeRight, staggerContainer, staggerItem } from "@/app/lib/motionPresets";

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

export default function TestimonialsSection() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "right" ? 340 : -340, behavior: "smooth" });
  };

  return (
    <section className="py-section bg-surface-muted overflow-hidden">
      <div className="screen-space">

        {/* Header row — label from left, arrows from right */}
        <div className="flex items-end justify-between mb-8">
          <SectionHeader
            icon={FcGoogle}
            tag="Real Traveler Reviews"
            title="What Our Guests Say"
          />

          <motion.div
            className="flex items-center gap-2 shrink-0"
            variants={fadeLeft}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, amount: 0.3 }}
          >
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
          </motion.div>
        </div>

        {/* Scrollable cards — staggered */}
        <motion.div
          ref={scrollRef}
          className="flex gap-5 overflow-x-auto snap-x snap-mandatory pb-8 pl-4 scrollbar-hide"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          variants={staggerContainer(0.12, 0.1)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.1 }}
        >
          {REVIEWS.map((review) => (
            <motion.div
              key={review.id}
              variants={staggerItem}
              className="snap-start shrink-0"
            >
              <ReviewCard review={review} />
            </motion.div>
          ))}
        </motion.div>

      </div>
    </section>
  );
}