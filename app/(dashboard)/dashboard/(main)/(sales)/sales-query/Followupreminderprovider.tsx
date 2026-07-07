"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarClock, ClipboardList, Loader2 } from "lucide-react";
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { getMyFollowUps, addFollowUp, getSalesQueryById } from "./actions";
import { PackageDetailsDialog } from "./Packagedetailsdialog";
import type { PackageQueryType, PackageRequirements } from "../../(marketing)/queries/actions";

const CHECK_INTERVAL_MS = 30 * 1000; // Check every 30s instead of 60s

// Formats a Date into the value a `datetime-local` input expects (local time,
// no timezone suffix) — e.g. "2026-07-07T14:45".
function toDatetimeLocalValue(d: Date): string {
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const QUICK_FOLLOWUP_OPTIONS = [
    { label: "10 min", ms: 10 * 60 * 1000 },
    { label: "30 min", ms: 30 * 60 * 1000 },
    { label: "1 hr", ms: 60 * 60 * 1000 },
    { label: "6 hr", ms: 6 * 60 * 60 * 1000 },
    { label: "1 day", ms: 24 * 60 * 60 * 1000 },
];

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

    // ── Reminder popup state ─────────────────────────────────────────────────
    const [dueFollowUp, setDueFollowUp] = useState<FollowUp | null>(null);
    const [mode, setMode] = useState<"prompt" | "reschedule">("prompt");
    const [rescheduleAt, setRescheduleAt] = useState("");
    const [isRescheduling, startReschedule] = useTransition();

    // ── Deep-opened Package Requirements dialog ─────────────────────────────
    const [reqQuery, setReqQuery] = useState<PackageQueryType | null>(null);
    const [reqInitial, setReqInitial] = useState<PackageRequirements | null>(null);
    const [reqOpen, setReqOpen] = useState(false);
    const [loadingReq, setLoadingReq] = useState(false);

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

                // ── Due — open the interactive reminder popup ─────────────────
                // Fire if: past due AND not more than 10 minutes late
                // (wide window ensures we don't miss it even if a check is delayed)
                if (
                    msOverdue >= 0 &&
                    msOverdue <= 10 * 60 * 1000 &&
                    !notifiedKeys.current.has(dueKey)
                ) {
                    markNotified(dueKey);
                    setDueFollowUp(fu);
                    setMode("prompt");
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

    function closeReminder() {
        setDueFollowUp(null);
        setMode("prompt");
    }

    async function handleFillRequirements() {
        if (!dueFollowUp) return;
        setLoadingReq(true);
        try {
            const full = await getSalesQueryById(dueFollowUp.packageQuery.id);
            if (full) {
                setReqQuery(full as unknown as PackageQueryType);
                setReqInitial((full as { requirements?: unknown }).requirements as PackageRequirements | null ?? null);
                setReqOpen(true);
                closeReminder();
            } else {
                toast.error("Couldn't load this query — it may have been deleted.");
            }
        } finally {
            setLoadingReq(false);
        }
    }

    function handleStartReschedule() {
        setMode("reschedule");
        // Prefill with 1 hour from now as a sensible default
        setRescheduleAt(toDatetimeLocalValue(new Date(Date.now() + 60 * 60 * 1000)));
    }

    function setQuickReschedule(ms: number) {
        setRescheduleAt(toDatetimeLocalValue(new Date(Date.now() + ms)));
    }

    function handleConfirmReschedule() {
        if (!dueFollowUp || !rescheduleAt) return;
        startReschedule(async () => {
            const fd = new FormData();
            fd.set("note", dueFollowUp.note); // preserve the existing note
            fd.set("followUpAt", rescheduleAt);
            const result = await addFollowUp(dueFollowUp.packageQuery.id, fd);
            if (result.success) {
                toast.success("Follow-up rescheduled");
                closeReminder();
            } else {
                toast.error(result.message);
            }
        });
    }

    return (
        <>
            {/* ── Reminder popup ───────────────────────────────────────────────── */}
            <Dialog open={!!dueFollowUp} onOpenChange={(v) => { if (!v) closeReminder(); }}>
                <DialogContent className="sm:max-w-md">
                    {dueFollowUp && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-amber-600">
                                    <CalendarClock className="h-4 w-4" />
                                    Follow-Up Due
                                </DialogTitle>
                                <DialogDescription>
                                    Your follow-up with{" "}
                                    <span className="font-semibold text-foreground">{dueFollowUp.packageQuery.name}</span>{" "}
                                    is due now.
                                    {dueFollowUp.packageQuery.destination && (
                                        <> — {dueFollowUp.packageQuery.destination}</>
                                    )}
                                </DialogDescription>
                            </DialogHeader>

                            {dueFollowUp.note && (
                                <div className="rounded-lg bg-muted/50 border px-3 py-2 text-sm">
                                    {dueFollowUp.note}
                                </div>
                            )}

                            {mode === "prompt" ? (
                                <DialogFooter className="flex-col sm:flex-row gap-2 pt-1">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="gap-2"
                                        onClick={handleStartReschedule}
                                    >
                                        <CalendarClock className="h-3.5 w-3.5" />
                                        Reschedule Follow-Up
                                    </Button>
                                    <Button
                                        type="button"
                                        className="gap-2"
                                        onClick={handleFillRequirements}
                                        disabled={loadingReq}
                                    >
                                        {loadingReq
                                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            : <ClipboardList className="h-3.5 w-3.5" />}
                                        Fill Package Requirements
                                    </Button>
                                </DialogFooter>
                            ) : (
                                <div className="space-y-4 pt-1">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="reschedule-time">New follow-up time</Label>
                                        <Input
                                            id="reschedule-time"
                                            type="datetime-local"
                                            value={rescheduleAt}
                                            onChange={(e) => setRescheduleAt(e.target.value)}
                                            min={new Date().toISOString().slice(0, 16)}
                                        />
                                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                                            {QUICK_FOLLOWUP_OPTIONS.map((opt) => (
                                                <button
                                                    key={opt.label}
                                                    type="button"
                                                    onClick={() => setQuickReschedule(opt.ms)}
                                                    className="px-2.5 py-1 rounded-full border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors"
                                                >
                                                    +{opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button type="button" variant="outline" onClick={() => setMode("prompt")}>
                                            Back
                                        </Button>
                                        <Button
                                            type="button"
                                            onClick={handleConfirmReschedule}
                                            disabled={isRescheduling || !rescheduleAt}
                                        >
                                            {isRescheduling ? "Saving..." : "Confirm Reschedule"}
                                        </Button>
                                    </DialogFooter>
                                </div>
                            )}
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* ── Package Requirements, deep-opened from the reminder ─────────── */}
            {reqQuery && (
                <PackageDetailsDialog
                    key={reqQuery.id}
                    query={reqQuery}
                    initialRequirements={reqInitial}
                    open={reqOpen}
                    onOpenChange={setReqOpen}
                    onDone={() => setReqOpen(false)}
                >
                    <span />
                </PackageDetailsDialog>
            )}
        </>
    );
}
