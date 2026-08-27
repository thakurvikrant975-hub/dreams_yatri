"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { rejectAllPendingHotels } from "../actions";

/** Declines every currently-pending day on this package with one shared
 * reason — for when nothing in the whole request is fulfillable, rather
 * than working through each day's own Reject button one at a time. */
export function RejectAllButton({ packageId, pendingCount }: { packageId: string; pendingCount: number }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState("");

    function handleRejectAll() {
        if (!reason.trim()) { toast.error("A reason is required to reject these hotel requests."); return; }
        startTransition(async () => {
            try {
                const result = await rejectAllPendingHotels(packageId, reason);
                if (result.success) {
                    toast.success(`Rejected ${result.count} pending day${result.count !== 1 ? "s" : ""} — the sales exec has been notified.`);
                    setOpen(false);
                    setReason("");
                    // Nothing on this package is actionable any more, so go back
                    // to the queue rather than leaving the admin on a finished
                    // page to navigate out of by hand.
                    router.push("/dashboard/hotel-requests-v2");
                } else {
                    toast.error(result.error ?? "Failed to reject");
                }
            } catch (e) {
                // An uncaught server-action error unwinds past this route's own
                // error boundary to the unstyled global error page; caught, the
                // dialog is still open with the reason still typed in it.
                console.error("[RejectAllButton] reject-all failed", e);
                toast.error("Couldn't reject these days — try again.");
            }
        });
    }

    if (!open) {
        return (
            <Button
                type="button" size="sm" variant="outline"
                className="h-8 text-xs gap-1.5 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                onClick={() => setOpen(true)}
            >
                <Ban className="size-3.5" /> Reject All {pendingCount} Pending Days
            </Button>
        );
    }

    return (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 space-y-2 w-full">
            <p className="text-sm font-semibold text-red-800 flex items-center gap-1.5">
                <Ban className="size-4" /> Reject all {pendingCount} pending day{pendingCount !== 1 ? "s" : ""} on this package
            </p>
            <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Wrong destination for our catalog / budget too low across the board"
                rows={2}
                className="text-sm resize-none bg-white"
            />
            <div className="flex items-center gap-2">
                <Button
                    type="button" size="sm"
                    className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white"
                    disabled={isPending || !reason.trim()}
                    onClick={handleRejectAll}
                >
                    {isPending ? "Rejecting…" : "Confirm Reject All"}
                </Button>
                <Button
                    type="button" size="sm" variant="ghost"
                    className="h-8 text-xs"
                    onClick={() => { setOpen(false); setReason(""); }}
                >
                    Cancel
                </Button>
            </div>
        </div>
    );
}
