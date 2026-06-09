"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Plus, Star, UserCheck, UserX } from "lucide-react";
import { assignDriverToLeg, quickAddAndAssignDriver, unassignDriverFromLeg, type DriverOption, type QuickDriverInput } from "../actions";

const inputCls =
    "h-9 w-full rounded-md border border-dashboard-base-300 bg-dashboard-base-100 px-3 text-sm text-dashboard-base-content outline-none focus:border-dashboard-primary placeholder:text-dashboard-neutral/60";

type Vehicle = { id: number; name: string };

type CurrentAssignment = {
    driverName: string | null;
    driverPhone: string | null;
    vehicleNumber: string | null;
    confirmedAt: Date | null;
    confirmedBy: string | null;
};

export default function DriverAssignPanel({
    bookingId,
    legNumber,
    fromLocation,
    toLocation,
    vehicleName,
    drivers,
    vehicles,
    currentAssignment,
}: {
    bookingId: string;
    legNumber: number;
    fromLocation: string;
    toLocation: string;
    vehicleName: string | null;
    drivers: DriverOption[];
    vehicles: Vehicle[];
    currentAssignment: CurrentAssignment | null;
}) {
    const router = useRouter();
    const [assigning, setAssigning]   = useState<number | null>(null);
    const [unassigning, setUnassigning] = useState(false);
    const [showAdd, setShowAdd]       = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [notes, setNotes]           = useState("");

    // Quick-add form state
    const [addName,    setAddName]    = useState("");
    const [addPhone,   setAddPhone]   = useState("");
    const [addReg,     setAddReg]     = useState("");
    const [addLicense, setAddLicense] = useState("");
    const [addCity,    setAddCity]    = useState("");
    const [addVehicle, setAddVehicle] = useState<string>("");

    async function handleAssign(driverId: number) {
        setAssigning(driverId);
        try {
            const res = await assignDriverToLeg(bookingId, legNumber, driverId, {
                fromLocation, toLocation,
                notes: notes.trim() || undefined,
            });
            if (!res.success) { toast.error(res.error); return; }
            toast.success(
                res.allConfirmed
                    ? "Driver assigned! All transfers confirmed — booking moved to Cab Confirmed."
                    : "Driver assigned successfully.",
            );
            router.refresh();
        } finally { setAssigning(null); }
    }

    async function handleUnassign() {
        setUnassigning(true);
        try {
            const res = await unassignDriverFromLeg(bookingId, legNumber);
            if (!res.success) { toast.error(res.error); return; }
            toast.success("Driver unassigned.");
            router.refresh();
        } finally { setUnassigning(false); }
    }

    async function handleQuickAdd(e: React.FormEvent) {
        e.preventDefault();
        if (!addName.trim() || !addPhone.trim()) {
            toast.error("Name and phone are required.");
            return;
        }
        setSubmitting(true);
        try {
            const data: QuickDriverInput = {
                name: addName.trim(),
                mobile: addPhone.trim(),
                vehicle_reg_number: addReg.trim() || undefined,
                license_number: addLicense.trim() || undefined,
                city: addCity.trim() || undefined,
                vehicle_id: addVehicle ? Number(addVehicle) : null,
            };
            const res = await quickAddAndAssignDriver(bookingId, legNumber, data, {
                fromLocation, toLocation,
                notes: notes.trim() || undefined,
            });
            if (!res.success) { toast.error(res.error); return; }
            toast.success(
                res.allConfirmed
                    ? "New driver added and assigned! All transfers confirmed."
                    : "New driver added and assigned.",
            );
            router.refresh();
        } finally { setSubmitting(false); }
    }

    return (
        <div className="flex flex-col gap-3">
            {/* Vehicle context label */}
            {vehicleName && (
                <p className="text-[11px] uppercase tracking-widest text-dashboard-neutral font-semibold">
                    Showing drivers for &nbsp;<span className="font-bold text-dashboard-primary">{vehicleName}</span>
                    {drivers.length === 0 && " — no registered drivers found"}
                </p>
            )}

            {/* Notes field (shared across all actions) */}
            <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes for this assignment (optional)"
                className={inputCls}
            />

            {/* Driver cards grid */}
            {drivers.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                    {drivers.map((d) => (
                        <div
                            key={d.id}
                            className="flex items-start justify-between gap-3 rounded-lg border border-dashboard-base-300 bg-dashboard-base-200/50 px-3 py-2.5"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-semibold text-dashboard-base-content truncate">{d.name}</span>
                                    {d.is_verified && (
                                        <span className="shrink-0 rounded-full bg-blue-100 px-1.5 py-0 text-[10px] font-semibold text-blue-700">✓ Verified</span>
                                    )}
                                </div>
                                <p className="mt-0.5 text-xs text-dashboard-neutral">📞 {d.mobile}</p>
                                {d.vehicle_reg_number && (
                                    <p className="text-xs text-dashboard-neutral">🚗 {d.vehicle_reg_number}</p>
                                )}
                                {d.city && (
                                    <p className="text-[11px] text-dashboard-neutral opacity-70">📍 {d.city}{d.state ? `, ${d.state}` : ""}</p>
                                )}
                                {d.avg_rating != null && (
                                    <div className="mt-1 flex items-center gap-0.5 text-[11px] text-amber-600">
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
                                {assigning === d.id ? "…" : "Assign"}
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-200/40 px-4 py-3 text-sm text-dashboard-neutral">
                    No registered drivers found for this vehicle type.
                    <span className="ml-1 font-medium text-dashboard-primary cursor-pointer" onClick={() => setShowAdd(true)}>
                        Add one below →
                    </span>
                </div>
            )}

            {/* Add Driver toggle */}
            <button
                type="button"
                onClick={() => setShowAdd((v) => !v)}
                className="flex items-center gap-1.5 text-sm font-medium text-dashboard-primary hover:opacity-80 transition-opacity cursor-pointer self-start"
            >
                <Plus className="size-4" />
                Add New Driver
                {showAdd ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>

            {/* Quick-add form */}
            {showAdd && (
                <form
                    onSubmit={handleQuickAdd}
                    className="rounded-xl border border-dashboard-primary/20 bg-dashboard-primary/5 px-4 py-4 flex flex-col gap-3"
                >
                    <p className="text-xs font-semibold uppercase tracking-wide text-dashboard-primary">
                        New Driver — will be saved to the driver database and assigned to this leg
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                            required
                            value={addName}
                            onChange={(e) => setAddName(e.target.value)}
                            placeholder="Full name *"
                            className={inputCls}
                        />
                        <input
                            required
                            value={addPhone}
                            onChange={(e) => setAddPhone(e.target.value)}
                            placeholder="Mobile number *"
                            className={inputCls}
                        />
                        <input
                            value={addReg}
                            onChange={(e) => setAddReg(e.target.value)}
                            placeholder="Vehicle reg. number (optional)"
                            className={inputCls}
                        />
                        <input
                            value={addLicense}
                            onChange={(e) => setAddLicense(e.target.value)}
                            placeholder="License number (optional)"
                            className={inputCls}
                        />
                        <input
                            value={addCity}
                            onChange={(e) => setAddCity(e.target.value)}
                            placeholder="City (optional)"
                            className={inputCls}
                        />
                        <select
                            value={addVehicle}
                            onChange={(e) => setAddVehicle(e.target.value)}
                            className={inputCls}
                        >
                            <option value="">Vehicle type (optional)</option>
                            {vehicles.map((v) => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="cursor-pointer self-start inline-flex items-center gap-1.5 rounded-lg bg-dashboard-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <UserCheck className="size-4" />
                        {submitting ? "Adding & Assigning…" : "Add & Assign Driver"}
                    </button>
                </form>
            )}

            {/* Unassign option if currently assigned */}
            {currentAssignment?.driverName && (
                <button
                    type="button"
                    onClick={handleUnassign}
                    disabled={unassigning}
                    className="cursor-pointer self-start flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <UserX className="size-3.5" />
                    {unassigning ? "Removing…" : "Unassign current driver"}
                </button>
            )}
        </div>
    );
}
