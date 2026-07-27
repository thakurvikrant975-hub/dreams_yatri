"use client";

import {
  Home, Car, ShieldCheck, Headset, Heart, Sparkles,
  MessageCircle, MapPin, CalendarCheck, Luggage, Sun, Star,
} from "lucide-react";
import { Accordion } from "@/app/components/ui/Accordian";

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

const JOURNEY_STEPS = [
  { icon: MessageCircle, title: "Share Your Plan", text: "Tell us your dates, budget and travel style — it takes 30 seconds." },
  { icon: Sun, title: "Get a Custom Itinerary", text: "A free personalised plan with the best price, usually within a few hours." },
  { icon: CalendarCheck, title: "Confirm Your Trip", text: "Lock your dates with a small advance. Full clarity, zero hidden costs." },
  { icon: Luggage, title: "We Arrange Everything", text: "Hotels, private cab, tickets and pickups — all booked for you." },
  { icon: MapPin, title: "Travel Carefree", text: "Enjoy your trip while our team stays one WhatsApp message away, 24/7." },
  { icon: Heart, title: "Memories for Life", text: "Head home with stories worth telling — and let's plan the next one." },
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

export function JourneySection() {
  return (
    <section className="py-14 sm:py-20">
      <div className="mx-auto max-w-4xl px-4">
        <SectionHead eyebrow="How It Works" title="Your Journey With Us" />
        <ol className="mt-10 space-y-6">
          {JOURNEY_STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-600 text-white">
                  <s.icon size={18} />
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

export function TestimonialsSection({ testimonials }: { testimonials: { authorName: string; authorRole: string; quote: string; rating: number }[] }) {
  if (testimonials.length === 0) return null;
  return (
    <section className="bg-neutral-50 py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHead eyebrow="Reviews" title="Loved by Real Travellers" />
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t, i) => (
            <figure key={i} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex gap-0.5 text-amber-400">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star key={s} size={14} className={s < t.rating ? "fill-amber-400" : "fill-none text-neutral-300"} />
                ))}
              </div>
              <blockquote className="mt-3 text-sm text-neutral-700">&quot;{t.quote}&quot;</blockquote>
              <figcaption className="mt-3 text-sm font-semibold text-neutral-900">
                {t.authorName}
                {t.authorRole && <span className="block text-xs font-normal text-neutral-500">{t.authorRole}</span>}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FaqSection({ faqs }: { faqs: { question: string; answer: string }[] }) {
  if (faqs.length === 0) return null;
  return (
    <section className="py-14 sm:py-20">
      <div className="mx-auto max-w-3xl px-4">
        <SectionHead eyebrow="FAQ" title="Your Questions, Answered" />
        <div className="mt-8">
          <Accordion variant="bordered">
            {faqs.map((f, i) => (
              <Accordion.Item key={i} id={String(i)}>
                <Accordion.Trigger className="justify-between font-semibold text-neutral-900">
                  <span>{f.question}</span>
                  <Accordion.Chevron />
                </Accordion.Trigger>
                <Accordion.Content>
                  <p className="text-sm text-neutral-600">{f.answer}</p>
                </Accordion.Content>
              </Accordion.Item>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="text-center">
      <span className="text-xs font-bold uppercase tracking-wide text-red-600">{eyebrow}</span>
      <h2 className="mt-1.5 text-2xl font-extrabold text-neutral-900 sm:text-3xl">{title}</h2>
    </div>
  );
}
