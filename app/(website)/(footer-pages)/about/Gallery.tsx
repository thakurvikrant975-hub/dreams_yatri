"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, ChevronLeft, ChevronRight, X, ZoomIn, MapPin } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type GalleryImage = {
  id: number;
  src: string;
  label: string;
  tag: string;
};

type GalleryProps = {
  gallery: GalleryImage[];
  /** How many cards visible at once (desktop). Default: 3 */
  perView?: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Hook: responsive perView
// ─────────────────────────────────────────────────────────────────────────────
function usePerView(base: number) {
  const [pv, setPv] = useState(base);
  useEffect(() => {
    const calc = () => {
      if (window.innerWidth < 640) setPv(1);
      else if (window.innerWidth < 1024) setPv(2);
      else setPv(base);
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [base]);
  return pv;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook: touch drag
// ─────────────────────────────────────────────────────────────────────────────
function useDrag(onSwipe: (dir: -1 | 1) => void) {
  const startX = useRef(0);
  const isDragging = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    isDragging.current = true;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    if (Math.abs(dx) > 48) onSwipe(dx < 0 ? 1 : -1);
    isDragging.current = false;
  };
  const onMouseDown = (e: React.MouseEvent) => {
    startX.current = e.clientX;
    isDragging.current = true;
  };
  const onMouseUp = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 48) onSwipe(dx < 0 ? 1 : -1);
    isDragging.current = false;
  };

  return { onTouchStart, onTouchEnd, onMouseDown, onMouseUp };
}

// ─────────────────────────────────────────────────────────────────────────────
// Lightbox
// ─────────────────────────────────────────────────────────────────────────────
function Lightbox({
  images,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  images: GalleryImage[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const img = images[index];

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, onPrev, onNext]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const drag = useDrag((dir) => { dir === 1 ? onNext() : onPrev(); });

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.95)", backdropFilter: "blur(12px)", animation: "lb-in 0.25s ease both" }}
      onClick={onClose}
    >
      <style>{`
        @keyframes lb-in  { from { opacity:0 } to { opacity:1 } }
        @keyframes lb-img { from { opacity:0; transform:scale(0.94) } to { opacity:1; transform:scale(1) } }
      `}</style>

      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-5 right-5 z-10 w-10 h-10 rounded-full flex items-center justify-center text-white transition-colors"
        style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)" }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.7)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
      >
        <X size={18} />
      </button>

      {/* Counter */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 text-white/50 text-xs font-semibold tracking-widest select-none">
        {index + 1} / {images.length}
      </div>

      {/* Prev */}
      <button
        onClick={e => { e.stopPropagation(); onPrev(); }}
        className="absolute left-4 sm:left-8 z-10 w-11 h-11 rounded-full flex items-center justify-center text-white transition-all"
        style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.15)" }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.65)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.10)")}
      >
        <ChevronLeft size={22} />
      </button>

      {/* Image */}
      <div
        className="relative mx-20 sm:mx-28 max-w-5xl w-full select-none"
        onClick={e => e.stopPropagation()}
        {...drag}
        style={{ cursor: "grab", userSelect: "none" }}
      >
        <img
          key={img.id}
          src={img.src.replace("w=600", "w=1400").replace("h=400", "h=900")}
          alt={img.label}
          className="w-full rounded-2xl object-cover"
          style={{
            maxHeight: "80vh",
            objectFit: "contain",
            animation: "lb-img 0.3s ease both",
            boxShadow: "0 40px 120px rgba(0,0,0,0.7)",
          }}
          draggable={false}
        />

        {/* Caption */}
        <div
          className="absolute bottom-0 left-0 right-0 rounded-b-2xl px-6 py-5"
          style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.85))" }}
        >
          <div className="flex items-center gap-2 mb-1">
            <MapPin size={12} className="text-red-400" />
            <span className="text-red-400 text-xs font-bold uppercase tracking-widest">{img.tag}</span>
          </div>
          <p className="text-white font-bold text-lg leading-tight">{img.label}</p>
        </div>
      </div>

      {/* Next */}
      <button
        onClick={e => { e.stopPropagation(); onNext(); }}
        className="absolute right-4 sm:right-8 z-10 w-11 h-11 rounded-full flex items-center justify-center text-white transition-all"
        style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.15)" }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.65)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.10)")}
      >
        <ChevronRight size={22} />
      </button>

      {/* Thumbnail strip */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2 px-4 overflow-x-auto max-w-full"
        style={{ scrollbarWidth: "none" }}>
        {images.map((im, i) => (
          <button
            key={im.id}
            onClick={e => { e.stopPropagation(); }}
            style={{
              width: 48, height: 36, flexShrink: 0,
              borderRadius: 8, overflow: "hidden",
              border: i === index ? "2px solid #EF4444" : "2px solid transparent",
              opacity: i === index ? 1 : 0.45,
              transition: "opacity 0.2s, border-color 0.2s",
            }}
          >
            <img src={im.src} alt={im.label} className="w-full h-full object-cover" draggable={false} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Gallery
// ─────────────────────────────────────────────────────────────────────────────
export function Gallery({ gallery, perView = 3 }: GalleryProps) {
  const pv = usePerView(perView);
  const max = Math.max(0, gallery.length - pv);

  const [offset, setOffset] = useState(0);           // current slide index
  const [animating, setAnimating] = useState(false);  // lock during transition
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Clamp helper
  const clamp = (n: number) => Math.max(0, Math.min(max, n));

  // Slide with lock
  const slideTo = useCallback((next: number) => {
    if (animating) return;
    const clamped = clamp(next);
    if (clamped === offset) return;
    setAnimating(true);
    setOffset(clamped);
    setTimeout(() => setAnimating(false), 480);
  }, [animating, offset, max]);

  const prev = () => slideTo(offset - 1);
  const next = () => slideTo(offset + 1);

  // Keyboard nav (slider level)
  useEffect(() => {
    if (lightboxIdx !== null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxIdx, prev, next]);

  // Reset offset when perView changes
  useEffect(() => { setOffset(0); }, [pv]);

  const drag = useDrag((dir) => { dir === 1 ? next() : prev(); });

  // Translate %: each card = 100/pv % of track width
  const translatePct = -(offset * (100 / pv));

  return (
    <>
      <style>{`
        @keyframes card-pop {
          from { opacity:0; transform:scale(0.96) translateY(12px); }
          to   { opacity:1; transform:scale(1) translateY(0); }
        }
        .gallery-card { animation: card-pop 0.5s ease both; }
      `}</style>

      <div className="relative select-none">

        {/* ── Track wrapper with overflow hidden ── */}
        <div
          className="overflow-hidden rounded-2xl"
          ref={trackRef}
          {...drag}
          style={{ cursor: "grab" }}
          onMouseDown={e => { drag.onMouseDown(e); (e.currentTarget as HTMLDivElement).style.cursor = "grabbing"; }}
          onMouseUp={e => { drag.onMouseUp(e); (e.currentTarget as HTMLDivElement).style.cursor = "grab"; }}
          onMouseLeave={e => { drag.onMouseUp(e as any); (e.currentTarget as HTMLDivElement).style.cursor = "grab"; }}
        >
          {/* ── Sliding track ── */}
          <div
            style={{
              display: "flex",
              gap: "16px",
              transition: animating
                ? "transform 0.48s cubic-bezier(0.25, 0.46, 0.45, 0.94)"
                : "transform 0.48s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
              transform: `translateX(calc(${translatePct}% - ${offset * 16 / pv}px))`,
              willChange: "transform",
            }}
          >
            {gallery.map((img, i) => (
              <div
                key={img.id}
                className="flex-shrink-0"
                style={{ width: `calc((100% - ${(pv - 1) * 16}px) / ${pv})` }}
              >
                <div
                  className="gallery-card relative group cursor-pointer overflow-hidden bg-gray-100"
                  style={{
                    aspectRatio: "4/3",
                    borderRadius: "16px",
                    animationDelay: `${(i % pv) * 60}ms`,
                  }}
                  onClick={() => setLightboxIdx(i)}
                >
                  {/* Image */}
                  <img
                    src={img.src}
                    alt={img.label}
                    className="w-full h-full object-cover"
                    style={{ transition: "transform 0.55s cubic-bezier(0.25,0.46,0.45,0.94)" }}
                    onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.08)")}
                    onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
                    loading="lazy"
                    draggable={false}
                  />

                  {/* Gradient overlay */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0) 55%)",
                      opacity: 0,
                      transition: "opacity 0.3s ease",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                    onMouseLeave={e => (e.currentTarget.style.opacity = "0")}
                  />

                  {/* Hover overlay managed at parent */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.06) 55%)" }} />

                  {/* Tag */}
                  <div className="absolute top-3 left-3">
                    <span
                      className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                      style={{ background: "rgba(239,68,68,0.85)", color: "#fff", backdropFilter: "blur(6px)" }}
                    >
                      {img.tag}
                    </span>
                  </div>

                  {/* Zoom icon */}
                  <div
                    className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300"
                    style={{
                      background: "rgba(255,255,255,0.2)",
                      backdropFilter: "blur(8px)",
                      border: "1px solid rgba(255,255,255,0.25)",
                      transform: "scale(0.8)",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = "scale(1)")}
                    onMouseLeave={e => (e.currentTarget.style.transform = "scale(0.8)")}
                  >
                    <ZoomIn size={13} className="text-white" />
                  </div>

                  {/* Caption */}
                  <div
                    className="absolute bottom-0 left-0 right-0 px-4 py-4 translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100"
                    style={{ transition: "all 0.3s cubic-bezier(0.25,0.46,0.45,0.94)" }}
                  >
                    <p className="text-white font-bold text-sm leading-snug">{img.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Controls ── */}
        <div className="flex items-center justify-between mt-6">

          {/* Dot indicators */}
          <div className="flex items-center gap-2">
            {Array.from({ length: max + 1 }).map((_, i) => (
              <button
                key={i}
                onClick={() => slideTo(i)}
                aria-label={`Go to slide ${i + 1}`}
                style={{
                  height: 6,
                  width: i === offset ? 28 : 6,
                  borderRadius: 999,
                  background: i === offset ? "#EF4444" : "#D1D5DB",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  transition: "width 0.3s cubic-bezier(0.25,0.46,0.45,0.94), background 0.3s ease",
                  flexShrink: 0,
                }}
              />
            ))}
          </div>

          {/* Prev / Next */}
          <div className="flex items-center gap-2">
            <button
              onClick={prev}
              disabled={offset === 0}
              aria-label="Previous"
              className="transition-all duration-200"
              style={{
                width: 40, height: 40, borderRadius: "50%",
                border: "1.5px solid #E5E7EB",
                background: offset === 0 ? "#F9FAFB" : "#fff",
                color: offset === 0 ? "#D1D5DB" : "#111827",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: offset === 0 ? "not-allowed" : "pointer",
                boxShadow: offset === 0 ? "none" : "0 1px 4px rgba(0,0,0,0.08)",
              }}
              onMouseEnter={e => { if (offset !== 0) (e.currentTarget as HTMLButtonElement).style.borderColor = "#EF4444"; (e.currentTarget as HTMLButtonElement).style.color = "#EF4444"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#E5E7EB"; (e.currentTarget as HTMLButtonElement).style.color = offset === 0 ? "#D1D5DB" : "#111827"; }}
            >
              <ChevronLeft size={18} />
            </button>

            <span className="text-xs text-gray-400 font-semibold tabular-nums w-12 text-center select-none">
              {offset + 1} / {max + 1}
            </span>

            <button
              onClick={next}
              disabled={offset === max}
              aria-label="Next"
              className="transition-all duration-200"
              style={{
                width: 40, height: 40, borderRadius: "50%",
                border: "1.5px solid #E5E7EB",
                background: offset === max ? "#F9FAFB" : "#EF4444",
                color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: offset === max ? "not-allowed" : "pointer",
                boxShadow: offset === max ? "none" : "0 3px 12px rgba(239,68,68,0.35)",
                opacity: offset === max ? 0.4 : 1,
              }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* ── Edge fade hints ── */}
        {offset > 0 && (
          <div className="absolute top-0 left-0 bottom-12 w-12 pointer-events-none rounded-l-2xl"
            style={{ background: "linear-gradient(to right, rgba(255,255,255,0.7), transparent)", zIndex: 2 }} />
        )}
        {offset < max && (
          <div className="absolute top-0 right-0 bottom-12 w-12 pointer-events-none rounded-r-2xl"
            style={{ background: "linear-gradient(to left, rgba(255,255,255,0.7), transparent)", zIndex: 2 }} />
        )}
      </div>

      {/* ── Lightbox ── */}
      {lightboxIdx !== null && (
        <Lightbox
          images={gallery}
          index={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onPrev={() => setLightboxIdx(i => Math.max(0, (i ?? 0) - 1))}
          onNext={() => setLightboxIdx(i => Math.min(gallery.length - 1, (i ?? 0) + 1))}
        />
      )}
    </>
  );
}