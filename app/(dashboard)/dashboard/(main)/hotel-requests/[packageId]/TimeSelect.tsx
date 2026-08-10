"use client";

import { cn } from "@/app/lib/utils";

// A plain <select> populated with 30-minute slots — deliberately not the
// native <input type="time"> (its widget/format varies by browser and OS,
// which is what actually caused the "conflicts": the free-text field this
// replaced let the hotel team type times in whatever format they liked —
// "2pm", "14:00", "2:00pm" — and only some of those parsed correctly
// downstream in the itinerary PDF). Every option here is always a clean
// 24h "HH:MM" value, same convention the rest of the app already stores
// hotel times in, so it's guaranteed to render consistently everywhere.
const TIME_OPTIONS: { value: string; label: string }[] = Array.from({ length: 48 }, (_, i) => {
    const h = Math.floor(i / 2);
    const m = i % 2 === 0 ? 0 : 30;
    const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const label = `${h12}:${String(m).padStart(2, "0")} ${period}`;
    return { value, label };
});

export function TimeSelect({
    value, onChange, placeholder = "Select time", className,
}: {
    /** 24h "HH:MM", or "" for unset. */
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
                "h-9 w-full text-sm rounded-md border border-input bg-background px-2.5",
                "cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring",
                className,
            )}
        >
            <option value="">{placeholder}</option>
            {TIME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
            ))}
        </select>
    );
}
