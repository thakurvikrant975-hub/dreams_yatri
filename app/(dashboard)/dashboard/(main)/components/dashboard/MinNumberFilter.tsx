"use client";

import { cn } from "@/app/lib/utils";

/** A "min value" filter — package cost and group size are both "show me
 * records at or above X" asks, so one small control covers both instead of
 * writing it twice with a different prefix. Shared by the marketing Queries
 * table and the Sales Queries table so the two filter bars behave and look
 * identically. */
export function MinNumberFilter({
    label, value, onChange, prefix, placeholder, width = "w-40",
}: {
    label: string;
    value: number | null;
    onChange: (v: number | null) => void;
    prefix?: string;
    placeholder?: string;
    width?: string;
}) {
    const active = value !== null;
    return (
        <div className={cn(
            "flex items-center gap-1.5 h-10 px-3 rounded-lg border transition-colors",
            "border-dashboard-base-300 bg-dashboard-base-100 focus-within:border-dashboard-primary",
            active && "border-dashboard-primary/50 bg-dashboard-primary/5",
            width,
        )}>
            <span className={cn("text-xs whitespace-nowrap", active ? "text-dashboard-primary" : "text-dashboard-base-content/50")}>
                {label}
            </span>
            {prefix && <span className="text-xs text-dashboard-base-content/40">{prefix}</span>}
            <input
                type="number"
                min={0}
                inputMode="numeric"
                value={value ?? ""}
                placeholder={placeholder}
                onChange={(e) => {
                    const v = e.target.value.trim();
                    onChange(v === "" ? null : Math.max(0, Number(v)));
                }}
                className="w-full min-w-0 bg-transparent outline-none text-sm tabular-nums text-dashboard-base-content placeholder:text-dashboard-base-content/35"
            />
        </div>
    );
}
