"use client";

import { useState } from "react";

// ── Design tokens ─────────────────────────────────────────────────────────────
const BRAND      = "#EF4444"; // red-500
const BRAND_LIGHT = "#FEF2F2"; // red-50
const BRAND_BORDER = "#FECACA"; // red-200
const DARK       = "#111827"; // gray-900
const GRAY       = "#6B7280"; // gray-500
const GRAY_LIGHT = "#F9FAFB"; // gray-50
const BORDER     = "#E5E7EB"; // gray-200

// ── Icons ─────────────────────────────────────────────────────────────────────

const PlaneIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19 4c-1 0-1.5.5-3.5 2.5L11 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
  </svg>
);
const MapPinIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
  </svg>
);
const BriefcaseIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
  </svg>
);
const ClockIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);
const MailIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);
const PhoneIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6.13 6.13l.91-.91a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);
const CheckIcon = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const ChevronDownIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
const GlobeIcon  = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" />
  </svg>
);
const GrowthIcon = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
  </svg>
);
const UsersIcon  = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const HeartIcon  = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

// ── Data ──────────────────────────────────────────────────────────────────────

const OPENINGS = [
  {
    id: 1,
    title: "Sales Executive",
    department: "Sales",
    type: "Full-time",
    location: "Shimla, HP",
    experience: "1–3 Years",
    badge: "Urgent Hiring",
    badgeStyle: { background: BRAND_LIGHT, color: "#DC2626", border: `1px solid ${BRAND_BORDER}` },
    description: "Drive revenue by converting inbound leads into confirmed bookings. You'll engage with prospective travellers across phone, WhatsApp, and email — understanding their requirements and presenting the right packages with confidence.",
    responsibilities: [
      "Handle inbound enquiries and follow up on leads from Google Ads and organic channels",
      "Understand customer travel requirements and recommend suitable packages",
      "Achieve monthly booking and revenue targets",
      "Maintain accurate lead records in the CRM",
      "Coordinate with the operations team post-confirmation",
    ],
    requirements: [
      "1–3 years of sales experience (travel industry preferred)",
      "Strong verbal communication in Hindi and English",
      "Comfort working with CRM tools and WhatsApp Business",
      "Target-driven with a customer-first mindset",
    ],
  },
  {
    id: 2,
    title: "Travel Expert",
    department: "Product",
    type: "Full-time",
    location: "Shimla, HP",
    experience: "2–4 Years",
    badge: "Open",
    badgeStyle: { background: "#F0FDF4", color: "#15803D", border: "1px solid #BBF7D0" },
    description: "Craft memorable travel experiences by designing detailed, accurate, and competitive tour packages. You are the backbone of our product — your itinerary knowledge directly impacts what we sell and how customers experience their journeys.",
    responsibilities: [
      "Research and build itineraries for HP, Kashmir, Rajasthan, Goa, and international destinations",
      "Source, negotiate, and manage hotel, transport, and activity vendor relationships",
      "Price packages competitively while maintaining healthy margins",
      "Ensure all itinerary documentation is accurate and up-to-date",
      "Support the sales team with destination knowledge during customer calls",
    ],
    requirements: [
      "2–4 years in travel operations or tour planning",
      "Strong knowledge of domestic destinations (HP, Kashmir, Rajasthan mandatory)",
      "Vendor negotiation and costing experience",
      "Detail-oriented with excellent written communication",
    ],
  },
  {
    id: 3,
    title: "Business Development Manager",
    department: "Growth",
    type: "Full-time",
    location: "Shimla / Remote",
    experience: "4–7 Years",
    badge: "Senior Role",
    badgeStyle: { background: "#EEF2FF", color: "#4338CA", border: "1px solid #C7D2FE" },
    description: "Own our B2B and partnership growth strategy. You will identify and close partnerships with corporates, schools, travel agents, and international inbound operators — expanding our distribution beyond direct consumer channels.",
    responsibilities: [
      "Identify and develop B2B partnerships with corporates, educational institutions, and travel agents",
      "Build and manage a pipeline of channel partners across North India",
      "Lead outreach for international inbound tourism from UK, USA, Australia, and GCC markets",
      "Negotiate and finalise partnership agreements",
      "Represent Dreams Yatri at travel trade fairs and networking events",
    ],
    requirements: [
      "4–7 years in business development, preferably in travel or hospitality",
      "Proven B2B sales track record with a strong professional network",
      "Excellent presentation and negotiation skills",
      "Willingness to travel for client meetings and trade events",
    ],
  },
  {
    id: 4,
    title: "Operations Manager",
    department: "Operations",
    type: "Full-time",
    location: "Shimla, HP",
    experience: "3–6 Years",
    badge: "Open",
    badgeStyle: { background: "#F0FDF4", color: "#15803D", border: "1px solid #BBF7D0" },
    description: "Own the end-to-end execution of confirmed tours — from vendor coordination to on-trip customer support. You ensure every traveller experience matches what was promised at the point of sale, protecting our brand and reputation.",
    responsibilities: [
      "Coordinate with hotels, transporters, and guides to ensure seamless tour execution",
      "Manage last-minute changes, cancellations, and on-trip escalations",
      "Oversee documentation: vouchers, confirmations, and travel kits",
      "Monitor vendor quality and address service failures proactively",
      "Build and maintain relationships with key vendors across all active destinations",
    ],
    requirements: [
      "3–6 years in travel operations or tour management",
      "Strong vendor network in Himachal Pradesh preferred",
      "Calm under pressure with exceptional problem-solving skills",
      "Proficient in MS Office; experience with booking systems is a plus",
    ],
  },
];

const PERKS = [
  { icon: <GlobeIcon />,  title: "FAM Trips",          desc: "Explore destinations firsthand on company-sponsored familiarisation tours." },
  { icon: <GrowthIcon />, title: "Fast Growth",         desc: "Early-stage company — your impact is visible, and promotions are merit-based." },
  { icon: <UsersIcon />,  title: "Collaborative Team",  desc: "Small, focused team where every person's work directly shapes company outcomes." },
  { icon: <HeartIcon />,  title: "Travel Perks",        desc: "Exclusive discounts on personal travel bookings for you and your family." },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CareersPage() {
  const [expanded, setExpanded] = useState<number | null>(null);
  const toggle = (id: number) => setExpanded((p) => (p === id ? null : id));
  const mailSubject = (t: string) => encodeURIComponent(`Application for ${t} — Dreams Yatri`);

  // shared section heading
  const SectionLabel = ({ label, title }: { label: string; title: string }) => (
    <div style={{ textAlign: "center", marginBottom: "36px" }}>
      <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: BRAND, margin: "0 0 8px" }}>{label}</p>
      <h2 style={{ fontSize: "clamp(1.4rem, 3vw, 1.9rem)", fontWeight: 700, color: DARK, margin: 0 }}>{title}</h2>
    </div>
  );

  return (
    <div style={{ background: "#ffffff", minHeight: "100vh", fontFamily: "'Inter','Segoe UI',sans-serif", color: DARK }}>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <div style={{ background: DARK, paddingTop: "88px", paddingBottom: "96px", position: "relative", overflow: "hidden" }}>

        {/* Red glow */}
        <div style={{ position: "absolute", top: "-100px", right: "-100px", width: "450px", height: "450px", borderRadius: "50%", background: "rgba(239,68,68,0.1)", filter: "blur(90px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-60px", left: "-60px", width: "300px", height: "300px", borderRadius: "50%", background: "rgba(239,68,68,0.06)", filter: "blur(60px)", pointerEvents: "none" }} />

        {/* Mountains + flight path */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.045 }} viewBox="0 0 1200 420" preserveAspectRatio="xMidYMid slice">
          <path d="M0 420 L80 280 L160 340 L260 200 L360 300 L440 160 L540 280 L600 220 L680 300 L760 180 L860 280 L940 200 L1040 300 L1120 240 L1200 320 L1200 420Z" fill="white" />
          <path d="M0 420 L100 320 L200 380 L300 260 L400 340 L480 240 L560 320 L640 280 L720 360 L820 260 L920 340 L1020 280 L1100 360 L1200 300 L1200 420Z" fill="white" opacity="0.5" />
          <path d="M60 360 Q300 100 600 175 Q900 250 1140 75" stroke="white" strokeWidth="2" fill="none" strokeDasharray="10 8" />
          <circle cx="1140" cy="75" r="5" fill="white" />
        </svg>

        <div style={{ maxWidth: "1152px", margin: "0 auto", padding: "0 24px", textAlign: "center", position: "relative", zIndex: 1 }}>

          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "5px 16px", borderRadius: "100px", marginBottom: "24px", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#FCA5A5", fontSize: "11px", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" }}>
            <PlaneIcon size={13} />
            We're Hiring
          </div>

          <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)", fontWeight: 800, color: "#ffffff", lineHeight: 1.15, margin: "0 0 20px" }}>
            Build Careers That{" "}
            <span style={{ color: BRAND }}>Go Places</span>
          </h1>

          <p style={{ maxWidth: "520px", margin: "0 auto 40px", color: "rgba(255,255,255,0.55)", fontSize: "clamp(0.95rem, 2vw, 1.1rem)", lineHeight: 1.75 }}>
            Join a fast-growing travel company headquartered in Shimla. We craft journeys for thousands of travellers — and we need passionate people to help us scale.
          </p>

          <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "40px" }}>
            {[{ v: "4", l: "Open Positions" }, { v: "50+", l: "Destinations" }, { v: "10K+", l: "Happy Travellers" }].map((s, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <p style={{ fontSize: "1.8rem", fontWeight: 800, color: "#fff", margin: 0 }}>{s.v}</p>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", margin: "4px 0 0" }}>{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Wave — dark to white */}
      <svg style={{ display: "block", marginTop: "-1px", background: "#ffffff" }} viewBox="0 0 1200 56" preserveAspectRatio="none" height="56" width="100%">
        <path d="M0 0 Q300 56 600 28 Q900 0 1200 38 L1200 0 Z" fill={DARK} />
      </svg>

      {/* ── CONTENT ──────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: "1152px", margin: "0 auto", padding: "0 24px 80px" }}>

        {/* PERKS */}
        <section style={{ paddingTop: "52px", paddingBottom: "52px" }}>
          <SectionLabel label="Life at Dreams Yatri" title="Why Work With Us" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "14px" }}>
            {PERKS.map((p, i) => (
              <div key={i} style={{ background: "#ffffff", borderRadius: "16px", border: `1px solid ${BORDER}`, padding: "28px 22px", textAlign: "center" }}>
                <div style={{ width: "52px", height: "52px", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", background: BRAND_LIGHT, color: BRAND }}>
                  {p.icon}
                </div>
                <p style={{ fontWeight: 700, fontSize: "14px", color: DARK, margin: "0 0 6px" }}>{p.title}</p>
                <p style={{ fontSize: "13px", color: GRAY, lineHeight: 1.65, margin: 0 }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* OPENINGS */}
        <section style={{ marginBottom: "52px" }}>
          <SectionLabel label="Current Openings" title="Find Your Role" />
          <p style={{ textAlign: "center", fontSize: "14px", color: GRAY, marginTop: "-20px", marginBottom: "32px" }}>
            To apply, email your CV to{" "}
            <a href="mailto:hr@dreamsyatri.com" style={{ color: BRAND, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: "3px" }}>
              hr@dreamsyatri.com
            </a>
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {OPENINGS.map((job) => {
              const open = expanded === job.id;
              return (
                <div className="bg-gray-100" key={job.id} style={{ borderRadius: "16px", border: open ? `1.5px solid ${BRAND_BORDER}` : `1px solid ${BORDER}`, overflow: "hidden", transition: "border-color 0.2s" }}>

                  {/* Header row */}
                  <button
                    type="button"
                    onClick={() => toggle(job.id)}
                    style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: "20px 22px", cursor: "pointer", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "7px", marginBottom: "10px" }}>
                        <span style={{ ...job.badgeStyle, fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "100px" }}>{job.badge}</span>
                        <span style={{ fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "100px", background: GRAY_LIGHT, color: GRAY, border: `1px solid ${BORDER}` }}>{job.department}</span>
                      </div>
                      <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: DARK, margin: "0 0 10px", lineHeight: 1.3 }}>{job.title}</h3>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "14px" }}>
                        {[{ icon: <MapPinIcon />, t: job.location }, { icon: <BriefcaseIcon />, t: job.type }, { icon: <ClockIcon />, t: job.experience }].map((m, i) => (
                          <span key={i} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: GRAY }}>
                            <span style={{ color: "#9CA3AF" }}>{m.icon}</span>{m.t}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Chevron toggle */}
                    <span style={{ flexShrink: 0, width: "30px", height: "30px", borderRadius: "8px", border: `1px solid ${open ? BRAND_BORDER : BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", color: open ? BRAND : GRAY, background: open ? BRAND_LIGHT : "#ffffff", transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s, background 0.2s", marginTop: "2px" }}>
                      <ChevronDownIcon />
                    </span>
                  </button>

                  {/* Expanded body */}
                  {open && (
                    <div style={{ padding: "0 22px 26px", borderTop: `1px solid ${BORDER}` }}>
                      <p style={{ fontSize: "14px", color: GRAY, lineHeight: 1.75, margin: "18px 0 22px" }}>{job.description}</p>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginBottom: "24px" }}>
                        {/* Responsibilities */}
                        <div style={{ background: GRAY_LIGHT, borderRadius: "12px", padding: "18px" }}>
                          <p style={{ fontSize: "13px", fontWeight: 700, color: DARK, margin: "0 0 12px" }}>What You'll Do</p>
                          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "9px" }}>
                            {job.responsibilities.map((r, i) => (
                              <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "9px", fontSize: "13px", color: GRAY, lineHeight: 1.6 }}>
                                <span style={{ width: "17px", height: "17px", borderRadius: "50%", background: BRAND, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "2px" }}>
                                  <CheckIcon />
                                </span>
                                {r}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Requirements */}
                        <div style={{ background: GRAY_LIGHT, borderRadius: "12px", padding: "18px" }}>
                          <p style={{ fontSize: "13px", fontWeight: 700, color: DARK, margin: "0 0 12px" }}>What We're Looking For</p>
                          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "9px" }}>
                            {job.requirements.map((r, i) => (
                              <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "9px", fontSize: "13px", color: GRAY, lineHeight: 1.6 }}>
                                <span style={{ width: "17px", height: "17px", borderRadius: "50%", border: `2px solid ${BRAND}`, flexShrink: 0, marginTop: "2px" }} />
                                {r}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Apply row */}
                      <div style={{ paddingTop: "18px", borderTop: `1px solid ${BORDER}`, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
                        <a
                          href={`mailto:hr@dreamsyatri.com?subject=${mailSubject(job.title)}`}
                          style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 22px", borderRadius: "10px", background: BRAND, color: "#ffffff", fontSize: "13px", fontWeight: 700, textDecoration: "none", boxShadow: "0 2px 10px rgba(239,68,68,0.28)" }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
                          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                        >
                          <MailIcon size={14} />
                          Apply via Email
                        </a>
                        <p style={{ fontSize: "12px", color: GRAY, margin: 0 }}>
                          Send CV to <strong style={{ color: DARK }}>hr@dreamsyatri.com</strong> — subject: <em>"{job.title} — Dreams Yatri"</em>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* CONTACT HR */}
        <section className="bg-gray-100" style={{borderRadius: "20px", border: `1px solid ${BORDER}`, padding: "clamp(28px,4vw,44px)", marginBottom: "14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "28px", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: BRAND, margin: "0 0 8px" }}>Have Questions?</p>
              <h3 style={{ fontSize: "clamp(1.2rem, 2.5vw, 1.55rem)", fontWeight: 700, color: DARK, margin: "0 0 10px" }}>Talk to Our HR Team</h3>
              <p style={{ fontSize: "14px", color: GRAY, lineHeight: 1.7, margin: 0 }}>Not sure which role fits you, or want to know more before applying? Reach out — we're happy to help.</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { href: "mailto:hr@dreamsyatri.com", icon: <MailIcon />, label: "Email HR", value: "hr@dreamsyatri.com" },
                { href: "tel:+917023907023",         icon: <PhoneIcon />, label: "Call Us",  value: "+91 70239 07023" },
                { href: "tel:+917023907099",         icon: <PhoneIcon />, label: "Alternate", value: "+91 70239 07099" },
              ].map((item, i) => (
                <a key={i} href={item.href}
                className="bg-white"
                  style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", borderRadius: "12px", border: `1px solid ${BORDER}`, textDecoration: "none", transition: "border-color 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = BRAND_BORDER)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}
                >
                  <span style={{ width: "36px", height: "36px", borderRadius: "10px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: BRAND_LIGHT, color: BRAND }}>{item.icon}</span>
                  <div>
                    <p style={{ fontSize: "11px", color: GRAY, margin: "0 0 2px" }}>{item.label}</p>
                    <p style={{ fontSize: "14px", fontWeight: 600, color: DARK, margin: 0 }}>{item.value}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}