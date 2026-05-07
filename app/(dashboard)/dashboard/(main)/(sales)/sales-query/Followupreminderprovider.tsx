"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
import { getMyFollowUps } from "./actions";

const CHECK_INTERVAL_MS = 30 * 1000; // Check every 30s instead of 60s

type FollowUp = {
    id: string;
    note: string;
    followUpAt: Date | null;
    packageQuery: {
        id: string;
        name: string;
        destination: string | null;
        status: string;
    };
};

export function FollowUpReminderProvider() {
    // Key: `${id}-due` or `${id}-upcoming-${scheduledTimestamp}`
    // Using the timestamp in the key means rescheduled follow-ups fire again correctly.
    const notifiedKeys = useRef<Set<string>>(new Set());
    // On mount, seed notifiedKeys from sessionStorage so remounts don't re-fire
    const seeded = useRef(false);

    useEffect(() => {
        if (!seeded.current) {
            try {
                const stored = sessionStorage.getItem("fu-notified");
                if (stored) {
                    const keys: string[] = JSON.parse(stored);
                    keys.forEach(k => notifiedKeys.current.add(k));
                }
            } catch {
                // ignore
            }
            seeded.current = true;
        }

        function persist() {
            try {
                sessionStorage.setItem(
                    "fu-notified",
                    JSON.stringify([...notifiedKeys.current]),
                );
            } catch {
                // ignore
            }
        }

        function markNotified(key: string) {
            notifiedKeys.current.add(key);
            persist();
        }

        async function checkFollowUps() {
            let followUps: FollowUp[];
            try {
                followUps = (await getMyFollowUps()) as FollowUp[];
            } catch {
                return; // silently ignore network/server errors
            }

            const now = Date.now();

            for (const fu of followUps) {
                // Skip follow-ups on closed/converted queries — no point reminding
                if (["CLOSED", "CONVERTED"].includes(fu.packageQuery.status)) continue;
                if (!fu.followUpAt) continue;

                const dueAt = new Date(fu.followUpAt).getTime();
                // Use timestamp in key so rescheduling a follow-up fires a fresh notification
                const dueKey = `${fu.id}-due-${dueAt}`;
                const upcomingKey = `${fu.id}-upcoming-${dueAt}`;

                const msUntilDue = dueAt - now;
                const msOverdue = now - dueAt;

                // ── Due notification ──────────────────────────────────────────
                // Fire if: past due AND not more than 10 minutes late
                // (wide window ensures we don't miss it even if a check is delayed)
                if (
                    msOverdue >= 0 &&
                    msOverdue <= 10 * 60 * 1000 &&
                    !notifiedKeys.current.has(dueKey)
                ) {
                    markNotified(dueKey);
                    toast(`📞 Follow-up due: ${fu.packageQuery.name}`, {
                        description:
                            fu.note.length > 80
                                ? fu.note.slice(0, 80) + "…"
                                : fu.note,
                        duration: 12000,
                        icon: <CalendarClock className="h-4 w-4 text-amber-500" />,
                        action: {
                            label: "View",
                            onClick: () => {
                                window.location.href = `/dashboard/sales-query`;
                            },
                        },
                    });
                }

                // ── Upcoming warning (5 min before) ──────────────────────────
                // Fire if: between 5:30 and 0:30 minutes away
                // The ±30s buffer handles interval timing jitter
                if (
                    msUntilDue > 0 &&
                    msUntilDue <= 5.5 * 60 * 1000 &&
                    !notifiedKeys.current.has(upcomingKey)
                ) {
                    markNotified(upcomingKey);
                    const minsLeft = Math.ceil(msUntilDue / 1000 / 60);
                    toast(
                        `⏰ Follow-up in ${minsLeft} min: ${fu.packageQuery.name}`,
                        {
                            description: fu.packageQuery.destination
                                ? `Destination: ${fu.packageQuery.destination}`
                                : fu.note.slice(0, 60),
                            duration: 10000,
                        },
                    );
                }
            }
        }

        // Fire immediately on mount
        checkFollowUps();

        // Then on a regular interval
        const interval = setInterval(checkFollowUps, CHECK_INTERVAL_MS);

        // Also re-check when the tab regains focus — catches cases where the
        // browser throttled the interval while the tab was in the background
        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                checkFollowUps();
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            clearInterval(interval);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);

    return null;
}