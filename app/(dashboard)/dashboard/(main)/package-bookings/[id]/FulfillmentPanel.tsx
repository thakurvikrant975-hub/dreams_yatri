"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setItemFulfillment, getReplacementCandidates, proposeReplacement, type ReplacementCandidate } from "../fulfillment.actions";
import type { BookingFulfillment, FulfillmentItem, FulfillmentState } from "@/app/services/fulfillment/status.service";

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

function ItemRow({ bookingId, item }: { bookingId: string; item: FulfillmentItem }) {
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
                {/* Title + subtitle */}
                <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-dashboard-base-content leading-snug">{item.title}</div>
                    <div className="text-xs text-dashboard-neutral mt-0.5">{titleCase(item.kind)}{item.subtitle ? ` · ${item.subtitle}` : ""}</div>
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

export default function FulfillmentPanel({ bookingId, fulfillment }: { bookingId: string; fulfillment: BookingFulfillment }) {
    const router = useRouter();
    const [activitiesOnly, setActivitiesOnly] = useState(false);
    const [verifyingAll, setVerifyingAll] = useState(false);

    const anyItems = fulfillment.days.some((d) => d.items.length > 0);
    if (!anyItems) return <p className="text-sm text-dashboard-neutral">No fulfilment items (no itinerary snapshot on this booking).</p>;

    const { confirmed, total, attention } = fulfillment.summary;
    const pct = total > 0 ? Math.round((confirmed / total) * 100) : 0;

    const allActivities = fulfillment.days.flatMap((d) => d.items.filter((i) => i.kind === "ACTIVITY"));
    const unverifiedActivities = allActivities.filter((i) => i.status !== "CONFIRMED" && i.status !== "REPLACED");
    const hasActivities = allActivities.length > 0;

    async function handleVerifyAllActivities() {
        setVerifyingAll(true);
        try {
            const results = await Promise.all(
                unverifiedActivities.map((it) =>
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
        <div className="flex flex-col gap-4">
            {/* Summary bar */}
            <div className="rounded-lg border border-dashboard-base-300/70 bg-dashboard-base-200/40 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-dashboard-base-content">
                        {confirmed}/{total} confirmed
                    </span>
                    <span className="text-xs text-dashboard-neutral">{pct}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-dashboard-base-300/60">
                    <div
                        className={`h-full rounded-full transition-all ${pct === 100 ? "bg-green-500" : pct >= 50 ? "bg-dashboard-primary" : "bg-amber-400"}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-dashboard-neutral">
                    {attention > 0 && <span className="text-red-600">{attention} need attention</span>}
                    {!fulfillment.paid && <span className="text-amber-600">booking not yet paid</span>}
                    <span className="ml-auto italic opacity-60">changes save automatically</span>
                </div>
            </div>

            {/* Activity controls — filter to activities only, and bulk-verify them */}
            {hasActivities && (
                <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-dashboard-base-300/70 bg-dashboard-base-100 px-4 py-2.5">
                    <button
                        type="button"
                        onClick={() => setActivitiesOnly((v) => !v)}
                        aria-pressed={activitiesOnly}
                        className={`h-8 rounded-md border px-3 text-xs font-medium transition-colors ${
                            activitiesOnly
                                ? "border-dashboard-primary bg-dashboard-primary/10 text-dashboard-primary"
                                : "border-dashboard-base-300 text-dashboard-neutral hover:bg-dashboard-base-200"
                        }`}
                    >
                        {activitiesOnly ? "Showing activities only" : "Show activities only"}
                    </button>
                    <span className="text-xs text-dashboard-neutral">
                        {allActivities.length - unverifiedActivities.length}/{allActivities.length} activities confirmed
                    </span>
                    <button
                        type="button"
                        onClick={handleVerifyAllActivities}
                        disabled={verifyingAll || unverifiedActivities.length === 0}
                        className="ml-auto h-8 rounded-md bg-dashboard-primary px-3 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                        {verifyingAll
                            ? "Verifying…"
                            : unverifiedActivities.length === 0
                                ? "All activities verified"
                                : `Verify all activities (${unverifiedActivities.length})`}
                    </button>
                </div>
            )}

            {/* Per-day item rows */}
            {fulfillment.days.map((d) => {
                const items = activitiesOnly ? d.items.filter((i) => i.kind === "ACTIVITY") : d.items;
                if (items.length === 0) return null;
                return (
                    <div key={d.day} className="rounded-lg border border-dashboard-base-300/70 overflow-hidden">
                        <div className="flex items-center gap-2 border-b border-dashboard-base-300/60 bg-dashboard-base-200/50 px-4 py-2">
                            <span className="rounded bg-dashboard-primary/10 px-2 py-0.5 text-[11px] font-bold text-dashboard-primary">Day {d.day}</span>
                            <span className="text-xs font-medium text-dashboard-base-content">{d.title}</span>
                            <span className="ml-auto text-[11px] text-dashboard-neutral">
                                {items.filter(i => i.status === "CONFIRMED" || i.status === "REPLACED").length}/{items.length} done
                            </span>
                        </div>
                        <div className="divide-y divide-dashboard-base-300/40 px-4">
                            {items.map((it) => <ItemRow key={it.key} bookingId={bookingId} item={it} />)}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
