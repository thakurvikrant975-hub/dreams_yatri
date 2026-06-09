"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Car, ChevronDown, ChevronUp, Phone, Star, Zap } from "lucide-react";
import { assignDriverToAllLegs, type DriverOption } from "../actions";

export default function QuickAssignPanel({
    bookingId,
    totalLegs,
    drivers,
    vehicleLabel,
}: {
    bookingId: string;
    totalLegs: number;
    drivers: DriverOption[];
    /** e.g. "Swift Dzire" when single type, "all vehicle types" when mixed */
    vehicleLabel: string;
}) {
    const router = useRouter();
    const [open, setOpen]         = useState(true);
    const [assigning, setAssigning] = useState<number | null>(null);

    async function handleAssign(driverId: number) {
        setAssigning(driverId);
        try {
            const res = await assignDriverToAllLegs(bookingId, driverId);
            if (!res.success) { toast.error(res.error); return; }
            toast.success(
                res.allConfirmed
                    ? "Driver assigned for the full trip! Booking advanced to Cab Confirmed."
                    : `Driver assigned to all ${totalLegs} transfers.`,
            );
            setOpen(false);
            router.refresh();
        } finally { setAssigning(null); }
    }

    return (
        <div className="rounded-xl border-2 border-dashboard-primary/30 overflow-hidden shadow-sm">
            {/* Header toggle */}
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 bg-dashboard-primary/8 hover:bg-dashboard-primary/12 transition-colors cursor-pointer"
            >
                <div className="flex items-center gap-3 min-w-0">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-dashboard-primary text-white shadow-sm">
                        <Zap className="size-4" />
                    </span>
                    <div className="text-left min-w-0">
                        <p className="text-sm font-bold text-dashboard-base-content leading-tight">
                            Assign one driver for the full trip
                        </p>
                        <p className="text-xs text-dashboard-neutral mt-0.5">
                            {totalLegs} transfer{totalLegs !== 1 ? "s" : ""} · {vehicleLabel} · most common workflow
                        </p>
                    </div>
                </div>
                <span className="shrink-0 rounded-full bg-dashboard-primary/10 p-1">
                    {open
                        ? <ChevronUp  className="size-4 text-dashboard-primary" />
                        : <ChevronDown className="size-4 text-dashboard-primary" />}
                </span>
            </button>

            {open && (
                <div className="px-5 py-4 flex flex-col gap-3 bg-dashboard-base-100 border-t border-dashboard-primary/15">
                    {drivers.length > 0 ? (
                        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                            {drivers.map((d) => (
                                <div
                                    key={d.id}
                                    className="flex items-start gap-3 rounded-xl border border-dashboard-base-300 bg-dashboard-base-200/40 px-3.5 py-3 hover:border-dashboard-primary/40 hover:bg-dashboard-primary/5 transition-all group"
                                >
                                    {/* Avatar placeholder */}
                                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-dashboard-primary/10 text-sm font-bold text-dashboard-primary">
                                        {d.name.charAt(0).toUpperCase()}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-sm font-semibold text-dashboard-base-content leading-tight">{d.name}</span>
                                            {d.is_verified && (
                                                <span className="rounded-full bg-blue-100 px-1.5 py-0 text-[10px] font-bold text-blue-700 leading-4">✓</span>
                                            )}
                                        </div>
                                        <p className="flex items-center gap-1 text-xs text-dashboard-neutral mt-0.5">
                                            <Phone className="size-3 shrink-0" />{d.mobile}
                                        </p>
                                        {d.vehicle?.name && (
                                            <p className="flex items-center gap-1 text-[11px] text-dashboard-neutral/70 mt-0.5">
                                                <Car className="size-3 shrink-0" />{d.vehicle.name}
                                            </p>
                                        )}
                                        {d.vehicle_reg_number && (
                                            <p className="text-[11px] text-dashboard-neutral/70">{d.vehicle_reg_number}</p>
                                        )}
                                        {d.avg_rating != null && (
                                            <div className="flex items-center gap-0.5 mt-0.5 text-[11px] text-amber-600">
                                                <Star className="size-3 fill-amber-400 stroke-amber-500" />
                                                <span className="font-semibold">{d.avg_rating.toFixed(1)}</span>
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => handleAssign(d.id)}
                                            disabled={assigning !== null}
                                            className="mt-2 w-full cursor-pointer rounded-lg bg-dashboard-primary py-1.5 text-xs font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {assigning === d.id ? "Assigning…" : "Assign for Full Trip"}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-200/40 px-4 py-3 text-sm text-dashboard-neutral">
                            No active drivers found.{" "}
                            <a href="/dashboard/cab-drivers" target="_blank" rel="noreferrer" className="font-semibold text-dashboard-primary hover:underline">
                                Add drivers →
                            </a>
                        </div>
                    )}

                    <p className="text-[11px] text-dashboard-neutral">
                        Driver not listed?{" "}
                        <a href="/dashboard/cab-drivers" target="_blank" rel="noreferrer" className="font-semibold text-dashboard-primary hover:underline">
                            Manage drivers →
                        </a>
                        <span className="ml-1.5 opacity-50">· or use per-segment assignment below for different drivers on different legs</span>
                    </p>
                </div>
            )}
        </div>
    );
}
