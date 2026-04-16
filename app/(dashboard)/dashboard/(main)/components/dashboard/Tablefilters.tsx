import { Search } from "lucide-react";
import { Input } from "../ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface FilterOption {
    label: string;
    value: string;
}

export interface FilterConfig {
    /** Controlled value */
    value: string;
    /** Setter */
    onChange: (value: string) => void;
    /** Dropdown options (excluding the "All" item which is auto-added) */
    options: FilterOption[];
    /** Placeholder shown in trigger and as the "all" label, e.g. "All Destinations" */
    placeholder: string;
    /** Trigger width class, defaults to "w-40" */
    width?: string;
    /** The value used for the catch-all option, defaults to "all" */
    allValue?: string;
}

export interface TableFiltersProps {
    // ── Search ────────────────────────────────────────────────────────────────
    search: string;
    onSearchChange: (value: string) => void;
    searchPlaceholder?: string;

    // ── Filters ───────────────────────────────────────────────────────────────
    filters?: FilterConfig[];

    // ── Count display ─────────────────────────────────────────────────────────
    filteredCount?: number;
    totalCount?: number;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function TableFilters({
    search,
    onSearchChange,
    searchPlaceholder = "Search...",
    filters = [],
    filteredCount,
    totalCount,
}: TableFiltersProps) {
    const showCount =
        filteredCount !== undefined && totalCount !== undefined;

    return (
        <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder={searchPlaceholder}
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="pl-9"
                />
            </div>

            {/* Dynamic filters */}
            {filters.map((filter, i) => {
                const allValue = filter.allValue ?? "all";
                return (
                    <Select
                        key={i}
                        value={filter.value}
                        onValueChange={filter.onChange}
                    >
                        <SelectTrigger className={filter.width ?? "w-40"}>
                            <SelectValue placeholder={filter.placeholder} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={allValue}>
                                {filter.placeholder}
                            </SelectItem>
                            {filter.options.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );
            })}


        </div>
    );
}