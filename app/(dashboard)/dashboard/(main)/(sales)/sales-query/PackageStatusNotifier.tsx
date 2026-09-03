"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { getMyUnseenPackageEvents } from "@/app/(dashboard)/dashboard/(builder)/package-builder/action";

const CHECK_INTERVAL_MS = 20 * 1000;

/**
 * Surfaces "your package was approved" / "…was rejected — <reason>" /
 * "hotel added for <package>" / "hotel request rejected for <client>" as a
 * toast without the exec needing to refresh — polled, not pushed (no
 * generic in-app notification bus exists in this dashboard yet; see
 * getMyUnseenPackageEvents for why this stays narrowly scoped to just these
 * events rather than building one).
 */
export function PackageStatusNotifier() {
    // Held in a ref so the poll below keeps its empty dependency list —
    // re-running that effect on every navigation would restart the interval and
    // fire an extra check each time. Written in an effect rather than during
    // render, which is when a ref may not be touched.
    const pathname = usePathname();
    const pathnameRef = useRef(pathname);
    useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

    /**
     * A "Reload" button on the toast, but only when the exec is looking at the
     * very package the event is about.
     *
     * The builder holds the package in local form state loaded when the page
     * opened, so an exec sitting in it while the hotel team fills a day has a
     * copy that predates the fill — the toast tells them something happened
     * that their screen will not show. Reloading is deliberately their click
     * rather than automatic: they may have unsaved edits in front of them, and
     * throwing those away to deliver news is a bad trade.
     */
    function reloadActionFor(packageId: string) {
        const onThisPackage = pathnameRef.current?.includes(`/package-builder/${packageId}`);
        if (!onThisPackage) return undefined;
        return { label: "Reload", onClick: () => window.location.reload() };
    }

    useEffect(() => {
        async function check() {
            let events: Awaited<ReturnType<typeof getMyUnseenPackageEvents>>;
            try {
                events = await getMyUnseenPackageEvents();
            } catch {
                return; // silently ignore network/server errors
            }
            for (const e of events) {
                if (e.kind === "verified") {
                    toast.success(`Package approved — ${e.title}`, {
                        description: "Costing signed off on the pricing. Open the package and use Share with Client to send it.",
                        duration: 12000,
                    });
                } else if (e.kind === "rejected") {
                    toast.error(`Package rejected — ${e.title}`, {
                        description: [e.reasonLabel, e.note].filter(Boolean).join(" — ") || "See the package for details.",
                        duration: 15000,
                    });
                } else if (e.kind === "hotel_filled") {
                    const dayLines = e.days
                        .map((d) => [`Day ${d.day}`, d.hotelName].filter(Boolean).join(" · "))
                        .join(", ");
                    toast.success(`Hotel${e.days.length > 1 ? "s" : ""} added for "${e.title}"`, {
                        description: [
                            dayLines,
                            // A fill deliberately does NOT advance the package
                            // to costing — submitting is the exec's own call,
                            // and a one-way door once taken. So this says what
                            // is actually left to do, rather than the old
                            // "ready for costing review", which was describing
                            // an auto-advance that no longer happens.
                            e.stillPending > 0
                                ? `${e.stillPending} day${e.stillPending === 1 ? "" : "s"} still with the hotel team`
                                : "every day is filled — check it over and submit for costing",
                            e.filledByName ? `filled by ${e.filledByName}` : null,
                        ].filter(Boolean).join(" — "),
                        duration: 12000,
                        action: reloadActionFor(e.id),
                    });
                } else {
                    const dayLines = e.days
                        .map((d) => [`Day ${d.day}`, d.note].filter(Boolean).join(" · "))
                        .join(", ");
                    toast.error(
                        `Hotel request rejected for ${e.clientName ?? e.title}`,
                        {
                            description: [
                                dayLines,
                                e.rejectedByName ? `by ${e.rejectedByName}` : null,
                                "Open the package to update the request.",
                            ].filter(Boolean).join(" — "),
                            duration: 15000,
                            action: reloadActionFor(e.id),
                        },
                    );
                }
            }
        }

        check();
        const interval = setInterval(check, CHECK_INTERVAL_MS);

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") check();
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            clearInterval(interval);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);

    return null;
}
