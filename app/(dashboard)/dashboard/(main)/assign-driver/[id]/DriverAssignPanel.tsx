"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Star, UserX, X } from "lucide-react";
import { assignDriverToLeg, unassignDriverFromLeg, type DriverOption } from "../actions";

export default function DriverAssignPanel({
    bookingId,
    legNumber,
    fromLocation,
    toLocation,
    vehicleName,
    drivers,
    isAssigned,
}: {
    bookingId: string;
    legNumber: number;
    fromLocation: string;
    toLocation: string;
    vehicleName: string | null;
    drivers: DriverOption[];
    isAssigned: boolean;
}) {
    const router = useRouter();
    const [open, setOpen]         = useState(false);
    const [assigning, setAssigning] = useState<number | null>(null);
    const [unassigning, setUnassigning] = useState(false);

    async function handleAssign(driverId: number) {
        setAssigning(driverId);
        try {
            const res = await assignDriverToLeg(bookingId, legNumber, driverId, { fromLocation, toLocation });
            if (!res.success) { toast.error(res.error); return; }
            toast.success(
                res.allConfirmed
                    ? "Driver assigned! All legs done — booking advanced to Cab Confirmed."
                    : "Driver assigned successfully.",
            );
            setOpen(false);
            router.refresh();
        } finally { setAssigning(null); }
    }

    async function handleUnassign() {
        setUnassigning(true);
        try {
            const res = await unassignDriverFromLeg(bookingId, legNumber);
            if (!res.success) { toast.error(res.error); return; }
            toast.success("Driver removed.");
            router.refresh();
        } finally { setUnassigning(false); }
    }

    return (
        <div className="flex flex-col gap-2.5">
            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap">
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    className={`cursor-pointer inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                        open
                            ? "border border-dashboard-base-300 bg-dashboard-base-200 text-dashboard-neutral"
                            : isAssigned
                                ? "border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                                : "bg-dashboard-primary text-white hover:opacity-90"
                    }`}
                >
                    {open ? (
                        <><X className="size-3.5" /> Cancel</>
                    ) : isAssigned ? (
                        <>🔄 Change Driver</>
                    ) : (
                        <>👤 Assign Driver</>
                    )}
                </button>
                {isAssigned && !open && (
                    <button
                        type="button"
                        onClick={handleUnassign}
                        disabled={unassigning}
                        className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <UserX className="size-3.5" />
                        {unassigning ? "Removing…" : "Remove"}
                    </button>
                )}
            </div>

            {/* Driver picker (inline expand) */}
            {open && (
                <div className="rounded-xl border border-dashboard-primary/20 bg-dashboard-primary/4 p-3 flex flex-col gap-2.5">
                    {/* Vehicle context */}
                    <p className="text-[10px] uppercase tracking-widest font-semibold text-dashboard-neutral">
                        {vehicleName
                            ? drivers.length > 0
                                ? `${drivers.length} driver${drivers.length !== 1 ? "s" : ""} registered for ${vehicleName}`
                                : `No drivers registered for ${vehicleName}`
                            : `${drivers.length} driver${drivers.length !== 1 ? "s" : ""} available`}
                    </p>

                    {drivers.length > 0 ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                            {drivers.map((d) => (
                                <div
                                    key={d.id}
                                    className="flex items-start justify-between gap-2 rounded-lg border border-dashboard-base-300 bg-dashboard-base-100 px-3 py-2.5"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-sm font-semibold text-dashboard-base-content">{d.name}</span>
                                            {d.is_verified && (
                                                <span className="rounded-full bg-blue-100 px-1.5 py-0 text-[10px] font-bold text-blue-700">✓ Verified</span>
                                            )}
                                        </div>
                                        <p className="mt-0.5 text-xs text-dashboard-neutral">📞 {d.mobile}</p>
                                        {d.vehicle_reg_number && (
                                            <p className="text-xs text-dashboard-neutral">🚗 {d.vehicle_reg_number}</p>
                                        )}
                                        {d.city && (
                                            <p className="text-[11px] text-dashboard-neutral opacity-70">
                                                📍 {d.city}{d.state ? `, ${d.state}` : ""}
                                            </p>
                                        )}
                                        {d.avg_rating != null && (
                                            <div className="mt-0.5 flex items-center gap-0.5 text-[11px] text-amber-600">
                                                <Star className="size-3 fill-amber-400 stroke-amber-500" />
                                                <span className="font-semibold">{d.avg_rating.toFixed(1)}</span>
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleAssign(d.id)}
                                        disabled={assigning !== null}
                                        className="cursor-pointer shrink-0 rounded-md bg-dashboard-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {assigning === d.id ? "…" : "Select"}
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-dashboard-neutral">
                            No drivers found for this vehicle type.
                        </p>
                    )}

                    {/* Link to add drivers */}
                    <p className="text-[11px] text-dashboard-neutral border-t border-dashboard-base-300/60 pt-2 mt-0.5">
                        {drivers.length > 0 ? "Driver not listed?" : "Want to add one?"}{" "}
                        <a
                            href="/dashboard/cab-drivers"
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-dashboard-primary hover:underline"
                        >
                            Add a new driver →
                        </a>
                        {vehicleName && (
                            <span className="ml-1 opacity-60">(register them as {vehicleName} driver)</span>
                        )}
                    </p>
                </div>
            )}
        </div>
    );
}
