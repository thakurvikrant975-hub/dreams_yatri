import React from 'react'
import { MapPin, Quote } from 'lucide-react'
import { SectionHeading } from '../components/SectionHeading'

export const FounderStory = () => {
  return (
    <>
 {/* ── FOUNDER STORY ────────────────────────────────────────────────── */}
            <section id="story" className="py-24 sm:py-32 bg-white">
                <div className="max-w-6xl mx-auto px-6 sm:px-8">

                    <div className="grid lg:grid-cols-2 gap-16 items-start">

                        {/* Left — visual */}
                        <div className="relative">
                            {/* Large quote card */}
                            <div className="relative bg-gray-950 rounded-3xl p-8 sm:p-10 overflow-hidden">
                                <div className="absolute top-0 right-0 w-48 h-48 bg-red-500/10 rounded-full blur-3xl" />
                                <Quote size={40} className="text-red-500 mb-6 opacity-80" />
                                <p className="text-white text-xl sm:text-2xl leading-relaxed font-medium mb-6"
                                    style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic" }}>
                                    "I always loved to travel. The spontaneity, the new faces, the food you can't find anywhere else. But every trip came with a shadow — the anxiety of logistics in an unfamiliar place."
                                </p>
                                <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                                    <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 font-bold text-sm">V</div>
                                    <div>
                                        <p className="text-white font-semibold text-sm">Vikrant Thakur</p>
                                        <p className="text-gray-500 text-xs">Founder, Dreams Yatri</p>
                                    </div>
                                </div>
                            </div>

                            {/* Floating stat pill */}
                            <div className="absolute -bottom-5 -right-4 bg-red-500 text-white rounded-2xl px-5 py-3 shadow-xl shadow-red-500/30">
                                <p className="text-2xl font-extrabold leading-none">10K+</p>
                                <p className="text-xs text-red-100 mt-0.5">Trips Delivered</p>
                            </div>

                            {/* Shimla tag */}
                            <div className="absolute -top-4 -left-3 bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-lg flex items-center gap-2">
                                <MapPin size={13} className="text-red-500" />
                                <span className="text-xs font-semibold text-gray-700">Shimla, Himachal Pradesh</span>
                            </div>
                        </div>

                        {/* Right — text narrative */}
                        <div className="flex flex-col gap-8">
                            <div>
                                <p className="text-xs font-bold tracking-widest uppercase text-red-500 mb-4">The Origin Story</p>
                                <SectionHeading
                                    text="One night in Manali."
                                    highlight="Midnight. 3% battery."
                                    highlightPosition="suffix"
                                    variant="light"
                                />
                            </div>

                            <div>
                                <div className="relative border-l-2 border-red-100 pl-6">
                                    <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-red-500" />
                                    <p className="text-gray-600 text-base leading-relaxed">
                                        Vikrant Thakur landed in Manali at midnight. Hotel unconfirmed. Cab not responding. Phone on 3%. Standing in the cold, surrounded by strangers — he asked himself why something he loved felt like punishment.
                                    </p>
                                </div>
                            </div>

                            <div>
                                <div className="relative border-l-2 border-red-100 pl-6">
                                    <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-red-100" />
                                    <p className="text-gray-600 text-base leading-relaxed">
                                        Dreams Yatri was born not from a business plan, but from a personal promise: <em className="text-gray-800 not-italic font-semibold">nobody who books with us will ever stand in the cold wondering what to do next.</em>
                                    </p>
                                </div>
                            </div>

                            <div>
                                <div className="bg-red-50 border border-red-100 rounded-2xl p-6 mt-2">
                                    <p className="text-gray-700 text-sm leading-relaxed">
                                        <span className="font-bold text-gray-900">Based in Shimla, Himachal Pradesh</span> — we understand the mountains, the roads, and the people better than anyone. That local depth is our unfair advantage.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
    </>
  )
}

export default FounderStory
