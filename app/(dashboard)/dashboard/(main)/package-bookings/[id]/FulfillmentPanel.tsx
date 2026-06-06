"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setItemFulfillment } from "../fulfillment.actions";
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
        <div className="flex flex-wrap items-center gap-2 py-2.5">
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
