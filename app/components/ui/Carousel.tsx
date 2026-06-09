'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { cn } from '@/app/lib/utils';

// ── Hooks (exported so callers can sync external state) ───────────────────────

/** Responsive items-per-view — collapses gracefully on small screens. */
export function usePerView(base: number) {
  const [pv, setPv] = useState(base);
  useEffect(() => {
    const calc = () => {
      if      (window.innerWidth < 640)  setPv(1);
      else if (window.innerWidth < 1024) setPv(Math.min(base, 2));
      else                               setPv(base);
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [base]);
  return pv;
}

/** Unified touch + mouse drag — calls onSwipe(-1 | 1) when drag > threshold. */
export function useDrag(onSwipe: (dir: -1 | 1) => void) {
  const startX = useRef(0);
  const active  = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    active.current = true;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!active.current) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    if (Math.abs(dx) > 48) onSwipe(dx < 0 ? 1 : -1);
    active.current = false;
  };
  const onMouseDown = (e: React.MouseEvent) => {
    startX.current = e.clientX;
    active.current = true;
  };
  const onMouseUp = (e: React.MouseEvent) => {
    if (!active.current) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 48) onSwipe(dx < 0 ? 1 : -1);
    active.current = false;
  };

  return { onTouchStart, onTouchEnd, onMouseDown, onMouseUp };
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface CarouselProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Desktop items-per-view. Collapses to 1 on mobile, 2 on tablet. Default: 3 */
  perView?: number;
  gap?: number;
  className?: string;
  showDots?: boolean;
  showArrows?: boolean;
  showCounter?: boolean;
  /** Accessible label for the carousel region */
  ariaLabel?: string;
  /**
   * Color the edge fades blend into — should match the section background.
   * Accepts any CSS color (e.g. '#fff', 'var(--color-neutral-100)'). Default: white.
   */
  fadeColor?: string;
  /**
   * Edge fade hints at the left/right of the track. Disable for a clean
   * hard-cut peek (no gradient wash over the peeking card). Default: true.
   */
  showFade?: boolean;
  /** Controlled mode — caller manages offset. Both props required together. */
  offset?: number;
  onOffsetChange?: (offset: number) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Carousel<T,>({
  items,
  renderItem,
  perView     = 3,
  gap         = 12,
  className,
  showDots    = true,
  showArrows  = true,
  showCounter = true,
  ariaLabel   = 'Image carousel',
  fadeColor   = '#ffffff',
  showFade    = true,
  offset: controlledOffset,
  onOffsetChange,
}: CarouselProps<T>) {
  // Fade from the section bg color to a fully-transparent version of the *same*
  // color, so the edge blends cleanly (fading to bare `transparent` can leave a
  // grey tint on non-white backgrounds).
  const fadeTransparent = `color-mix(in srgb, ${fadeColor} 0%, transparent)`;
  const pv  = usePerView(perView);
  const max = Math.max(0, items.length - pv);

  const [internalOffset, setInternalOffset] = useState(0);
  const [animating, setAnimating]           = useState(false);

  const isControlled = controlledOffset !== undefined;
  const offset = isControlled ? controlledOffset! : internalOffset;

  const setOffset = useCallback((n: number) => {
    if (isControlled) onOffsetChange?.(n);
    else              setInternalOffset(n);
  }, [isControlled, onOffsetChange]);

  const slideTo = useCallback((next: number) => {
    if (animating) return;
    const clamped = Math.max(0, Math.min(max, next));
    if (clamped === offset) return;
    setAnimating(true);
    setOffset(clamped);
    setTimeout(() => setAnimating(false), 400);
  }, [animating, offset, max, setOffset]);

  const prev = useCallback(() => slideTo(offset - 1), [slideTo, offset]);
  const next = useCallback(() => slideTo(offset + 1), [slideTo, offset]);

  // Reset to 0 when perView changes (only in uncontrolled mode)
  useEffect(() => {
    if (!isControlled) setInternalOffset(0);
  }, [pv, isControlled]);

  const drag = useDrag((dir) => { dir === 1 ? next() : prev(); });

  const hasOverflow = items.length > pv;
  const translatePct = -(offset * (100 / pv));

  // Dot/counter math — robust to a fractional perView (e.g. 4.5 for a half-card
  // peek). Pages step in whole cards; the final dot snaps to `max` so the last
  // card can be fully revealed. For integer perView this is identical to max+1.
  const pages       = Math.floor(max) + 1;
  const activeDot   = Math.min(Math.round(offset), pages - 1);

  return (
    <div
      className={cn('select-none', className)}
      role="region"
      aria-label={ariaLabel}
      aria-roledescription="carousel"
    >
      {/* Visually-hidden live region announces slide changes to screen readers */}
      <span aria-live="polite" aria-atomic="true" className="sr-only">
        {`Showing items ${offset + 1} to ${Math.min(offset + pv, items.length)} of ${items.length}`}
      </span>

      {/* ── Sliding track + edge fades (scoped together) ── */}
      <div className="relative">
        <div
          className="overflow-hidden"
          {...drag}
          style={{ cursor: hasOverflow ? 'grab' : 'default' }}
          onMouseDown={e => { drag.onMouseDown(e); if (hasOverflow) (e.currentTarget as HTMLDivElement).style.cursor = 'grabbing'; }}
          onMouseUp={e => { drag.onMouseUp(e); if (hasOverflow) (e.currentTarget as HTMLDivElement).style.cursor = 'grab'; }}
          onMouseLeave={e => { drag.onMouseUp(e as unknown as React.MouseEvent); if (hasOverflow) (e.currentTarget as HTMLDivElement).style.cursor = 'grab'; }}
        >
          <div
            style={{
              display:    'flex',
              gap:        `${gap}px`,
              transform:  `translateX(calc(${translatePct}% - ${offset * gap / pv}px))`,
              transition: 'transform 0.42s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              willChange: 'transform',
            }}
          >
            {items.map((item, i) => (
              <div
                key={i}
                role="group"
                aria-label={`Item ${i + 1} of ${items.length}`}
                aria-roledescription="slide"
                className="shrink-0"
                style={{ width: `calc((100% - ${(pv - 1) * gap}px) / ${pv})` }}
              >
                {renderItem(item, i)}
              </div>
            ))}
          </div>
        </div>

        {/* ── Edge fade hints — scoped to track, never overlap controls ── */}
        {showFade && hasOverflow && offset > 0 && (
          <div
            className="absolute inset-y-0 left-0 w-12 pointer-events-none z-10"
            style={{ background: `linear-gradient(to right, ${fadeColor}, ${fadeTransparent})` }}
          />
        )}
        {showFade && hasOverflow && offset < max && (
          <div
            className="absolute inset-y-0 right-0 w-12 pointer-events-none z-10"
            style={{ background: `linear-gradient(to left, ${fadeColor}, ${fadeTransparent})` }}
          />
        )}
      </div>

      {/* ── Controls ── */}
      {hasOverflow && (showDots || showArrows) && (
        <div className="flex items-center justify-between mt-3">

          {/* Dot indicators */}
          {showDots && (
            <div className="flex items-center gap-1.5">
              {Array.from({ length: pages }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => slideTo(i === pages - 1 ? max : i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    i === activeDot ? 'w-5 bg-primary-500' : 'w-1.5 bg-neutral-300 hover:bg-neutral-400'
                  )}
                />
              ))}
            </div>
          )}

          {/* Prev / Next arrows */}
          {showArrows && (
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={prev}
                disabled={offset === 0}
                aria-label="Previous"
                className={cn(
                  'size-8 rounded-full flex items-center justify-center transition-all duration-200',
                  offset === 0
                    ? 'bg-neutral-100 text-neutral-300 cursor-not-allowed'
                    : 'bg-primary-500 text-white hover:bg-primary-600 shadow-md shadow-primary-200/60'
                )}
              >
                <ChevronLeftIcon className="size-4" />
              </button>

              {showCounter && (
                <span className="text-[11px] text-neutral-400 font-medium tabular-nums w-10 text-center select-none">
                  {activeDot + 1} / {pages}
                </span>
              )}

              <button
                type="button"
                onClick={next}
                disabled={offset === max}
                aria-label="Next"
                className={cn(
                  'size-8 rounded-full flex items-center justify-center transition-all duration-200',
                  offset === max
                    ? 'bg-neutral-100 text-neutral-300 cursor-not-allowed'
                    : 'bg-primary-500 text-white hover:bg-primary-600 shadow-md shadow-primary-200/60'
                )}
              >
                <ChevronRightIcon className="size-4" />
              </button>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
