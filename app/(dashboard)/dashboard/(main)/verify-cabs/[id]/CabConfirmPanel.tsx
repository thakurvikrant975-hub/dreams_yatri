"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { confirmCabLeg } from "../actions";

const inputCls =
    "h-9 w-full rounded-md border border-dashboard-base-300 bg-dashboard-base-100 px-3 text-sm text-dashboard-base-content outline-none focus:border-dashboard-primary placeholder:text-dashboard-neutral/60";

export default function CabConfirmPanel({
    bookingId,
    legNumber,
    fromLocation,
    toLocation,
}: {
    bookingId: string;
    legNumber: number;
    fromLocation: string;
    toLocation: string;
}) {
    const router = useRouter();
    const [driverName,    setDriverName]    = useState("");
    const [driverPhone,   setDriverPhone]   = useState("");
    const [vehicleNumber, setVehicleNumber] = useState("");
    const [notes,         setNotes]         = useState("");
    const [confirming,    setConfirming]    = useState(false);

    async function handleConfirm() {
        setConfirming(true);
        try {
            const res = await confirmCabLeg(bookingId, legNumber, {
                fromLocation,
                toLocation,
                driverName:    driverName.trim()    || undefined,
                driverPhone:   driverPhone.trim()   || undefined,
                vehicleNumber: vehicleNumber.trim() || undefined,
                notes:         notes.trim()         || undefined,
            });
            if (!res.success) { toast.error(res.error); return; }
            toast.success(
                res.allConfirmed
                    ? "All cabs confirmed! Booking moved to Cab Confirmed."
                    : "Cab transfer confirmed.",
            );
            router.refresh();
        } finally { setConfirming(false); }
    }

    return (
        <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="Driver name (optional)"
                    className={inputCls}
                />
                <input
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                    placeholder="Driver phone (optional)"
                    className={inputCls}
                />
                <input
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    placeholder="Vehicle no. (optional)"
                    className={inputCls}
                />
            </div>
            <div className="flex items-center gap-2">
                <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notes (optional)"
                    className={`${inputCls} flex-1`}
                />
                <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={confirming}
                    className="cursor-pointer shrink-0 rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-700/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {confirming ? "Confirming…" : "✓ Confirm Transfer"}
                </button>
            </div>
        </div>
    );
}
