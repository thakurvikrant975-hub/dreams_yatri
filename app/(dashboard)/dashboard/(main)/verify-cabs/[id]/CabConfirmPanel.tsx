"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { confirmCabLeg, type CabVehicleOption } from "../actions";
import VehiclePickerModal from "./VehiclePickerModal";

const inputCls =
    "h-9 w-full rounded-md border border-dashboard-base-300 bg-dashboard-base-100 px-3 text-sm text-dashboard-base-content outline-none focus:border-dashboard-primary placeholder:text-dashboard-neutral/60";
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export default function CabConfirmPanel({
    bookingId,
    legNumber,
    fromLocation,
    toLocation,
    destinationId,
    legDateISO,
    currentVehicleName,
    baselineRate,
    baselineTotal,
    pricingType,
    km,
}: {
    bookingId: string;
    legNumber: number;
    fromLocation: string;
    toLocation: string;
    destinationId: number | null;
    legDateISO: string;
    currentVehicleName: string;
    baselineRate: number;
    baselineTotal: number;
    pricingType: "PER_DAY" | "PER_KM";
    km: number;
}) {
    const router = useRouter();
    const [notes, setNotes] = useState("");
    const [confirming, setConfirming] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);

    async function handleConfirm() {
        setConfirming(true);
        try {
            const res = await confirmCabLeg(bookingId, legNumber, {
                fromLocation, toLocation,
                notes: notes.trim() || undefined,
                ratePerCab: baselineRate,
                totalCost: baselineTotal,
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

    function costFor(opt: CabVehicleOption): number {
        return opt.pricingType === "PER_KM" ? opt.rate * km : opt.rate;
    }

    return (
        <div className="flex flex-col gap-2">
            {baselineTotal > 0 && (
                <p className="text-xs text-dashboard-neutral">
                    Current: <span className="font-medium text-dashboard-base-content">{currentVehicleName}</span>
                    {" · "}{inr(baselineRate)}{pricingType === "PER_KM" ? "/km" : "/day"}
                    {" · "}<span className="font-semibold text-dashboard-base-content">{inr(baselineTotal)}</span>
                </p>
            )}
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
                    className="cursor-pointer rounded-lg border border-dashboard-base-300 px-3 py-2 text-sm font-medium text-dashboard-base-100 bg-dashboard-error transition-colors"
                >
                    Change Cab
                </button>
                <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={confirming}
                    className="cursor-pointer shrink-0 rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-700/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {confirming
                        ? "Verifying…"
                        : <span className="flex items-center gap-1.5"><CheckCircle2 className="size-4" /> Verify Cab</span>
                    }
                </button>
            </div>

            {modalOpen && (
                <VehiclePickerModal
                    headerTitle={`Change Cab — Day ${legNumber}`}
                    destinationId={destinationId}
                    dateISO={legDateISO}
                    baselineTotal={baselineTotal}
                    estimateCost={costFor}
                    confirmLabel="Confirm Change →"
                    onConfirm={(opt) => confirmCabLeg(bookingId, legNumber, {
                        fromLocation, toLocation,
                        notes: notes.trim() || undefined,
                        newVehicleName: opt.name,
                        ratePerCab: opt.rate,
                        totalCost: costFor(opt),
                    })}
                    onClose={() => setModalOpen(false)}
                    onConfirmed={() => { setModalOpen(false); router.refresh(); toast.success("Cab changed & verified."); }}
                />
            )}
        </div>
    );
}
