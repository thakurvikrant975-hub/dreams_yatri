"use client";

import { useRef, useState, useEffect } from "react";
import {
  AlertTriangle, CheckCircle, Clock, Phone, Mail,
  MessageCircle, Shield, FileText, ArrowRight,
  ChevronDown, Info, RefreshCw, XCircle, Calendar,
  Percent, HelpCircle, Plane,
} from "lucide-react";

// ── Reveal ────────────────────────────────────────────────────────────────────
function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setV(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el); return () => obs.disconnect();
  }, [threshold]);
  return { ref, v };
}

function Reveal({
  children, delay = 0, className = "", dir = "up",
}: {
  children: React.ReactNode; delay?: number; className?: string;
  dir?: "up" | "left" | "right";
}) {
  const { ref, v } = useInView();
  const t = { up: "translateY(22px)", left: "translateX(-22px)", right: "translateX(22px)" };
  return (
    <div ref={ref} className={className}
      style={{ opacity: v ? 1 : 0, transform: v ? "none" : t[dir], transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms` }}>
      {children}
    </div>
  );
}

// ── Policy slab data ──────────────────────────────────────────────────────────
const SLABS = [
  {
    id: 1,
    range: "30+ Days",
    label: "More than 30 days before travel",
    charge: 20,
    refund: 80,
    risk: "low",
    color: "#22C55E",
    bg: "#F0FDF4",
    border: "#BBF7D0",
    icon: <CheckCircle size={22} />,
    advice: "Plenty of time. Cancel now and recover most of your money. We'll process your refund within 7–10 business days.",
  },
  {
    id: 2,
    range: "16–30 Days",
    label: "16 to 30 days before travel",
    charge: 35,
    refund: 65,
    risk: "moderate",
    color: "#F59E0B",
    bg: "#FFFBEB",
    border: "#FDE68A",
    icon: <Clock size={22} />,
    advice: "You still recover a majority. Consider rescheduling instead — date changes in this window are usually penalty-free.",
  },
  {
    id: 3,
    range: "10–15 Days",
    label: "10 to 15 days before travel",
    charge: 50,
    refund: 50,
    risk: "high",
    color: "#F97316",
    bg: "#FFF7ED",
    border: "#FED7AA",
    icon: <AlertTriangle size={22} />,
    advice: "Half your amount is at risk. We strongly recommend rescheduling. Contact us — we'll find the best solution for you.",
  },
  {
    id: 4,
    range: "5–7 Days",
    label: "5 to 7 days before travel",
    charge: 100,
    refund: 0,
    risk: "critical",
    color: "#EF4444",
    bg: "#FEF2F2",
    border: "#FECACA",
    icon: <XCircle size={22} />,
    advice: "Full amount is non-refundable at this stage. Hotels, vehicles, and guides are already confirmed. If possible, please reschedule instead of cancelling.",
  },
];

// ── Accordion ─────────────────────────────────────────────────────────────────
function Accordion({ q, a, delay }: { q: string; a: string; delay?: number }) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(0);
  useEffect(() => { if (contentRef.current) setH(open ? contentRef.current.scrollHeight : 0); }, [open]);

  return (
    <Reveal delay={delay}>
      <div className={`border rounded-xl overflow-hidden transition-all duration-200 ${open ? "border-red-200 shadow-sm" : "border-gray-100 hover:border-gray-200"}`}>
        <button type="button" onClick={() => setOpen(!open)}
          className="w-full flex items-start justify-between gap-4 px-5 py-4 text-left bg-white hover:bg-gray-50/60 transition-colors">
          <span className="font-semibold text-gray-900 text-sm leading-relaxed">{q}</span>
          <span className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 mt-0.5 ${open ? "bg-red-500 text-white" : "bg-gray-100 text-gray-500"}`}
            style={{ transform: open ? "rotate(180deg)" : "none" }}>
            <ChevronDown size={14} />
          </span>
        </button>
        <div style={{ height: h, overflow: "hidden", transition: "height 0.3s ease" }}>
          <div ref={contentRef}>
            <div className="px-5 pb-5 pt-1 border-t border-gray-50">
              <p className="text-gray-600 text-sm leading-relaxed">{a}</p>
            </div>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CancellationPolicyPage() {

  const FAQS = [
    { q: "How do I cancel my booking?", a: "Contact us in writing via email at support@dreamsyatri.com or WhatsApp us at +91 70239 07023. Cancellations must be confirmed in writing — verbal requests over the phone are not processed. Include your booking reference number and travel dates in your request." },
    { q: "When does the cancellation clock start?", a: "The cancellation timeline is calculated from the date we receive your written cancellation request — not from the date of your original booking. The number of days remaining is counted from the day of request to your scheduled departure date." },
    { q: "What if I want to reschedule instead of cancel?", a: "Rescheduling is almost always a better option than cancelling. If you reschedule more than 15 days before travel, there is typically no rescheduling fee subject to supplier availability. Rescheduling within 15 days may incur a fee. Speak to our team — we'll work with you to find the best outcome." },
    { q: "Is the cancellation charge applied to the full package cost?", a: "Yes. The cancellation percentage is applied to the total confirmed package value including accommodation, transfers, meals, and activities as per your booking confirmation. Add-on items booked separately may have their own supplier cancellation terms." },
    { q: "How long does a refund take?", a: "Refunds are processed within 7–10 business days after your cancellation is confirmed in writing. The amount is returned to the original payment method. Bank transfer refunds may take an additional 2–3 business days to reflect in your account." },
    { q: "What if my trip is cancelled due to bad weather or natural disaster?", a: "Force majeure events — natural disasters, severe weather, government travel advisories, or political unrest — are handled on a case-by-case basis. We prioritise rescheduling at no extra charge. Where cancellation is unavoidable, we refund the full amount minus actual non-recoverable costs already paid to hotels and vendors." },
    { q: "I have travel insurance. Does that change the cancellation charge?", a: "Travel insurance is a separate contract between you and the insurer. Our cancellation policy applies regardless of whether you have insurance. If your insurer covers the cancellation charge, you may be able to claim from them — but our policy remains unchanged." },
    { q: "Can I cancel individual components of my package?", a: "Partial cancellations are handled based on the supplier's individual cancellation terms. Some hotels and activity providers have stricter policies than ours. Our team will advise you of the exact charges applicable to each component before confirming any partial cancellation." },
    { q: "What happens if Dreams Yatri cancels my trip?", a: "In the rare event that we need to cancel your trip — due to insufficient group size, supplier failure, or operational reasons — you will receive a full refund with no deductions, or a free reschedule to your preferred dates, whichever you prefer." },
    { q: "Is there a cancellation fee for 0–4 days before travel?", a: "For cancellations within 0–4 days before travel, the same 100% cancellation charge applies as the 5–7 day window. By this point, all vendor payments have already been made and are non-recoverable." },
  ];

  return (
    <div className="bg-white min-h-screen" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;0,800;1,700&display=swap');
        @keyframes hero-rise { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:none; } }
        @keyframes float-card {
          0%,100% { transform:translateY(0) rotate(-1.5deg); }
          50%      { transform:translateY(-10px) rotate(-1.5deg); }
        }
        @keyframes fill-bar { from { width:0; } to { width:var(--w); } }
        .policy-bar { animation: fill-bar 1s ease 0.4s both; }
      `}</style>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative bg-gray-950 overflow-hidden" style={{ paddingTop: "88px", paddingBottom: "80px" }}>
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "48px 48px" }} />
        <div className="absolute -top-32 -right-32 w-[450px] h-[450px] rounded-full pointer-events-none"
          style={{ background: "rgba(239,68,68,0.09)", filter: "blur(90px)" }} />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: "rgba(239,68,68,0.05)", filter: "blur(70px)" }} />

        {/* Decorative % watermark */}
        <div className="absolute right-4 sm:right-16 top-1/2 -translate-y-1/2 pointer-events-none select-none" aria-hidden="true">
          <span style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(140px,20vw,260px)", fontWeight: 800, fontStyle: "italic", color: "rgba(255,255,255,0.022)", lineHeight: 1 }}>%</span>
        </div>

        <div className="max-w-6xl mx-auto px-6 sm:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* Left copy */}
            <div>
              <div className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full border text-xs font-bold tracking-widest uppercase"
                style={{ background: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.28)", color: "#FCA5A5", animation: "hero-rise 0.5s ease both" }}>
                <FileText size={11} /> Cancellation Policy
              </div>

              <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(2.2rem,5.5vw,3.8rem)", fontWeight: 800, color: "#fff", lineHeight: 1.1, margin: "0 0 18px", animation: "hero-rise 0.55s ease 0.08s both" }}>
                Transparent. Fair.{" "}
                <span style={{ color: "#EF4444", fontStyle: "italic" }}>No surprises.</span>
              </h1>

              <p className="text-gray-400 leading-relaxed mb-8"
                style={{ fontSize: "clamp(0.95rem,1.8vw,1.05rem)", maxWidth: "460px", animation: "hero-rise 0.55s ease 0.16s both" }}>
                We believe you should know exactly what happens before you commit. Our cancellation policy is structured simply — the earlier you cancel, the more you recover.
              </p>

              {/* Key principle chips */}
              <div className="flex flex-wrap gap-3 mb-8" style={{ animation: "hero-rise 0.55s ease 0.22s both" }}>
                {[
                  { icon: <CheckCircle size={13} />, text: "Written cancellations only" },
                  { icon: <RefreshCw size={13} />, text: "Reschedule is always better" },
                  { icon: <Clock size={13} />, text: "Refunds in 7–10 business days" },
                ].map((c, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 bg-white/[0.06] border border-white/10 text-gray-300 text-xs font-semibold px-3.5 py-2 rounded-xl">
                    <span className="text-red-400">{c.icon}</span>{c.text}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-3" style={{ animation: "hero-rise 0.55s ease 0.28s both" }}>
                <a href="tel:+917023907023"
                  className="inline-flex items-center gap-2 font-bold text-sm px-5 py-3 rounded-xl text-white no-underline transition-opacity hover:opacity-88"
                  style={{ background: "#EF4444", boxShadow: "0 4px 16px rgba(239,68,68,0.38)", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                  <Phone size={14} /> Talk to Us First
                </a>
                <a href="mailto:support@dreamsyatri.com"
                  className="inline-flex items-center gap-2 font-bold text-sm px-5 py-3 rounded-xl no-underline transition-all"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1.5px solid rgba(255,255,255,0.15)", color: "#fff", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                  <Mail size={14} /> Email Support
                </a>
              </div>
            </div>

            {/* Right — floating quick-ref card */}
            <div className="hidden lg:flex justify-center items-center">
              <div style={{ animation: "float-card 5s ease-in-out infinite" }}>
                <div className="bg-white rounded-3xl p-7 relative" style={{ width: 340, boxShadow: "0 24px 80px rgba(0,0,0,0.32)" }}>
                  <div className="absolute top-0 right-0 w-20 h-20 rounded-tr-3xl rounded-bl-3xl" style={{ background: "rgba(239,68,68,0.07)" }} />
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center">
                      <Percent size={18} className="text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm">Quick Reference</p>
                      <p className="text-gray-400 text-xs">Cancellation Charges</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    {SLABS.map((s) => (
                      <div key={s.id} className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-16 text-xs font-bold" style={{ color: s.color }}>{s.range}</div>
                        <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="policy-bar h-full rounded-full"
                            style={{ "--w": `${s.charge}%`, background: s.color, width: `${s.charge}%` } as React.CSSProperties}
                          />
                        </div>
                        <div className="flex-shrink-0 w-10 text-right text-xs font-extrabold" style={{ color: s.color, fontFamily: "'Playfair Display',serif" }}>{s.charge}%</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 pt-5 border-t border-gray-100 flex items-center gap-2 text-gray-500 text-xs">
                    <Info size={12} className="text-red-400 flex-shrink-0" />
                    Percentage of total package value charged on cancellation
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Wave */}
        <svg className="block w-full -mb-px relative z-10" viewBox="0 0 1200 56" preserveAspectRatio="none" height="56">
          <path d="M0 56 L1200 56 L1200 38 Q900 0 600 28 Q300 56 0 0 Z" fill="white" />
        </svg>
      </section>

      {/* ── IMPORTANT NOTICE ──────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 sm:px-8 pt-8">
        <Reveal>
          <div className="flex items-start gap-4 bg-amber-50 border border-amber-200 rounded-2xl px-6 py-4">
            <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-800 text-sm mb-1">Before You Cancel — Consider Rescheduling</p>
              <p className="text-amber-700 text-sm leading-relaxed">
                In most cases, rescheduling your trip saves you money. If your plans have changed, speak to our team first — we'll explore every option before a cancellation is the only answer. Call <a href="tel:+917023907023" className="font-bold underline">+91 70239 07023</a>.
              </p>
            </div>
          </div>
        </Reveal>
      </div>

      {/* ── POLICY SLABS ──────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-6 sm:px-8">

          <Reveal className="text-center mb-14">
            <p className="text-xs font-bold tracking-widest uppercase text-red-500 mb-3">The Policy</p>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(1.7rem,3.5vw,2.5rem)", fontWeight: 800, color: "#111827", margin: "0 0 12px" }}>
              Cancellation charges at a glance
            </h2>
            <p className="text-gray-500 text-base max-w-md mx-auto leading-relaxed">
              All charges are a percentage of the total confirmed package value. The earlier you cancel, the more you get back.
            </p>
          </Reveal>

          {/* Slab cards — large */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
            {SLABS.map((slab, i) => (
              <Reveal key={slab.id} delay={i * 70}>
                <div
                  className="relative rounded-3xl border-2 p-7 sm:p-8 overflow-hidden transition-all duration-300 hover:shadow-xl group"
                  style={{ borderColor: slab.border, background: slab.bg }}
                >
                  {/* Large number watermark */}
                  <div className="absolute right-5 top-4 pointer-events-none select-none" aria-hidden="true">
                    <span style={{
                      fontFamily: "'Playfair Display',serif",
                      fontSize: "90px", fontWeight: 800, fontStyle: "italic",
                      color: slab.color, opacity: 0.08, lineHeight: 1,
                    }}>{slab.charge}%</span>
                  </div>

                  {/* Header */}
                  <div className="flex items-start gap-4 mb-5">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: slab.color + "20", color: slab.color }}>
                      {slab.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-extrabold text-gray-900 text-lg"
                          style={{ fontFamily: "'Playfair Display',serif" }}>
                          {slab.range} before travel
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs font-semibold">{slab.label}</p>
                    </div>
                  </div>

                  {/* Charge + Refund */}
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="bg-white rounded-2xl px-5 py-4 text-center border" style={{ borderColor: slab.border }}>
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Charge</p>
                      <p style={{ fontFamily: "'Playfair Display',serif", fontSize: "2.2rem", fontWeight: 800, color: slab.color, margin: 0, lineHeight: 1 }}>
                        {slab.charge}%
                      </p>
                      <p className="text-gray-400 text-xs mt-1">of package value</p>
                    </div>
                    <div className="bg-white rounded-2xl px-5 py-4 text-center border" style={{ borderColor: slab.border }}>
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Refund</p>
                      <p style={{ fontFamily: "'Playfair Display',serif", fontSize: "2.2rem", fontWeight: 800, color: slab.refund > 0 ? "#22C55E" : "#EF4444", margin: 0, lineHeight: 1 }}>
                        {slab.refund}%
                      </p>
                      <p className="text-gray-400 text-xs mt-1">{slab.refund > 0 ? "returned to you" : "non-refundable"}</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-5">
                    <div className="flex items-center justify-between text-xs text-gray-400 font-semibold mb-1.5">
                      <span>Amount charged</span>
                      <span style={{ color: slab.color }}>{slab.charge}% of total</span>
                    </div>
                    <div className="h-2.5 bg-white rounded-full overflow-hidden border" style={{ borderColor: slab.border }}>
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${slab.charge}%`, background: slab.color }}
                      />
                    </div>
                  </div>

                  {/* Advice */}
                  <div className="flex items-start gap-2.5 bg-white/70 rounded-xl px-4 py-3 border" style={{ borderColor: slab.border }}>
                    <Info size={14} style={{ color: slab.color, flexShrink: 0, marginTop: 2 }} />
                    <p className="text-gray-600 text-xs leading-relaxed">{slab.advice}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Full comparison table */}
          <Reveal>
            <div className="rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="bg-gray-950 px-6 py-4 flex items-center gap-3">
                <FileText size={16} className="text-red-400" />
                <p className="text-white font-bold text-sm">Complete Policy Summary</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-widest text-gray-500">Days Before Travel</th>
                      <th className="text-center px-6 py-4 text-xs font-bold uppercase tracking-widest text-gray-500">Cancellation Charge</th>
                      <th className="text-center px-6 py-4 text-xs font-bold uppercase tracking-widest text-gray-500">Amount Refunded</th>
                      <th className="text-center px-6 py-4 text-xs font-bold uppercase tracking-widest text-gray-500 hidden sm:table-cell">Risk Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SLABS.map((s, i) => (
                      <tr key={s.id} className={i < SLABS.length - 1 ? "border-b border-gray-50" : ""}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                            <div>
                              <p className="font-bold text-gray-900 text-sm">{s.range}</p>
                              <p className="text-gray-400 text-xs">{s.label}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-block font-extrabold text-xl" style={{ fontFamily: "'Playfair Display',serif", color: s.color }}>{s.charge}%</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-block font-extrabold text-xl" style={{ fontFamily: "'Playfair Display',serif", color: s.refund > 0 ? "#22C55E" : "#EF4444" }}>
                            {s.refund}%
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center hidden sm:table-cell">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold"
                            style={{ background: s.color + "18", color: s.color }}>
                            {s.risk.charAt(0).toUpperCase() + s.risk.slice(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── HOW TO CANCEL ─────────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 sm:px-8">

          <Reveal className="text-center mb-14">
            <p className="text-xs font-bold tracking-widest uppercase text-red-500 mb-3">The Process</p>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(1.7rem,3.5vw,2.5rem)", fontWeight: 800, color: "#111827", margin: "0 0 12px" }}>
              How to cancel your booking
            </h2>
            <p className="text-gray-500 text-base max-w-md mx-auto leading-relaxed">A simple 4-step process — straightforward and fully documented.</p>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                step: "01", icon: <Mail size={22} />, title: "Send Written Request",
                desc: "Email support@dreamsyatri.com or WhatsApp us. Include your booking reference number and reason for cancellation.",
                note: "Verbal requests are not accepted",
              },
              {
                step: "02", icon: <CheckCircle size={22} />, title: "Confirmation Received",
                desc: "We acknowledge your cancellation request within 2 hours and confirm the applicable charge based on your travel date.",
                note: "Charges locked at time of request",
              },
              {
                step: "03", icon: <Percent size={22} />, title: "Deduction Calculated",
                desc: "The cancellation charge is applied to your total package value. We send a written breakdown of the refund amount.",
                note: "Full breakdown in writing",
              },
              {
                step: "04", icon: <RefreshCw size={22} />, title: "Refund Processed",
                desc: "The refund is returned to your original payment method within 7–10 business days after cancellation confirmation.",
                note: "To original payment source only",
              },
            ].map((s, i) => (
              <Reveal key={i} delay={i * 70}>
                <div className="bg-white rounded-2xl border border-gray-100 p-6 hover:border-red-200 hover:shadow-lg hover:shadow-red-500/5 transition-all duration-300 h-full flex flex-col">
                  <div className="flex items-start justify-between mb-5">
                    <div className="w-11 h-11 rounded-xl bg-red-50 text-red-500 flex items-center justify-center">
                      {s.icon}
                    </div>
                    <span style={{ fontFamily: "'Playfair Display',serif", fontSize: "2rem", fontWeight: 800, color: "#F3F4F6", lineHeight: 1 }}>{s.step}</span>
                  </div>
                  <h3 className="font-bold text-gray-900 text-base mb-2">{s.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed flex-1 mb-4">{s.desc}</p>
                  <div className="flex items-center gap-2 mt-auto pt-4 border-t border-gray-50">
                    <Info size={12} className="text-red-400 flex-shrink-0" />
                    <p className="text-gray-400 text-xs font-semibold">{s.note}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Reschedule CTA */}
          <Reveal className="mt-8">
            <div className="bg-gray-950 rounded-2xl p-7 sm:p-9 flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(239,68,68,0.15)" }}>
                <RefreshCw size={22} className="text-red-400" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-white text-base mb-1">Thinking of cancelling? Reschedule instead.</p>
                <p className="text-gray-400 text-sm leading-relaxed">Most of the time, changing your travel dates is free or costs far less than cancelling. Our team will check availability and find you better dates before you lose any money.</p>
              </div>
              <a href="tel:+917023907023"
                className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-bold px-6 py-3 rounded-xl text-sm no-underline transition-colors flex-shrink-0"
                style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", boxShadow: "0 3px 12px rgba(239,68,68,0.32)" }}>
                <Phone size={14} /> Call to Reschedule
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── SPECIAL CASES ─────────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6 sm:px-8">

          <Reveal className="text-center mb-14">
            <p className="text-xs font-bold tracking-widest uppercase text-red-500 mb-3">Special Circumstances</p>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(1.7rem,3.5vw,2.5rem)", fontWeight: 800, color: "#111827", margin: 0 }}>
              When things are outside your control
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: <AlertTriangle size={20} />, color: "#F59E0B",
                title: "Force Majeure",
                desc: "Natural disasters, severe weather, government advisories, or political unrest. We prioritise free rescheduling. Cancellations are handled case-by-case with refund of all recoverable costs.",
              },
              {
                icon: <Shield size={20} />, color: "#8B5CF6",
                title: "Medical Emergency",
                desc: "In the event of a documented medical emergency preventing travel, contact us immediately. We treat each case with compassion and work to minimise financial impact where suppliers allow.",
              },
              {
                icon: <Plane size={20} />, color: "#0EA5E9",
                title: "Flight Cancellation",
                desc: "If your inbound flight is cancelled or significantly delayed by the airline, inform us immediately. We'll reschedule ground arrangements without additional charge where operationally possible.",
              },
              {
                icon: <XCircle size={20} />, color: "#EF4444",
                title: "Dreams Yatri Cancels",
                desc: "If we cancel your trip for any reason, you receive a 100% full refund with zero deductions — or a free reschedule to your preferred dates. No exceptions.",
              },
              {
                icon: <HelpCircle size={20} />, color: "#10B981",
                title: "Visa Rejection",
                desc: "For international packages, if your visa is rejected after booking, contact us immediately with the rejection letter. We'll work with you on rescheduling or refunding recoverable costs.",
              },
              {
                icon: <Calendar size={20} />, color: "#F97316",
                title: "Partial Trip Completion",
                desc: "If you need to cut short a trip already in progress due to an emergency, charges for unused future nights are subject to hotel and vendor policies at that point. We'll negotiate on your behalf.",
              },
            ].map((card, i) => (
              <Reveal key={i} delay={i * 60}>
                <div className="bg-white border border-gray-100 rounded-2xl p-6 hover:border-opacity-60 hover:shadow-lg transition-all duration-300 h-full group"
                  onMouseEnter={e => (e.currentTarget.style.borderColor = card.color + "55")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "")}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-colors duration-300" style={{ background: card.color + "15", color: card.color }}>
                    {card.icon}
                  </div>
                  <h3 className="font-bold text-gray-900 text-base mb-2">{card.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{card.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 sm:px-8">
          <Reveal className="text-center mb-12">
            <p className="text-xs font-bold tracking-widest uppercase text-red-500 mb-3">Common Questions</p>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(1.7rem,3.5vw,2.5rem)", fontWeight: 800, color: "#111827", margin: 0 }}>
              Cancellation FAQs
            </h2>
          </Reveal>

          <div className="flex flex-col gap-3">
            {[
              { q: "How do I cancel my booking?", a: "Contact us in writing via email at support@dreamsyatri.com or WhatsApp us at +91 70239 07023. Cancellations must be confirmed in writing — verbal requests over the phone are not processed. Include your booking reference number and travel dates in your request." },
              { q: "When does the cancellation clock start?", a: "The cancellation timeline is calculated from the date we receive your written cancellation request — not from the date of your original booking. The number of days remaining is counted from the day of request to your scheduled departure date." },
              { q: "What if I want to reschedule instead of cancel?", a: "Rescheduling is almost always a better option than cancelling. If you reschedule more than 15 days before travel, there is typically no rescheduling fee subject to supplier availability. Rescheduling within 15 days may incur a fee. Speak to our team — we'll work with you to find the best outcome." },
              { q: "Is the cancellation charge applied to the full package cost?", a: "Yes. The cancellation percentage is applied to the total confirmed package value including accommodation, transfers, meals, and activities as per your booking confirmation. Add-on items booked separately may have their own supplier cancellation terms." },
              { q: "How long does a refund take?", a: "Refunds are processed within 7–10 business days after your cancellation is confirmed in writing. The amount is returned to the original payment method. Bank transfer refunds may take an additional 2–3 business days to reflect in your account." },
              { q: "What if my trip is cancelled due to bad weather or a natural disaster?", a: "Force majeure events — natural disasters, severe weather, government travel advisories, or political unrest — are handled on a case-by-case basis. We prioritise rescheduling at no extra charge. Where cancellation is unavoidable, we refund the full amount minus actual non-recoverable costs already paid to hotels and vendors." },
              { q: "Can I cancel individual components of my package?", a: "Partial cancellations are handled based on the supplier's individual cancellation terms. Some hotels and activity providers have stricter policies than ours. Our team will advise you of the exact charges applicable to each component before confirming any partial cancellation." },
              { q: "What happens if Dreams Yatri cancels my trip?", a: "In the rare event that we need to cancel your trip — due to insufficient group size, supplier failure, or operational reasons — you will receive a full refund with no deductions, or a free reschedule to your preferred dates, whichever you prefer." },
            ].map((faq, i) => (
              <Accordion key={i} q={faq.q} a={faq.a} delay={i * 30} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT ───────────────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-950">
        <div className="max-w-6xl mx-auto px-6 sm:px-8">
          <Reveal className="text-center mb-12">
            <p className="text-xs font-bold tracking-widest uppercase text-red-400 mb-3">Need Help?</p>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(1.7rem,3.5vw,2.5rem)", fontWeight: 800, color: "#fff", margin: "0 0 12px" }}>
              Speak to our team before cancelling
            </h2>
            <p className="text-gray-400 max-w-md mx-auto text-base leading-relaxed">
              A 5-minute call could save you thousands of rupees. We'll explore every option — rescheduling, partial credit, or special exception — before you lose your deposit.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              {
                icon: <Phone size={22} />, color: "#EF4444", label: "Call Us",
                title: "Fastest Resolution", value: "+91 70239 07023",
                sub: "Support: +91 70239 07099",
                href: "tel:+917023907023", cta: "Call Now",
                hours: "Mon–Sat, 9 AM–7 PM · Emergency 24/7",
              },
              {
                icon: <MessageCircle size={22} />, color: "#25D366", label: "WhatsApp",
                title: "Share Documents", value: "+91 70239 07023",
                sub: "Attach booking reference",
                href: "https://wa.me/917023907023?text=Hi%2C%20I%20need%20help%20with%20a%20cancellation.",
                cta: "Open WhatsApp", hours: "Typically replies in under 5 minutes",
              },
              {
                icon: <Mail size={22} />, color: "#0EA5E9", label: "Email",
                title: "Written Cancellation", value: "support@dreamsyatri.com",
                sub: "Include booking reference",
                href: "mailto:support@dreamsyatri.com?subject=Cancellation%20Request", cta: "Send Email",
                hours: "Response within 4 hours",
              },
            ].map((ch, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-7 flex flex-col h-full transition-all duration-300"
                  onMouseEnter={e => (e.currentTarget.style.borderColor = ch.color + "44")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "")}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 flex-shrink-0" style={{ background: ch.color + "18", color: ch.color }}>
                    {ch.icon}
                  </div>
                  <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: ch.color }}>{ch.label}</p>
                  <h3 className="text-white font-bold text-base mb-1">{ch.title}</h3>
                  <p className="font-bold text-white text-sm mb-1">{ch.value}</p>
                  <p className="text-gray-500 text-xs mb-6">{ch.sub}</p>
                  <a href={ch.href}
                    target={ch.href.startsWith("http") ? "_blank" : undefined}
                    rel={ch.href.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="mt-auto w-full py-3 rounded-xl text-sm font-bold text-center flex items-center justify-center gap-2 no-underline transition-opacity hover:opacity-88 mb-4"
                    style={{ background: ch.color, color: ch.color === "#25D366" ? "#000" : "#fff", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                    <ArrowRight size={14} /> {ch.cta}
                  </a>
                  <p className="text-gray-600 text-xs flex items-center gap-1.5">
                    <Clock size={11} style={{ color: ch.color }} />{ch.hours}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA STRIP ─────────────────────────────────────────────────────── */}
      <section className="bg-red-500 py-16 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle,rgba(255,255,255,0.6) 1px,transparent 1px)", backgroundSize: "26px 26px" }} />
        <Reveal className="relative z-10 max-w-xl mx-auto">
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(1.5rem,3.5vw,2.2rem)", fontWeight: 800, color: "#fff", margin: "0 0 12px" }}>
            Plans changed? Talk to us first.
          </h2>
          <p className="text-red-100 text-base leading-relaxed mb-7 max-w-md mx-auto">
            We'd rather find you a better date than lose your booking. Call before you cancel.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href="tel:+917023907023"
              className="inline-flex items-center gap-2 bg-white text-red-500 hover:bg-red-50 font-bold px-7 py-3.5 rounded-xl text-sm no-underline transition-colors"
              style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.14)", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
              <Phone size={14} /> +91 70239 07023
            </a>
            <a href="mailto:support@dreamsyatri.com"
              className="inline-flex items-center gap-2 border border-white/40 hover:border-white text-white font-semibold px-7 py-3.5 rounded-xl text-sm no-underline transition-all"
              style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
              <Mail size={14} /> support@dreamsyatri.com
            </a>
          </div>
        </Reveal>
      </section>
    </div>
  );
}