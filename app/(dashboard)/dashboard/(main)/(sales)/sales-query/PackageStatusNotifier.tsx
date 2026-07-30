"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { getMyUnseenPackageEvents } from "@/app/(dashboard)/dashboard/(builder)/package-builder/action";

const CHECK_INTERVAL_MS = 20 * 1000;

/**
 * Surfaces "your package was approved" / "…was rejected — <reason>" as a
 * toast without the exec needing to refresh — polled, not pushed (no generic
 * in-app notification bus exists in this dashboard yet; see
 * getMyUnseenPackageEvents for why this stays narrowly scoped to just these
 * two package events rather than building one).
 */
export function PackageStatusNotifier() {
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
                } else {
                    toast.error(`Package rejected — ${e.title}`, {
                        description: [e.reasonLabel, e.note].filter(Boolean).join(" — ") || "See the package for details.",
                        duration: 15000,
                    });
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
