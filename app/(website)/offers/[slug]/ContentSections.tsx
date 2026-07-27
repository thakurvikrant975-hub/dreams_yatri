"use client";

import {
  Home, Car, ShieldCheck, Headset, Heart, Sparkles, Star, Plus,
} from "lucide-react";
import { Accordion, useAccordionItem } from "@/app/components/ui/Accordian";

// Simplified, fixed "why choose us" grid — same content as the custom SVG
// hub diagram in the reference design, laid out as clean cards instead of
// bespoke connector-line artwork (kept intentionally generic/non-editable).
const BENEFITS = [
  { icon: Home, title: "Handpicked Stays", items: ["Personally inspected stays", "Beachfront & sea views", "Trusted quality checks"] },
  { icon: Car, title: "Transfers Included", items: ["Airport/jetty pickups", "AC cab with local driver", "Inter-transfers arranged"] },
  { icon: ShieldCheck, title: "Best Price Guarantee", items: ["Price-match promise", "Zero hidden charges", "Clear, transparent quotes"] },
  { icon: Headset, title: "24/7 On-Trip Support", items: ["Real human on WhatsApp", "Help within minutes", "Support anywhere on the trip"] },
  { icon: Heart, title: "Couples & Families", items: ["Honeymoon décor & dinners", "Relaxed, easy-paced days", "Kid-friendly options"] },
  { icon: Sparkles, title: "100% Customisable", items: ["Add activities anytime", "Any budget & duration", "Fully flexible itinerary"] },
];

// Milestone layout for the SVG road below — top%/side must stay in sync with
// the <g transform="translate(x y)"> coordinates on the matching milestone
// circle a few hundred lines down (x=620 -> "right", x=180 -> "left"; top% is
// the milestone's own y ÷ 1200, the viewBox height).
const JOURNEY_STEPS = [
  { title: "Share Your Plan", text: "Tell us your dates, budget and travel style — it takes 30 seconds.", top: 8.75, side: "right" as const },
  { title: "Get a Custom Itinerary", text: "A free personalised plan with the best price, usually within a few hours.", top: 23.75, side: "left" as const },
  { title: "Confirm Your Trip", text: "Lock your dates with a small advance. Full clarity, zero hidden costs.", top: 38.75, side: "right" as const },
  { title: "We Arrange Everything", text: "Hotels, private cab, tickets and pickups — all booked for you.", top: 53.75, side: "left" as const },
  { title: "Travel Carefree", text: "Enjoy your trip while our team stays one WhatsApp message away, 24/7.", top: 68.75, side: "right" as const },
  { title: "Memories for Life", text: "Head home with stories worth telling — and let's plan the next one.", top: 83.75, side: "left" as const },
];

export function BenefitsSection() {
  return (
    <section className="bg-neutral-50 py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHead eyebrow="Why Choose Us" title="Your Trip, Fully Taken Care Of" />
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b) => (
            <div key={b.title} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex size-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <b.icon size={20} />
              </div>
              <h3 className="mt-3 text-base font-bold text-neutral-900">{b.title}</h3>
              <ul className="mt-2 space-y-1">
                {b.items.map((it) => (
                  <li key={it} className="text-sm text-neutral-600">{it}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Ported verbatim from the reference's winding-road SVG (viewBox 0 0 800
// 1200) — kept as one literal artwork rather than 6 generated milestones,
// since the road's own curve geometry (the <path> "d") only makes sense as
// a whole. Percentage-based (not px) positioning for the step text blocks
// below and the aspect-[2/3] wrapper keep it in sync with the SVG at any
// width, since the reference's own fixed-px version only ever rendered at
// one desktop size. Hidden below md: — decorative, and the road's fine
// curve detail doesn't hold up shrunk to a phone width; the plain numbered
// list right below is the mobile version instead.
export function JourneySection({ destination }: { destination?: string | null }) {
  return (
    <section className="py-14 sm:py-20">
      <div className="mx-auto max-w-5xl px-4">
        <SectionHead
          eyebrow="How It Works"
          title="Your Journey With DreamsYatri"
          subtitle={`From first hello to holiday memories${destination ? ` in ${destination}` : ""} — six simple steps, and we drive every one of them.`}
        />

        {/* Desktop: road + positioned steps */}
        <div className="relative mx-auto mt-14 hidden aspect-2/3 max-w-200 md:block">
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 800 1200" aria-hidden="true" focusable="false">
            <defs>
              <filter id="rmRoadShadow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#0f172a" floodOpacity="0.14" />
              </filter>
              <filter id="rmDotShadow" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="5" stdDeviation="6" floodColor="#0f172a" floodOpacity="0.22" />
              </filter>
            </defs>

            <path
              d="M -20 60 L 440 60 C 680 60, 680 240, 440 240 L 360 240 C 120 240, 120 420, 360 420 L 440 420 C 680 420, 680 600, 440 600 L 360 600 C 120 600, 120 780, 360 780 L 440 780 C 680 780, 680 960, 440 960 L 360 960 C 120 960, 120 1140, 360 1140 L 820 1140"
              fill="none" stroke="#262b33" strokeWidth="44" strokeLinecap="round" filter="url(#rmRoadShadow)"
            />
            <path
              d="M -20 60 L 440 60 C 680 60, 680 240, 440 240 L 360 240 C 120 240, 120 420, 360 420 L 440 420 C 680 420, 680 600, 440 600 L 360 600 C 120 600, 120 780, 360 780 L 440 780 C 680 780, 680 960, 440 960 L 360 960 C 120 960, 120 1140, 360 1140 L 820 1140"
              fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="16 22"
            />

            <text x="24" y="26" fontSize="24" fontWeight="800" letterSpacing="2" fill="#0f172a">READY TO EXPLORE</text>
            <g>
              <line x1="758" y1="1116" x2="758" y2="1028" stroke="#262b33" strokeWidth="5" strokeLinecap="round" />
              <path d="M758 1028 h40 l-11 13 11 13 h-40 z" fill="#ec1f28" />
            </g>
            <text x="790" y="1196" textAnchor="end" fontSize="24" fontWeight="800" letterSpacing="2" fill="#0f172a">SEE YOU AGAIN</text>

            {/* Milestones — white ring + brand-red disc + white icon */}
            <g filter="url(#rmDotShadow)"><circle cx="620" cy="150" r="50" fill="#fff" /><circle cx="620" cy="150" r="43" fill="#ec1f28" /></g>
            <g transform="translate(620 150) scale(1.7) translate(-12 -12)" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </g>

            <g filter="url(#rmDotShadow)"><circle cx="180" cy="330" r="50" fill="#fff" /><circle cx="180" cy="330" r="43" fill="#ec1f28" /></g>
            <g transform="translate(180 330) scale(1.7) translate(-12 -12)" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14" /><path d="M15 6v14" />
            </g>

            <g filter="url(#rmDotShadow)"><circle cx="620" cy="510" r="50" fill="#fff" /><circle cx="620" cy="510" r="43" fill="#ec1f28" /></g>
            <g transform="translate(620 510) scale(1.7) translate(-12 -12)" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2 3 7v6c0 5 3.5 8 9 9 5.5-1 9-4 9-9V7z" /><path d="M9 12l2 2 4-4" />
            </g>

            <g filter="url(#rmDotShadow)"><circle cx="180" cy="690" r="50" fill="#fff" /><circle cx="180" cy="690" r="43" fill="#ec1f28" /></g>
            <g transform="translate(180 690) scale(1.7) translate(-12 -12)" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="M9 15.5l2 2 4-4" />
            </g>

            <g filter="url(#rmDotShadow)"><circle cx="620" cy="870" r="50" fill="#fff" /><circle cx="620" cy="870" r="43" fill="#ec1f28" /></g>
            <g transform="translate(620 870) scale(1.7) translate(-12 -12)" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
            </g>

            <g filter="url(#rmDotShadow)"><circle cx="180" cy="1050" r="50" fill="#fff" /><circle cx="180" cy="1050" r="43" fill="#ec1f28" /></g>
            <g transform="translate(180 1050) scale(1.7) translate(-12 -12)" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21s-6-4.35-9-8.5C1 9 3 5 7 5c2 0 3 1 5 3 2-2 3-3 5-3 4 0 6 4 4 7.5C18 16.65 12 21 12 21z" />
            </g>
          </svg>

          {JOURNEY_STEPS.map((s) => (
            <div
              key={s.title}
              className={`absolute w-[40%] ${s.side === "right" ? "right-[35%] text-right" : "left-[35%] text-left"}`}
              style={{ top: `${s.top}%` }}
            >
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-neutral-900">{s.title}</h3>
              <p className="mt-1 text-sm text-neutral-600">{s.text}</p>
            </div>
          ))}
        </div>

        {/* Mobile: numbered vertical timeline */}
        <ol className="mt-10 space-y-6 md:hidden">
          {JOURNEY_STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-600 text-sm font-bold text-white">
                  {i + 1}
                </div>
                {i < JOURNEY_STEPS.length - 1 && <div className="mt-1 w-px flex-1 bg-neutral-200" />}
              </div>
              <div className="pb-6">
                <h3 className="font-bold text-neutral-900">{s.title}</h3>
                <p className="mt-0.5 text-sm text-neutral-600">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// "Priya & Sameer" -> "PS" — matches the reference's avatar initials exactly
// (first letter of the first name, first letter of the last name/token).
function initials(name: string): string {
  const parts = name.split(/[^a-zA-Z]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function TestimonialsSection({
  testimonials, destination,
}: {
  testimonials: { authorName: string; authorRole: string; quote: string; rating: number }[];
  destination?: string | null;
}) {
  if (testimonials.length === 0) return null;
  return (
    <section className="py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHead
          eyebrow="Reviews"
          title="Loved by 2,300+ Travellers"
          subtitle={`Real experiences from travellers who explored ${destination || "with us"}.`}
        />
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t, i) => (
            <figure key={i} className="rounded-2xl border border-neutral-200 bg-white p-7 shadow-sm">
              <div className="flex gap-0.5 text-amber-400">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star key={s} size={16} className={s < t.rating ? "fill-amber-400" : "fill-none text-neutral-300"} />
                ))}
              </div>
              <blockquote className="mt-4 text-[15px] leading-relaxed text-neutral-800">&quot;{t.quote}&quot;</blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-red-100 text-sm font-bold text-red-600">
                  {initials(t.authorName)}
                </span>
                <span>
                  <span className="block text-sm font-bold text-neutral-900">{t.authorName}</span>
                  {t.authorRole && <span className="block text-sm text-neutral-500">{t.authorRole}</span>}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

// The "+" rotates to an "x" on open — matches the reference's .faq__q svg
// (rotate(45deg) on .faq__item.is-open) instead of the default chevron-flip.
function FaqToggleIcon() {
  const { isOpen } = useAccordionItem();
  return (
    <Plus
      size={20}
      className={`shrink-0 text-red-600 transition-transform duration-300 ${isOpen ? "rotate-45" : ""}`}
    />
  );
}

export function FaqSection({ faqs }: { faqs: { question: string; answer: string }[] }) {
  if (faqs.length === 0) return null;
  return (
    <section className="bg-neutral-50 py-14 sm:py-20">
      <div className="mx-auto max-w-3xl px-4">
        <SectionHead eyebrow="FAQ" title="Your Questions, Answered" />
        <div className="mt-10">
          <Accordion variant="ghost" className="gap-0">
            {faqs.map((f, i) => (
              <Accordion.Item key={i} id={String(i)} className="border-b border-neutral-200 bg-transparent last:border-b-0">
                <Accordion.Trigger className="justify-between gap-4 rounded-none px-0 py-5 text-left text-base font-bold text-neutral-900 hover:bg-transparent">
                  <span>{f.question}</span>
                  <FaqToggleIcon />
                </Accordion.Trigger>
                <Accordion.Content className="px-0 pb-5 pt-0">
                  <p className="text-sm leading-relaxed text-neutral-600">{f.answer}</p>
                </Accordion.Content>
              </Accordion.Item>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}

function SectionHead({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="text-center">
      <span className="text-xs font-bold uppercase tracking-wide text-red-600">{eyebrow}</span>
      <h2 className="mt-1.5 text-2xl font-extrabold text-neutral-900 sm:text-3xl">{title}</h2>
      {subtitle && <p className="mx-auto mt-2 max-w-lg text-sm text-neutral-500">{subtitle}</p>}
    </div>
  );
}
