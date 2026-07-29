"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DropdownMenu, Dialog, VisuallyHidden } from "radix-ui";
import { MoreVertical, Eye, RefreshCw, Ban } from "lucide-react";
import { toast } from "sonner";
import { formatPaiseRoundedUp } from "@/app/lib/money";
import { adminPreviewCancellation, adminCancelBooking, adminSyncPayments } from "./actions";
import type { CancellationPreview } from "@/app/actions/payment/types";

const item =
    "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-dashboard-base-content outline-none cursor-pointer data-[highlighted]:bg-dashboard-base-200";

export default function BookingRowActions({
    bookingId,
    bookingNumber,
    cancellable,
    hasPendingPayments,
}: {
    bookingId: string;
    bookingNumber: string;
    cancellable: boolean;
    hasPendingPayments: boolean;
}) {
    const router = useRouter();
    const [syncing, setSyncing] = useState(false);
    const [cancelOpen, setCancelOpen] = useState(false);
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
        setReason("");
        setPreview(null);
        setCancelOpen(true);
        setLoadingPreview(true);
        try {
            const res = await adminPreviewCancellation(bookingId);
            if (!res.success) { toast.error(res.error); setCancelOpen(false); return; }
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
            setCancelOpen(false);
            router.refresh();
        } finally {
            setCancelling(false);
        }
    }

    return (
        <>
            <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                    <button
                        aria-label={`Actions for ${bookingNumber}`}
                        className="flex size-8 items-center justify-center rounded-md text-dashboard-neutral hover:bg-dashboard-base-200 hover:text-dashboard-base-content outline-none"
                    >
                        <MoreVertical className="size-4" />
                    </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                    <DropdownMenu.Content
                        align="end"
                        sideOffset={4}
                        className="z-50 min-w-44 rounded-lg border border-dashboard-base-300 bg-dashboard-base-100 p-1 shadow-lg"
                    >
                        <DropdownMenu.Item asChild className={item}>
                            <Link href={`/dashboard/package-bookings/${bookingId}`}>
                                <Eye className="size-4 text-dashboard-neutral" /> View details
                            </Link>
                        </DropdownMenu.Item>

                        {hasPendingPayments && (
                            <DropdownMenu.Item
                                className={item}
                                disabled={syncing}
                                onSelect={(e) => { e.preventDefault(); onSync(); }}
                            >
                                <RefreshCw className="size-4 text-dashboard-neutral" /> {syncing ? "Syncing…" : "Sync payment status"}
                            </DropdownMenu.Item>
                        )}

                        {cancellable && (
                            <DropdownMenu.Item
                                className={`${item} text-red-600 data-[highlighted]:bg-red-50`}
                                onSelect={(e) => { e.preventDefault(); openCancel(); }}
                            >
                                <Ban className="size-4" /> Cancel booking
                            </DropdownMenu.Item>
                        )}
                    </DropdownMenu.Content>
                </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* Cancel confirm dialog */}
            <Dialog.Root open={cancelOpen} onOpenChange={(o) => { if (!o && !cancelling) setCancelOpen(false); }}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
                    <Dialog.Content
                        data-layout="dashboard"
                        className="fixed left-1/2 top-1/2 z-50 w-[min(28rem,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-dashboard-base-100 p-5 shadow-2xl outline-none"
                        aria-describedby={undefined}
                    >
                        <Dialog.Title className="text-base font-semibold text-dashboard-base-content">Cancel {bookingNumber}?</Dialog.Title>
                        <VisuallyHidden.Root asChild><Dialog.Description>Cancel this booking and initiate any eligible refund.</Dialog.Description></VisuallyHidden.Root>

                        {loadingPreview ? (
                            <p className="mt-3 text-sm text-dashboard-neutral">Calculating refund…</p>
                        ) : preview ? (
                            <div className="mt-3 rounded-lg bg-dashboard-base-200/60 px-3 py-2.5 text-sm">
                                <div className="text-dashboard-neutral">Paid {formatPaiseRoundedUp(preview.paidPaise)} · {preview.daysToTravel} day{preview.daysToTravel !== 1 ? "s" : ""} to travel</div>
                                <div className="mt-1 text-dashboard-base-content">
                                    Refund <span className="font-semibold">{preview.refundPct}%</span> = <span className="font-semibold">{formatPaiseRoundedUp(preview.refundablePaise)}</span>
                                    <span className="text-dashboard-neutral"> (fee {formatPaiseRoundedUp(preview.feePaise)})</span>
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

                        <div className="mt-4 flex justify-end gap-2">
                            <button onClick={() => setCancelOpen(false)} disabled={cancelling} className="rounded-md border border-dashboard-base-300 px-3 py-2 text-sm text-dashboard-neutral hover:bg-dashboard-base-200 disabled:opacity-50">
                                Keep booking
                            </button>
                            <button onClick={confirmCancel} disabled={cancelling || loadingPreview} className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                                {cancelling ? "Cancelling…" : "Confirm cancellation"}
                            </button>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </>
    );
}
