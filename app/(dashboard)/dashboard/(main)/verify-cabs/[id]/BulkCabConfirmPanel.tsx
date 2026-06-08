"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { confirmAllCabLegs } from "../actions";

const inputCls =
    "h-9 w-full rounded-md border border-dashboard-base-300 bg-dashboard-base-100 px-3 text-sm text-dashboard-base-content outline-none focus:border-dashboard-primary placeholder:text-dashboard-neutral/60";

type PendingLeg = {
    day: number;
    from: string;
    to: string;
};

export default function BulkCabConfirmPanel({
    bookingId,
    pendingLegs,
}: {
    bookingId: string;
    pendingLegs: PendingLeg[];
}) {
    const router = useRouter();
    const [open,          setOpen]          = useState(true);
    const [driverName,    setDriverName]    = useState("");
    const [driverPhone,   setDriverPhone]   = useState("");
    const [vehicleNumber, setVehicleNumber] = useState("");
    const [notes,         setNotes]         = useState("");
    const [confirming,    setConfirming]    = useState(false);

    if (pendingLegs.length === 0) return null;

    async function handleConfirmAll() {
        setConfirming(true);
        try {
            const res = await confirmAllCabLegs(bookingId, {
                driverName:    driverName.trim()    || undefined,
                driverPhone:   driverPhone.trim()   || undefined,
                vehicleNumber: vehicleNumber.trim() || undefined,
                notes:         notes.trim()         || undefined,
            });
            if (!res.success) { toast.error(res.error); return; }
            toast.success(`${res.count} transfer${res.count !== 1 ? "s" : ""} confirmed.`);
            router.refresh();
        } finally { setConfirming(false); }
    }

    return (
        <div className="rounded-xl border border-dashboard-primary/25 bg-dashboard-primary/5 overflow-hidden">
            {/* Header — always visible, toggles body */}
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-dashboard-primary/10 transition-colors cursor-pointer"
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-dashboard-primary/15">
                        <Zap className="size-3.5 text-dashboard-primary" />
                    </span>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-dashboard-base-content">
                            Confirm all {pendingLegs.length} pending transfer{pendingLegs.length !== 1 ? "s" : ""} at once
                        </p>
                        <p className="text-xs text-dashboard-neutral mt-0.5">
                            Enter driver details once — applied to every leg below
                        </p>
                    </div>
                </div>
                {open
                    ? <ChevronUp  className="size-4 shrink-0 text-dashboard-neutral" />
                    : <ChevronDown className="size-4 shrink-0 text-dashboard-neutral" />
                }
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

                    {/* Driver inputs */}
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
                            onClick={handleConfirmAll}
                            disabled={confirming}
                            className="cursor-pointer shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-dashboard-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <CheckCircle2 className="size-4" />
                            {confirming ? "Confirming…" : `Confirm all ${pendingLegs.length}`}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
