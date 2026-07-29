"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatPaiseRoundedUp } from "@/app/lib/money";
import { adminPreviewCancellation, adminCancelBooking, adminSyncPayments } from "../actions";
import type { CancellationPreview } from "@/app/actions/payment/types";

const btn = "rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export default function BookingAdminActions({
    bookingId,
    cancellable,
    hasPendingPayments,
}: {
    bookingId: string;
    cancellable: boolean;
    hasPendingPayments: boolean;
}) {
    const router = useRouter();
    const [syncing, setSyncing] = useState(false);
    const [showCancel, setShowCancel] = useState(false);
    const [preview, setPreview] = useState<CancellationPreview | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [reason, setReason] = useState("");
    const [cancelling, setCancelling] = useState(false);

    async function onSync() {
        setSyncing(true);
        try {
            const res = await adminSyncPayments(bookingId);
            if (!res.success) { toast.error(res.error); return; }
            toast.success(`Synced — ${res.finalized} confirmed, ${res.failed} failed${res.skipped ? `, ${res.skipped} unchanged` : ""}.`);
            router.refresh();
        } finally {
            setSyncing(false);
        }
    }

    async function openCancel() {
        setShowCancel(true);
        setLoadingPreview(true);
        try {
            const res = await adminPreviewCancellation(bookingId);
            if (!res.success) { toast.error(res.error); setShowCancel(false); return; }
            setPreview(res.preview);
        } finally {
            setLoadingPreview(false);
        }
    }

    async function confirmCancel() {
        setCancelling(true);
        try {
            const res = await adminCancelBooking(bookingId, reason);
            if (!res.success) { toast.error(res.error); return; }
            toast.success(
                res.alreadyCancelled
                    ? "Booking was already cancelled."
                    : `Booking cancelled. Refund ${res.refundPct}% = ${formatPaiseRoundedUp(res.refundablePaise)}.`,
            );
            setShowCancel(false);
            router.refresh();
        } finally {
            setCancelling(false);
        }
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
                {hasPendingPayments && (
                    <button onClick={onSync} disabled={syncing} className={`${btn} border border-dashboard-base-300 text-dashboard-base-content hover:bg-dashboard-base-200`}>
                        {syncing ? "Syncing…" : "Sync payment status"}
                    </button>
                )}
                {cancellable && !showCancel && (
                    <button onClick={openCancel} className={`${btn} border border-red-200 text-red-600 hover:bg-red-50`}>
                        Cancel booking
                    </button>
                )}
            </div>

            {showCancel && (
                <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
                    <div className="text-sm font-semibold text-dashboard-base-content">Cancel this booking?</div>
                    {loadingPreview ? (
                        <p className="mt-2 text-sm text-dashboard-neutral">Calculating refund…</p>
                    ) : preview ? (
                        <div className="mt-2 text-sm text-dashboard-neutral">
                            Paid {formatPaiseRoundedUp(preview.paidPaise)} · {preview.daysToTravel} day{preview.daysToTravel !== 1 ? "s" : ""} to travel.
                            <div className="mt-1 text-dashboard-base-content">
                                Refund <span className="font-semibold">{preview.refundPct}%</span> = <span className="font-semibold">{formatPaiseRoundedUp(preview.refundablePaise)}</span>
                                <span className="text-dashboard-neutral"> (cancellation fee {formatPaiseRoundedUp(preview.feePaise)})</span>
                            </div>
                        </div>
                    ) : null}

                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Reason (optional — saved to the booking timeline)"
                        rows={2}
                        className="mt-3 w-full rounded-md border border-dashboard-base-300 bg-dashboard-base-100 px-3 py-2 text-sm text-dashboard-base-content outline-none focus:border-dashboard-primary"
                    />

                    <div className="mt-3 flex justify-end gap-2">
                        <button onClick={() => { setShowCancel(false); setReason(""); }} disabled={cancelling} className={`${btn} border border-dashboard-base-300 text-dashboard-neutral hover:bg-dashboard-base-200`}>
                            Keep booking
                        </button>
                        <button onClick={confirmCancel} disabled={cancelling || loadingPreview} className={`${btn} bg-red-600 text-white hover:bg-red-700`}>
                            {cancelling ? "Cancelling…" : "Confirm cancellation"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
