"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { confirmCabLeg } from "../actions";

const inputCls =
    "h-9 w-full rounded-md border border-dashboard-base-300 bg-dashboard-base-100 px-3 text-sm text-dashboard-base-content outline-none focus:border-dashboard-primary placeholder:text-dashboard-neutral/60";

export default function CabConfirmPanel({
    bookingId,
    legNumber,
    fromLocation,
    toLocation,
}: {
    bookingId: string;
    legNumber: number;
    fromLocation: string;
    toLocation: string;
}) {
    const router = useRouter();
    const [notes, setNotes] = useState("");
    const [confirming, setConfirming] = useState(false);

    async function handleConfirm() {
        setConfirming(true);
        try {
            const res = await confirmCabLeg(bookingId, legNumber, {
                fromLocation,
                toLocation,
                notes: notes.trim() || undefined,
            });
            if (!res.success) { toast.error(res.error); return; }
            toast.success(
                res.allConfirmed
                    ? "All cabs verified! Booking status updated."
                    : "Cab availability verified for this leg.",
            );
            router.refresh();
        } finally { setConfirming(false); }
    }

    return (
        <div className="flex items-center gap-2">
            <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Verification notes (optional)"
                className={`${inputCls} flex-1`}
            />
            <button
                type="button"
                onClick={handleConfirm}
                disabled={confirming}
                className="cursor-pointer shrink-0 rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-700/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {confirming ? "Verifying…" : "✓ Verify Cab"}
            </button>
        </div>
    );
}
