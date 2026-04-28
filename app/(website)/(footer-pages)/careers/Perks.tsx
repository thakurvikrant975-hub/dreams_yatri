import React from 'react'
import { Globe, TrendingUp, Users, Heart } from 'lucide-react'
import { Reveal } from '../components/Reveal'
import { SectionLabel } from '../components/SectionLabel'
import { SectionHeading } from '../components/SectionHeading'
import Image from 'next/image'
// ─── Types ────────────────────────────────────────────────────────────────────
interface Perk {
  icon: React.ElementType
  title: string
  desc: string
  image: string
  tag: string
}

// ─── Data (extended from PERKS with image + tag) ──────────────────────────────
const PERKS: Perk[] = [
  {
    icon: Globe,
    title: 'FAM Trips',
    desc: 'Explore destinations firsthand on company-sponsored familiarisation tours.',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80&fit=crop',
    tag: 'Explore the World',
  },
  {
    icon: TrendingUp,
    title: 'Fast Growth',
    desc: 'Early-stage company — your impact is visible, and promotions are merit-based.',
    image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&q=80&fit=crop',
    tag: 'Career First',
  },
  {
    icon: Users,
    title: 'Collaborative Team',
    desc: 'Small, focused team where every person\'s work directly shapes company outcomes.',
    image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&q=80&fit=crop',
    tag: 'Better Together',
  },
  {
    icon: Heart,
    title: 'Travel Perks',
    desc: 'Exclusive discounts on personal travel bookings for you and your family.',
    image: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80&fit=crop',
    tag: 'For You & Family',
  },
]

// ─── Component ────────────────────────────────────────────────────────────────
export const Perks = () => {
  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto">

        {/* ── Header ── */}
        <Reveal className="text-center mb-16">
          <SectionLabel>Life at DreamsYatri</SectionLabel>
          <SectionHeading
            text="Why Work "
            highlight="With Us"
            highlightPosition="suffix"
            variant="light"
          />
          <p
            className="text-gray-500 text-sm mt-4 max-w-lg mx-auto leading-relaxed"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            We're building more than a company — a place where passionate people
            take ownership, grow fast, and shape meaningful travel experiences.
          </p>
        </Reveal>

        {/* ── Cards Grid ── */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 w-full">
          {PERKS.map(({ icon: Icon, title, desc, image, tag }, i) => (
            <Reveal key={i} delay={i * 80}>
              <div
                className="
                  group relative rounded-2xl overflow-hidden bg-white
                  border border-gray-100 shadow-sm
                  hover:shadow-xl hover:-translate-y-1.5
                  transition-all duration-400 ease-out
                  flex flex-col h-full
                "
              >

                {/* ── Image ── */}
                <div className="relative h-48 overflow-hidden shrink-0">
                  <Image
                    src={image}
                    alt={title}
                    width={222}
                    height={222}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                  {/* Bottom fade */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

                  {/* Tag chip */}
                  <span
                    className="absolute bottom-3 left-3 text-[10px] font-semibold tracking-widest uppercase text-white/90 bg-black/30 backdrop-blur-sm px-2.5 py-1 rounded-full"
                    style={{ fontFamily: "'DM Mono', monospace" }}
                  >
                    {tag}
                  </span>
                </div>

                {/* ── Body ── */}
                <div className="flex flex-col gap-3 p-3 py-6 flex-1">

                  {/* Icon + Title */}
                  <div className="flex items-center gap-3">
                    <div
                      className="
                        w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center
                        text-red-500 shrink-0
                        group-hover:bg-red-500 group-hover:text-white
                        transition-all duration-300
                      "
                    >
                      <Icon size={17} strokeWidth={1.8} />
                    </div>
                    <h3
                      className="text-[14px] font-semibold text-gray-900 leading-tight"
                      style={{ fontFamily: "'DM Sans', sans-serif" }}
                    >
                      {title}
                    </h3>
                  </div>

                  {/* Divider */}
                  <div className="w-full h-px bg-gray-100" />

                  {/* Description */}
                  <p
                    className="text-[13px] text-gray-500 leading-relaxed"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    {desc}
                  </p>

                </div>

                {/* Left accent bar on hover */}
                <div
                  className="
                    absolute left-0 top-0 bottom-0 w-[3px] bg-red-500
                    scale-y-0 group-hover:scale-y-100
                    origin-bottom transition-transform duration-400
                    rounded-l-2xl
                  "
                />

              </div>
            </Reveal>
          ))}
        </div>

      </div>
    </section>
  )
}

export default Perks