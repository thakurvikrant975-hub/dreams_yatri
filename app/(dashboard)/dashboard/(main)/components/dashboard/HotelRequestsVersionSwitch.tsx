"use client";

import Link from "next/link";
import { FlaskConical, Undo2 } from "lucide-react";
import { cn } from "@/app/lib/utils";

/**
 * Moves the hotel team between the two fill experiences.
 *
 * Both are live at once and read the same rows, so a request filled in either
 * shows up in both queues. That is the point: v2 adds catalog search,
 * quick-create, multi-night fills and the seasonal rate calendar, and if any of
 * it misbehaves mid-shift nobody is stuck — the classic form is one click away
 * and untouched.
 *
 * Deliberately presentational and shared. It is the one thing the two versions
 * have in common, and keeping it in a single file is what stops the two queues
 * drifting into looking like unrelated screens.
 */
export function HotelRequestsVersionSwitch({ current }: { current: "v1" | "v2" }) {
    const options = [
        {
            key: "v1" as const,
            href: "/dashboard/hotel-requests",
            label: "Classic",
            hint: "The original form",
            Icon: Undo2,
        },
        {
            key: "v2" as const,
            href: "/dashboard/hotel-requests-v2",
            label: "New",
            hint: "Catalog search, seasons, multi-night",
            Icon: FlaskConical,
        },
    ];

    return (
        <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-dashboard-neutral">Fill using</span>
            <div className="inline-flex rounded-lg border border-dashboard-border bg-dashboard-muted/40 p-0.5">
                {options.map((o) => {
                    const active = o.key === current;
                    return (
                        <Link
                            key={o.key}
                            href={o.href}
                            title={o.hint}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                                active
                                    ? "bg-white text-dashboard-text shadow-sm border border-dashboard-border"
                                    : "text-dashboard-neutral hover:text-dashboard-text",
                            )}
                        >
                            <o.Icon className="size-3.5" />
                            {o.label}
                        </Link>
                    );
                })}
            </div>
            <span className="text-[11px] text-dashboard-neutral/70">
                {current === "v2"
                    ? "Something off? Switch back to Classic — the same requests are waiting there."
                    : "Same requests either way."}
            </span>
        </div>
    );
}
