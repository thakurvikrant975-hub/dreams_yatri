"use client";

import { AlertTriangle, FileText, Mail, Phone } from "lucide-react";
import Hero from "../components/Hero";
import { SectionLabel } from "../components/SectionLabel";
import { SectionHeading } from "../components/SectionHeading";
import { Reveal } from "../components/Reveal";
import { Cta } from "../components/Cta";

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "1. Acceptance of Terms",
    body: "By accessing or booking through Dreams Yatri, you agree to be bound by these Terms & Conditions. [Insert full acceptance-of-terms clause — governing scope, who these terms apply to, and effective date.]",
  },
  {
    title: "2. Bookings & Payments",
    body: "[Insert booking process, payment schedule (advance/full payment), accepted payment methods, currency, and confirmation terms.] See also our Cancellation Policy for refund and rescheduling terms.",
  },
  {
    title: "3. Traveller Responsibilities",
    body: "[Insert traveller obligations — valid travel documents, visas, health/vaccination requirements, conduct during the trip, and compliance with local laws.]",
  },
  {
    title: "4. Pricing & Inclusions",
    body: "[Insert what package prices include/exclude, price-change conditions, taxes and surcharges, and currency fluctuation clauses.]",
  },
  {
    title: "5. Liability & Limitation",
    body: "[Insert liability limitations — third-party suppliers (hotels, airlines, transport operators), force majeure, and the extent of Dreams Yatri's responsibility for service disruptions.]",
  },
  {
    title: "6. Intellectual Property",
    body: "[Insert ownership terms for site content, itineraries, photography, and branding, plus permitted use by customers.]",
  },
  {
    title: "7. Governing Law & Jurisdiction",
    body: "[Insert governing law clause and jurisdiction for dispute resolution.]",
  },
  {
    title: "8. Changes to These Terms",
    body: "[Insert how and when these terms may be updated, and how customers will be notified.]",
  },
];

export default function TermsPage() {
  return (
    <div className="bg-white min-h-screen" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;0,800;1,700&display=swap');`}</style>

      <Hero>
        <SectionLabel>Legal</SectionLabel>
        <SectionHeading
          level="h1"
          variant="dark"
          text="Terms &"
          highlight="Conditions"
          highlightPosition="suffix"
        />
        <p className="text-gray-400 leading-relaxed mt-4 max-w-lg" style={{ fontSize: "clamp(0.95rem,1.8vw,1.05rem)" }}>
          The rules and agreements that govern your booking with Dreams Yatri.
        </p>
      </Hero>

      <div className="max-w-4xl mx-auto px-6 sm:px-8 pt-10 pb-4">
        <Reveal>
          <div className="flex items-start gap-4 bg-amber-50 border border-amber-200 rounded-2xl px-6 py-4">
            <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-800 text-sm mb-1">⚠️ Placeholder — replace before launch</p>
              <p className="text-amber-700 text-sm leading-relaxed">
                This page is a structural placeholder, not binding legal text. Every bracketed
                section below must be replaced with content reviewed by qualified legal counsel
                before this page goes live.
              </p>
            </div>
          </div>
        </Reveal>
      </div>

      <section className="py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-6 sm:px-8">
          <Reveal className="mb-8">
            <p className="text-gray-400 text-xs">Last updated: [Insert date]</p>
          </Reveal>

          <div className="flex flex-col gap-8">
            {SECTIONS.map((s, i) => (
              <Reveal key={s.title} delay={i * 40}>
                <div className="border-b border-gray-100 pb-8 last:border-0">
                  <h2 className="font-bold text-gray-900 text-lg mb-2" style={{ fontFamily: "'Playfair Display',serif" }}>
                    {s.title}
                  </h2>
                  <p className="text-gray-600 text-sm leading-relaxed">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={SECTIONS.length * 40}>
            <div className="mt-10 flex items-start gap-4 bg-gray-50 border border-gray-100 rounded-2xl px-6 py-5">
              <FileText size={18} className="text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-gray-900 text-sm mb-1">Questions about these terms?</p>
                <p className="text-gray-500 text-sm leading-relaxed flex flex-wrap gap-x-4 gap-y-1 mt-1">
                  <a href="mailto:support@dreamsyatri.com" className="inline-flex items-center gap-1.5 font-semibold text-gray-700">
                    <Mail size={13} /> support@dreamsyatri.com
                  </a>
                  <a href="tel:+917023907023" className="inline-flex items-center gap-1.5 font-semibold text-gray-700">
                    <Phone size={13} /> +91 70239 07023
                  </a>
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <Cta />
    </div>
  );
}
