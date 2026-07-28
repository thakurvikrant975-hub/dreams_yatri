"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setItemFulfillment, getReplacementCandidates, proposeReplacement, type ReplacementCandidate } from "../fulfillment.actions";
import type { FulfillmentItem, FulfillmentState } from "@/app/services/fulfillment/status.service";

const SETTABLE = [
    { v: "IN_PROCESS", l: "In process" },
    { v: "CONFIRMED",  l: "Confirmed"  },
    { v: "UNAVAILABLE",l: "Unavailable"},
] as const;

type SettableStatus = "IN_PROCESS" | "CONFIRMED" | "UNAVAILABLE";

const CHIP: Record<FulfillmentState, string> = {
    AWAITING_PAYMENT: "bg-neutral-100 text-neutral-600",
    IN_PROCESS:       "bg-amber-100 text-amber-700",
    CONFIRMED:        "bg-green-100 text-green-700",
    UNAVAILABLE:      "bg-red-100 text-red-700",
    REPLACED:         "bg-purple-100 text-purple-700",
    CANCELLED:        "bg-neutral-100 text-neutral-500",
};

const SELECT_COLOR: Record<string, string> = {
    IN_PROCESS:  "border-amber-300  bg-amber-50   text-amber-800  focus:ring-amber-400",
    CONFIRMED:   "border-green-300  bg-green-50   text-green-800  focus:ring-green-400",
    UNAVAILABLE: "border-red-300    bg-red-50     text-red-800    focus:ring-red-400",
};

const titleCase = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

function ItemRow({ bookingId, item, dayLabel }: { bookingId: string; item: FulfillmentItem; dayLabel: string }) {
    const router = useRouter();
    const initStatus = (["IN_PROCESS", "CONFIRMED", "UNAVAILABLE"] as string[]).includes(item.status)
        ? (item.status as SettableStatus)
        : "IN_PROCESS";
    const [status, setStatus] = useState<SettableStatus>(initStatus);
    const [saving, setSaving] = useState(false);

    async function handleChange(next: SettableStatus) {
        const prev = status;
        setStatus(next);
        setSaving(true);
        try {
            const res = await setItemFulfillment({
                bookingId, kind: item.kind, day: item.day,
                activityId: item.activityId ?? null,
                status: next, voucherUrl: null,
            });
            if (!res.success) {
                toast.error(res.error);
                setStatus(prev);
                return;
            }
            toast.success(`Saved — ${item.title}`);
            router.refresh();
        } finally {
            setSaving(false);
        }
    }

    const colorCls = SELECT_COLOR[status] ?? "border-dashboard-base-300 bg-dashboard-base-100 text-dashboard-base-content";

    return (
        <div className="py-3">
            <div className="flex flex-wrap items-center gap-3">
                {/* Day badge + title/subtitle */}
                <span className="shrink-0 rounded bg-dashboard-primary/10 px-2 py-0.5 text-[11px] font-bold text-dashboard-primary">{dayLabel}</span>
                <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-dashboard-base-content leading-snug">{item.title}</div>
                    {item.subtitle && <div className="text-xs text-dashboard-neutral mt-0.5">{item.subtitle}</div>}
                </div>

                {/* Saved-state chip (reflects last server state) */}
                {item.status !== initStatus || (item.status !== status) ? null : (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CHIP[item.status]}`}>
                        {titleCase(item.status)}
                    </span>
                )}

                {/* Auto-save select */}
                <div className="relative flex items-center gap-1.5 shrink-0">
                    {saving && (
                        <span className="text-[11px] text-dashboard-neutral animate-pulse select-none">saving…</span>
                    )}
                    <select
                        value={status}
                        onChange={(e) => handleChange(e.target.value as SettableStatus)}
                        disabled={saving}
                        className={`h-8 rounded-md border px-2 pr-7 text-sm font-medium outline-none focus:ring-1 transition-colors appearance-none cursor-pointer disabled:opacity-60 ${colorCls}`}
                    >
                        {SETTABLE.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                    {/* Chevron */}
                    <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-current opacity-60" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
            </div>

            {/* Propose-alternatives box (shown when this item is unavailable) */}
            {status === "UNAVAILABLE" && <ProposeBox bookingId={bookingId} item={item} />}
        </div>
    );
}

function ProposeBox({ bookingId, item }: { bookingId: string; item: FulfillmentItem }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [cands, setCands] = useState<ReplacementCandidate[]>([]);
    const [sel, setSel] = useState<Set<string>>(new Set());
    const [sending, setSending] = useState(false);

    async function load() {
        setOpen(true);
        if (cands.length) return;
        setLoading(true);
        try {
            const res = await getReplacementCandidates(bookingId, item.kind);
            if (!res.success) { toast.error(res.error); setOpen(false); return; }
            setCands(res.candidates);
        } finally { setLoading(false); }
    }
    function toggle(id: string) {
        setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    }
    async function send() {
        const options = cands.filter((c) => sel.has(c.id));
        if (!options.length) { toast.error("Select at least one alternative."); return; }
        setSending(true);
        try {
            const res = await proposeReplacement({ bookingId, kind: item.kind, day: item.day, activityId: item.activityId ?? null, options });
            if (!res.success) { toast.error(res.error); return; }
            toast.success("Alternatives sent to the customer.");
            router.refresh();
        } finally { setSending(false); }
    }

    return (
        <div className="mt-2 rounded-md border border-red-100 bg-red-50/50 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-red-700">
                    {item.offer
                        ? `${item.offer.options.length} alternative${item.offer.options.length !== 1 ? "s" : ""} sent — awaiting customer choice`
                        : "Unavailable — propose alternatives to the customer"}
                </span>
                {!open && (
                    <button onClick={load} className="shrink-0 text-xs font-semibold text-dashboard-primary hover:underline">
                        {item.offer ? "Change options" : "Propose alternatives"}
                    </button>
                )}
            </div>
            {open && (
                <div className="mt-2.5">
                    {loading ? (
                        <span className="text-xs text-dashboard-neutral animate-pulse">Loading options…</span>
                    ) : (
                        <>
                            <div className="flex max-h-44 flex-col gap-1.5 overflow-y-auto pr-1">
                                {cands.length === 0 ? (
                                    <span className="text-xs text-dashboard-neutral">No alternatives found for this destination.</span>
                                ) : cands.map((c) => (
                                    <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer rounded px-1 py-0.5 hover:bg-red-100/50">
                                        <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} className="accent-dashboard-primary" />
                                        <span className="text-dashboard-base-content">{c.label}</span>
                                        {c.sublabel && <span className="text-xs text-dashboard-neutral">· {c.sublabel}</span>}
                                    </label>
                                ))}
                            </div>
                            <div className="mt-2.5 flex gap-2">
                                <button
                                    onClick={send}
                                    disabled={sending || sel.size === 0}
                                    className="h-7 rounded-md bg-dashboard-primary px-3 text-xs font-medium text-white disabled:opacity-50 hover:opacity-90"
                                >
                                    {sending ? "Sending…" : `Send ${sel.size > 0 ? sel.size : ""} option${sel.size !== 1 ? "s" : ""}`}
                                </button>
                                <button onClick={() => setOpen(false)} className="h-7 rounded-md border border-dashboard-base-300 px-3 text-xs text-dashboard-neutral hover:bg-dashboard-base-200">
                                    Cancel
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

// Flat, activities-only fulfilment checklist — hotel and cab confirmation
// happen exclusively on their own dedicated pages (Verify Hotels / Verify
// Cabs), so this panel never touches those. `items` must already be filtered
// to kind === "ACTIVITY" by the caller.
export default function FulfillmentPanel({ bookingId, items }: { bookingId: string; items: FulfillmentItem[] }) {
    const router = useRouter();
    const [verifyingAll, setVerifyingAll] = useState(false);

    if (items.length === 0) return <p className="text-sm text-dashboard-neutral">No trackable activities on this booking.</p>;

    const unverified = items.filter((i) => i.status !== "CONFIRMED" && i.status !== "REPLACED");

    async function handleVerifyAll() {
        setVerifyingAll(true);
        try {
            const results = await Promise.all(
                unverified.map((it) =>
                    setItemFulfillment({
                        bookingId, kind: it.kind, day: it.day,
                        activityId: it.activityId ?? null,
                        status: "CONFIRMED", voucherUrl: null,
                    }),
                ),
            );
            const failed = results.filter((r) => !r.success).length;
            if (failed > 0) toast.error(`${failed} activit${failed > 1 ? "ies" : "y"} could not be verified.`);
            if (failed < results.length) toast.success(`Verified ${results.length - failed} activit${results.length - failed > 1 ? "ies" : "y"}.`);
            router.refresh();
        } finally {
            setVerifyingAll(false);
        }
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-dashboard-base-300/70 bg-dashboard-base-200/40 px-4 py-2.5">
                <span className="text-xs font-semibold text-dashboard-base-content">
                    {items.length - unverified.length}/{items.length} confirmed
                </span>
                <button
                    type="button"
                    onClick={handleVerifyAll}
                    disabled={verifyingAll || unverified.length === 0}
                    className="ml-auto h-8 rounded-md bg-dashboard-primary px-3 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                    {verifyingAll
                        ? "Verifying…"
                        : unverified.length === 0
                            ? "All activities verified"
                            : `Verify all activities (${unverified.length})`}
                </button>
            </div>

            <div className="rounded-lg border border-dashboard-base-300/70 overflow-hidden px-4">
                <div className="divide-y divide-dashboard-base-300/40">
                    {items.map((it) => <ItemRow key={it.key} bookingId={bookingId} item={it} dayLabel={`Day ${it.day}`} />)}
                </div>
            </div>
        </div>
    );
}
