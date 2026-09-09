"use client";

/**
 * BookingCelebrationDialog
 * ─────────────────────────────────────────────────────────────────────────────
 * The bigger, one-time "you did it" moment on top of BookingWonToast's quiet
 * toast — fires specifically when ops verifies a sales exec's manually
 * submitted payment proof (see approveBookingPayments), though it listens to
 * the same booking-won event so it fires for a gateway-confirmed sale too.
 *
 * Shown exactly once per booking: dismissing it (either button, or the X)
 * persists celebrationSeenAt so it never reappears, live or on reload. A
 * second small dialog immediately follows asking if they want to plan a
 * party for it — entirely optional, never re-asked once answered.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PartyPopper, Sparkles } from "lucide-react";
import { useBookingWon, type BookingWon } from "@/app/lib/ably-client";
import {
    getUnseenCelebration, markCelebrationSeen, requestParty,
    type UnseenCelebration,
} from "../../package-bookings/payment-proof.actions";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";

function formatAmount(amountPaise: number, currency: string): string {
    const rupees = Math.round(amountPaise / 100);
    return `${currency} ${rupees.toLocaleString("en-IN")}`;
}

function toUnseen(won: BookingWon): UnseenCelebration {
    return {
        id: won.bookingId,
        bookingNumber: won.bookingNumber,
        packageTitle: won.packageTitle,
        clientName: won.clientName,
        amountPaise: won.amountPaise,
        currency: won.currency,
    };
}

export function BookingCelebrationDialog({ memberId }: { memberId: string }) {
    const router = useRouter();
    const [celebration, setCelebration] = useState<UnseenCelebration | null>(null);
    const [stage, setStage] = useState<"celebrate" | "party" | null>(null);
    const [sendingParty, setSendingParty] = useState(false);

    // Live: ops approves while this exec has a dashboard tab open.
    useBookingWon(memberId, (won) => {
        setCelebration(toUnseen(won));
        setStage("celebrate");
    });

    // Catch-up: they weren't watching when it happened — checked once, on
    // whichever page first mounts this (the dashboard home, same as the toast).
    useEffect(() => {
        getUnseenCelebration().then((c) => {
            if (c) { setCelebration(c); setStage("celebrate"); }
        });
    }, []);

    async function dismissCelebration() {
        if (celebration) await markCelebrationSeen(celebration.id);
        setStage("party");
    }

    function closeParty() {
        setStage(null);
        setCelebration(null);
        router.refresh();
    }

    async function sendParty() {
        if (!celebration) return closeParty();
        setSendingParty(true);
        try {
            const res = await requestParty(celebration.id);
            toast.success(res.message);
        } finally {
            setSendingParty(false);
            closeParty();
        }
    }

    if (!celebration) return null;

    return (
        <>
            <Dialog open={stage === "celebrate"} onOpenChange={(open) => { if (!open) dismissCelebration(); }}>
                <DialogContent className="max-w-sm text-center p-8">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-dashboard-success/10">
                        <PartyPopper className="h-8 w-8 text-dashboard-success" />
                    </div>
                    <DialogTitle className="mt-4 text-xl font-bold text-dashboard-base-content">Booking Confirmed! 🎉</DialogTitle>
                    <p className="mt-2 text-sm text-dashboard-base-content/70">
                        {celebration.clientName ? `${celebration.clientName}'s ` : ""}{celebration.packageTitle} is locked in —
                        {" "}{formatAmount(celebration.amountPaise, celebration.currency)} verified, booking {celebration.bookingNumber}.
                    </p>
                    <button
                        onClick={dismissCelebration}
                        className="mt-5 w-full rounded-lg bg-dashboard-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                    >
                        Nice!
                    </button>
                </DialogContent>
            </Dialog>

            <Dialog open={stage === "party"} onOpenChange={(open) => { if (!open) closeParty(); }}>
                <DialogContent className="max-w-sm text-center p-8">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-dashboard-accent/10">
                        <Sparkles className="h-8 w-8 text-dashboard-accent" />
                    </div>
                    <DialogTitle className="mt-4 text-lg font-bold text-dashboard-base-content">Want to plan a party to celebrate this one?</DialogTitle>
                    <p className="mt-2 text-sm text-dashboard-base-content/70">
                        We&rsquo;ll let your team know you&rsquo;d love to mark the occasion.
                    </p>
                    <button
                        onClick={sendParty}
                        disabled={sendingParty}
                        className="mt-5 w-full rounded-lg bg-dashboard-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {sendingParty ? "Sending…" : "Yes, let's celebrate!"}
                    </button>
                    <button
                        onClick={closeParty}
                        disabled={sendingParty}
                        className="mt-2 w-full text-xs text-dashboard-base-content/50 hover:text-dashboard-base-content/70 transition-colors disabled:opacity-50"
                    >
                        Maybe next time
                    </button>
                </DialogContent>
            </Dialog>
        </>
    );
}
