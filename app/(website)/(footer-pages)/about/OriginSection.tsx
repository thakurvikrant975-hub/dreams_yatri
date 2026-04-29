"use client";

import { Sparkles, CheckCircle } from "lucide-react";
import Image from "next/image";
import { SectionLabel } from "../components/SectionLabel";
import { SectionHeading } from "../components/SectionHeading";
import {painScenes } from "./data";


export function OriginSection() {
    return (
        <section className="py-24 px-6 bg-white">
            <div className="max-w-6xl mx-auto">

                {/* Header */}
                <SectionLabel>The Origin Story</SectionLabel>
                <SectionHeading
                    text="Why DreamsYatri"
                    highlight="exists"
                    highlightPosition="suffix"
                    variant="light"
                />
                <p className="text-sm text-gray-500 leading-relaxed max-w-lg mb-10">
                    Not a startup idea from a boardroom — a personal breaking point at midnight in the
                    mountains that became a mission to fix travel forever.
                </p>

                <div className="grid lg:grid-cols-2 gap-5 items-start">

                    {/* ── Left Column ─────────────────────────────────────── */}
                    <div className="flex flex-col gap-4">

                        {/* Dark Quote Card */}
                        <div className="bg-[#1C1917] rounded-2xl p-8 relative overflow-hidden">
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#D85A30] rounded-full opacity-[.12]" />
                            <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-[#EF9F27] rounded-full opacity-[.08]" />
                            <p className="font-playfair text-7xl leading-none text-[#D85A30] opacity-40 mb-1">"</p>
                            <p className="text-sm text-gray-300 leading-[1.9] italic relative z-10">
                                I've always loved to travel — the spontaneity, the new faces, food you
                                can't find anywhere else. But every trip came with a shadow: the anxiety
                                of managing logistics in an unfamiliar place.
                                <br /><br />
                                One night in Manali, I landed at midnight. Hotel unconfirmed. Cab not
                                responding. Phone at 3%. Standing in the cold, surrounded by strangers —{" "}
                                <strong className="not-italic font-semibold text-white">
                                    I asked myself why something I love feels like punishment.
                                </strong>
                            </p>
                            <div className="mt-6 pt-5 border-t border-white/10 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D85A30] to-[#EF9F27] flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                                    VT
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-white">Vikrant Thakur</p>
                                    <p className="text-xs text-gray-400 mt-0.5">Founder, Dreams Yatri</p>
                                </div>
                            </div>
                        </div>

                        {/* Mission Strip */}
                        <div className="bg-[#1C1917] rounded-2xl p-6 flex items-start gap-4">
                            <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center flex-shrink-0">
                                <Sparkles size={18} className="text-white" />
                            </div>
                            <div>
                                <p className="text-white font-semibold text-base mb-1.5">So he built the solution.</p>
                                <p className="text-white/80 text-xs leading-relaxed">
                                    Dreams Yatri was born to remove every ounce of friction from travel — so
                                    every person, wherever they go, can focus entirely on the experience and
                                    never the logistics.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* ── Right Column — Image Collage ─────────────────────── */}
                    <div className="flex flex-col gap-3">
                        <p className="text-[10px] font-semibold tracking-[.12em] uppercase text-gray-500 mb-1">
                            Problems we are solving
                        </p>

                        <PainScene {...painScenes[0]} priority />

                        <div className="grid grid-cols-2 gap-3">
                            <PainScene {...painScenes[1]} compact />
                            <PainScene {...painScenes[2]} compact />
                        </div>

                        <PainScene {...painScenes[3]} />
                    </div>
                </div>
            </div>
        </section>
    );
}

/* ── Sub-component ───────────────────────────────────────── */
function PainScene({
    height,
    num,
    title,
    fix,
    image,
    compact = false,
    priority = false,
}: {
    height: string;
    num: string;
    title: string;
    fix: string;
    image: string;
    size: "full" | "half";   // used by parent data only, not rendered
    compact?: boolean;
    priority?: boolean;
}) {
    return (
        <div className={`relative rounded-2xl overflow-hidden ${height}`}>
            <Image
                src={image}
                alt={title}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority={priority}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
            <div className={`absolute inset-0 flex flex-col justify-end z-10 ${compact ? "p-3" : "p-5"}`}>
                <p className="text-[9px] font-semibold tracking-widest uppercase text-white mb-1">
                    Problem {num}
                </p>
                <p className={`font-semibold text-white leading-snug mb-2 ${compact ? "text-xs" : "text-sm"}`}>
                    {title}
                </p>
                <div className="flex items-center gap-1.5">
                    <CheckCircle size={10} className="text-green-400 flex-shrink-0" />
                    <span className="text-[10px] text-white/70">{fix}</span>
                </div>
            </div>
        </div>
    );
}