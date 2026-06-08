"use client";

import { Review } from "@/app/types/home";
import { FcGoogle } from "react-icons/fc";
import { Star } from "lucide-react";
import SectionHeader from "@/app/components/ui/SectionHeader";
import ReviewCard from "@/app/components/ui/ReviewCard";
import { Carousel } from "@/app/components/ui/Carousel";

const REVIEWS: Review[] = [
  {
    id: 1,
    name: "Rahul Sharma",
    package: "Manali Tour Package",
    date: "27 July, 2025",
    profile:"https://lh3.googleusercontent.com/a-/ALV-UjVkVpYSzZJVpSoJsiX1r2wdqZa2mPirkwSIHIIZiJBzof6RsWF6=w144-h144-p-rp-mo-ba2-br100",
    rating: 5,
    text: "I arvind kumar (rajan) am very glad to share my wonderful experience with your team in Sikkim and darjiling tour especially full coordination by YAMINI AND VARSA MAIDAN in this tour.",
    images: [
      "/reviews/image-1.webp",
      "/reviews/image-2.webp",
      "/reviews/image-3.webp",
      "/reviews/image-4.webp",
    ],
  },
  {
    id: 2,
    name: "Nilesh Bhoyar",
    profile:"/reviews/image-8.png",
    package: "Kashmir Tour Package",
    date: "14 August, 2025",
    rating: 5,
    text: "Our journey was super fun and stress-free, thanks to their awesome arrangements 😊. Chanchal Ranaut, the coordinator, was super helpful and kept us in the loop throughout. Highly recommend Dremsyatri for a memorable experience!",
    images: [
      "/reviews/image-6.webp",
      "/reviews/image-7.webp",
    ],
  },
  {
    id: 3,
    name: "Suraj Rajoriya",
    profile:"/reviews/image-12.png",
    package: "Rajasthan Tour Package",
    date: "3 September, 2025",
    rating: 5,
    text: "Had a great experience with Dreams Yatri Travel Service. The journey was comfortable, the vehicle was clean, and the driver was polite and professional. Everything was well managed. Highly recommended!”😊😊",
    images: [
      "/reviews/image-9.webp",
      "/reviews/image-10.webp",
      "/reviews/image-11.webp",
      "/reviews/image-13.webp",
    ],
  },
  {
    id: 4,
    name: "Pawan Keshri",
    profile:"",
    package: "Rajasthan Tour Package",
    date: "3 September, 2025",
    rating: 5,
    text: "Best trevalling experience... On of the best tour package. Kashmir tour... thank you himani Sharma ji.",
    images: [
      "/reviews/image-17.webp",
      "/reviews/image-18.webp",
      "/reviews/image-19.webp",
      "/reviews/image-20.webp",
    ],
  },
  {
    id: 5,
    name: "Navneet Rawal",
    profile:"",
    package: "Rajasthan Tour Package",
    date: "3 September, 2025",
    rating: 5,
    text: "Dreams Yatri provides a smooth and well-organized travel experience. From planning to execution, everything was handled professionally. The team is supportive, responsive, and ensures comfort throughout the journey. Great service, reasonable pricing, and a hassle-free experience overall. Highly recommended for anyone looking for reliable and enjoyable travel arrangements.",
    images: [],
  },
  {
    id: 6,
    name: "Shivani Sharma",
    profile:"",
    package: "Rajasthan Tour Package",
    date: "3 September, 2025",
    rating: 5,
    text: "Our Jaisalmer trip was amazing. Fort visits, local culture, and desert experiences were planned nicely. Hotels and transport were smooth, and the overall coordination was excellent. A memorable Rajasthan experience with Dreams Yatri. Special thanks to Miss Himani Mam for organizing our trip.",
    images: [],
  },
  {
    id: 7,
    name: "Akshu",
    profile:"",
    package: "Rajasthan Tour Package",
    date: "12 October, 2025",
    rating: 5,
    text: "We had a very pleasant experience traveling to Vizag with Dreams Yatri. The trip was well-organized, with comfortable stays and smooth sightseeing arrangements. The team was responsive and managed everything efficiently from start to finish. Overall, a hassle-free and well-coordinated trip. Recommended for Vizag travel planning",
    images: [],
  },
];

export default function TestimonialsSection() {
  return (
    <section className="py-section bg-surface-muted overflow-hidden">
      <div className="screen-space">

        {/* Header row — label from left, arrows from right */}
        <div className="flex items-end justify-between">
          <div className="flex justify-between w-full items-center">

            <SectionHeader
              noAnimation
              icon={FcGoogle}
              tag="Real Traveler Reviews"
              title="What Our Guests Say"
            />

            <a
              href="https://share.google/FpztNvEYjcMDt9lDd"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center gap-1.5 px-5 py-3 rounded-xl bg-white border border-neutral-200 shadow-sm hover:border-rose-300 hover:shadow-md transition-all duration-200 cursor-pointer"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-neutral-800 group-hover:text-rose-600 transition-colors">
                <FcGoogle className="size-5 shrink-0" />
                Write a Review
              </span>
              <span className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="size-3.5 fill-yellow-400 text-yellow-400" />
                ))}
                <span className="ml-1 text-xs text-neutral-500 font-medium">4.2</span>
              </span>
            </a>
          </div>
        </div>

        {/* Reviews carousel */}
        <Carousel
          items={REVIEWS}
          renderItem={(review) => <ReviewCard review={review} />}
          perView={3}
          gap={20}
          ariaLabel="Guest reviews"
          className="mt-6"
        />

      </div>
    </section>
  );
}