"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  size,
  useClick,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
} from "@floating-ui/react";
import { cn } from "@/app/lib/utils";
import { ChevronDownIcon, MagnifyingGlassIcon } from "@heroicons/react/24/solid";
import axios from "axios";

export interface SearchSelectOption {
  id:   number;
  name: string;
}

interface SearchSelectProps {
  value?:        string;
  placeholder?:  string;
  fetchUrl:      string;
  extraParams?:  Record<string, string | number>;
  onChange:      (option: SearchSelectOption) => void;
  disabled?:     boolean;
  error?:        string;
  allowCustom?:  boolean;
}

export function SearchSelect({
  value,
  placeholder = "Search...",
  fetchUrl,
  extraParams = {},
  onChange,
  disabled = false,
  error,
  allowCustom = false,
}: SearchSelectProps) {
  const [query,   setQuery]   = useState("");
  const [options, setOptions] = useState<SearchSelectOption[]>([]);
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);

  const inputRef    = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelRef   = useRef<AbortController | null>(null);

  // ── Floating UI ────────────────────────────────────────────────────────────
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: (next) => {
      if (disabled) return;
      setOpen(next);
      if (!next) setQuery("");
    },
    placement: "bottom-start",
    middleware: [
      offset(6),
      flip({
        fallbackPlacements: ["top-start", "bottom-end", "top-end"],
        padding: 8,
      }),
      shift({ padding: 8 }),
      // Match trigger width, cap dropdown height
      size({
        apply({ rects, elements, availableHeight }) {
          Object.assign(elements.floating.style, {
            width:     `${rects.reference.width}px`,
            maxHeight: `${Math.min(availableHeight - 8, 320)}px`,
          });
        },
        padding: 8,
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const click   = useClick(context,   { enabled: !disabled });
  const dismiss = useDismiss(context, { outsidePress: true });
  const role    = useRole(context,    { role: "listbox" });

  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, role]);

  // ── Focus search input when dropdown opens ─────────────────────────────────
  useEffect(() => {
    if (open) {
      fetchOptions("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Axios fetch with abort ─────────────────────────────────────────────────
  const fetchOptions = useCallback(async (q: string) => {
    if (cancelRef.current) cancelRef.current.abort();
    cancelRef.current = new AbortController();
    setLoading(true);

    try {
      const { data } = await axios.get<SearchSelectOption[]>(fetchUrl, {
        params:  { q, ...extraParams },
        signal:  cancelRef.current.signal,
      });
      setOptions(data);
    } catch (err) {
      if (!axios.isCancel(err)) setOptions([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchUrl, JSON.stringify(extraParams)]);

  // ── Debounced search ───────────────────────────────────────────────────────
  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!val.trim()) {
      fetchOptions("");
      return;
    }

    debounceRef.current = setTimeout(() => fetchOptions(val), 350);
  }

  function handleSelect(opt: SearchSelectOption) {
    setQuery("");
    setOpen(false);
    onChange(opt);
  }

  function handleCustomConfirm() {
    if (!query.trim()) return;
    setOpen(false);
    onChange({ id: -1, name: query.trim() });
    setQuery("");
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (cancelRef.current)   cancelRef.current.abort();
    };
  }, []);

  return (
    <div className="relative w-full">

      {/* ── Trigger ── */}
      <div
        ref={refs.setReference}
        {...getReferenceProps()}
        className={cn(
          "w-full h-10 rounded-xl px-3 text-sm font-medium flex items-center justify-between cursor-pointer ring-[0.09em] ring-inset transition outline-none select-none",
          disabled
            ? "bg-neutral-100 text-neutral-500 ring-neutral-300 cursor-not-allowed"
            : error
            ? "text-error-800 ring-error-300 bg-error-500/15"
            : open
            ? "ring-neutral-500 bg-white text-neutral-900"
            : "bg-white text-neutral-900 hover:ring-neutral-400 ring-neutral-400/60"
        )}
      >
        <span className={cn("truncate flex-1 min-w-0", !value && "text-neutral-400 font-normal")}>
          {value || placeholder}
        </span>
        <ChevronDownIcon className={cn(
          "size-4 text-neutral-500 transition-transform duration-200 shrink-0 ml-2",
          open && "rotate-180"
        )} />
      </div>

      {/* ── Floating Dropdown ── */}
      {open && !disabled && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="z-[9999] rounded-xl bg-white shadow-xl ring-1 ring-black/10 overflow-hidden flex flex-col"
          >

            {/* Search input — sticky at top */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-100 shrink-0">
              <MagnifyingGlassIcon className="size-4 text-neutral-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={handleSearchChange}
                placeholder={placeholder}
                className="flex-1 text-sm outline-none bg-transparent placeholder:text-neutral-400 min-w-0"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(""); fetchOptions(""); }}
                  className="text-neutral-400 hover:text-neutral-600 text-xs shrink-0"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Options list — scrollable */}
            <div className="overflow-y-auto flex-1">
              {loading ? (
                <p className="px-3 py-3 text-xs text-neutral-400">Searching...</p>

              ) : options.length > 0 ? (
                options.map((opt) => (
                  <div
                    key={opt.id}
                    role="option"
                    aria-selected={value === opt.name}
                    onClick={() => handleSelect(opt)}
                    className={cn(
                      "px-3 py-2 text-sm cursor-pointer hover:bg-neutral-100 transition select-none",
                      value === opt.name && "bg-primary-500 text-white pointer-events-none"
                    )}
                  >
                    {opt.name}
                  </div>
                ))

              ) : query ? (
                <div className="px-3 py-3 text-xs text-neutral-400">
                  <p>No results for "{query}"</p>
                  {allowCustom && (
                    <button
                      type="button"
                      onClick={handleCustomConfirm}
                      className="mt-1.5 text-primary-600 font-medium hover:underline block"
                    >
                      + Add "{query}" manually
                    </button>
                  )}
                </div>

              ) : (
                <p className="px-3 py-3 text-xs text-neutral-400">
                  Start typing to search...
                </p>
              )}
            </div>

            {/* Footer — cities only (when capped at 15) */}
            {!query && options.length >= 15 && (
              <div className="px-3 py-1.5 border-t border-neutral-100 shrink-0">
                <p className="text-[10px] text-neutral-400">
                  Showing top 15 — type to search more
                </p>
              </div>
            )}

          </div>
        </FloatingPortal>
      )}

      {error && (
        <p className="text-error-500 mt-1.5 text-xs font-medium">{error}</p>
      )}
    </div>
  );
}