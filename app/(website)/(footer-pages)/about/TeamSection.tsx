import { Clock } from "lucide-react";
import { team } from "./data";
import { SectionHeading } from "../components/SectionHeading";
import Image from "next/image";


export function TeamSection() {
    return (
        <section className="py-20 px-6 bg-[#fafaf8]">
            <div className="max-w-6xl mx-auto">
                <div>
                    <p className="text-[11px] font-medium tracking-[0.18em] uppercase text-red-600 mb-5">
                        Our People
                    </p>
                    <SectionHeading
                        text="Travelers Who Plan"
                        highlight="Your Journey"
                        highlightPosition="suffix"
                        variant="light"
                    />
                    <p className="text-gray-500 text-[15px] font-light leading-relaxed max-w-md mb-14">
                        Our team has collectively explored 80+ countries and thousands of
                        Indian routes. We don't just plan travel — we've lived it.
                    </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                    {team.map(
                        ({ name, role, photo, experience, statVal, statKey, tag, quote }, i) => (
                            <div key={i}>
                                <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group shadow-lg">
                                    {/* Photo */}
                                    <div className="relative h-52 overflow-hidden bg-stone-100">
                                        <Image
                                            src={photo}
                                            width={222}
                                            height={222}
                                            alt={name}
                                            className="w-full h-full object-cover object-top"
                                        />
                                        {/* Gradient overlay */}
                                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/30" />
                                        {/* Experience badge */}
                                        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1 text-red-600">
                                            <Clock size={10} />
                                            <span className="text-[11px] font-medium">{experience}</span>
                                        </div>
                                    </div>

                                    {/* Body */}
                                    <div className="p-4 pb-5">
                                        <p className="text-[17px] font-bold text-gray-900 mb-0.5">
                                            {name}
                                        </p>
                                        <p className="text-[12px] text-gray-500 mb-3">{role}</p>

                                        <div className="h-px bg-gray-100 mb-3" />

                                        {/* Stats row */}
                                        <div className="flex justify-between items-end gap-4">
                                            <div>
                                                <p className="text-[15px] font-medium text-gray-900">{statVal}</p>
                                                <p className="text-[10px] uppercase tracking-wider text-gray-500 mt-0.5">
                                                    {statKey}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[15px] font-medium text-gray-900">{tag}</p>
                                                <p className="text-[10px] uppercase tracking-wider text-gray-500 mt-0.5">
                                                    Specialty
                                                </p>
                                            </div>
                                        </div>

                                        {/* Quote */}
                                        <p className="text-[12px] text-gray-500 italic leading-relaxed mt-3 pt-3 border-t border-gray-100">
                                            "{quote}"
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )
                    )}
                </div>
            </div>
        </section>
    );
}