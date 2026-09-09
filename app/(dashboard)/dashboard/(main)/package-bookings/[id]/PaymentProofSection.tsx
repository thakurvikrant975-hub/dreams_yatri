"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Upload, CheckCircle2, XCircle, Clock } from "lucide-react";
import {
    submitPaymentProof, approveBookingPayments, rejectBookingPayments,
    type PaymentProofInput,
} from "../payment-proof.actions";

const btn = "rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const inputCls = "h-9 rounded-md border border-dashboard-base-300 bg-dashboard-base-100 px-3 text-sm text-dashboard-base-content outline-none focus:border-dashboard-primary";

function todayStr(): string {
    return new Date().toISOString().slice(0, 10);
}

function inr(paise: number): string {
    return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

async function uploadProof(file: File): Promise<{ key: string; url: string }> {
    const body = new FormData();
    body.append("file", file);
    body.append("folder", "payment-proofs");
    const res = await fetch("/api/upload", { method: "POST", body });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Upload failed");
    return { key: data.key, url: data.url };
}

type ExistingPayment = {
    id: string;
    amount_paise: number;
    method: string | null;
    verificationStatus: string;
    status: string;
    proofUrl: string | null;
    rejectionReason: string | null;
    submittedByName: string | null;
    paidAt: Date | null;
    createdAt: Date;
};

type DraftRow = {
    id: string;
    amount: string;
    paidAt: string;
    method: "UPI" | "CASH";
    file: File | null;
    proofUrl: string | null;
    proofKey: string | null;
    uploading: boolean;
    error: string | null;
};

function newRow(): DraftRow {
    return {
        id: Math.random().toString(36).slice(2, 10),
        amount: "",
        paidAt: todayStr(),
        method: "UPI",
        file: null,
        proofUrl: null,
        proofKey: null,
        uploading: false,
        error: null,
    };
}

const VERIFICATION_STYLE: Record<string, { label: string; className: string; icon: typeof Clock }> = {
    PENDING_REVIEW: { label: "Pending review", className: "bg-amber-100 text-amber-700", icon: Clock },
    APPROVED: { label: "Approved", className: "bg-green-100 text-green-700", icon: CheckCircle2 },
    REJECTED: { label: "Rejected", className: "bg-red-100 text-red-700", icon: XCircle },
};

function fmtDate(d: Date | null): string {
    if (!d) return "—";
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));
}

export default function PaymentProofSection({
    bookingId,
    payments,
    canSubmit,
    isOps,
}: {
    bookingId: string;
    payments: ExistingPayment[];
    canSubmit: boolean;
    isOps: boolean;
}) {
    const router = useRouter();
    const [rows, setRows] = useState<DraftRow[]>([newRow()]);
    const [showForm, setShowForm] = useState(payments.length === 0);
    const [submitting, setSubmitting] = useState(false);
    const [approving, setApproving] = useState(false);
    const [rejecting, setRejecting] = useState(false);
    const [showReject, setShowReject] = useState(false);
    const [rejectReason, setRejectReason] = useState("");

    const pendingReview = payments.filter((p) => p.verificationStatus === "PENDING_REVIEW");

    function updateRow(id: string, patch: Partial<DraftRow>) {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    }

    async function handleFile(id: string, file: File) {
        updateRow(id, { file, uploading: true, error: null });
        try {
            const { key, url } = await uploadProof(file);
            updateRow(id, { proofUrl: url, proofKey: key, uploading: false });
        } catch (e) {
            updateRow(id, { uploading: false, error: e instanceof Error ? e.message : "Upload failed" });
        }
    }

    async function handleSubmit() {
        const ready = rows.filter((r) => r.amount && r.proofUrl && r.proofKey);
        if (ready.length === 0) {
            toast.error("Add an amount and screenshot for at least one payment.");
            return;
        }
        setSubmitting(true);
        try {
            const payload: PaymentProofInput[] = ready.map((r) => ({
                amount: Number(r.amount),
                proofUrl: r.proofUrl!,
                proofKey: r.proofKey!,
                paidAt: r.paidAt,
                method: r.method,
            }));
            const res = await submitPaymentProof(bookingId, payload);
            if (!res.success) { toast.error(res.message); return; }
            toast.success(res.message);
            setRows([newRow()]);
            setShowForm(false);
            router.refresh();
        } finally {
            setSubmitting(false);
        }
    }

    async function handleApprove() {
        setApproving(true);
        try {
            const res = await approveBookingPayments(bookingId);
            if (!res.success) { toast.error(res.message); return; }
            toast.success(res.message);
            router.refresh();
        } finally {
            setApproving(false);
        }
    }

    async function handleReject() {
        if (!rejectReason.trim()) { toast.error("Add a reason."); return; }
        setRejecting(true);
        try {
            const res = await rejectBookingPayments(bookingId, rejectReason);
            if (!res.success) { toast.error(res.message); return; }
            toast.success(res.message);
            setShowReject(false);
            setRejectReason("");
            router.refresh();
        } finally {
            setRejecting(false);
        }
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Existing proofs */}
            {payments.length === 0 ? (
                <p className="text-sm text-dashboard-neutral">No payment proofs submitted yet.</p>
            ) : (
                <ul className="flex flex-col gap-2">
                    {payments.map((p) => {
                        const v = VERIFICATION_STYLE[p.verificationStatus] ?? VERIFICATION_STYLE.PENDING_REVIEW;
                        const Icon = v.icon;
                        return (
                            <li key={p.id} className="flex items-start gap-3 rounded-lg border border-dashboard-base-300 p-3">
                                {p.proofUrl && (
                                    <a href={p.proofUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={p.proofUrl} alt="Payment screenshot" className="h-16 w-16 rounded-md object-cover border border-dashboard-base-300" />
                                    </a>
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-semibold text-dashboard-base-content">{inr(p.amount_paise)}</span>
                                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${v.className}`}>
                                            <Icon className="size-3" /> {v.label}
                                        </span>
                                        {p.method && <span className="text-xs text-dashboard-neutral">{p.method}</span>}
                                    </div>
                                    <p className="mt-0.5 text-xs text-dashboard-neutral">
                                        Paid {fmtDate(p.paidAt)} · Submitted by {p.submittedByName ?? "—"}
                                    </p>
                                    {p.verificationStatus === "REJECTED" && p.rejectionReason && (
                                        <p className="mt-1 text-xs text-red-600">Reason: {p.rejectionReason}</p>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {/* Ops: approve/reject the pending batch */}
            {isOps && pendingReview.length > 0 && (
                <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                    <p className="text-sm text-dashboard-base-content">
                        {pendingReview.length} payment{pendingReview.length !== 1 ? "s" : ""} awaiting review — verify the screenshot{pendingReview.length !== 1 ? "s" : ""} above before approving.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={handleApprove} disabled={approving || rejecting} className={`${btn} bg-green-600 text-white hover:bg-green-700`}>
                            {approving ? "Approving…" : "Approve payment"}
                        </button>
                        {!showReject ? (
                            <button onClick={() => setShowReject(true)} disabled={approving} className={`${btn} border border-red-200 text-red-600 hover:bg-red-50`}>
                                Reject
                            </button>
                        ) : null}
                    </div>
                    {showReject && (
                        <div className="flex flex-col gap-2">
                            <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Why is this being rejected? (shown to the sales exec)"
                                rows={2}
                                className="w-full rounded-md border border-dashboard-base-300 bg-dashboard-base-100 px-3 py-2 text-sm text-dashboard-base-content outline-none focus:border-dashboard-primary"
                            />
                            <div className="flex justify-end gap-2">
                                <button onClick={() => { setShowReject(false); setRejectReason(""); }} disabled={rejecting} className={`${btn} border border-dashboard-base-300 text-dashboard-neutral hover:bg-dashboard-base-200`}>
                                    Cancel
                                </button>
                                <button onClick={handleReject} disabled={rejecting} className={`${btn} bg-red-600 text-white hover:bg-red-700`}>
                                    {rejecting ? "Rejecting…" : "Confirm rejection"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Sales exec: submit new proof */}
            {canSubmit && (
                showForm ? (
                    <div className="flex flex-col gap-3 rounded-lg border border-dashboard-base-300 p-3">
                        {rows.map((row) => (
                            <div key={row.id} className="flex flex-wrap items-start gap-2 rounded-md border border-dashboard-base-300/70 p-2.5">
                                <input
                                    type="number"
                                    min={0}
                                    value={row.amount}
                                    onChange={(e) => updateRow(row.id, { amount: e.target.value })}
                                    placeholder="Amount (₹)"
                                    className={`${inputCls} w-32`}
                                />
                                <input
                                    type="date"
                                    value={row.paidAt}
                                    max={todayStr()}
                                    onChange={(e) => updateRow(row.id, { paidAt: e.target.value })}
                                    className={`${inputCls} w-40`}
                                />
                                <select
                                    value={row.method}
                                    onChange={(e) => updateRow(row.id, { method: e.target.value as "UPI" | "CASH" })}
                                    className={inputCls}
                                >
                                    <option value="UPI">UPI / GPay</option>
                                    <option value="CASH">Cash</option>
                                </select>

                                <label className={`${btn} flex cursor-pointer items-center gap-1.5 border border-dashboard-base-300 text-dashboard-base-content hover:bg-dashboard-base-200`}>
                                    {row.uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                                    {row.proofUrl ? "Replace screenshot" : "Add screenshot"}
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp,image/avif"
                                        className="hidden"
                                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(row.id, f); }}
                                    />
                                </label>

                                {row.proofUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={row.proofUrl} alt="Screenshot preview" className="h-9 w-9 rounded-md object-cover border border-dashboard-base-300" />
                                )}
                                {row.error && <span className="text-xs text-red-600">{row.error}</span>}

                                {rows.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
                                        className="ml-auto text-dashboard-neutral hover:text-red-600"
                                    >
                                        <Trash2 className="size-4" />
                                    </button>
                                )}
                            </div>
                        ))}

                        <div className="flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => setRows((prev) => [...prev, newRow()])}
                                className="inline-flex items-center gap-1 text-xs font-medium text-dashboard-primary hover:underline"
                            >
                                <Plus className="size-3.5" /> Add another payment
                            </button>
                            <div className="flex gap-2">
                                {payments.length > 0 && (
                                    <button onClick={() => setShowForm(false)} disabled={submitting} className={`${btn} border border-dashboard-base-300 text-dashboard-neutral hover:bg-dashboard-base-200`}>
                                        Cancel
                                    </button>
                                )}
                                <button onClick={handleSubmit} disabled={submitting} className={`${btn} bg-dashboard-primary text-white hover:opacity-90`}>
                                    {submitting ? "Submitting…" : "Submit for approval"}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => { setShowForm(true); setRows([newRow()]); }}
                        className={`${btn} self-start border border-dashboard-base-300 text-dashboard-base-content hover:bg-dashboard-base-200`}
                    >
                        + Record a payment
                    </button>
                )
            )}
        </div>
    );
}
