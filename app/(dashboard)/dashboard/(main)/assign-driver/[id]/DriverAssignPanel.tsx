"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Car, ChevronDown, ChevronUp, Phone, Star, UserMinus, UserPlus } from "lucide-react";
import { assignDriverToSegment, unassignDriverFromSegment, type DriverOption, type SegmentLeg } from "../actions";

export default function DriverAssignPanel({
    bookingId,
    legs,
    vehicleName,
    drivers,
    isFullyAssigned,
}: {
    bookingId: string;
    legs: SegmentLeg[];
    vehicleName: string | null;
    drivers: DriverOption[];
    isFullyAssigned: boolean;
}) {
    const router = useRouter();
    const [open, setOpen]             = useState(false);
    const [assigning, setAssigning]   = useState<number | null>(null);
    const [unassigning, setUnassigning] = useState(false);

    const legNums = legs.map((l) => l.legNumber);

    async function handleAssign(driverId: number) {
        setAssigning(driverId);
        try {
            const res = await assignDriverToSegment(bookingId, legs, driverId);
            if (!res.success) { toast.error(res.error); return; }
            toast.success(
                res.allConfirmed
                    ? "Driver assigned! All legs covered — booking advanced to Cab Confirmed."
                    : `Driver assigned to ${legs.length} leg${legs.length !== 1 ? "s" : ""}.`,
            );
            setOpen(false);
            router.refresh();
        } finally { setAssigning(null); }
    }

    async function handleUnassign() {
        setUnassigning(true);
        try {
            const res = await unassignDriverFromSegment(bookingId, legNums);
            if (!res.success) { toast.error(res.error); return; }
            toast.success("Driver removed from this segment.");
            router.refresh();
        } finally { setUnassigning(false); }
    }

    return (
        <div className="flex flex-col gap-2">
            {/* Action row */}
            <div className="flex items-center gap-2 flex-wrap">
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    className={`cursor-pointer inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all ${
                        open
                            ? "border border-dashboard-base-300 bg-dashboard-base-200 text-dashboard-neutral"
                            : isFullyAssigned
                                ? "border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                                : "bg-dashboard-primary text-white hover:opacity-90 shadow-sm"
                    }`}
                >
                    <UserPlus className="size-3.5" />
                    {isFullyAssigned ? "Change for all days" : "Set driver for all days"}
                    {open
                        ? <ChevronUp   className="size-3.5 ml-0.5" />
                        : <ChevronDown className="size-3.5 ml-0.5" />}
                </button>

                {isFullyAssigned && !open && (
                    <button
                        type="button"
                        onClick={handleUnassign}
                        disabled={unassigning}
                        className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                        <UserMinus className="size-3.5" />
                        {unassigning ? "Removing…" : "Remove"}
                    </button>
                )}
            </div>

            {/* Driver picker */}
            {open && (
                <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-200/30 p-3.5 flex flex-col gap-3">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-dashboard-neutral">
                        {vehicleName
                            ? drivers.length > 0
                                ? `${drivers.length} driver${drivers.length !== 1 ? "s" : ""} · ${vehicleName}`
                                : `No drivers registered for ${vehicleName}`
                            : `${drivers.length} driver${drivers.length !== 1 ? "s" : ""} available`}
                    </p>

                    {drivers.length > 0 ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                            {drivers.map((d) => (
                                <div
                                    key={d.id}
                                    className="flex items-start gap-2.5 rounded-lg border border-dashboard-base-300 bg-dashboard-base-100 px-3 py-2.5 hover:border-dashboard-primary/30 transition-colors"
                                >
                                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-dashboard-primary/10 text-xs font-bold text-dashboard-primary">
                                        {d.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-sm font-semibold text-dashboard-base-content leading-tight">{d.name}</span>
                                            {d.is_verified && (
                                                <span className="rounded-full bg-blue-100 px-1.5 text-[10px] font-bold text-blue-700 leading-4">✓</span>
                                            )}
                                        </div>
                                        <p className="flex items-center gap-1 text-xs text-dashboard-neutral mt-0.5">
                                            <Phone className="size-3 shrink-0" />{d.mobile}
                                        </p>
                                        {d.vehicle_reg_number && (
                                            <p className="flex items-center gap-1 text-xs text-dashboard-neutral">
                                                <Car className="size-3 shrink-0" />{d.vehicle_reg_number}
                                            </p>
                                        )}
                                        {d.city && (
                                            <p className="text-[11px] text-dashboard-neutral/60">{d.city}{d.state ? `, ${d.state}` : ""}</p>
                                        )}
                                        {d.avg_rating != null && (
                                            <div className="flex items-center gap-0.5 text-[11px] text-amber-600">
                                                <Star className="size-3 fill-amber-400 stroke-amber-500" />
                                                <span className="font-semibold">{d.avg_rating.toFixed(1)}</span>
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleAssign(d.id)}
                                        disabled={assigning !== null}
                                        className="cursor-pointer shrink-0 self-center rounded-md bg-dashboard-primary px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
                                    >
                                        {assigning === d.id ? "…" : "Select"}
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-dashboard-neutral py-1">
                            No drivers found for this vehicle type.
                        </p>
                    )}

                    <p className="text-[11px] text-dashboard-neutral pt-0.5 border-t border-dashboard-base-300/50">
                        {drivers.length > 0 ? "Driver not listed?" : "Want to add one?"}{" "}
                        <a href="/dashboard/cab-drivers" target="_blank" rel="noreferrer" className="font-semibold text-dashboard-primary hover:underline">
                            Add a new driver →
                        </a>
                        {vehicleName && (
                            <span className="ml-1 opacity-50">(register as {vehicleName} driver)</span>
                        )}
                    </p>
                </div>
            )}
        </div>
    );
}
