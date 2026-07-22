"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
    CalendarClock, ClipboardList, Loader2, Phone, MapPin,
    Package, StickyNote, X, AlarmClockOff, CheckCheck,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { getMyFollowUps, addFollowUp, deleteFollowUp, getSalesQueryById } from "./actions";
import { PackageDetailsDialog } from "./Packagedetailsdialog";
import type { PackageQueryType, PackageRequirements } from "../../(marketing)/queries/actions";

const CHECK_INTERVAL_MS = 30 * 1000; // Check every 30s instead of 60s
const BEEP_INTERVAL_MS = 5 * 1000;
const SNOOZE_MS = 10 * 60 * 1000;
// Overdue follow-ups that are dismissed (or just sitting there unaddressed)
// must keep resurfacing at this cadence — the only way to silence one for
// good is to Clear it, Snooze it, or push it to a future date.
const RESHOW_INTERVAL_MS = 10 * 60 * 1000;

// Formats a Date into the value a `datetime-local` input expects (local time,
// no timezone suffix) — e.g. "2026-07-07T14:45".
function toDatetimeLocalValue(d: Date): string {
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

/**
 * `datetime-local` inputs give back a bare "2026-07-30T14:45" string with no
 * timezone info. `new Date()` on that string means "local time in whichever
 * environment parses it" — parsing it here (the browser) is what makes it the
 * *user's* local time. Converting to an ISO instant before it's sent to the
 * server action is what stops the server (running in its own timezone, often
 * UTC) from silently reinterpreting the same digits as a different moment.
 */
function toIsoInstant(datetimeLocalValue: string): string {
    return new Date(datetimeLocalValue).toISOString();
}

function playBeep() {
    if (typeof window === "undefined") return;
    try {
        const AudioCtx = window.AudioContext
            ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
        osc.onended = () => ctx.close();
    } catch {
        // Autoplay blocked or unsupported — fail silently, the visible
        // notification card still does its job.
    }
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
        phone: string;
        email: string | null;
        destination: string | null;
        packageName: string | null;
        status: string;
    };
};

export function FollowUpReminderProvider() {
    // One-shot "upcoming in 5 min" toast keys — `${id}-upcoming-${dueAt}`.
    // Using the timestamp means rescheduling fires a fresh warning.
    const upcomingNotified = useRef<Set<string>>(new Set());
    // Overdue follow-ups aren't one-shot — this tracks when each was last
    // *surfaced* so checkFollowUps can bring it back every RESHOW_INTERVAL_MS
    // if it's still overdue and the user hasn't cleared/snoozed/rescheduled it.
    const lastShownAt = useRef<Map<string, number>>(new Map());
    const seeded = useRef(false);

    // ── Reminder notification queue ─────────────────────────────────────────
    const [dueQueue, setDueQueue] = useState<FollowUp[]>([]);
    const [rescheduleTargetId, setRescheduleTargetId] = useState<string | null>(null);
    const [rescheduleAt, setRescheduleAt] = useState("");
    const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

    // ── Deep-opened Package Requirements dialog ─────────────────────────────
    const [reqQuery, setReqQuery] = useState<PackageQueryType | null>(null);
    const [reqInitial, setReqInitial] = useState<PackageRequirements | null>(null);
    const [reqOpen, setReqOpen] = useState(false);
    const [loadingReq, setLoadingReq] = useState(false);

    useEffect(() => {
        if (!seeded.current) {
            try {
                const storedUpcoming = sessionStorage.getItem("fu-upcoming-notified");
                if (storedUpcoming) {
                    const keys: string[] = JSON.parse(storedUpcoming);
                    keys.forEach(k => upcomingNotified.current.add(k));
                }
            } catch {
                // ignore
            }
            seeded.current = true;
        }
        // Deliberately NOT persisting `lastShownAt` across reloads — a page
        // refresh must re-surface every currently-overdue follow-up
        // immediately (not wait out whatever's left of its 10-min cooldown).
        // The cooldown only throttles re-showing within a single running tab.

        function persistUpcoming() {
            try {
                sessionStorage.setItem(
                    "fu-upcoming-notified",
                    JSON.stringify([...upcomingNotified.current]),
                );
            } catch {
                // ignore
            }
        }

        async function checkFollowUps() {
            let followUps: FollowUp[];
            try {
                followUps = (await getMyFollowUps()) as FollowUp[];
            } catch {
                return; // silently ignore network/server errors
            }

            const now = Date.now();
            const stillOverdueIds = new Set<string>();

            for (const fu of followUps) {
                // Skip follow-ups on closed/converted queries — no point reminding
                if (["CLOSED", "CONVERTED"].includes(fu.packageQuery.status)) continue;
                if (!fu.followUpAt) continue;

                const dueAt = new Date(fu.followUpAt).getTime();
                const msUntilDue = dueAt - now;
                const msOverdue = now - dueAt;

                // ── Overdue — no upper bound. Surface it now if it's new, or if
                // it's been dismissed/missed for RESHOW_INTERVAL_MS — it must
                // keep resurfacing until the user clears/snoozes/reschedules it.
                if (msOverdue >= 0) {
                    stillOverdueIds.add(fu.id);
                    const last = lastShownAt.current.get(fu.id);
                    if (last === undefined || now - last >= RESHOW_INTERVAL_MS) {
                        lastShownAt.current.set(fu.id, now);
                        setDueQueue(prev => prev.some(p => p.id === fu.id)
                            ? prev.map(p => (p.id === fu.id ? fu : p)) // refresh data in place
                            : [...prev, fu]);
                    }
                    continue;
                }

                // ── Upcoming warning (5 min before) — one-shot toast ──────────
                // Fire if: between 5:30 and 0:30 minutes away
                // The ±30s buffer handles interval timing jitter
                const upcomingKey = `${fu.id}-upcoming-${dueAt}`;
                if (
                    msUntilDue > 0 &&
                    msUntilDue <= 5.5 * 60 * 1000 &&
                    !upcomingNotified.current.has(upcomingKey)
                ) {
                    upcomingNotified.current.add(upcomingKey);
                    persistUpcoming();
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

            // A follow-up that's no longer overdue (cleared/snoozed/rescheduled
            // elsewhere, e.g. another tab) shouldn't linger in the queue.
            setDueQueue(prev => prev.filter(p => stillOverdueIds.has(p.id)));
        }

        // Fire immediately on mount — this is what surfaces the full queue of
        // past-date follow-ups right when the page loads/refreshes.
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

    // ── Beep every 5s while any follow-up notification is showing ──────────
    useEffect(() => {
        if (dueQueue.length === 0) return;
        playBeep();
        const beepInterval = setInterval(playBeep, BEEP_INTERVAL_MS);
        return () => clearInterval(beepInterval);
    }, [dueQueue.length]);

    function setProcessing(id: string, value: boolean) {
        setProcessingIds(prev => {
            const next = new Set(prev);
            if (value) next.add(id); else next.delete(id);
            return next;
        });
    }

    // Dismiss for now — it'll resurface within RESHOW_INTERVAL_MS if still overdue.
    function handleDismiss(id: string) {
        setDueQueue(prev => prev.filter(f => f.id !== id));
        if (rescheduleTargetId === id) { setRescheduleTargetId(null); setRescheduleAt(""); }
    }

    // Clear for good — deletes the follow-up so it never comes back.
    async function handleClear(fu: FollowUp) {
        setProcessing(fu.id, true);
        try {
            const result = await deleteFollowUp(fu.id);
            if (result.success) {
                toast.success("Follow-up cleared");
                setDueQueue(prev => prev.filter(f => f.id !== fu.id));
                lastShownAt.current.delete(fu.id);
            } else {
                toast.error(result.message);
            }
        } finally {
            setProcessing(fu.id, false);
        }
    }

    async function handleFillRequirements(fu: FollowUp) {
        setLoadingReq(true);
        try {
            const full = await getSalesQueryById(fu.packageQuery.id);
            if (full) {
                setReqQuery(full as unknown as PackageQueryType);
                setReqInitial((full as { requirements?: unknown }).requirements as PackageRequirements | null ?? null);
                setReqOpen(true);
                handleDismiss(fu.id);
            } else {
                toast.error("Couldn't load this query — it may have been deleted.");
            }
        } finally {
            setLoadingReq(false);
        }
    }

    function handleStartReschedule(fu: FollowUp) {
        setRescheduleTargetId(fu.id);
        // Prefill with 1 hour from now as a sensible default
        setRescheduleAt(toDatetimeLocalValue(new Date(Date.now() + 60 * 60 * 1000)));
    }

    function setQuickReschedule(ms: number) {
        setRescheduleAt(toDatetimeLocalValue(new Date(Date.now() + ms)));
    }

    async function handleConfirmReschedule(fu: FollowUp) {
        if (!rescheduleAt) return;
        setProcessing(fu.id, true);
        try {
            const fd = new FormData();
            fd.set("note", fu.note); // preserve the existing note
            fd.set("followUpAt", toIsoInstant(rescheduleAt));
            const result = await addFollowUp(fu.packageQuery.id, fd);
            if (result.success) {
                toast.success("Follow-up rescheduled");
                lastShownAt.current.delete(fu.id);
                handleDismiss(fu.id);
            } else {
                toast.error(result.message);
            }
        } finally {
            setProcessing(fu.id, false);
        }
    }

    async function handleSnooze(fu: FollowUp) {
        setProcessing(fu.id, true);
        try {
            const fd = new FormData();
            fd.set("note", fu.note); // preserve the existing note
            fd.set("followUpAt", new Date(Date.now() + SNOOZE_MS).toISOString());
            const result = await addFollowUp(fu.packageQuery.id, fd);
            if (result.success) {
                toast.success("Snoozed for 10 minutes");
                lastShownAt.current.delete(fu.id);
                handleDismiss(fu.id);
            } else {
                toast.error(result.message);
            }
        } finally {
            setProcessing(fu.id, false);
        }
    }

    const sortedQueue = [...dueQueue].sort(
        (a, b) => new Date(a.followUpAt!).getTime() - new Date(b.followUpAt!).getTime(),
    );

    return (
        <>
            {/* ── Reminder notification queue — fixed bottom-right corner ────── */}
            {sortedQueue.length > 0 && (
                <div className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-3 max-h-[calc(100vh-2rem)] overflow-y-auto">
                    {sortedQueue.map((fu, idx) => {
                        const isProcessing = processingIds.has(fu.id);
                        const inReschedule = rescheduleTargetId === fu.id;
                        return (
                            <div
                                key={fu.id}
                                className="w-95 max-w-[calc(100vw-2rem)] rounded-xl border border-amber-300 dark:border-amber-800 bg-background shadow-2xl animate-in slide-in-from-bottom-4 slide-in-from-right-4 fade-in duration-300"
                                role="alert"
                            >
                                <div className="flex items-start gap-2 px-4 pt-3.5 pb-2">
                                    <CalendarClock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                                            Follow-Up Due
                                            {sortedQueue.length > 1 && (
                                                <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                                                    ({idx + 1} of {sortedQueue.length})
                                                </span>
                                            )}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Clear, snooze, or reschedule — it&apos;ll keep coming back otherwise.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleDismiss(fu.id)}
                                        className="shrink-0 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                                        aria-label="Dismiss for now"
                                        title="Dismiss for now — it'll come back in 10 min if still overdue"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>

                                <div className="px-4 pb-3.5 space-y-3">
                                    {/* ── Client details ── */}
                                    <div className="rounded-lg border bg-muted/40 px-3 py-2.5 space-y-1.5">
                                        <p className="text-sm font-semibold text-foreground">
                                            {fu.packageQuery.name}
                                        </p>
                                        <a
                                            href={`tel:${fu.packageQuery.phone}`}
                                            className="flex items-center gap-1.5 text-xs text-primary hover:underline w-fit"
                                        >
                                            <Phone className="h-3 w-3" /> {fu.packageQuery.phone}
                                        </a>
                                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                                            {fu.packageQuery.destination && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-background border text-muted-foreground">
                                                    <MapPin className="h-2.5 w-2.5" /> {fu.packageQuery.destination}
                                                </span>
                                            )}
                                            {fu.packageQuery.packageName && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-background border text-muted-foreground">
                                                    <Package className="h-2.5 w-2.5" /> {fu.packageQuery.packageName}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* ── Saved follow-up note ── */}
                                    {fu.note && (
                                        <div className="rounded-lg bg-muted/50 border px-3 py-2 text-xs space-y-1">
                                            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                <StickyNote className="h-2.5 w-2.5" /> Saved Note
                                            </p>
                                            <p className="text-foreground">{fu.note}</p>
                                        </div>
                                    )}

                                    {!inReschedule ? (
                                        <div className="grid grid-cols-2 gap-2 pt-0.5">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="gap-1.5"
                                                onClick={() => handleClear(fu)}
                                                disabled={isProcessing}
                                            >
                                                {isProcessing
                                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    : <CheckCheck className="h-3.5 w-3.5" />}
                                                Clear
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="gap-1.5"
                                                onClick={() => handleSnooze(fu)}
                                                disabled={isProcessing}
                                            >
                                                <AlarmClockOff className="h-3.5 w-3.5" />
                                                Snooze 10 min
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="gap-1.5 col-span-2"
                                                onClick={() => handleStartReschedule(fu)}
                                            >
                                                <CalendarClock className="h-3.5 w-3.5" />
                                                Reschedule
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                className="gap-1.5 col-span-2"
                                                onClick={() => handleFillRequirements(fu)}
                                                disabled={loadingReq}
                                            >
                                                {loadingReq
                                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    : <ClipboardList className="h-3.5 w-3.5" />}
                                                Fill Package Requirements
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3 pt-0.5">
                                            <div className="space-y-1.5">
                                                <Label htmlFor={`reschedule-time-${fu.id}`} className="text-xs">New follow-up time</Label>
                                                <Input
                                                    id={`reschedule-time-${fu.id}`}
                                                    type="datetime-local"
                                                    value={rescheduleAt}
                                                    onChange={(e) => setRescheduleAt(e.target.value)}
                                                    min={new Date().toISOString().slice(0, 16)}
                                                    className="h-8 text-sm"
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
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    type="button" size="sm" variant="outline"
                                                    onClick={() => { setRescheduleTargetId(null); setRescheduleAt(""); }}
                                                >
                                                    Back
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    onClick={() => handleConfirmReschedule(fu)}
                                                    disabled={isProcessing || !rescheduleAt}
                                                >
                                                    {isProcessing ? "Saving..." : "Confirm Reschedule"}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

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
