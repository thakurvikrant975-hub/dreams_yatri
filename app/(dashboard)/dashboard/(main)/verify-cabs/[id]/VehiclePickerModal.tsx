"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Car, MapPin, Search, Users, X } from "lucide-react";
import { getVehicleOptionsForDestination, searchVehicleOptionsByCity, type CabVehicleOption } from "../actions";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/**
 * Shared vehicle picker used by both "Change Cab" (single leg) and "Change
 * All Cabs" (bulk). Auto-loads rates for the booking's own destination; when
 * that comes up empty (or ops just wants to look elsewhere), a city search
 * box queries every active rate across all destinations/locations by name.
 */
export default function VehiclePickerModal({
    headerTitle,
    destinationId,
    dateISO,
    baselineTotal,
    estimateCost,
    confirmLabel,
    onConfirm,
    onClose,
    onConfirmed,
}: {
    headerTitle: string;
    destinationId: number | null;
    dateISO: string;
    /** Current cost, for the "vs current" diff shown per option. */
    baselineTotal: number;
    /** Total cost if this vehicle is picked (sums across all affected legs for bulk). */
    estimateCost: (opt: CabVehicleOption) => number;
    confirmLabel: string;
    onConfirm: (opt: CabVehicleOption) => Promise<{ success: boolean; error?: string }>;
    onClose: () => void;
    onConfirmed: () => void;
}) {
    const [loading, setLoading] = useState(true);
    const [destOptions, setDestOptions] = useState<CabVehicleOption[]>([]);
    const [search, setSearch] = useState("");
    const [searching, setSearching] = useState(false);
    const [searchOptions, setSearchOptions] = useState<CabVehicleOption[] | null>(null);
    const [selected, setSelected] = useState<CabVehicleOption | null>(null);
    const [confirming, setConfirming] = useState(false);

    useEffect(() => {
        let cancelled = false;
        if (destinationId == null) { setLoading(false); return; }
        setLoading(true);
        getVehicleOptionsForDestination(destinationId, dateISO).then((opts) => {
            if (!cancelled) { setDestOptions(opts); setLoading(false); }
        });
        return () => { cancelled = true; };
    }, [destinationId, dateISO]);

    // Debounced city search
    useEffect(() => {
        if (search.trim().length < 2) { setSearchOptions(null); return; }
        let cancelled = false;
        setSearching(true);
        const t = setTimeout(() => {
            searchVehicleOptionsByCity(search, dateISO).then((opts) => {
                if (!cancelled) { setSearchOptions(opts); setSearching(false); }
            });
        }, 350);
        return () => { cancelled = true; clearTimeout(t); };
    }, [search, dateISO]);

    const options = searchOptions ?? destOptions;
    const isSearchMode = searchOptions != null;

    async function handleConfirm() {
        if (!selected) return;
        setConfirming(true);
        try {
            const res = await onConfirm(selected);
            if (!res.success) { toast.error(res.error ?? "Could not confirm."); return; }
            onConfirmed();
        } finally { setConfirming(false); }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="relative flex flex-col w-full max-w-lg max-h-[85vh] rounded-xl bg-dashboard-base-100 shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-dashboard-base-300 px-5 py-3.5 shrink-0">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-dashboard-base-content">
                        <Car className="size-4 text-dashboard-neutral" />
                        {headerTitle}
                    </h3>
                    <button
                        onClick={onClose}
                        className="cursor-pointer rounded-md p-1.5 text-dashboard-neutral hover:bg-dashboard-base-200 hover:text-dashboard-base-content transition-colors"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                {/* City search */}
                <div className="shrink-0 border-b border-dashboard-base-300 px-5 py-3">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-dashboard-neutral" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by city (e.g. Munnar, Kochi)…"
                            className="h-9 w-full rounded-md border border-dashboard-base-300 bg-dashboard-base-200/60 pl-8 pr-3 text-sm text-dashboard-base-content placeholder:text-dashboard-neutral outline-none focus:border-dashboard-primary"
                        />
                    </div>
                    {!isSearchMode && !loading && destOptions.length === 0 && (
                        <p className="mt-2 text-xs text-dashboard-error">
                            No vehicle rates configured for this destination — search a city above to use its rates instead.
                        </p>
                    )}
                </div>

                {/* Vehicle list */}
                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3 space-y-2">
                    {loading || searching ? (
                        <p className="py-10 text-center text-sm text-dashboard-neutral">
                            {searching ? "Searching…" : "Loading vehicles…"}
                        </p>
                    ) : options.length === 0 ? (
                        <p className="py-10 text-center text-sm text-dashboard-neutral">
                            {isSearchMode ? `No vehicle rates found for "${search}".` : "No vehicle rates configured for this destination."}
                        </p>
                    ) : options.map((opt) => {
                        const cost = estimateCost(opt);
                        const diff = cost - baselineTotal;
                        const isSelected = selected?.vehicleId === opt.vehicleId && selected.cityLabel === opt.cityLabel;
                        return (
                            <button
                                key={`${opt.vehicleId}-${opt.cityLabel}`}
                                type="button"
                                onClick={() => setSelected(opt)}
                                className={`cursor-pointer w-full rounded-lg border text-left flex items-center justify-between gap-3 p-3 transition-colors ${
                                    isSelected
                                        ? "border-green-500 bg-green-50"
                                        : "border-dashboard-base-300 bg-dashboard-base-100 hover:bg-dashboard-base-200/50"
                                }`}
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className={`text-sm font-semibold ${isSelected ? "text-green-700" : "text-dashboard-base-content"}`}>
                                            {opt.name}
                                        </span>
                                        {opt.hasAc && (
                                            <span className="rounded bg-dashboard-base-200 px-1.5 py-0.5 text-[9px] font-medium text-dashboard-neutral">AC</span>
                                        )}
                                        {opt.isSeasonal && (
                                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-700">Seasonal rate</span>
                                        )}
                                    </div>
                                    <p className="flex items-center gap-1 text-[11px] text-dashboard-neutral mt-0.5">
                                        <MapPin className="size-3" /> {opt.cityLabel}
                                        <span className="text-dashboard-base-300">·</span>
                                        <Users className="size-3" /> {opt.passengerCapacity}-seater
                                        <span className="text-dashboard-base-300">·</span>
                                        {inr(opt.rate)}{opt.pricingType === "PER_KM" ? "/km" : "/day"}
                                    </p>
                                </div>
                                <div className="shrink-0 text-right">
                                    <p className={`text-sm font-bold tabular-nums ${isSelected ? "text-green-700" : "text-dashboard-base-content"}`}>
                                        {inr(cost)}
                                    </p>
                                    {diff !== 0 && (
                                        <p className={`text-[10px] font-semibold ${diff > 0 ? "text-red-500" : "text-green-600"}`}>
                                            {diff > 0 ? "+" : "−"}{inr(Math.abs(diff))} vs current
                                        </p>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="shrink-0 border-t border-dashboard-base-300 bg-dashboard-base-100 px-5 py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0 text-xs">
                        {selected ? (
                            <span className="text-dashboard-base-content">
                                <span className="font-semibold">{selected.name}</span>
                                <span className="text-dashboard-neutral"> · {selected.cityLabel}</span>
                                <span className="ml-1.5 font-bold tabular-nums">{inr(estimateCost(selected))}</span>
                            </span>
                        ) : (
                            <span className="text-dashboard-neutral">Select a vehicle from the list above</span>
                        )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <button
                            onClick={onClose}
                            disabled={confirming}
                            className="cursor-pointer rounded-md border border-dashboard-base-300 px-3 py-2 text-sm font-medium text-dashboard-neutral hover:bg-dashboard-base-200 transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={confirming || !selected}
                            className="cursor-pointer rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-700/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {confirming ? "Confirming…" : confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
