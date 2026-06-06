"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setItemFulfillment, getReplacementCandidates, proposeReplacement, type ReplacementCandidate } from "../fulfillment.actions";
import type { BookingFulfillment, FulfillmentItem, FulfillmentState } from "@/app/services/fulfillment/status.service";

const SETTABLE = [
    { v: "IN_PROCESS", l: "In process" },
    { v: "CONFIRMED", l: "Confirmed" },
    { v: "UNAVAILABLE", l: "Unavailable" },
] as const;

const CHIP: Record<FulfillmentState, string> = {
    AWAITING_PAYMENT: "bg-neutral-100 text-neutral-600",
    IN_PROCESS: "bg-amber-100 text-amber-700",
    CONFIRMED: "bg-green-100 text-green-700",
    UNAVAILABLE: "bg-red-100 text-red-700",
    REPLACED: "bg-purple-100 text-purple-700",
    CANCELLED: "bg-neutral-100 text-neutral-500",
};
const titleCase = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const inputCls = "h-8 rounded-md border border-dashboard-base-300 bg-dashboard-base-100 px-2 text-sm text-dashboard-base-content outline-none focus:border-dashboard-primary";

function ItemEditor({ bookingId, item }: { bookingId: string; item: FulfillmentItem }) {
    const router = useRouter();
    const init = (["IN_PROCESS", "CONFIRMED", "UNAVAILABLE"] as string[]).includes(item.status) ? (item.status as "IN_PROCESS" | "CONFIRMED" | "UNAVAILABLE") : "IN_PROCESS";
    const [status, setStatus] = useState<"IN_PROCESS" | "CONFIRMED" | "UNAVAILABLE">(init);
    const [voucher, setVoucher] = useState(item.voucherUrl ?? "");
    const [saving, setSaving] = useState(false);

    async function save() {
        setSaving(true);
        try {
            const res = await setItemFulfillment({ bookingId, kind: item.kind, day: item.day, activityId: item.activityId ?? null, status, voucherUrl: voucher || null });
            if (!res.success) { toast.error(res.error); return; }
            toast.success("Updated.");
            router.refresh();
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="py-2.5">
            <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-44 flex-1">
                    <div className="text-sm text-dashboard-base-content">{item.title}</div>
                    <div className="text-xs text-dashboard-neutral">{titleCase(item.kind)}{item.subtitle ? ` · ${item.subtitle}` : ""}</div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CHIP[item.status]}`}>{titleCase(item.status)}</span>
                <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={inputCls}>
                    {SETTABLE.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
                <input value={voucher} onChange={(e) => setVoucher(e.target.value)} placeholder="Voucher/ticket URL" className={`${inputCls} w-48`} />
                <button onClick={save} disabled={saving} className="h-8 rounded-md bg-dashboard-primary px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
                    {saving ? "…" : "Save"}
                </button>
            </div>
            {item.status === "UNAVAILABLE" && <ProposeBox bookingId={bookingId} item={item} />}
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
    function toggle(id: string) { setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
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
        <div className="mt-1.5 rounded-md border border-red-100 bg-red-50/50 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-red-700">
                    {item.offer ? `${item.offer.options.length} alternative${item.offer.options.length !== 1 ? "s" : ""} sent — awaiting customer choice` : "Unavailable — propose alternatives to the customer"}
                </span>
                {!open && <button onClick={load} className="text-xs font-semibold text-dashboard-primary">{item.offer ? "Change options" : "Propose alternatives"}</button>}
            </div>
            {open && (
                <div className="mt-2">
                    {loading ? <span className="text-xs text-dashboard-neutral">Loading…</span> : (
                        <>
                            <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                                {cands.length === 0 ? (
                                    <span className="text-xs text-dashboard-neutral">No alternatives found for this destination.</span>
                                ) : cands.map((c) => (
                                    <label key={c.id} className="flex items-center gap-2 text-sm">
                                        <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} className="accent-dashboard-primary" />
                                        <span className="text-dashboard-base-content">{c.label}</span>
                                        {c.sublabel && <span className="text-xs text-dashboard-neutral">· {c.sublabel}</span>}
                                    </label>
                                ))}
                            </div>
                            <div className="mt-2 flex gap-2">
                                <button onClick={send} disabled={sending} className="h-7 rounded-md bg-dashboard-primary px-3 text-xs font-medium text-white disabled:opacity-50">{sending ? "Sending…" : "Send options"}</button>
                                <button onClick={() => setOpen(false)} className="h-7 rounded-md border border-dashboard-base-300 px-3 text-xs text-dashboard-neutral">Cancel</button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export default function FulfillmentPanel({ bookingId, fulfillment }: { bookingId: string; fulfillment: BookingFulfillment }) {
    const anyItems = fulfillment.days.some((d) => d.items.length > 0);
    if (!anyItems) return <p className="text-sm text-dashboard-neutral">No fulfilment items (no itinerary snapshot on this booking).</p>;

    return (
        <div className="flex flex-col gap-4">
            <p className="text-xs text-dashboard-neutral">
                {fulfillment.summary.confirmed}/{fulfillment.summary.total} confirmed
                {fulfillment.summary.attention > 0 ? ` · ${fulfillment.summary.attention} need attention` : ""}
                {!fulfillment.paid ? " · booking not yet paid" : ""}
            </p>
            {fulfillment.days.map((d) => (
                d.items.length === 0 ? null : (
                    <div key={d.day} className="rounded-lg border border-dashboard-base-300/70 p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-dashboard-neutral mb-1">Day {d.day} · {d.title}</div>
                        <div className="divide-y divide-dashboard-base-300/50">
                            {d.items.map((it) => <ItemEditor key={it.key} bookingId={bookingId} item={it} />)}
                        </div>
                    </div>
                )
            ))}
        </div>
    );
}
