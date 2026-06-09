"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Car, ChevronDown, ChevronUp, Phone, Star, UserMinus, UserPlus, UserX } from "lucide-react";
import { assignDriverToSegment, unassignDriverFromSegment, type DriverOption, type SegmentLeg } from "../actions";

export default function LegDriverPicker({
    bookingId,
    leg,
    driverName,
    driverPhone,
    vehicleNumber,
    confirmedBy,
    drivers,
}: {
    bookingId: string;
    leg: SegmentLeg;
    driverName: string | null;
    driverPhone: string | null;
    vehicleNumber: string | null;
    confirmedBy: string | null;
    drivers: DriverOption[];
}) {
    const router = useRouter();
    const [open, setOpen]           = useState(false);
    const [assigning, setAssigning] = useState<number | null>(null);
    const [removing, setRemoving]   = useState(false);
    const isAssigned = !!driverName;

    async function handleAssign(driverId: number) {
        setAssigning(driverId);
        try {
            const res = await assignDriverToSegment(bookingId, [leg], driverId);
            if (!res.success) { toast.error(res.error); return; }
            toast.success(res.allConfirmed ? "Driver assigned — all legs covered!" : "Driver assigned for this day.");
            setOpen(false);
            router.refresh();
        } finally { setAssigning(null); }
    }

    async function handleRemove() {
        setRemoving(true);
        try {
            const res = await unassignDriverFromSegment(bookingId, [leg.legNumber]);
            if (!res.success) { toast.error(res.error); return; }
            toast.success("Driver removed from this day.");
            router.refresh();
        } finally { setRemoving(false); }
    }

    return (
        <div className="mt-1.5 flex flex-col gap-1.5">
            {/* Assigned state — show pill + actions */}
            {isAssigned && !open && (
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 rounded-md border border-green-200 bg-green-50 px-2.5 py-1">
                        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-green-200 text-[9px] font-bold text-green-800">
                            {driverName!.charAt(0).toUpperCase()}
                        </span>
                        <span className="text-xs font-semibold text-green-800">{driverName}</span>
                        {driverPhone && (
                            <span className="flex items-center gap-0.5 text-[11px] text-green-700">
                                <Phone className="size-2.5 shrink-0" />{driverPhone}
                            </span>
                        )}
                        {vehicleNumber && (
                            <span className="flex items-center gap-0.5 text-[11px] text-green-700">
                                <Car className="size-2.5 shrink-0" />{vehicleNumber}
                            </span>
                        )}
                        {confirmedBy && (
                            <span className="text-[10px] text-green-600 opacity-60">by {confirmedBy}</span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                        Change
                    </button>
                    <button
                        type="button"
                        onClick={handleRemove}
                        disabled={removing}
                        className="flex items-center gap-0.5 text-[11px] font-semibold text-red-500 hover:underline cursor-pointer disabled:opacity-50"
                    >
                        <UserX className="size-3 shrink-0" />
                        {removing ? "Removing…" : "Remove"}
                    </button>
                </div>
            )}

            {/* Unassigned or changing — trigger button */}
            {(!isAssigned || open) && (
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    className={`inline-flex w-fit items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                        open
                            ? "border border-dashboard-base-300 bg-dashboard-base-200 text-dashboard-neutral"
                            : "bg-dashboard-primary/10 text-dashboard-primary hover:bg-dashboard-primary/20"
                    }`}
                >
                    <UserPlus className="size-3 shrink-0" />
                    {isAssigned ? "Change driver for this day" : "Assign driver for this day"}
                    {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                </button>
            )}

            {/* Driver picker dropdown */}
            {open && (
                <div className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-100 p-2.5 flex flex-col gap-2">
                    {drivers.length > 0 ? (
                        <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto">
                            {drivers.map((d) => (
                                <div
                                    key={d.id}
                                    className="flex items-center gap-2.5 rounded-md border border-dashboard-base-300 bg-dashboard-base-200/40 px-2.5 py-2 hover:border-dashboard-primary/30 transition-colors"
                                >
                                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-dashboard-primary/10 text-xs font-bold text-dashboard-primary">
                                        {d.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1 flex-wrap">
                                            <span className="text-xs font-semibold text-dashboard-base-content leading-tight">{d.name}</span>
                                            {d.is_verified && (
                                                <span className="rounded-full bg-blue-100 px-1 text-[9px] font-bold text-blue-700 leading-4">Verified</span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0 text-[10px] text-dashboard-neutral mt-0.5">
                                            <span className="flex items-center gap-0.5">
                                                <Phone className="size-2.5 shrink-0" />{d.mobile}
                                            </span>
                                            {d.vehicle_reg_number && (
                                                <span className="flex items-center gap-0.5">
                                                    <Car className="size-2.5 shrink-0" />{d.vehicle_reg_number}
                                                </span>
                                            )}
                                            {d.avg_rating != null && (
                                                <span className="flex items-center gap-0.5 text-amber-600">
                                                    <Star className="size-2.5 fill-amber-400 stroke-amber-500" />
                                                    {d.avg_rating.toFixed(1)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleAssign(d.id)}
                                        disabled={assigning !== null}
                                        className="shrink-0 cursor-pointer rounded-md bg-dashboard-primary px-2.5 py-1 text-[11px] font-bold text-white hover:opacity-90 disabled:opacity-50"
                                    >
                                        {assigning === d.id ? "…" : "Select"}
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-dashboard-neutral py-1">No drivers registered for this vehicle type.</p>
                    )}
                    <p className="border-t border-dashboard-base-300/50 pt-1.5 text-[10px] text-dashboard-neutral">
                        Driver not listed?{" "}
                        <a
                            href="/dashboard/cab-drivers"
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-dashboard-primary hover:underline"
                        >
                            Add a driver
                        </a>
                    </p>
                </div>
            )}
        </div>
    );
}
