"use client";

import { useState, useRef, useEffect } from "react";
import {
  Phone, Mail, MessageCircle, Clock, MapPin,
  Shield, Zap, CheckCircle, ChevronRight,
  AlertCircle, Headphones, FileText, RefreshCw,
  Navigation, Camera, Wifi, CreditCard, Users,
  ArrowRight, Star, Send,
} from "lucide-react";
import { useContact } from "@/app/context/Global";
import { ISSUE_CATEGORIES } from "./data";
import { SectionHeading } from "../components/SectionHeading";

function ProcessStep({ num, title, desc, delay }: { num: string; title: string; desc: string; delay?: number }) {
  return (
    <Reveal delay={delay} className="flex gap-5 items-start">
      <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm"
        style={{ background: "rgba(239,68,68,0.12)", color: "#EF4444", fontFamily: "'Playfair Display', serif" }}>
        {num}
      </div>
      <div>
        <p className="font-bold text-white text-sm mb-1">{title}</p>
        <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
      </div>
    </Reveal>
  );
}

// ── Reveal ────────────────────────────────────────────────────────────────────
function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setV(true); obs.disconnect(); } }, { threshold });
    obs.observe(el); return () => obs.disconnect();
  }, []);
  return { ref, v };
}

function Reveal({ children, delay = 0, className = "", dir = "up" }: {
  children: React.ReactNode; delay?: number; className?: string; dir?: "up" | "left" | "right";
}) {
  const { ref, v } = useInView();
  const translate = { up: "translateY(24px)", left: "translateX(-24px)", right: "translateX(24px)" };
  return (
    <div ref={ref} className={className} style={{ opacity: v ? 1 : 0, transform: v ? "none" : translate[dir], transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms` }}>
      {children}
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status, label }: { status: "online" | "busy" | "away"; label: string }) {
  const map = { online: "#22C55E", busy: "#F59E0B", away: "#EF4444" };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: map[status] }}>
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: map[status] }} />
        <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: map[status] }} />
      </span>
      {label}
    </span>
  );
}

// ── Issue category card ───────────────────────────────────────────────────────
function IssueCard({ icon, title, desc, action, href, delay }: {
  icon: React.ReactNode; title: string; desc: string; action: string; href: string; delay?: number;
}) {
  return (
    <Reveal delay={delay}>
      <a href={href} className="group block bg-white border border-gray-100 rounded-2xl p-6 hover:border-red-200 hover:shadow-xl hover:shadow-red-500/[0.06] transition-all duration-300 no-underline h-full">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 text-red-500 transition-colors duration-300 group-hover:bg-red-500 group-hover:text-white" style={{ background: "#FEF2F2" }}>
          {icon}
        </div>
        <h3 className="text-gray-900 font-bold text-base mb-1.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{title}</h3>
        <p className="text-gray-500 text-sm leading-relaxed mb-4">{desc}</p>
        <span className="inline-flex items-center gap-1.5 text-red-500 text-sm font-bold group-hover:gap-3 transition-all duration-200">
          {action} <ArrowRight size={14} />
        </span>
      </a>
    </Reveal>
  );
}



// ── Contact channel card ──────────────────────────────────────────────────────
function ChannelCard({ icon, accent, label, tag, title, desc, value, cta, href, hours, delay }: {
  icon: React.ReactNode; accent: string; label: string; tag?: string; title: string;
  desc: string; value: string; cta: string; href: string; hours: string; delay?: number;
}) {
  return (
    <Reveal delay={delay} className="h-full">
      <div className="h-full flex flex-col bg-white shadow-lg border border-gray-200 rounded-2xl border border-gray-100 p-7 hover:border-opacity-60 hover:shadow-xl transition-all duration-300 group"
        style={{ "--accent": accent } as React.CSSProperties}
        onMouseEnter={e => (e.currentTarget.style.borderColor = accent + "55")}
        onMouseLeave={e => (e.currentTarget.style.borderColor = "")}
      >
        <div className="flex items-start justify-between mb-5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: accent + "18", color: accent }}>
            {icon}
          </div>
          {tag && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: accent + "15", color: accent }}>{tag}</span>
          )}
        </div>
        <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: accent }}>{label}</p>
        <h3 className="text-gray-900 font-bold text-lg mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{title}</h3>
        <p className="text-gray-500 text-sm leading-relaxed mb-5 flex-1">{desc}</p>
        <p className=" text-gray-500 text-sm mb-4">{value}</p>
        <a href={href}
          className="w-full py-3 rounded-xl cursor-pointer text-sm font-bold text-center transition-all duration-200 no-underline flex items-center justify-center gap-2 mb-4"
          style={{ background: accent, color: "#fff", boxShadow: `0 4px 14px ${accent}40` }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          {cta}
        </a>
        <p className="text-gray-400 text-xs flex items-center gap-1.5">
          <Clock size={11} style={{ color: accent }} />{hours}
        </p>
      </div>
    </Reveal>
  );
}

// ── SLA Badge ─────────────────────────────────────────────────────────────────
function SLARow({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-3 py-4 border-b border-gray-100 last:border-0">
      <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + "15", color }}>{icon}</span>
      <span className="text-gray-600 text-sm flex-1">{label}</span>
      <span className="text-gray-900 font-bold text-sm">{value}</span>
    </div>
  );
}

// ── Quick Query Form ──────────────────────────────────────────────────────────
function QuickForm() {
  const [form, setForm] = useState({ name: "", phone: "", issue: "", msg: "" });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = () => {
    if (!form.name || !form.phone || !form.issue) return;
    setLoading(true);
    setTimeout(() => { setLoading(false); setSent(true); }, 1200);
  };

  const inputCls = "w-full px-4 py-3 rounded-lg ring ring-gray-300 border-gray-300 text-sm text-gray-900 bg-white outline-none transition-all placeholder:text-gray-400 focus:border-red-400 focus:ring-2 focus:ring-red-100";

  if (sent) {
    return (
      <div className="text-center py-10">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={28} className="text-green-500" />
        </div>
        <h4 className="font-bold text-gray-900 text-lg mb-2">Request Received!</h4>
        <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto">Our support team will reach out to you within 2 hours on your phone number.</p>
        <button onClick={() => { setSent(false); setForm({ name: "", phone: "", issue: "", msg: "" }); }}
          className="mt-5 text-sm text-red-500 font-semibold hover:underline" type="button">Submit another request</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Your Name <span className="text-red-500">*</span></label>
          <input className={inputCls} placeholder="Rahul Sharma" value={form.name} onChange={set("name")} />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Phone Number <span className="text-red-500">*</span></label>
          <input className={inputCls} placeholder="+91 98765 43210" value={form.phone} onChange={set("phone")} type="tel" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Issue Type <span className="text-red-500">*</span></label>
        <select className={inputCls} value={form.issue} onChange={set("issue")}>
          <option value="">Select issue type…</option>
          <option>Hotel / Accommodation Problem</option>
          <option>Transport / Transfer Issue</option>
          <option>Cancellation or Refund</option>
          <option>Itinerary Change Request</option>
          <option>Payment Query</option>
          <option>Emergency Assistance</option>
          <option>Documents / Vouchers</option>
          <option>Other</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Brief Description</label>
        <textarea className={inputCls} rows={6} placeholder="Describe your issue briefly so we can prepare before calling you…" value={form.msg} onChange={set("msg")} style={{ resize: "none" }} />
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={loading || !form.name || !form.phone || !form.issue}
        className="w-full py-3.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-90 disabled:cursor-not-allowed"
        style={{ background: loading ? "#D1D5DB" : "#EF4444", boxShadow: loading ? "none" : "0 4px 16px rgba(239,68,68,0.32)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        {loading ? (
          <><RefreshCw size={15} className="animate-spin" /> Submitting…</>
        ) : (
          <><Send size={15} /> Request a Callback</>
        )}
      </button>
      <p className="text-center text-xs text-gray-500">We'll call you back Shortly.</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CustomerSupportPage() {
  const contact = useContact();
  return (
    <div className="bg-white min-h-screen" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;0,800;1,700&display=swap');
        @keyframes hero-rise { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:none; } }
        @keyframes float-card {
          0%,100% { transform:translateY(0) rotate(1deg); }
          50%      { transform:translateY(-8px) rotate(1deg); }
        }
        @keyframes spin-ring { to { transform:rotate(360deg); } }
      `}</style>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative bg-gray-950 overflow-hidden" style={{ paddingTop: "88px", paddingBottom: "0" }}>

        {/* Grid texture */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.032]"
          style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "48px 48px" }} />

        {/* Glow blobs */}
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: "rgba(239,68,68,0.09)", filter: "blur(100px)" }} />
        <div className="absolute top-1/2 -left-20 w-64 h-64 rounded-full pointer-events-none" style={{ background: "rgba(239,68,68,0.05)", filter: "blur(70px)" }} />

        <div className="max-w-6xl mx-auto px-6 sm:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-end pb-0">

            {/* Left — copy */}
            <div className="pt-10 pb-16">
              <div className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full border text-xs font-bold tracking-widest uppercase"
                style={{ background: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.28)", color: "#FCA5A5", animation: "hero-rise 0.5s ease both" }}>
                <Headphones size={11} />
                Customer Support
              </div>

              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(2.2rem, 5.5vw, 3.8rem)", fontWeight: 800, color: "#fff", lineHeight: 1.1, margin: "0 0 18px", animation: "hero-rise 0.55s ease 0.08s both" }}>
                We're here  <br />{"   "}
                <span style={{ color: "#EF4444", fontStyle: "italic" }}>always.</span>
              </h1>

              <p className="text-gray-400 leading-relaxed mb-8"
                style={{ fontSize: "clamp(0.95rem,1.8vw,1.05rem)", maxWidth: "480px", animation: "hero-rise 0.55s ease 0.16s both" }}>
                Trip going sideways? Question before you leave? Need a document urgently? Our support team works around the clock so your journey never gets derailed.
              </p>

              {/* Live status chips */}
              <div className="flex flex-wrap gap-3 mb-8" style={{ animation: "hero-rise 0.55s ease 0.22s both" }}>
                <div className="flex items-center gap-2 bg-white/[0.05] border border-white/10 px-3.5 py-2 rounded-xl">
                  <StatusBadge status="online" label="Sales team online" />
                </div>
                <div className="flex items-center gap-2 bg-white/[0.05] border border-white/10 px-3.5 py-2 rounded-xl">
                  <StatusBadge status="online" label="Support team online" />
                </div>
                <div className="flex items-center gap-2 bg-white/[0.05] border border-white/10 px-3.5 py-2 rounded-xl">
                  <StatusBadge status="online" label="Emergency line 24/7" />
                </div>
              </div>

              {/* Quick action buttons */}
              <div className="flex flex-wrap gap-3" style={{ animation: "hero-rise 0.55s ease 0.28s both" }}>
                <a href={contact.sales.phoneUrl}
                  className="inline-flex items-center gap-2 font-bold text-sm px-5 py-3 rounded-xl text-white no-underline transition-all hover:opacity-88"
                  style={{ background: "#EF4444", boxShadow: "0 4px 16px rgba(239,68,68,0.38)", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                  <Phone size={15} /> Call Sales
                </a>
                <a href={contact.support.phoneUrl}
                  className="inline-flex items-center gap-2 font-bold text-sm px-5 py-3 rounded-xl no-underline transition-all"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1.5px solid rgba(255,255,255,0.15)", color: "#fff", fontFamily: "'Plus Jakarta Sans',sans-serif" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}>
                  <Shield size={15} /> Call Support
                </a>
                <a href={contact.whatsapp.url}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 font-bold text-sm px-5 py-3 rounded-xl no-underline transition-all"
                  style={{ background: "rgba(37,211,102,0.15)", border: "1.5px solid rgba(37,211,102,0.3)", color: "#25D366", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                  <MessageCircle size={15} /> WhatsApp
                </a>
              </div>
            </div>

            {/* Right — floating response time card */}
            <div className="hidden lg:flex items-end justify-center pb-0">
              <div style={{ animation: "float-card 5s ease-in-out infinite" }}>
                <div className="bg-white rounded-3xl p-8 relative" style={{ width: 320, boxShadow: "0 24px 80px rgba(0,0,0,0.32), 0 4px 24px rgba(0,0,0,0.16)" }}>
                  {/* Red corner accent */}
                  <div className="absolute top-0 right-0 w-20 h-20 rounded-tr-3xl rounded-bl-3xl" style={{ background: "rgba(239,68,68,0.08)" }} />

                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center">
                      <Headphones size={18} className="text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm">Dreams Yatri Support</p>
                      <StatusBadge status="online" label="Online now" />
                    </div>
                  </div>

                  {/* Mock chat bubble */}
                  <div className="bg-red-50 rounded-2xl rounded-tl-sm p-3.5 mb-3">
                    <p className="text-gray-700 text-xs leading-relaxed">Hi! How can we help you today? We typically respond within a few minutes. 😊</p>
                  </div>

                  <div className="space-y-2 mb-5">
                    {["Hotel issue", "Transfer delay", "Refund query", "Emergency help"].map((opt) => (
                      <div key={opt} className="border border-gray-100 rounded-xl px-3.5 py-2.5 flex items-center justify-between group cursor-default hover:border-red-200 hover:bg-red-50/50 transition-all">
                        <span className="text-gray-700 text-xs font-semibold">{opt}</span>
                        <ChevronRight size={13} className="text-gray-300 group-hover:text-red-400 transition-colors" />
                      </div>
                    ))}
                  </div>

                  {/* Response time stat */}
                  <div className="border-t border-gray-100 pt-4 grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-center">
                      <p style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.2rem", fontWeight: 800, color: "#EF4444", margin: 0 }}>{"<"}5m</p>
                      <p className="text-gray-400 text-xs mt-0.5 font-semibold">Avg Response</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-center">
                      <p style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.2rem", fontWeight: 800, color: "#EF4444", margin: 0 }}>24/7</p>
                      <p className="text-gray-400 text-xs mt-0.5 font-semibold">Emergency</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom wave */}
        <svg className="block w-full -mb-px relative z-10" viewBox="0 0 1200 56" preserveAspectRatio="none" height="56">
          <path d="M0 0 Q300 56 600 28 Q900 0 1200 38 L1200 0 Z" fill="#030712" />
          <path d="M0 56 L1200 56 L1200 38 Q900 0 600 28 Q300 56 0 0 Z" fill="white" />
        </svg>
      </section>

      {/* ── SLA PROMISE BAND ──────────────────────────────────────────────── */}
      <section className="bg-white border-b border-gray-100 py-6">
        <div className="max-w-6xl mx-auto px-6 sm:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: <Zap size={16} />, label: "WhatsApp response", value: "< 5 min", color: "#25D366" },
              { icon: <Phone size={16} />, label: "Phone pickup", value: "< 2 rings", color: "#EF4444" },
              { icon: <Mail size={16} />, label: "Email response", value: "< 4 hours", color: "#0EA5E9" },
              { icon: <Shield size={16} />, label: "Emergency resolution", value: "Same day", color: "#8B5CF6" },
            ].map((s, i) => (
              <Reveal key={i} delay={i * 50} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3.5">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: s.color + "18", color: s.color }}>{s.icon}</span>
                <div>
                  <p className="text-gray-500 text-xs leading-none mb-1">{s.label}</p>
                  <p className="font-extrabold text-gray-900 text-sm">{s.value}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT CHANNELS ──────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6 sm:px-8">
          <Reveal className="text-center mb-12">
            <p className="text-xs font-bold tracking-widest uppercase text-red-500 mb-3">Contact Channels</p>
            <SectionHeading
                text="Reach Us The Way That"
                highlight="Suits Your"
                highlightPosition="suffix"
                variant="light"
              />
            <p className="text-gray-500 text-base max-w-md mx-auto leading-relaxed">Every channel connects you to a real person — no bots, no automated menus.</p>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <ChannelCard
              icon={<Phone size={22} />} accent="#EF4444" label="Sales Team" tag="Most Popular"
              title="Book a New Trip" desc="Talk to a travel expert who will design the perfect itinerary for you."
              value={contact.sales.phone} cta="Call Sales" href={contact.sales.phone}
              hours="Mon–Sat, 9 AM–7 PM IST" delay={0}
            />
            <ChannelCard
              icon={<Shield size={22} />} accent="#10B981" label="Support Team" tag="Existing Bookings"
              title="Trip Assistance" desc="Hotel issues, transfer delays, cancellations, and on-trip emergencies."
              value={contact.support.phone} cta="Call Support" href={contact.support.phone}
              hours="24/7 for active trips" delay={80}
            />
            <ChannelCard
              icon={<MessageCircle size={22} />} accent="#25D366" label="WhatsApp" tag="Fastest Response"
              title="Chat Instantly" desc="Drop a message anytime. Share documents, photos, and queries — we reply in minutes."
              value={contact.whatsapp.phone} cta="Open WhatsApp"
              href={contact.whatsapp.url}
              hours="Typically under 5 minutes" delay={160}
            />
            <ChannelCard
              icon={<Mail size={22} />} accent="#0EA5E9" label="Email Support"
              title="Detailed Queries"
              desc="Refund requests, billing disputes, complaints, and document submissions go here."
              value={contact.support.email} cta="Send Email" href={contact.support.email}
              hours="Response within 4 hours" delay={240}
            />
          </div>
        </div>
      </section>

      {/* ── SPLIT: REQUEST CALLBACK + HOW IT WORKS ────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6 sm:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-start">

            {/* Left — callback form */}
            <Reveal dir="left">
              <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500">
                    <Phone size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold tracking-widest uppercase text-red-500 mb-0.5">Request a Callback</p>
                    <h3 className="font-bold text-gray-900 text-lg" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>We'll call you back in 2 hours</h3>
                  </div>
                </div>
                <QuickForm />
              </div>
            </Reveal>

            {/* Right — how support works */}
            <div>
              <Reveal dir="right" className="mb-10">
                <p className="text-xs font-bold tracking-widest uppercase text-red-500 mb-3">How It Works</p>
              <SectionHeading
                text="Fast Human"
                highlight="Solutions"
                highlightPosition="suffix"
                variant="light"
              />
                <p className="text-gray-500 text-sm leading-relaxed">From the moment you reach out, our team moves with urgency — not bureaucracy.</p>
              </Reveal>

              <div className="bg-gray-950 rounded-3xl p-8">
                <div className="flex flex-col gap-6">
                  {[
                    { num: "01", title: "Contact us on any channel", desc: "Call, WhatsApp, email, or fill the callback form. We're active on all channels simultaneously." },
                    { num: "02", title: "We verify your booking", desc: "Share your booking reference or name. We pull up your itinerary and understand the full context before responding." },
                    { num: "03", title: "Immediate action is taken", desc: "We coordinate with hotels, drivers, and vendors directly. You get a real update — not a ticket number." },
                    { num: "04", title: "Issue resolved & confirmed", desc: "We follow up to ensure everything is sorted and your trip continues without disruption." },
                  ].map((s, i) => (
                    <ProcessStep key={i} {...s} delay={i * 60} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SUPPORT TEAMS ─────────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-950">
        <div className="max-w-6xl mx-auto px-6 sm:px-8">
          <Reveal className="text-center mb-14">
            <p className="text-xs font-bold tracking-widest uppercase text-red-400 mb-3">Meet the Teams</p>

            <SectionHeading
              text="Real People."
              highlight="Real Solutions."
              highlightPosition="suffix"
              variant="dark"
            />
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              {
                icon: <Users size={24} />, color: "#EF4444", label: "Sales Team",
                who: "Travel planners & booking specialists",
                handles: ["New trip enquiries", "Custom itinerary design", "Package pricing & availability", "B2B and group bookings"],
                contact: contact.sales.email,
                phone: contact.sales.phone,
                hours: "Mon–Sat, 9 AM–7 PM",
              },
              {
                icon: <Shield size={24} />, color: "#10B981", label: "Support Team",
                who: "On-trip problem solvers",
                handles: ["Hotel & transport issues", "Itinerary amendments", "Document resending", "On-trip emergency management"],
                contact: contact.support.email,
                phone: contact.support.phone,
                hours: "24/7 for active bookings",
              },
              {
                icon: <CreditCard size={24} />, color: "#0EA5E9", label: "Finance Team",
                who: "Billing, refunds & payment experts",
                handles: ["Refund processing", "Payment reconciliation", "GST invoices & receipts", "Dispute resolution"],
                contact: contact.finance.email,
                phone: contact.finance.phone,
                hours: "Mon–Sat, 10 AM–6 PM",
              },
            ].map((team, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-7 h-full flex flex-col hover:border-opacity-40 transition-all duration-300"
                  onMouseEnter={e => (e.currentTarget.style.borderColor = team.color + "44")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "")}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 flex-shrink-0" style={{ background: team.color + "18", color: team.color }}>
                    {team.icon}
                  </div>
                  <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: team.color }}>{team.label}</p>
                  <h3 className="text-white font-bold text-base mb-1">{team.who}</h3>
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-4">Handles:</p>
                  <ul className="flex flex-col gap-2 mb-6 flex-1">
                    {team.handles.map((h, j) => (
                      <li key={j} className="flex items-start gap-2.5 text-sm text-gray-400">
                        <CheckCircle size={14} style={{ color: team.color, flexShrink: 0, marginTop: 2 }} /> {h}
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-white/10 pt-5 flex flex-col gap-2.5">
                    <a href={`tel:${team.phone.replace(/\s/g, "")}`} className="flex items-center gap-2.5 no-underline group">
                      <Phone size={13} style={{ color: team.color, flexShrink: 0 }} />
                      <span className="text-white text-sm font-semibold group-hover:underline">{team.phone}</span>
                    </a>
                    <a href={`mailto:${team.contact}`} className="flex items-center gap-2.5 no-underline group">
                      <Mail size={13} style={{ color: team.color, flexShrink: 0 }} />
                      <span className="text-gray-400 text-sm group-hover:text-white transition-colors">{team.contact}</span>
                    </a>
                    <div className="flex items-center gap-2.5">
                      <Clock size={13} style={{ color: team.color, flexShrink: 0 }} />
                      <span className="text-gray-500 text-xs">{team.hours}</span>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Office info */}
          <Reveal className="mt-8 border border-white/10 rounded-2xl px-7 py-5 flex flex-wrap gap-6 justify-between text-center items-center">
            {[
              { icon: <MapPin size={15} />, label: "Head Office", value: "Shimla, Himachal Pradesh – 171001" },
              { icon: <Clock size={15} />, label: "General Hours", value: "Mon–Sat, 9:00 AM – 7:00 PM IST" },
              { icon: <Star size={15} />, label: "Emergency Line", value: "24/7 for active bookings" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-red-400">{item.icon}</span>
                <div className="text-left">
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-0.5">{item.label}</p>
                  <p className="text-white text-sm font-semibold">{item.value}</p>
                </div>
                {i < 2 && <div className="hidden sm:block w-px h-8 bg-white/10 ml-4" />}
              </div>
            ))}
          </Reveal>
        </div>
      </section>
    </div>
  );
}