"use client";

import { useState, useRef, useEffect, useId, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/app/lib/utils";
import {
  useFloating,
  offset,
  flip,
  shift,
  size,
  autoUpdate,
  useClick,
  useDismiss,
  useInteractions,
} from "@floating-ui/react";
import { CaretDown, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";

import { Check } from "@phosphor-icons/react/dist/ssr";

// Below this many options, scanning the list is faster than typing to filter
// — skip the search bar entirely rather than trust every call site to pass
// showSearch={false} for its own short lists.
const MIN_OPTIONS_FOR_SEARCH = 8;

// Auto-focusing the search input opens the on-screen keyboard, which on a
// phone covers half the viewport and hides the very options list the user
// opened the dropdown to see. Only auto-focus on a fine pointer (mouse/
// trackpad), where there's no virtual keyboard to worry about and keyboard-
// only users still get arrow-key navigation for free.
function hasCoarsePointer(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
}

// ── Option type ───────────────────────────────────────────────────────────────
// Accepts plain strings (value === label) or explicit { value, label } objects.

type RawOption = string | { value: string; label: string };

interface NormalizedOption {
  value: string;
  label: string;
}

function normalize(opt: RawOption): NormalizedOption {
  return typeof opt === "string" ? { value: opt, label: opt } : opt;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface SearchSelectProps {
  options: RawOption[];
  value?: string;
  onChange: (value: string) => void;
  name?: string;
  /** Sets the id on the trigger button — pair with a <Label htmlFor> for an accessible name */
  id?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  showSearch?: boolean;
  /** Show opt.value on the trigger instead of opt.label — useful for compact fields like dial codes */
  compact?: boolean;
  /** Minimum width of the dropdown in px — lets a narrow trigger have a wider dropdown */
  dropdownMinWidth?: number;
  disabled?: boolean;
  error?: boolean;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SearchSelect({
  options,
  value,
  onChange,
  name,
  id,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  showSearch = true,
  compact = false,
  dropdownMinWidth,
  disabled = false,
  error = false,
  className,
}: SearchSelectProps) {
  const listboxId = useId();

  const [open, setOpen]               = useState(false);
  const [query, setQuery]             = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef  = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);

  const normalized = options.map(normalize);
  const shouldShowSearch = showSearch && normalized.length > MIN_OPTIONS_FOR_SEARCH;

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: (next) => { if (!disabled) setOpen(next); },
    placement: "bottom-start",
    // fixed strategy positions relative to the viewport — escapes any
    // overflow:hidden / overflow:auto ancestor in the component tree
    strategy: "fixed",
    middleware: [
      offset(4),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        apply({ rects, elements }) {
          const w = dropdownMinWidth
            ? Math.max(rects.reference.width, dropdownMinWidth)
            : rects.reference.width;
          Object.assign(elements.floating.style, { width: `${w}px` });
        },
        padding: 8,
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const click   = useClick(context, { enabled: !disabled });
  const dismiss = useDismiss(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

  // Reset search + focus input whenever dropdown opens — but skip the
  // auto-focus on touch devices (see hasCoarsePointer above).
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(-1);
      if (shouldShowSearch && !hasCoarsePointer()) {
        const id = setTimeout(() => searchRef.current?.focus(), 10);
        return () => clearTimeout(id);
      }
    }
  }, [open, shouldShowSearch]);

  const filtered = query.trim()
    ? normalized.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : normalized;

  // Keep keyboard-active option scrolled into view
  useEffect(() => {
    if (activeIndex >= 0) {
      optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  const selectOption = useCallback(
    (opt: NormalizedOption) => { onChange(opt.value); setOpen(false); },
    [onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && filtered[activeIndex]) {
          selectOption(filtered[activeIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  // What to show on the trigger: in compact mode show just the value (e.g. "+91"),
  // otherwise show the full label (e.g. "India +91")
  const selectedLabel = compact
    ? (value ?? "")
    : (normalized.find((o) => o.value === value)?.label ?? "");

  const dropdown = open && !disabled && (
    <div
      ref={refs.setFloating}
      id={listboxId}
      role="listbox"
      aria-label={placeholder}
      style={floatingStyles}
      {...getFloatingProps()}
      className="z-9999 rounded-xl bg-white shadow-xl ring-1 ring-neutral-200 overflow-hidden"
    >
      {/* Search bar */}
      {shouldShowSearch && (
        <div className="p-2 border-b border-neutral-100">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-neutral-50 border border-neutral-200">
            <MagnifyingGlass size={13} className="text-neutral-400 shrink-0" />
            <input
              ref={searchRef}
              type="text"
              aria-label="Search options"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveIndex(-1); }}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              className="flex-1 min-w-0 bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 outline-none"
            />
          </div>
        </div>
      )}

      {/* Options */}
      <div className="max-h-56 overflow-y-auto scrollbar-mini py-1">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-sm text-neutral-400 text-center" role="status">
            No results
          </p>
        ) : (
          filtered.map((opt, i) => (
            <div
              key={opt.value + opt.label}
              ref={(el) => { optionRefs.current[i] = el; }}
              role="option"
              aria-selected={opt.value === value}
              onClick={() => selectOption(opt)}
              onMouseEnter={() => setActiveIndex(i)}
              className={cn(
                "px-3 py-2 text-sm cursor-pointer transition-colors select-none",
                opt.value === value
                  ? "bg-primary-500 text-white"
                  : i === activeIndex
                    ? "bg-neutral-100 text-neutral-900"
                    : "text-neutral-700 hover:bg-neutral-50"
              )}
            >
              {opt.label}
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    // className goes on the wrapper so width utilities (w-24, shrink-0, etc.)
    // constrain the wrapper itself rather than just the inner button
    <div className={cn("relative w-full", className)}>
      {name && <input type="hidden" name={name} value={value ?? ""} />}

      {/* Trigger */}
      <button
        type="button"
        id={id}
        ref={(el) => {
          refs.setReference(el);
          (triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = el;
        }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        title={compact ? (normalized.find((o) => o.value === value)?.label ?? placeholder) : undefined}
        className={cn(
          "h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-left shadow-sm outline-none transition-colors flex items-center justify-between gap-2",
          "focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20",
          "disabled:bg-neutral-50 disabled:opacity-60 disabled:cursor-not-allowed",
          open && "border-primary-400 ring-2 ring-primary-500/20",
          error && !open && "border-red-400",
        )}
        {...getReferenceProps()}
      >
        <span className={cn("truncate", !selectedLabel ? "text-neutral-400" : "text-neutral-900")}>
          {selectedLabel || placeholder}
        </span>
        <CaretDown
          size={14}
          weight="bold"
          className={cn(
            "shrink-0 text-neutral-400 transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Portal — renders into document.body, fully outside any overflow container */}
      {typeof document !== "undefined" && createPortal(dropdown, document.body)}
    </div>
  );
}

// ── MultiSearchSelect ─────────────────────────────────────────────────────────

interface MultiSearchSelectProps {
  options: RawOption[];
  value: string[];
  onChange: (value: string[]) => void;
  /** Sets the id on the combobox trigger — pair with a <Label htmlFor> for an accessible name */
  id?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  showSearch?: boolean;
  disabled?: boolean;
  className?: string;
}

export function MultiSearchSelect({
  options,
  value,
  onChange,
  id,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  showSearch = true,
  disabled = false,
  className,
}: MultiSearchSelectProps) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const searchRef  = useRef<HTMLInputElement>(null);
  const normalized = options.map(normalize);
  const shouldShowSearch = showSearch && normalized.length > MIN_OPTIONS_FOR_SEARCH;

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: (next) => { if (!disabled) setOpen(next); },
    placement: "bottom-start",
    strategy: "fixed",
    middleware: [
      offset(4),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        apply({ rects, elements }) {
          Object.assign(elements.floating.style, { width: `${rects.reference.width}px` });
        },
        padding: 8,
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const click   = useClick(context, { enabled: !disabled });
  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

  useEffect(() => {
    if (open) {
      setQuery("");
      if (shouldShowSearch && !hasCoarsePointer()) {
        const id = setTimeout(() => searchRef.current?.focus(), 10);
        return () => clearTimeout(id);
      }
    }
  }, [open, shouldShowSearch]);

  const filtered = query.trim()
    ? normalized.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : normalized;

  function toggle(opt: NormalizedOption) {
    const next = value.includes(opt.value)
      ? value.filter((v) => v !== opt.value)
      : [...value, opt.value];
    onChange(next);
  }


  const dropdown = open && !disabled && (
    <div
      ref={refs.setFloating}
      id={listboxId}
      role="listbox"
      aria-multiselectable="true"
      aria-label={placeholder}
      style={floatingStyles}
      {...getFloatingProps()}
      className="z-9999 rounded-xl bg-white shadow-xl ring-1 ring-neutral-200 overflow-hidden"
    >
      {shouldShowSearch && (
        <div className="p-2 border-b border-neutral-100">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-neutral-50 border border-neutral-200">
            <MagnifyingGlass size={13} className="text-neutral-400 shrink-0" />
            <input
              ref={searchRef}
              type="text"
              aria-label="Search options"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex-1 min-w-0 bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 outline-none"
            />
          </div>
        </div>
      )}
      <div className="max-h-56 overflow-y-auto scrollbar-mini py-1">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-sm text-neutral-400 text-center" role="status">No results</p>
        ) : (
          filtered.map((opt) => {
            const selected = value.includes(opt.value);
            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={selected}
                onClick={() => toggle(opt)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer transition-colors select-none",
                  selected ? "bg-primary-50 text-primary-700" : "text-neutral-700 hover:bg-neutral-50"
                )}
              >
                <span className={cn(
                  "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                  selected ? "bg-primary-500 border-primary-500" : "border-neutral-300 bg-white"
                )}>
                  {selected && <Check size={10} weight="bold" className="text-white" />}
                </span>
                {opt.label}
              </div>
            );
          })
        )}
      </div>
      {value.length > 0 && (
        <div className="px-3 py-2 border-t border-neutral-100 flex justify-end">
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className={cn("relative w-full", className)}>
      <div
        id={id}
        ref={refs.setReference as React.RefCallback<HTMLDivElement>}
        role="combobox"
        tabIndex={disabled ? undefined : 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        className={cn(
          "min-h-10 w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm shadow-sm outline-none transition-colors flex flex-wrap items-center gap-1.5 cursor-pointer",
          open && "border-primary-400 ring-2 ring-primary-500/20",
          disabled && "bg-neutral-50 opacity-60 pointer-events-none",
        )}
        {...getReferenceProps()}
      >
        {value.length === 0 ? (
          <span className="text-neutral-400 px-1 flex-1">{placeholder}</span>
        ) : (
          value.map((v) => {
            const label = normalized.find((o) => o.value === v)?.label ?? v;
            return (
              <span
                key={v}
                className="flex items-center gap-1 bg-primary-50 text-primary-700 border border-primary-200 rounded-md px-2 py-0.5 text-xs font-medium shrink-0"
              >
                {label}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onChange(value.filter((x) => x !== v)); }}
                  disabled={disabled}
                  aria-label={`Remove ${label}`}
                  className="text-primary-400 hover:text-primary-700 leading-none ml-0.5"
                >
                  ×
                </button>
              </span>
            );
          })
        )}
        <CaretDown
          size={14}
          weight="bold"
          className={cn("ml-auto shrink-0 text-neutral-400 transition-transform duration-150", open && "rotate-180")}
        />
      </div>
      {typeof document !== "undefined" && createPortal(dropdown, document.body)}
    </div>
  );
}
