"use client";

import { Reveal } from "../components/Reveal";
import { PERKS } from "./data";

export default function Perks() {
  return (
    <section className="py-16 border-t border-gray-100">
      <Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PERKS.map(({ icon: Icon, title, desc }, i) => (
            <div
              key={i}
              className="group relative bg-white border border-gray-100 rounded-2xl p-6
                         hover:border-red-200 hover:shadow-md hover:-translate-y-0.5
                         transition-all duration-300"
            >
              {/* Accent top line */}
              <div className="absolute top-0 left-6 right-6 h-[2px] bg-red-500 rounded-full
                              scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />

              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-4
                              group-hover:bg-red-500 transition-colors duration-300">
                <Icon size={18} className="text-red-500 group-hover:text-white transition-colors duration-300" />
              </div>

              <h4
                className="text-gray-900 font-bold text-[15px] mb-2"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {title}
              </h4>
              <p
                className="text-gray-400 text-[13px] leading-relaxed"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {desc}
              </p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}