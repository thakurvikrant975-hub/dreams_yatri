"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "../ui/button";
import { Input }  from "../ui/input";
import { Loader2, ChevronsUpDown, Check, X } from "lucide-react";
import { cn } from "@/app/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────

export type Option = {
  id:           number;
  label:        string;
  description?: string;
};

type SearchSelectProps = {
  value?:        number | null;
  onChange:      (val: number | null, option?: Option) => void;
  fetchOptions:  (query: string) => Promise<Option[]>;
  placeholder?:  string;
  initialLabel?: string;
  disabled?:     boolean;
};

// ── Component ─────────────────────────────────────────────────────────────

export function SearchSelect({
  value,
  onChange,
  fetchOptions,
  placeholder  = "Search...",
  initialLabel = "",
  disabled     = false,
}: SearchSelectProps) {
  const [open,          setOpen]          = useState(false);
  const [query,         setQuery]         = useState("");
  const [options,       setOptions]       = useState<Option[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(initialLabel);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const fetchRef     = useRef(fetchOptions);

  // Keep fetch ref current without re-triggering effects
  useEffect(() => { fetchRef.current = fetchOptions; });

  // Click outside → close
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // Focus input on open; reset on close
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery("");
      setOptions([]);
    }
  }, [open]);

  // Debounced fetch: immediate for empty query, 300 ms for typed queries
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);

    const delay = query === "" ? 0 : 300;
    const timer = setTimeout(async () => {
      try {
        const results = await fetchRef.current(query);
        if (!cancelled) setOptions(results);
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelect(opt: Option) {
    setSelectedLabel(opt.label);
    onChange(opt.id, opt);
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedLabel("");
    onChange(null);
  }

  const hasValue = value != null;
  const triggerLabel = hasValue && selectedLabel ? selectedLabel : undefined;

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(prev => !prev)}
        className="w-full justify-between font-normal h-9 text-sm"
      >
        <span className={cn("truncate", !triggerLabel && "text-muted-foreground")}>
          {triggerLabel ?? placeholder}
        </span>
        <span className="flex items-center gap-0.5 shrink-0 ml-1">
          {hasValue && (
            <span
              role="button"
              aria-label="Clear"
              onClick={handleClear}
              className="rounded p-0.5 hover:bg-muted"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
        </span>
      </Button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-background shadow-md">
          <div className="p-1.5 border-b">
            <Input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Type to search..."
              className="h-8 text-sm"
            />
          </div>

          <div className="max-h-52 overflow-y-auto p-1">
            {loading ? (
              <div className="flex items-center justify-center py-5">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : options.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-5">
                {query ? "No results found" : "Start typing to search"}
              </p>
            ) : (
              options.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelect(opt)}
                  className={cn(
                    "w-full flex items-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted text-left",
                    value === opt.id && "bg-muted"
                  )}
                >
                  <Check className={cn(
                    "h-3.5 w-3.5 mt-0.5 shrink-0",
                    value === opt.id ? "opacity-100" : "opacity-0"
                  )} />
                  <div className="min-w-0">
                    <p className="font-medium leading-tight truncate">{opt.label}</p>
                    {opt.description && (
                      <p className="text-xs text-muted-foreground">{opt.description}</p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
