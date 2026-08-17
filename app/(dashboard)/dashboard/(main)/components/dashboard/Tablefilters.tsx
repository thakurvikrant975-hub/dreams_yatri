"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X, SlidersHorizontal, ChevronDown } from "lucide-react";
import { Input } from "../ui/input";
import { cn } from "@/app/lib/utils";
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from "../ui/select";


export interface FilterOption  { label: string; value: string }
export interface FilterConfig {
    value:       string;
    onChange:    (value: string) => void;
    options:     FilterOption[];
    placeholder: string;
    width?:      string;
    allValue?:   string;
}
export interface TableFiltersProps {
    search:              string;
    onSearchChange:      (value: string) => void;
    searchPlaceholder?:  string;
    filters?:            FilterConfig[];
    filteredCount?:      number;
    totalCount?:         number;
    className?:          string;
    /** Tucks `filters` (plus `children`, if given) behind a "Filters" toggle
     * button instead of always showing them inline — for pages with enough
     * filters that the always-visible row overflows/overlaps. Opens by
     * default only if a filter is already active on mount (e.g. from the
     * URL), so an applied filter is never hidden without the user knowing. */
    collapsible?:        boolean;
    /** Extra controls rendered alongside `filters` inside the collapsible
     * panel (e.g. a location search, a rows-per-page select) — ignored
     * unless `collapsible` is set. */
    children?:           React.ReactNode;
}

export function TableFilters({
    search,
    onSearchChange,
    searchPlaceholder = "Search...",
    filters = [],
    filteredCount,
    totalCount,
    className,
    collapsible = false,
    children,
}: TableFiltersProps) {
    const [inputValue, setInputValue] = useState(search);
    const inputRef = useRef<HTMLInputElement>(null);
    const showCount = filteredCount !== undefined && totalCount !== undefined;
    const activeFilterCount = filters.filter(f => f.value !== (f.allValue ?? "all")).length;
    const isFiltered = activeFilterCount > 0 || search.length > 0;
    const isPending = inputValue.trim() !== search;
    const hasFilterPanel = collapsible && (filters.length > 0 || !!children);
    // Mount-time only: if a filter already came in active (e.g. from the
    // URL on load/refresh), start open rather than hiding it silently.
    const [filtersOpen, setFiltersOpen] = useState(activeFilterCount > 0);

    // Sync when parent updates the committed search (URL-driven navigation, filter reset, etc.)
    useEffect(() => {
        setInputValue(search);
    }, [search]);

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter") {
            e.preventDefault();
            onSearchChange(inputValue.trim());
        } else if (e.key === "Escape") {
            if (isPending) {
                // Revert to the last committed value without losing focus
                setInputValue(search);
            } else {
                setInputValue("");
                onSearchChange("");
            }
        }
    }

    function handleClear() {
        setInputValue("");
        onSearchChange("");
        // Restore focus so the user can keep typing immediately
        inputRef.current?.focus();
    }

    function renderFilterSelects() {
        return filters.map((filter, i) => {
            const allValue = filter.allValue ?? "all";
            const isActive = filter.value !== allValue;

            return (
                <Select
                    key={i}
                    value={filter.value}
                    onValueChange={filter.onChange}
                >
                    <SelectTrigger
                        className={cn(
                            filter.width ?? "w-40",
                            "h-10 text-sm rounded-lg cursor-pointer transition-colors",
                            "border-dashboard-base-300 bg-dashboard-base-100",
                            "text-dashboard-base-content/70",
                            "focus:ring-dashboard-primary/30 focus:border-dashboard-primary",
                            isActive && "border-dashboard-primary/50 bg-dashboard-primary/5 text-dashboard-primary",
                        )}
                    >
                        <SelectValue placeholder={filter.placeholder} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-dashboard-base-300 bg-dashboard-base-100">
                        <SelectItem
                            value={allValue}
                            className="text-sm text-dashboard-base-content/55 focus:bg-dashboard-base-200 focus:text-dashboard-base-content rounded-lg cursor-pointer"
                        >
                            {filter.placeholder}
                        </SelectItem>
                        {filter.options.map((opt) => (
                            <SelectItem
                                key={opt.value}
                                value={opt.value}
                                className="text-sm text-dashboard-base-content focus:bg-dashboard-base-200 focus:text-dashboard-base-content rounded-lg cursor-pointer"
                            >
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            );
        });
    }

    return (
        <div className={cn("flex flex-col gap-3", className)}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">

                {/* ── Left: Search ── */}
                <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dashboard-base-content/50 pointer-events-none" />
                    <Input
                        ref={inputRef}
                        placeholder={searchPlaceholder}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className={cn(
                            "pl-9 h-10 text-sm",
                            inputValue ? "pr-14" : "pr-3",
                            "bg-dashboard-base-100 border border-dashboard-base-300",
                            "text-dashboard-base-content placeholder:text-dashboard-base-content/40",
                            "focus-visible:ring-dashboard-primary/30 focus-visible:border-dashboard-primary",
                            "transition-colors rounded-lg",
                        )}
                    />
                    {inputValue && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            {isPending && (
                                <span className="text-[10px] font-mono leading-none text-dashboard-base-content/30 select-none">
                                    ↵
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={handleClear}
                                tabIndex={-1}
                                aria-label="Clear search"
                                className="p-0.5 rounded text-dashboard-base-content/35 hover:text-dashboard-base-content/70 hover:bg-dashboard-base-200 transition-colors"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}
                </div>

                {/* ── Right: Filters ── */}
                {!collapsible && filters.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {renderFilterSelects()}
                    </div>
                )}

                {hasFilterPanel && (
                    <button
                        type="button"
                        onClick={() => setFiltersOpen(o => !o)}
                        aria-expanded={filtersOpen}
                        className={cn(
                            "shrink-0 h-10 px-3.5 flex items-center gap-2 text-sm rounded-lg border transition-colors cursor-pointer",
                            "border-dashboard-base-300 bg-dashboard-base-100 text-dashboard-base-content/70 hover:bg-dashboard-base-200",
                            filtersOpen && "border-dashboard-primary/50 bg-dashboard-primary/5 text-dashboard-primary",
                        )}
                    >
                        <SlidersHorizontal className="h-4 w-4" />
                        Filters
                        {activeFilterCount > 0 && (
                            <span className="min-w-4.5 h-4.5 px-1 flex items-center justify-center text-[10px] font-medium rounded-full bg-dashboard-primary text-white tabular-nums">
                                {activeFilterCount}
                            </span>
                        )}
                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", filtersOpen && "rotate-180")} />
                    </button>
                )}

                {/* ── Count badge ── */}
                {showCount && (
                    <span className={cn(
                        "shrink-0 text-xs font-medium px-2.5 py-1 rounded-full tabular-nums whitespace-nowrap",
                        isFiltered
                            ? "bg-dashboard-primary/10 text-dashboard-primary"
                            : "bg-dashboard-base-200 text-dashboard-base-content/45"
                    )}>
                        {filteredCount} / {totalCount}
                    </span>
                )}
            </div>

            {hasFilterPanel && filtersOpen && (
                <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-dashboard-base-300 bg-dashboard-base-200/30">
                    {renderFilterSelects()}
                    {children}
                </div>
            )}
        </div>
    );
}
