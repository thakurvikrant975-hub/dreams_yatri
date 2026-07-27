"use client";

import { AlertTriangle, ShieldCheck, Mail, Phone } from "lucide-react";
import Hero from "../components/Hero";
import { SectionLabel } from "../components/SectionLabel";
import { SectionHeading } from "../components/SectionHeading";
import { Reveal } from "../components/Reveal";
import { Cta } from "../components/Cta";

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "1. Information We Collect",
    body: "[Insert what personal data is collected — name, contact details, payment information, travel documents, and data collected automatically via cookies/analytics.]",
  },
  {
    title: "2. How We Use Your Information",
    body: "[Insert purposes of use — processing bookings, communicating trip details, customer support, marketing (with opt-out), and legal/compliance obligations.]",
  },
  {
    title: "3. Sharing With Third Parties",
    body: "[Insert which third parties data is shared with — hotels, airlines, transport operators, payment gateways — and under what conditions.]",
  },
  {
    title: "4. Data Storage & Security",
    body: "[Insert how data is stored, retention periods, and the security measures in place to protect customer data.]",
  },
  {
    title: "5. Cookies & Tracking",
    body: "[Insert cookie usage — analytics, session management, advertising — and how users can control cookie preferences.]",
  },
  {
    title: "6. Your Rights",
    body: "[Insert user rights — access, correction, deletion of personal data, and how to exercise them.]",
  },
  {
    title: "7. Children's Privacy",
    body: "[Insert policy on data collection from minors, if applicable.]",
  },
  {
    title: "8. Changes to This Policy",
    body: "[Insert how and when this policy may be updated, and how customers will be notified.]",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-white min-h-screen" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;0,800;1,700&display=swap');`}</style>

      <Hero>
        <SectionLabel>Legal</SectionLabel>
        <SectionHeading
          level="h1"
          variant="dark"
          text="Privacy"
          highlight="Policy"
          highlightPosition="suffix"
        />
        <p className="text-gray-400 leading-relaxed mt-4 max-w-lg" style={{ fontSize: "clamp(0.95rem,1.8vw,1.05rem)" }}>
          How Dreams Yatri collects, uses, and protects your personal information.
        </p>
      </Hero>

      <div className="max-w-4xl mx-auto px-6 sm:px-8 pt-10 pb-4">
        <Reveal>
          <div className="flex items-start gap-4 bg-amber-50 border border-amber-200 rounded-2xl px-6 py-4">
            <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-800 text-sm mb-1">⚠️ Placeholder — replace before launch</p>
              <p className="text-amber-700 text-sm leading-relaxed">
                This page is a structural placeholder, not a binding privacy policy. Every
                bracketed section below must be replaced with content reviewed by qualified
                legal counsel before this page goes live.
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
              <ShieldCheck size={18} className="text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-gray-900 text-sm mb-1">Questions about your data?</p>
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
