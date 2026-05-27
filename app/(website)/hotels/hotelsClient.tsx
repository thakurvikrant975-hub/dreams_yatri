"use client";
// app/(website)/hotels/HotelsClient.tsx

import { useState } from "react";
import { useHotels } from "@/app/hooks/hotels/useHotels";
import type {
    HotelCardData,
    HotelListMeta,
} from "@/app/types/hotels/hotels";
import HotelCard from "./components/hotelCard";


// ── Types ─────────────────────────────────────────────────────────────────

type Props = {
    initialHotels: HotelCardData[];
    initialMeta: HotelListMeta;
};

// ── Helpers ───────────────────────────────────────────────────────────────

function getStartingPrice(hotel: HotelCardData) {
    return hotel.room_pricing[0]?.price_per_night ?? null;
}

function getDiscount(hotel: HotelCardData) {
    const r = hotel.room_pricing[0];
    if (!r?.original_price) return null;
    return Math.round((1 - r.price_per_night / r.original_price) * 100);
}

// ── Hotel Card ────────────────────────────────────────────────────────────



// ── Pagination ─────────────────────────────────────────────────────────────

function Pagination({
    meta,
    onPage,
}: {
    meta: HotelListMeta;
    onPage: (p: number) => void;
}) {
    if (meta.totalPages <= 1) return null;

    const pages = Array.from({ length: meta.totalPages }, (_, i) => i + 1)
        .filter(p => p === 1 || p === meta.totalPages || Math.abs(p - meta.page) <= 2);

    return (
        <div className="flex items-center justify-center gap-2 mt-8">
            <button
                onClick={() => onPage(meta.page - 1)}
                disabled={!meta.hasPrevPage}
                className="text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
                ← Prev
            </button>

            {pages.map((p, i) => {
                const prev = pages[i - 1];
                const showEllipsis = prev && p - prev > 1;
                return (
                    <span key={p} className="flex items-center gap-2">
                        {showEllipsis && <span className="text-muted-foreground text-sm">…</span>}
                        <button
                            onClick={() => onPage(p)}
                            className={`text-sm w-8 h-8 rounded-lg border transition-colors ${p === meta.page
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "border-border hover:bg-muted"
                                }`}
                        >
                            {p}
                        </button>
                    </span>
                );
            })}

            <button
                onClick={() => onPage(meta.page + 1)}
                disabled={!meta.hasNextPage}
                className="text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
                Next →
            </button>
        </div>
    );
}

// ── Main Client Component ─────────────────────────────────────────────────

const CATEGORIES = ["hotel", "resort", "houseboat", "villa", "homestay"];
const STAY_TYPES = ["1 Star", "2 Star", "3 Star", "4 Star", "5 Star"];
const SORT_OPTIONS = [
    { label: "Newest", value: "newest" },
    { label: "Price: Low", value: "price_asc" },
    { label: "Price: High", value: "price_desc" },
] as const;

export function HotelsClient({ initialHotels, initialMeta }: Props) {
    const { hotels, meta, loading, error, setFilter, setPage, filters } = useHotels();

    // On mount, useHotels starts empty and fetches — hydrate with SSR data until ready
    const displayHotels = loading && hotels.length === 0 ? initialHotels : hotels;
    const displayMeta = meta ?? initialMeta;

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-semibold">Hotels</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {displayMeta.total} properties found
                    </p>
                </div>

                {/* Sort */}
                <select
                    className="text-sm border border-border rounded-lg px-3 py-2 bg-background"
                    value={filters.sort ?? "newest"}
                    onChange={e => setFilter("sort", e.target.value as any)}
                >
                    {SORT_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
            </div>

            <div className="flex gap-6">
                {/* ── Filter sidebar ── */}
                <aside className="w-56 shrink-0 space-y-5">

                    {/* Search */}
                    <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Search</p>
                        <input
                            type="text"
                            placeholder="Hotel name..."
                            className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background"
                            defaultValue={filters.search ?? ""}
                            onChange={e => setFilter("search", e.target.value || undefined)}
                        />
                    </div>

                    {/* Category */}
                    <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</p>
                        <div className="space-y-1">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                    type="radio"
                                    name="category"
                                    checked={!filters.category}
                                    onChange={() => setFilter("category", undefined)}
                                />
                                All types
                            </label>
                            {CATEGORIES.map(cat => (
                                <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer capitalize">
                                    <input
                                        type="radio"
                                        name="category"
                                        checked={filters.category === cat}
                                        onChange={() => setFilter("category", cat)}
                                    />
                                    {cat}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Stay Type */}
                    <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Stay Type</p>
                        <div className="space-y-1">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="radio" name="stay_type" checked={!filters.stay_type} onChange={() => setFilter("stay_type", undefined)} />
                                Any
                            </label>
                            {STAY_TYPES.map(t => (
                                <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input type="radio" name="stay_type" checked={filters.stay_type === t} onChange={() => setFilter("stay_type", t)} />
                                    {t}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Price range */}
                    <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Price / Night</p>
                        <div className="flex gap-2 items-center">
                            <input
                                type="number"
                                placeholder="Min"
                                className="w-full text-sm border border-border rounded-lg px-2 py-1.5 bg-background"
                                value={filters.min_price ?? ""}
                                onChange={e => setFilter("min_price", e.target.value ? Number(e.target.value) : undefined)}
                            />
                            <span className="text-muted-foreground text-xs shrink-0">–</span>
                            <input
                                type="number"
                                placeholder="Max"
                                className="w-full text-sm border border-border rounded-lg px-2 py-1.5 bg-background"
                                value={filters.max_price ?? ""}
                                onChange={e => setFilter("max_price", e.target.value ? Number(e.target.value) : undefined)}
                            />
                        </div>
                    </div>
                </aside>

                {/* ── Hotel list ── */}
                <div className="flex-1 min-w-0">
                    {error && (
                        <div className="text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-lg mb-4">
                            {error}
                        </div>
                    )}

                    {loading && (
                        <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>
                    )}

                    {!loading && displayHotels.length === 0 && (
                        <div className="text-sm text-muted-foreground py-12 text-center">
                            No hotels found matching your filters.
                        </div>
                    )}

                    <div className={`flex flex-col gap-4 ${loading ? "opacity-50 pointer-events-none" : ""}`}>
                        {displayHotels.map(hotel => (
                            <HotelCard key={hotel.id} hotel={hotel} />
                        ))}
                    </div>

                    <Pagination meta={displayMeta} onPage={setPage} />
                </div>
            </div>
        </div>
    );
}