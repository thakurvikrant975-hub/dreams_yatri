"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
import { confirmAllCabLegs, confirmCabLeg, type CabVehicleOption } from "../actions";
import VehiclePickerModal from "./VehiclePickerModal";

const inputCls =
    "h-9 w-full rounded-md border border-dashboard-base-300 bg-dashboard-base-100 px-3 text-sm text-dashboard-base-content outline-none focus:border-dashboard-primary placeholder:text-dashboard-neutral/60";

type PendingLeg = { day: number; from: string; to: string; dateISO: string; km: number; baselineTotal: number };

export default function BulkCabConfirmPanel({
    bookingId,
    pendingLegs,
    destinationId,
}: {
    bookingId: string;
    pendingLegs: PendingLeg[];
    destinationId: number | null;
}) {
    const router = useRouter();
    const [open, setOpen] = useState(true);
    const [notes, setNotes] = useState("");
    const [confirming, setConfirming] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);

    if (pendingLegs.length === 0) return null;

    async function handleConfirmAll() {
        setConfirming(true);
        try {
            const res = await confirmAllCabLegs(bookingId, { notes: notes.trim() || undefined });
            if (!res.success) { toast.error(res.error); return; }
            toast.success(`${res.count} cab transfer${res.count !== 1 ? "s" : ""} verified.`);
            router.refresh();
        } finally { setConfirming(false); }
    }

    const baselineTotalSum = pendingLegs.reduce((s, l) => s + l.baselineTotal, 0);

    function estimateCost(opt: CabVehicleOption): number {
        return opt.pricingType === "PER_KM"
            ? pendingLegs.reduce((s, l) => s + opt.rate * l.km, 0)
            : opt.rate * pendingLegs.length;
    }

    async function handleChangeAll(opt: CabVehicleOption): Promise<{ success: boolean; error?: string }> {
        let failed = 0;
        let lastAllConfirmed = false;
        for (const leg of pendingLegs) {
            const totalCost = opt.pricingType === "PER_KM" ? opt.rate * leg.km : opt.rate;
            const res = await confirmCabLeg(bookingId, leg.day, {
                fromLocation: leg.from, toLocation: leg.to,
                notes: notes.trim() || undefined,
                newVehicleName: opt.name,
                ratePerCab: opt.rate,
                totalCost,
            });
            if (!res.success) { failed++; continue; }
            lastAllConfirmed = res.allConfirmed;
        }
        if (failed === pendingLegs.length) return { success: false, error: "Could not change any of the pending legs." };
        toast.success(
            lastAllConfirmed
                ? "All cabs verified! Booking status updated."
                : `${opt.name} applied to ${pendingLegs.length - failed} of ${pendingLegs.length} leg${pendingLegs.length !== 1 ? "s" : ""}.`,
        );
        return { success: true };
    }

    return (
        <div className="rounded-xl border shadow-lg bg-dashboard-base-100 overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors cursor-pointer"
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-dashboard-primary/15">
                        <ShieldCheck className="size-3.5 text-dashboard-primary" />
                    </span>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-dashboard-base-content">
                            Verify all {pendingLegs.length} pending cab{pendingLegs.length !== 1 ? "s" : ""} at once
                        </p>
                        <p className="text-xs text-dashboard-neutral mt-0.5">
                            Confirm cab availability across all transfer legs
                        </p>
                    </div>
                </div>
                {open
                    ? <ChevronUp  className="size-4 shrink-0 text-dashboard-neutral" />
                    : <ChevronDown className="size-4 shrink-0 text-dashboard-neutral" />}
            </button>

            {open && (
                <div className="border-t border-dashboard-primary/15 px-4 py-4 flex flex-col gap-3">

                    {/* Pending legs preview */}
                    <div className="flex flex-wrap gap-1.5">
                        {pendingLegs.map((leg) => (
                            <span
                                key={leg.day}
                                className="inline-flex items-center gap-1 rounded-full border border-dashboard-base-300 bg-dashboard-base-100 px-2.5 py-0.5 text-xs text-dashboard-base-content"
                            >
                                <span className="flex size-4 items-center justify-center rounded-full bg-dashboard-primary/15 text-[9px] font-bold text-dashboard-primary">
                                    {leg.day}
                                </span>
                                <span className="max-w-[120px] truncate">{leg.from}</span>
                                <span className="text-dashboard-neutral">→</span>
                                <span className="max-w-[120px] truncate">{leg.to}</span>
                            </span>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Verification notes (optional)"
                            className={`${inputCls} flex-1`}
                        />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setModalOpen(true)}
                            className="cursor-pointer shrink-0 rounded-lg border border-dashboard-base-300 px-4 py-2 text-sm font-medium text-dashboard-base-100 bg-dashboard-error transition-colors"
                        >
                            Change all cabs
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirmAll}
                            disabled={confirming}
                            className="cursor-pointer shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-dashboard-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <CheckCircle2 className="size-4" />
                            {confirming ? "Verifying…" : `Verify all ${pendingLegs.length}`}
                        </button>
                    </div>
                </div>
            )}

            {modalOpen && (
                <VehiclePickerModal
                    headerTitle={`Change All Cabs — ${pendingLegs.length} leg${pendingLegs.length !== 1 ? "s" : ""}`}
                    destinationId={destinationId}
                    dateISO={pendingLegs[0].dateISO}
                    baselineTotal={baselineTotalSum}
                    estimateCost={estimateCost}
                    confirmLabel={`Apply to all ${pendingLegs.length} →`}
                    onConfirm={handleChangeAll}
                    onClose={() => setModalOpen(false)}
                    onConfirmed={() => { setModalOpen(false); router.refresh(); }}
                />
            )}
        </div>
    );
}
