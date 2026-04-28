import React, { useState } from 'react'
import { Filter, MapPin, Quote, Star, ChevronDown } from 'lucide-react';
import { AVATAR_COLORS, DESTINATIONS, TESTIMONIALS } from './data';
import { SectionLabel } from '../components/SectionLabel';
import { SectionHeading } from '../components/SectionHeading';


function Avatar({ initials, index }: { initials: string; index: number }) {
    const [bg, text] = AVATAR_COLORS[index % AVATAR_COLORS.length];
    return (
        <div
            className="rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ width: 44, height: 44, background: bg, color: text, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
            {initials}
        </div>
    );
}

// ── Star rating ───────────────────────────────────────────────────────────────
function Stars({ count = 5 }: { count?: number }) {
    return (
        <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={14} fill={i < count ? "#EF4444" : "none"} stroke={i < count ? "#EF4444" : "#D1D5DB"} />
            ))}
        </div>
    );
}

// ── Testimonial card ──────────────────────────────────────────────────────────
function TestimonialCard({ t, index, delay = 0 }: { t: typeof TESTIMONIALS[0]; index: number; delay?: number }) {
    return (
        <div className="h-full">
            <div
                className="h-full flex flex-col rounded-2xl border border-gray-200 shadow-lg p-6 transition-all duration-300 hover:border-red-200 hover:shadow-xl hover:shadow-red-500/5 group"
                style={{ minHeight: "220px" }}
            >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Avatar initials={t.avatar} index={index} />
                        <div>
                            <p className="font-bold text-gray-900 text-sm leading-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                                {t.name}
                            </p>
                            <p className="text-gray-400 text-xs mt-0.5">{t.location}</p>
                        </div>
                    </div>
                    <Quote size={18} className="text-red-200 group-hover:text-red-400 transition-colors flex-shrink-0 mt-1" />
                </div>

                {/* Stars + date */}
                <div className="flex items-center gap-3 mb-4">
                    <Stars count={t.rating} />
                    <span className="text-gray-300 text-xs">·</span>
                    <span className="text-gray-500 text-xs">{t.date}</span>
                </div>

                {/* Quote */}
                <p
                    className="text-gray-600 text-sm leading-relaxed flex-1"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                    "{t.quote}"
                </p>

                {/* Footer */}
                <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-gray-700">
                        <MapPin size={11} className="text-red-400" />
                        {t.destination}
                    </div>
                    <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: "#FEF2F2", color: "#DC2626" }}
                    >
                        {t.trip.split(" ").slice(0, 2).join(" ")}
                    </span>
                </div>
            </div>
        </div>
    );
}

const Reviews = () => {
    const [activeFilter, setActiveFilter] = useState("All");
    const [showAll, setShowAll] = useState(false);

    const filtered = activeFilter === "All"
        ? TESTIMONIALS
        : TESTIMONIALS.filter((t) => t.destination === activeFilter);

    const visible = showAll ? filtered : filtered.slice(0, 6);

    return (
        <div>
            {/* ── FILTER + GRID ─────────────────────────────────────────────────── */}
            <section className="max-w-6xl mx-auto px-6 sm:px-8 py-16">

                {/* Filter bar */}
                <div className="mb-10">
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2 text-gray-400 text-sm font-semibold mr-1">
                            <Filter size={14} />
                            Filter by
                        </div>
                        {DESTINATIONS.map((d) => (
                            <button
                                key={d}
                                type="button"
                                onClick={() => { setActiveFilter(d); setShowAll(false); }}
                                className={`filter-btn ${activeFilter === d ? "active" : ""}`}
                            >
                                {d}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Section heading */}
                <div className="mb-10">
                    <div className="flex items-end justify-between flex-wrap gap-4">
                        <div>
                            <SectionLabel>Traveler Stories</SectionLabel>
                            <SectionHeading
                                text={activeFilter === "All" ? "What our" : `Reviews - `}
                                highlight={activeFilter === "All" ? "travellers say" : `${activeFilter}`}
                                highlightPosition="suffix"
                                variant="light"
                            />
                        </div>
                        <p className="text-gray-400 text-sm font-medium">
                            {filtered.length} review{filtered.length !== 1 ? "s" : ""}
                        </p>
                    </div>
                </div>

                {/* Cards grid */}
                {filtered.length > 0 ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {visible.map((t, i) => (
                                <TestimonialCard key={t.id} t={t} index={i} delay={i * 50} />
                            ))}
                        </div>

                        {/* Show more */}
                        {!showAll && filtered.length > 6 && (
                            <div className="flex justify-center mt-10">
                                <button
                                    type="button"
                                    onClick={() => setShowAll(true)}
                                    className="inline-flex items-center gap-2 border-2 border-gray-200 hover:border-red-400 text-gray-600 hover:text-red-500 font-bold px-8 py-3.5 rounded-xl transition-all text-sm"
                                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                                >
                                    Show all {filtered.length} reviews
                                    <ChevronDown size={16} />
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-16 text-gray-400">
                        <p className="text-lg font-semibold">No reviews yet for this destination.</p>
                        <p className="text-sm mt-1">Check back soon — we're adding new ones every week.</p>
                    </div>
                )}
            </section>
        </div>
    )
}

export default Reviews
