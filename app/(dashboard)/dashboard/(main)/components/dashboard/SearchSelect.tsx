"use client";

import { useState, useEffect, useRef } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { SearchIcon, Loader2, ChevronDownIcon, XIcon, CheckIcon, ImageIcon } from "lucide-react";
import Image from "next/image";
import { cn } from "@/app/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────

export type Option = {
  id:           number;
  label:        string;
  description?: string;
  thumbnail?:   string;
  badge?:       string;
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

  const inputRef = useRef<HTMLInputElement>(null);
  const fetchRef = useRef(fetchOptions);
  useEffect(() => { fetchRef.current = fetchOptions; });

  // Reset state on close; focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
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
    return () => { cancelled = true; clearTimeout(timer); };
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

  const hasValue      = value != null;
  const triggerLabel  = hasValue && selectedLabel ? selectedLabel : undefined;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={(v) => !disabled && setOpen(v)}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-xs",
            "ring-offset-background transition-colors",
            "hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            open && "border-ring ring-2 ring-ring ring-offset-2",
          )}
        >
          <span className={cn("flex-1 truncate text-left", !triggerLabel && "text-muted-foreground")}>
            {triggerLabel ?? placeholder}
          </span>
          <span className="flex shrink-0 items-center gap-0.5">
            {hasValue && (
              <span
                role="button"
                aria-label="Clear"
                onClick={handleClear}
                className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <XIcon className="h-3 w-3" />
              </span>
            )}
            <ChevronDownIcon className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
              open && "rotate-180",
            )} />
          </span>
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          sideOffset={5}
          align="start"
          avoidCollisions
          className={cn(
            "z-50 w-(--radix-popover-trigger-width) overflow-hidden rounded-xl border border-border/80 bg-background shadow-lg outline-none",
            // Enter/exit animations matching LocationSearchSelect
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
          )}
        >
          {/* Search input row */}
          <div className="flex items-center gap-2 border-b px-3 py-2.5">
            <SearchIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {loading && (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Options list */}
          <div className="max-h-56 overflow-y-auto py-1">
            {!loading && options.length === 0 ? (
              <p className="px-3 py-5 text-center text-xs text-muted-foreground">
                {query ? "No results found" : "Start typing to search"}
              </p>
            ) : (
              options.map((opt) => {
                const isSelected = value === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(opt); }}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors",
                      isSelected
                        ? "bg-primary/10 text-foreground"
                        : opt.badge
                          ? "bg-emerald-50/60 text-foreground hover:bg-emerald-50"
                          : "text-foreground hover:bg-muted/60",
                    )}
                  >
                    {opt.thumbnail ? (
                      <Image
                        src={opt.thumbnail}
                        alt={opt.label}
                        width={40}
                        height={30}
                        className="h-8 w-11 rounded-md object-cover shrink-0 border"
                      />
                    ) : opt.thumbnail !== undefined ? (
                      <div className="h-8 w-11 rounded-md bg-muted border flex items-center justify-center shrink-0">
                        <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    ) : null}
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-xs font-medium leading-tight">
                        {opt.label}
                      </span>
                      {(opt.description || opt.badge) && (
                        <span className="flex items-center gap-1.5">
                          {opt.description && (
                            <span className="truncate text-[10px] text-muted-foreground">
                              {opt.description}
                            </span>
                          )}
                          {opt.badge && (
                            <span className="shrink-0 rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide bg-emerald-100 text-emerald-700 border border-emerald-200">
                              {opt.badge}
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                    <CheckIcon className={cn(
                      "h-3.5 w-3.5 shrink-0 text-primary transition-opacity",
                      isSelected ? "opacity-100" : "opacity-0",
                    )} />
                  </button>
                );
              })
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
