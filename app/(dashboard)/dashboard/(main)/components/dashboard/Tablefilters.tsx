import { Search } from "lucide-react";
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
}

export function TableFilters({
    search,
    onSearchChange,
    searchPlaceholder = "Search...",
    filters = [],
    filteredCount,
    totalCount,
    className,
}: TableFiltersProps) {
    const showCount = filteredCount !== undefined && totalCount !== undefined;
    const isFiltered = filters.some(f => f.value !== (f.allValue ?? "all")) || search.length > 0;

    return (
        <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center", className)}>

            {/* ── Left: Search ── */}
            <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dashboard-base-content/75 pointer-events-none" />
                <Input
                    placeholder={searchPlaceholder}
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className={cn(
                        "pl-9 h-10 text-sm",
                        "bg-dashboard-base-100 border border-dashboard-base-300",
                        "text-dashboard-base-content placeholder:text-dashboard-base-content/35",
                        "focus-visible:ring-dashboard-primary/30 focus-visible:border-dashboard-primary",
                        "transition-colors rounded-lg placeholder:text-dashboard-base-content/70",
                    )}
                />
            </div>

            {/* ── Right: Filters ── */}
            {filters.length > 0 && (
                <div className="flex items-center gap-2 shrink-0">
                    {/* Filter icon — visual hint */}
                    {filters.map((filter, i) => {
                        const allValue   = filter.allValue ?? "all";
                        const isActive   = filter.value !== allValue;

                        return (
                            <Select
                                key={i}
                                value={filter.value}
                                onValueChange={filter.onChange}
                            >
                                <SelectTrigger
                                    className={cn(
                                        filter.width ?? "w-40",
                                        "h-10 text-sm rounded-lg transition-colors",
                                        "border-dashboard-base-300 bg-dashboard-base-100",
                                        "text-dashboard-base-content/70 cursor-pointer",
                                        "focus:ring-dashboard-primary/30 focus:border-dashboard-primary",
                                        // highlight trigger when a non-default filter is active
                                        isActive && "border-dashboard-primary/50 bg-dashboard-primary/5 text-dashboard-primary",
                                    )}
                                >
                                    <SelectValue placeholder={filter.placeholder} />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-dashboard-base-300 bg-dashboard-base-100">
                                    <SelectItem
                                        value={allValue}
                                        className="text-sm text-dashboard-base-content/55 focus:bg-dashboard-base-200 focus:text-dashboard-base-content rounded-lg"
                                    >
                                        {filter.placeholder}
                                    </SelectItem>
                                    {filter.options.map((opt) => (
                                        <SelectItem
                                            key={opt.value}
                                            value={opt.value}
                                            className="text-sm text-dashboard-base-content focus:bg-dashboard-base-200 focus:text-dashboard-base-content rounded-lg"
                                        >
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        );
                    })}
                </div>
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
    );
}