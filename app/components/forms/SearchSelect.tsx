// app/components/forms/SearchSelect.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/app/lib/utils";
import { ChevronDownIcon, MagnifyingGlassIcon } from "@heroicons/react/24/solid";
import axios from "axios";

export interface SearchSelectOption {
  id:   number;
  name: string;
}

interface SearchSelectProps {
  value?:         string;
  placeholder?:   string;
  fetchUrl:       string;
  extraParams?:   Record<string, string | number>;
  onChange:       (option: SearchSelectOption) => void;
  disabled?:      boolean;
  error?:         string;
  allowCustom?:   boolean;
}

const DEFAULT_LIMIT = 5;   // shown on open before typing
const SEARCH_LIMIT  = 10;  // shown after typing

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

  const wrapperRef  = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelRef   = useRef<AbortController | null>(null);

  // ── Close on outside click ───────────────────────────────────────────────────
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Axios fetch ──────────────────────────────────────────────────────────────
  const fetchOptions = useCallback(async (q: string) => {
    // Cancel previous in-flight request
    if (cancelRef.current) cancelRef.current.abort();
    cancelRef.current = new AbortController();

    setLoading(true);

    try {
      const limit = q.trim() ? SEARCH_LIMIT : DEFAULT_LIMIT;

      const { data } = await axios.get<SearchSelectOption[]>(fetchUrl, {
        params: {
          q,
          limit,
          ...extraParams,
        },
        signal: cancelRef.current.signal,
      });

      setOptions(data);
    } catch (err) {
      if (!axios.isCancel(err)) setOptions([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchUrl, JSON.stringify(extraParams)]);

  // ── Open dropdown ────────────────────────────────────────────────────────────
  function handleOpen() {
    if (disabled) return;
    setOpen(true);
    setQuery("");
    fetchOptions(""); // load default 5
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  // ── Debounced search input ───────────────────────────────────────────────────
  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Immediate fetch on empty (back to default 5), debounced on typing
    if (!val.trim()) {
      fetchOptions("");
      return;
    }

    debounceRef.current = setTimeout(() => {
      fetchOptions(val);
    }, 350);
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

  // ── Cleanup on unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (cancelRef.current)   cancelRef.current.abort();
    };
  }, []);

  return (
    <div ref={wrapperRef} className="relative w-full">

      {/* ── Trigger ── */}
      <div
        onClick={handleOpen}
        className={cn(
          "w-full h-10 rounded-xl px-3 text-sm font-medium flex items-center justify-between cursor-pointer ring-[0.09em] ring-inset transition outline-none",
          disabled
            ? "bg-neutral-100 text-neutral-500 ring-neutral-300 cursor-not-allowed"
            : error
            ? "text-error-800 ring-error-300 bg-error-500/15"
            : "bg-white text-neutral-900 hover:ring-neutral-400 ring-neutral-400/60"
        )}
      >
        <span className={cn("truncate", !value && "text-neutral-400")}>
          {value || placeholder}
        </span>
        <ChevronDownIcon className={cn(
          "size-4 text-neutral-500 transition-transform duration-200",
          open && "rotate-180"
        )} />
      </div>

      {/* ── Dropdown ── */}
      {open && !disabled && (
        <div className="absolute z-50 mt-1.5 w-full rounded-xl bg-white shadow-lg ring-1 ring-black/10 overflow-hidden">

          {/* Search input */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-100">
            <MagnifyingGlassIcon className="size-4 text-neutral-400 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={handleSearchChange}
              placeholder={placeholder}
              className="flex-1 text-sm outline-none bg-transparent placeholder:text-neutral-400"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(""); fetchOptions(""); }}
                className="text-neutral-400 hover:text-neutral-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Options */}
          <div className="max-h-52 overflow-y-auto">
            {loading ? (
              <p className="px-3 py-3 text-xs text-neutral-400">Searching...</p>

            ) : options.length > 0 ? (
              <>
                {!query && (
                  <p className="px-3 pt-2 pb-1 text-[10px] text-neutral-400 uppercase tracking-wide font-medium">
                    Popular
                  </p>
                )}
                {options.map((opt) => (
                  <div
                    key={opt.id}
                    onClick={() => handleSelect(opt)}
                    className={cn(
                      "px-3 py-2 text-sm cursor-pointer hover:bg-neutral-100 transition select-none",
                      value === opt.name && "bg-primary-50 text-primary-600 font-medium"
                    )}
                  >
                    {opt.name}
                  </div>
                ))}
              </>

            ) : query ? (
              <div className="px-3 py-3 text-xs text-neutral-400">
                <p>No results for "{query}"</p>
                {allowCustom && (
                  <button
                    type="button"
                    onClick={handleCustomConfirm}
                    className="mt-1.5 text-primary-600 font-medium hover:underline"
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

          {/* Footer hint */}
          {!query && options.length > 0 && (
            <div className="px-3 py-1.5 border-t border-neutral-100">
              <p className="text-[10px] text-neutral-400">
                Showing {DEFAULT_LIMIT} defaults — type to search more
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-error-500 mt-1.5 text-xs font-medium">{error}</p>
      )}
    </div>
  );
}