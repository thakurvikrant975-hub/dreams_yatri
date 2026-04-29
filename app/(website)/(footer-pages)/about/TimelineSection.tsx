"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { SectionHeading } from "../components/SectionHeading";
import {
  MapPin,
  Users,
  Globe2,
  Rocket,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Card from "@/app/components/ui/Card";
import { timelineData } from "./data";
import Image from "next/image";
import { useTimelineReveal } from "@/app/hooks/footer-pages/useTimelineReveal";



/* ─────────────────────────────────────────────
   IMAGE COLLAGE COMPONENT
───────────────────────────────────────────── */
function ImageCollage({
  images,
  onOpen,
}: {
  images: { src: string; alt: string }[];
  onOpen: (index: number) => void;
}) {
  const count = images.length;

  if (count === 1) {
    return (
      <button
        onClick={() => onOpen(0)}
        className="block w-full rounded-xl overflow-hidden aspect-[4/3] focus:outline-none focus:ring-2 focus:ring-red-400"
        aria-label={`View photo: ${images[0].alt}`}
      >
        <img
          src={images[0].src}
          alt={images[0].alt}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
        />
      </button>
    );
  }

  if (count === 2) {
    return (
      <div className="grid grid-cols-2 gap-1.5 rounded-xl overflow-hidden">
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => onOpen(i)}
            className="block aspect-square focus:outline-none focus:ring-2 focus:ring-red-400 overflow-hidden"
            aria-label={`View photo: ${img.alt}`}
          >
            <Image
              src={img.src}
              alt={img.alt}
              width={600}
              height={400}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
            />
          </button>
        ))}
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className="grid grid-cols-2 gap-1.5 rounded-xl overflow-hidden">
        <button
          onClick={() => onOpen(0)}
          className="row-span-2 block focus:outline-none focus:ring-2 focus:ring-red-400 overflow-hidden"
          aria-label={`View photo: ${images[0].alt}`}
        >
          <img
            src={images[0].src}
            alt={images[0].alt}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
          />
        </button>
        {images.slice(1).map((img, i) => (
          <button
            key={i}
            onClick={() => onOpen(i + 1)}
            className="block aspect-video focus:outline-none focus:ring-2 focus:ring-red-400 overflow-hidden"
            aria-label={`View photo: ${img.alt}`}
          >
            <img
              src={img.src}
              alt={img.alt}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
            />
          </button>
        ))}
      </div>
    );
  }

  // 4 images — 2×2 grid with last image showing "+N more" overlay if >4
  return (
    <div className="grid grid-cols-2 gap-1.5 rounded-xl overflow-hidden">
      {images.slice(0, 4).map((img, i) => (
        <button
          key={i}
          onClick={() => onOpen(i)}
          className="relative block aspect-square focus:outline-none focus:ring-2 focus:ring-red-400 overflow-hidden"
          aria-label={`View photo: ${img.alt}`}
        >
          <img
            src={img.src}
            alt={img.alt}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
          />
          {i === 3 && count > 4 && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-white text-xl font-bold">+{count - 4}</span>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
function SectionLabel({ children }: { children: any }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="w-8 h-0.5 bg-red-500" />
      <span className="text-red-500 text-xs font-bold uppercase tracking-widest">{children}</span>
    </div>
  );
}
/* ─────────────────────────────────────────────
   LIGHTBOX COMPONENT
───────────────────────────────────────────── */
function Lightbox({
  images,
  startIndex,
  onClose,
}: {
  images: { src: string; alt: string }[];
  startIndex: number;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(startIndex);

  const prev = useCallback(
    () => setCurrent((c) => (c - 1 + images.length) % images.length),
    [images.length]
  );
  const next = useCallback(
    () => setCurrent((c) => (c + 1) % images.length),
    [images.length]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose, prev, next]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors z-10"
        aria-label="Close preview"
      >
        <X size={22} />
      </button>

      {/* Prev */}
      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            prev();
          }}
          className="absolute left-3 sm:left-6 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-3 transition-colors z-10"
          aria-label="Previous image"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {/* Image */}
      <div
        className="max-w-4xl w-full max-h-[85vh] flex flex-col items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          key={current}
          src={images[current].src.replace("w=600", "w=1200")}
          alt={images[current].alt}
          className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-2xl animate-fade-in"
        />
        <p className="text-white/70 text-sm text-center">
          {images[current].alt}{" "}
          <span className="text-white/40 ml-2">
            {current + 1} / {images.length}
          </span>
        </p>

        {/* Dot indicators */}
        {images.length > 1 && (
          <div className="flex gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === current ? "bg-red-500 w-5" : "bg-white/30"
                  }`}
                aria-label={`Go to image ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Next */}
      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
          className="absolute right-3 sm:right-6 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-3 transition-colors z-10"
          aria-label="Next image"
        >
          <ChevronRight size={24} />
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   TIMELINE CARD
───────────────────────────────────────────── */
function TimelineCard({
  year,
  tag,
  title,
  Icon,
  desc,
  images,
  align,
}: {
  year: string;
  tag: string;
  title: string;
  Icon: React.ElementType;
  desc: string;
  images: { src: string; alt: string }[];
  align: "left" | "right";
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <>
      {lightboxIndex !== null && (
        <Lightbox
          images={images}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      <Card
        className={`bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-red-100 transition-all duration-300 overflow-hidden ${align === "left" ? "sm:text-right" : ""
          }`}
      >
        {/* Image Collage */}
        <div className="p-3 pb-0">
          <ImageCollage images={images} onOpen={(i) => setLightboxIndex(i)} />
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6">
          <div
            className={`flex flex-wrap items-center gap-2 mb-3 ${align === "left" ? "sm:justify-end" : ""
              }`}
          >
            <span className="text-xs font-black text-red-500 bg-red-50 border border-red-200 rounded-full px-3 py-1">
              {year}
            </span>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {tag}
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2 leading-snug">
            {title}
          </h3>
          <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
        </div>
      </Card>
    </>
  );
}

/* ─────────────────────────────────────────────
   MAIN SECTION EXPORT
───────────────────────────────────────────── */
export default function OurJourneyTimeline() {
  useTimelineReveal();

  const spineRef = useRef<HTMLDivElement>(null);

  // Separate refs for desktop dots (always visible on sm+)
  const firstDotDesktopRef = useRef<HTMLDivElement>(null);
  const lastDotDesktopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const spine = document.getElementById("tl-spine-fill");
    if (
      !spine ||
      !spineRef.current ||
      !firstDotDesktopRef.current ||
      !lastDotDesktopRef.current
    ) return;

    const getSpineBounds = () => {
      const spineRect = spineRef.current!.getBoundingClientRect();
      const firstRect = firstDotDesktopRef.current!.getBoundingClientRect();
      const lastRect = lastDotDesktopRef.current!.getBoundingClientRect();

      const spineTop = spineRect.top + window.scrollY;
      const firstDotCenter = firstRect.top + window.scrollY + firstRect.height / 2;
      const lastDotCenter = lastRect.top + window.scrollY + lastRect.height / 2;

      return { spineTop, firstDotCenter, lastDotCenter };
    };

    const updateSpineHeight = () => {
      const { spineTop, firstDotCenter, lastDotCenter } = getSpineBounds();
      const offsetTop = firstDotCenter - spineTop;
      const totalLength = lastDotCenter - firstDotCenter;
      spineRef.current!.style.top = `${offsetTop}px`;
      spineRef.current!.style.bottom = "auto";
      spineRef.current!.style.height = `${totalLength}px`;
    };

    const onScroll = () => {
      const { firstDotCenter, lastDotCenter } = getSpineBounds();
      const viewportMid = window.scrollY + window.innerHeight * 0.6;
      const progress = Math.min(
        Math.max(
          (viewportMid - firstDotCenter) / (lastDotCenter - firstDotCenter),
          0
        ),
        1
      );
      spine.style.height = `${progress * 100}%`;
    };

    const onResize = () => {
      updateSpineHeight();
      onScroll();
    };

    updateSpineHeight();
    onScroll();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <section
      aria-labelledby="journey-heading"
      className="py-24 px-4 sm:px-6 bg-gradient-to-b from-white via-red-50/30 to-white"
    >
      <div className="max-w-5xl mx-auto">
        <div>
          <SectionLabel>Our Journey</SectionLabel>
          <SectionHeading
            text="From One Cold Night to"
            highlight="50k+ Happy Travellers"
            highlightPosition="suffix"
            variant="light"
          />
          <p className="mt-4 text-gray-500 text-base sm:text-lg leading-relaxed">
            Every great travel company is born from a bad trip. Here&apos;s ours
            — and how it became your most reliable travel partner.
          </p>
        </div>

        <div className="relative mt-16">

          {/* ── SPINE — replaced with ref version ── */}
          <div
            ref={spineRef}
            aria-hidden="true"
            className="absolute left-5 sm:left-1/2 sm:-translate-x-px w-px pointer-events-none overflow-hidden"
          >
            {/* Grey base */}
            <div className="absolute inset-0 bg-gray-200" />
            {/* Red fill grows on scroll */}
            <div
              id="tl-spine-fill"
              className="absolute top-0 left-0 w-full bg-red-500"
              style={{ height: "0%" }}
            />
          </div>

          <div className="space-y-12">
            {timelineData.map(({ year, tag, title, Icon, desc, images }, i) => {
              const isLeft = i % 2 === 0;
              const isFirst = i === 0;
              const isLast = i === timelineData.length - 1;

              return (
                <div key={year} className="tl-item">
                  <div className="relative flex items-start pl-14 sm:pl-0">

                    {/* Mobile dot — no ref, hidden on desktop */}
                    <div
                      aria-hidden="true"
                      className="tl-dot absolute left-[13px] top-6 w-5 h-5 rounded-full border-4 border-white shadow-md sm:hidden z-10"
                    />

                    {/* Desktop layout */}
                    <div className="hidden sm:flex w-full items-start gap-0">
                      <div className="w-[calc(50%-2rem)] pr-8">
                        {isLeft && (
                          <TimelineCard
                            year={year} tag={tag} title={title}
                            Icon={Icon} desc={desc} images={images}
                            align="left"
                          />
                        )}
                      </div>

                      {/* ── Center dot — desktop ref only ── */}
                      <div
                        ref={
                          isFirst
                            ? firstDotDesktopRef
                            : isLast
                            ? lastDotDesktopRef
                            : undefined
                        }
                        className="flex-shrink-0 w-16 flex flex-col items-center pt-6 z-10 gap-1"
                      >
                        <div className="tl-dot w-11 h-11 rounded-full border-4 border-white shadow-lg flex items-center justify-center">
                          <Icon size={17} className="text-white" strokeWidth={2.5} />
                        </div>
                        <span className="tl-year text-[10px] font-black tracking-widest p-2 py-0.5 bg-gray-900 bg-red-100 rounded-full uppercase">
                          {year}
                        </span>
                      </div>

                      <div className="w-[calc(50%-2rem)] pl-8">
                        {!isLeft && (
                          <TimelineCard
                            year={year} tag={tag} title={title}
                            Icon={Icon} desc={desc} images={images}
                            align="right"
                          />
                        )}
                      </div>
                    </div>

                    {/* Mobile card */}
                    <div className="sm:hidden w-full">
                      <TimelineCard
                        year={year} tag={tag} title={title}
                        Icon={Icon} desc={desc} images={images}
                        align="right"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-20 text-center">
          <p className="text-gray-400 text-sm uppercase tracking-widest font-semibold mb-2">
            The story continues
          </p>
          <p className="text-gray-600 text-base sm:text-lg font-medium">
            And your trip is the next chapter.
          </p>
        </div>
      </div>
    </section>
  );
}