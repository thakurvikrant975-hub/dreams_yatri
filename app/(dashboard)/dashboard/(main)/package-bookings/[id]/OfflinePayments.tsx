"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatPaiseRoundedUp } from "@/app/lib/money";
import { uploadImageFile } from "@/app/lib/uploadImageFile";
import { recordOfflinePayment, voidOfflinePayment } from "../offline-payment.actions";

/**
 * Recording money that came in outside the gateway, and unwinding it when it
 * was recorded wrongly.
 *
 * Laid out as an inline panel rather than an overlay, matching
 * BookingAdminActions on the same page: the figures it is checked against —
 * total, paid, outstanding — stay on screen while the form is open, which is
 * the whole point of entering it here rather than on a separate screen.
 */

const btn = "rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const field = "w-full rounded-md border border-dashboard-base-300 bg-dashboard-base-100 px-3 py-2 text-sm text-dashboard-base-content outline-none focus:border-dashboard-primary";
const label = "block text-xs font-medium text-dashboard-neutral mb-1";

const METHODS = [
    { value: "UPI", label: "UPI" },
    { value: "BANK_TRANSFER", label: "Bank transfer (NEFT / IMPS / RTGS)" },
    { value: "CASH", label: "Cash" },
    { value: "CHEQUE", label: "Cheque" },
] as const;

/** `datetime-local` wants the local wall clock, which toISOString would shift. */
function localNow(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function RecordOfflinePaymentPanel({
    bookingId,
    outstandingPaise,
    depositPaise,
    totalPaise,
    isFirstPayment,
}: {
    bookingId: string;
    outstandingPaise: number;
    /** What a first payment must match — surfaced up front so the exec is not
     *  told only after the form is rejected. */
    depositPaise: number;
    totalPaise: number;
    isFirstPayment: boolean;
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    const [amount, setAmount] = useState("");
    const [method, setMethod] = useState<(typeof METHODS)[number]["value"]>("UPI");
    const [reference, setReference] = useState("");
    const [receivedAt, setReceivedAt] = useState(localNow());
    const [receiptUrl, setReceiptUrl] = useState("");
    const [notes, setNotes] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);

    // Cash is the one rail with no reference of its own; everything else has a
    // UTR, and without it the payment can never be matched to a statement.
    const referenceRequired = method !== "CASH";

    function reset() {
        setAmount(""); setMethod("UPI"); setReference("");
        setReceivedAt(localNow()); setReceiptUrl(""); setNotes("");
        if (fileRef.current) fileRef.current.value = "";
    }

    async function onPickReceipt(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const url = await uploadImageFile(file, "payment-receipts", `receipt-${bookingId}`);
            setReceiptUrl(url);
            toast.success("Receipt attached.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not upload the receipt.");
            if (fileRef.current) fileRef.current.value = "";
        } finally {
            setUploading(false);
        }
    }

    async function submit() {
        const rupees = Number(amount);
        if (!Number.isFinite(rupees) || rupees <= 0) { toast.error("Enter the amount received."); return; }
        if (!receiptUrl) { toast.error("Attach the payment receipt."); return; }
        if (referenceRequired && !reference.trim()) { toast.error("Enter the UTR / transaction / cheque number."); return; }

        setSaving(true);
        try {
            const res = await recordOfflinePayment({
                bookingId,
                amountRupees: rupees,
                method,
                reference: reference.trim() || undefined,
                receivedAt: new Date(receivedAt),
                receiptUrl,
                notes: notes.trim() || undefined,
            });
            if (!res.success) { toast.error(res.error); return; }
            toast.success(`Recorded against ${res.bookingNumber}.`);
            reset();
            setOpen(false);
            router.refresh();
        } finally {
            setSaving(false);
        }
    }

    if (outstandingPaise <= 0) return null;

    if (!open) {
        return (
            <button onClick={() => setOpen(true)} className={`${btn} border border-dashboard-base-300 text-dashboard-base-content hover:bg-dashboard-base-200`}>
                Record payment taken outside the gateway
            </button>
        );
    }

    return (
        <div className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-100 p-4">
            <div className="text-sm font-semibold text-dashboard-base-content">Payment taken outside the gateway</div>
            <p className="mt-1 text-xs text-dashboard-neutral">
                Company UPI, bank transfer, cash or cheque. Outstanding on this booking:{" "}
                <span className="font-semibold text-dashboard-base-content">{formatPaiseRoundedUp(outstandingPaise)}</span>.
                {isFirstPayment && (
                    <>
                        {" "}The first payment must be exactly{" "}
                        {depositPaise === totalPaise
                            ? formatPaiseRoundedUp(totalPaise)
                            : <>{formatPaiseRoundedUp(depositPaise)} (deposit) or {formatPaiseRoundedUp(totalPaise)} (full)</>}.
                    </>
                )}
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                    <label className={label} htmlFor="op-amount">Amount received (₹)</label>
                    <input id="op-amount" type="number" min="1" step="1" inputMode="numeric" value={amount}
                        onChange={(e) => setAmount(e.target.value)} className={field} placeholder="e.g. 12500" />
                </div>
                <div>
                    <label className={label} htmlFor="op-method">How it was paid</label>
                    <select id="op-method" value={method} onChange={(e) => setMethod(e.target.value as typeof method)} className={field}>
                        {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                </div>
                <div>
                    <label className={label} htmlFor="op-ref">
                        UTR / transaction / cheque no. {!referenceRequired && <span className="text-dashboard-neutral">(optional for cash)</span>}
                    </label>
                    <input id="op-ref" value={reference} onChange={(e) => setReference(e.target.value)} className={field}
                        placeholder={referenceRequired ? "Required — matches the bank statement" : "If the receipt has one"} />
                </div>
                <div>
                    <label className={label} htmlFor="op-when">When it was received</label>
                    <input id="op-when" type="datetime-local" value={receivedAt} max={localNow()}
                        onChange={(e) => setReceivedAt(e.target.value)} className={field} />
                </div>
            </div>

            <div className="mt-3">
                <label className={label} htmlFor="op-receipt">Receipt or screenshot — required</label>
                <div className="flex items-center gap-3">
                    <input id="op-receipt" ref={fileRef} type="file" accept="image/*,application/pdf" onChange={onPickReceipt}
                        className="text-xs text-dashboard-neutral file:mr-3 file:rounded-md file:border file:border-dashboard-base-300 file:bg-dashboard-base-200 file:px-3 file:py-1.5 file:text-xs file:text-dashboard-base-content" />
                    {uploading && <span className="text-xs text-dashboard-neutral">Uploading…</span>}
                    {receiptUrl && !uploading && (
                        <a href={receiptUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-dashboard-primary underline">
                            View attached
                        </a>
                    )}
                </div>
                <p className="mt-1 text-xs text-dashboard-neutral">
                    Nobody countersigns these, so the receipt is the only proof this payment happened.
                </p>
            </div>

            <div className="mt-3">
                <label className={label} htmlFor="op-notes">Note (optional)</label>
                <input id="op-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={field}
                    placeholder="e.g. paid into the company UPI by the client's father" />
            </div>

            <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => { setOpen(false); reset(); }} disabled={saving}
                    className={`${btn} border border-dashboard-base-300 text-dashboard-neutral hover:bg-dashboard-base-200`}>
                    Cancel
                </button>
                <button onClick={submit} disabled={saving || uploading}
                    className={`${btn} bg-dashboard-primary text-white hover:opacity-90`}>
                    {saving ? "Recording…" : "Record payment"}
                </button>
            </div>
        </div>
    );
}

/**
 * Voiding, not deleting — see voidOfflinePayment. The reason is mandatory
 * because it is the only thing that will explain the row to whoever reads the
 * books later.
 */
export function VoidOfflinePaymentButton({ paymentId, amountPaise }: { paymentId: string; amountPaise: number }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState("");
    const [saving, setSaving] = useState(false);

    async function submit() {
        setSaving(true);
        try {
            const res = await voidOfflinePayment({ paymentId, reason: reason.trim() });
            if (!res.success) { toast.error(res.error); return; }
            toast.success("Payment voided.");
            setOpen(false); setReason("");
            router.refresh();
        } finally {
            setSaving(false);
        }
    }

    if (!open) {
        return (
            <button onClick={() => setOpen(true)} className="text-xs font-medium text-red-600 hover:underline">
                Void
            </button>
        );
    }

    return (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50/50 p-2.5">
            <div className="text-xs text-dashboard-base-content">
                Void {formatPaiseRoundedUp(amountPaise)}? The row is kept and marked voided — the money leaves every figure,
                but the invoice already raised against it stays in the books.
            </div>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this being voided?"
                className="mt-2 w-full rounded-md border border-dashboard-base-300 bg-dashboard-base-100 px-2.5 py-1.5 text-xs text-dashboard-base-content outline-none focus:border-dashboard-primary" />
            <div className="mt-2 flex justify-end gap-2">
                <button onClick={() => { setOpen(false); setReason(""); }} disabled={saving}
                    className="rounded-md border border-dashboard-base-300 px-2.5 py-1 text-xs text-dashboard-neutral hover:bg-dashboard-base-200">
                    Keep
                </button>
                <button onClick={submit} disabled={saving || reason.trim().length < 4}
                    className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">
                    {saving ? "Voiding…" : "Void payment"}
                </button>
            </div>
        </div>
    );
}
