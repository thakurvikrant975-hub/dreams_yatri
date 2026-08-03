"use client";

import { Children, useEffect, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Card, CardBody, CardFooter } from "@/app/components/ui/Card";

/**
 * The listing-page filter sidebar: a sticky, self-sizing Card on desktop and a
 * drawer on mobile, plus the rows that go inside it.
 *
 * Shared so the package search and the destinations listing can't drift apart
 * — they were separate copies, and only one of them ever got the fixes.
 */

/** Rows beyond this are hidden behind a "Show all" toggle so no single section
 *  can push the rest of the sidebar out of reach. */
const COLLAPSE_AFTER = 6;

/** Breathing room between the panel's bottom edge and the viewport bottom. */
const VIEWPORT_GUTTER = 16;

const STICKY_TOP = "calc(var(--spacing-header-height) + 1rem)";

/**
 * Keeps the panel exactly as tall as the viewport space left below it.
 *
 * A static `calc(100svh - header)` can't do this: on first paint the sidebar
 * starts below the promo topbar, header and any search bar, so it would
 * overflow the fold — and once those scroll away and it sticks under the
 * header, it would stop short of the fold instead of using the space it just
 * gained. Measuring the live offset covers both, plus resizes and header-height
 * changes, and writing straight to the node keeps scrolling re-render free.
 */
export function useAvailableHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      const top = el.getBoundingClientRect().top;
      el.style.maxHeight = `${Math.max(240, window.innerHeight - top - VIEWPORT_GUTTER)}px`;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // The promo topbar is dismissible and results reflow as filters apply, both
    // of which move the panel without a scroll or resize event.
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, []);

  return ref;
}

// ── Desktop panel ────────────────────────────────────────────────────────────

export function FilterPanel({
  activeCount, onClearAll, isPending, children,
}: {
  activeCount: number;
  onClearAll: () => void;
  /** Dims the list while the server re-renders the results. */
  isPending?: boolean;
  children: React.ReactNode;
}) {
  const panelRef = useAvailableHeight<HTMLDivElement>();

  return (
    <aside className="hidden lg:block w-75 shrink-0">
      <div className="sticky" style={{ top: STICKY_TOP }}>
        {/* Same Card shell as the cards it sits beside */}
        <Card
          ref={panelRef}
          variant="elevated"
          radius="xl"
          padding="none"
          className="flex flex-col overflow-hidden"
          // Replaced on mount by the measured space below the panel; this is
          // just the pre-hydration value so the first paint isn't oversized.
          style={{ maxHeight: "calc(100svh - var(--spacing-header-height) - 2rem)" }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-muted shrink-0 ">
            <p className="font-semibold font-heading text-neutral-900 text-sm ">
              Filters
              {activeCount > 0 && (
                <span className="ml-1.5 text-xs font-normal text-neutral-400">({activeCount})</span>
              )}
            </p>
            {activeCount > 0 && (
              <button onClick={onClearAll} className="text-xs text-primary hover:underline font-medium">
                Clear all
              </button>
            )}
          </div>
          <CardBody className={`flex-1 overflow-y-auto px-5 py-5 scrollbar-panel ${isPending ? "opacity-60" : ""}`}>
            {children}
          </CardBody>
        </Card>
      </div>
    </aside>
  );
}

/** Matching skeleton for the panel's own Suspense boundary. */
export function FilterPanelSkeleton({ sections = 3 }: { sections?: number }) {
  return (
    <aside className="hidden lg:block w-75 shrink-0">
      <div className="sticky" style={{ top: STICKY_TOP }}>
        <Card variant="elevated" radius="xl" padding="none">
          <div className="px-5 py-4 border-b border-muted">
            <div className="skeleton-box h-4 w-20 rounded" />
          </div>
          <CardBody className="px-5 py-5 space-y-5">
            {Array.from({ length: sections }).map((_, s) => (
              <div key={s} className="space-y-2.5">
                <div className="skeleton-box h-3 w-24 rounded" />
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton-box h-4 w-full rounded" />
                ))}
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </aside>
  );
}

// ── Mobile ───────────────────────────────────────────────────────────────────

export function FilterTrigger({
  activeCount, onOpen,
}: {
  activeCount: number;
  onOpen: () => void;
}) {
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-(--z-sticky) bg-white border-t border-muted px-4 py-3">
      <button
        onClick={onOpen}
        className="flex items-center gap-2 px-4 py-2.5 border border-default rounded-full text-sm font-medium bg-white shadow-sm"
      >
        <SlidersHorizontal className="h-4 w-4" />
        Filters
        {activeCount > 0 && (
          <span className="ml-0.5 bg-primary text-white text-xs font-semibold rounded-full h-5 w-5 flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>
    </div>
  );
}

export function FilterDrawer({
  open, onClose, activeCount, onClearAll, applyLabel, children,
}: {
  open: boolean;
  onClose: () => void;
  activeCount: number;
  onClearAll: () => void;
  /** Call to action on the footer button, e.g. "Show 24 Destinations". */
  applyLabel: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    // Above --z-sticky, or the site header paints over the top of the drawer.
    <div className="lg:hidden fixed inset-0 z-(--z-overlay) flex">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <Card
        variant="elevated"
        radius="none"
        padding="none"
        className="ml-auto w-80 max-w-[85vw] h-full flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-muted">
          <p className="font-semibold text-neutral-800 text-sm">Filters</p>
          <button onClick={onClose} aria-label="Close filters">
            <X className="h-5 w-5 text-neutral-500" />
          </button>
        </div>
        <CardBody className="flex-1 overflow-y-auto px-5 py-5 scrollbar-panel">{children}</CardBody>
        <CardFooter className="px-5 py-4 border-t border-muted space-y-2">
          {activeCount > 0 && (
            <button
              onClick={onClearAll}
              className="w-full py-2.5 border border-default rounded-xl text-sm text-neutral-600"
            >
              Clear All
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-medium"
          >
            {applyLabel}
          </button>
        </CardFooter>
      </Card>
    </div>
  );
}

// ── Rows ─────────────────────────────────────────────────────────────────────

export function FilterSection({
  title, subtitle, selected, onClear, disabled, disabledNote, children,
}: {
  title: string;
  subtitle?: string;
  /** How many options in this section are ticked — drives the "Clear" link. */
  selected: number;
  onClear?: () => void;
  /** Greyed out and inert, e.g. Region while "International" is selected. */
  disabled?: boolean;
  disabledNote?: string;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const rows = Children.toArray(children);
  const hidden = Math.max(0, rows.length - COLLAPSE_AFTER);
  const visible = expanded ? rows : rows.slice(0, COLLAPSE_AFTER);

  return (
    <div
      className={`not-first:border-t not-first:border-muted not-first:pt-6 ${
        disabled ? "opacity-40 pointer-events-none select-none" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold font-heading uppercase tracking-widest text-neutral-900">
          {title}
          {subtitle && (
            <span className="ml-1.5 normal-case tracking-normal font-normal text-neutral-500/90">
              {subtitle}
            </span>
          )}
        </p>
        {disabled && disabledNote && (
          <span className="text-[10px] text-neutral-400">{disabledNote}</span>
        )}
        {!disabled && selected > 0 && onClear && (
          <button onClick={onClear} className="text-[10px] text-primary hover:underline">
            Clear
          </button>
        )}
      </div>
      <div className="space-y-2">{visible}</div>
      {hidden > 0 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2.5 text-xs text-primary hover:underline"
        >
          {expanded ? "Show less" : `Show all (${hidden} more)`}
        </button>
      )}
    </div>
  );
}

export function FilterCheckRow({
  label, hint, count, checked, disabled, onChange,
}: {
  label: string;
  hint?: string;
  count?: number;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex items-center gap-2.5 py-0.5 ${
        disabled ? "cursor-not-allowed" : "cursor-pointer group"
      }`}
    >
      {/* Tailwind's grid-overlay checkbox: the native input is stripped with
          appearance-none and the tick is a sibling SVG stacked in the same grid
          cell, so the control keeps real checkbox semantics (focus, keyboard,
          :checked, forced-colors) while being fully styleable. `group` on the
          wrapper is what lets the SVG react to the input's state. */}
      <div className="group grid size-4 shrink-0 grid-cols-1">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="col-start-1 row-start-1 appearance-none rounded-sm border border-neutral-300 bg-white checked:border-primary-500 checked:bg-primary-500 indeterminate:border-primary-500 indeterminate:bg-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-100 disabled:checked:bg-neutral-100 forced-colors:appearance-auto"
        />
        <svg
          fill="none"
          viewBox="0 0 14 14"
          className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-disabled:stroke-neutral-950/25"
        >
          <path
            d="M3 8L6 11L11 3.5"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-0 group-has-checked:opacity-100"
          />
          <path
            d="M3 7H11"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-0 group-has-indeterminate:opacity-100"
          />
        </svg>
      </div>
      <span
        className={`flex-1 min-w-0 text-sm text-neutral-700 ${
          disabled ? "" : "group-hover:text-primary transition-colors"
        }`}
      >
        {label}
        {hint && <span className="block text-[11px] text-neutral-400">{hint}</span>}
      </span>
      {count !== undefined && <span className="text-xs text-neutral-400 shrink-0">({count})</span>}
    </label>
  );
}

/** Single-select row (the segmented "type" lists), styled to sit alongside the
 *  checkbox rows rather than as a separate control. */
export function FilterRadioRow({
  label, count, active, onSelect,
}: {
  label: string;
  count?: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
        active ? "bg-primary/10 text-primary font-medium" : "text-neutral-600 hover:bg-neutral-50"
      }`}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`text-xs px-1.5 py-0.5 rounded-md ${
            active ? "bg-primary/15 text-primary" : "text-neutral-400 bg-neutral-100"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
