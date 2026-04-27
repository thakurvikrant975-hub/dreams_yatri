"use client";

import { useState, useTransition } from "react";
import { COUNTRY_CODES, type CountryCode } from "@/app/lib/assets/country-codes";
import { submitContactForm, type ContactActionResult } from "./action";
import Hero from "../components/Hero";
import { useContact } from "@/app/context/Global";


// ── Inline SVG Icons (no external dep) ───────────────────────────────────────

const PlaneIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19 4c-1 0-1.5.5-3.5 2.5L11 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
  </svg>
);

const PhoneIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6.13 6.13l.91-.91a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const MailIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const MapPinIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const ClockIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);

const CheckCircleIcon = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="9 12 11 14 15 10" />
  </svg>
);

const XCircleIcon = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

const ChevronDownIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const GlobeIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" />
  </svg>
);

const CheckIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const SendIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
  </svg>
);

// ── Phone length rules per country ────────────────────────────────────────────

const PHONE_LENGTH: Record<string, number> = {
  IN: 10, US: 10, GB: 10, AE: 9, AU: 9, CA: 10,
  DE: 11, FR: 9, SG: 8, JP: 10, NZ: 9, NL: 9,
  IT: 10, ES: 9, CH: 9, SE: 9, NO: 8, DK: 8,
  MY: 9, TH: 9, PH: 10, BD: 10, PK: 10, LK: 9,
  NP: 10, BH: 8, SA: 9, QA: 8, KW: 8, OM: 8,
  ZA: 9,
};

// ── Form State ────────────────────────────────────────────────────────────────

type FormState = {
  name: string;
  email: string;
  countryCode: string;
  phone: string;
  message: string;
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

const DEFAULT_COUNTRY = COUNTRY_CODES[0]; // India

// ── Component ─────────────────────────────────────────────────────────────────

export default function ContactPage() {
  const [isPending, startTransition] = useTransition();
  const contact = useContact();


  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    countryCode: DEFAULT_COUNTRY.code,
    phone: "",
    message: "",
  });

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [result, setResult] = useState<ContactActionResult | null>(null);

  const selectedCountry: CountryCode =
    COUNTRY_CODES.find((c) => c.code === form.countryCode) ?? DEFAULT_COUNTRY;

  const maxPhoneLength = PHONE_LENGTH[form.countryCode] ?? 15;

  // ── Handlers ────────────────────────────────────────────────────────────────

  const set = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const value = field === "phone"
      ? e.target.value.replace(/\D/g, "").slice(0, maxPhoneLength)
      : e.target.value;

    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    // Reset server result on edit
    if (result) setResult(null);
  };

  const clientValidate = (): FieldErrors => {
    const e: FieldErrors = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = "Name must be at least 2 characters.";
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) e.email = "Enter a valid email address.";
    if (!form.phone) {
      e.phone = "Phone number is required.";
    } else if (form.phone.length < (PHONE_LENGTH[form.countryCode] ?? 5)) {
      e.phone = `Enter a valid ${maxPhoneLength}-digit number.`;
    }
    if (!form.message.trim() || form.message.trim().length < 10) e.message = "Message must be at least 10 characters.";
    return e;
  };

  const handleSubmit = () => {
    const errors = clientValidate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    startTransition(async () => {
      const res = await submitContactForm({
        name: form.name,
        email: form.email,
        countryCode: form.countryCode,
        dialCode: selectedCountry.dial,
        phone: form.phone,
        message: form.message,
      });
      setResult(res);

      if (res.success) {
        setForm({ name: "", email: "", countryCode: DEFAULT_COUNTRY.code, phone: "", message: "" });
        setFieldErrors({});
      } else if (res.errors) {
        // Map server field errors → local state
        const mapped: FieldErrors = {};
        for (const [key, msgs] of Object.entries(res.errors)) {
          mapped[key as keyof FormState] = msgs[0];
        }
        setFieldErrors(mapped);
      }
    });
  };

  // ── Reusable field error display ─────────────────────────────────────────────

  const FieldError = ({ field }: { field: keyof FormState }) =>
    fieldErrors[field] ? (
      <p className="text-error mt-1 text-xs">{fieldErrors[field]}</p>
    ) : null;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div data-layout="website" className="bg-page">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      {/* Flush with header: no top padding, negative margin to override any parent gap */}
      <Hero>


        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-6 text-xs font-semibold tracking-widest uppercase bg-amber-500/15 border-amber-500/35 text-amber-500"
          >
            <PlaneIcon size={14} />
            Get In Touch
          </div>


          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(2.2rem, 5.5vw, 3.8rem)", fontWeight: 800, color: "#fff", lineHeight: 1.1, margin: "0 0 16px", animation: "hero-rise 0.55s ease 0.08s both" }}>
              Let's Plan Your{" "}
              <span style={{ color: "#EF4444", fontStyle: "italic" }}>Dream Journey</span>
            </h1>

            <p className="text-gray-400 leading-relaxed mb-8"
              style={{ fontSize: "clamp(0.95rem, 1.8vw, 1.05rem)", animation: "hero-rise 0.55s ease 0.16s both" }}>
              Whether it’s a quick weekend escape or an unforgettable cross-continent adventure, our travel experts take care of everything. From designing personalized itineraries to securing the best prices and handling every booking detail, we ensure your journey is smooth, stress-free, and perfectly tailored to your preferences from start to finish.
            </p>

   

          <div className="flex flex-wrap justify-center gap-6">
            {[
              { icon: <GlobeIcon />, text: "50+ Destinations" },
              { icon: <ClockIcon />, text: "24/7 Support" },
              { icon: <CheckIcon />, text: "Trusted by 10,000+" },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm font-medium text-white/75"
              >
                <span className="text-amber-400">
                  {item.icon}
                </span>
                {item.text}
              </div>
            ))}
          </div>
        </div>
      </Hero>



      {/* ── BODY ─────────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">

        {/* Team Cards */}
        <div className="text-center mb-10 pt-10">
          <p className="text-xs font-bold tracking-widest uppercase text-brand mb-2">Reach Our Teams</p>
          <h2 className="text-primary font-bold" style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)" }}>
            Talk to the Right Person
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-12">
          {/* Sales */}
          <div className="bg-surface rounded-2xl p-7 border border-default relative overflow-hidden">
            <div className="absolute top-0 right-0 w-28 h-28 rounded-bl-full" style={{ background: "rgba(245,166,35,0.06)" }} />
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 text-white" style={{ background: "linear-gradient(135deg,#F5A623,#d4870e)" }}>
              <PlaneIcon size={22} />
            </div>
            <p className="text-xs font-bold tracking-widest uppercase mb-1 text-brand">Sales Team</p>
            <h3 className="text-primary font-bold text-lg mb-2">Book Your Trip</h3>
            <p className="text-secondary text-sm leading-relaxed mb-5">
              Planning a vacation? Our sales team will curate personalised packages, pricing, and itineraries for you.
            </p>
            <div className="flex flex-col gap-3">
              <a href={contact.sales.phoneUrl} className="flex items-center gap-3 text-primary text-sm font-semibold hover:text-brand transition-colors no-underline">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center text-brand flex-shrink-0" style={{ background: "rgba(245,166,35,0.12)" }}>
                  <PhoneIcon />
                </span>
                {contact.sales.phone}
              </a>
              <a href={contact.sales.emailUrl} className="flex items-center gap-3 text-primary text-sm font-semibold hover:text-brand transition-colors no-underline">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center text-brand flex-shrink-0" style={{ background: "rgba(245,166,35,0.12)" }}>
                  <MailIcon />
                </span>
                {contact.sales.email}
              </a>
            </div>
            <div className="flex items-center gap-2 text-muted text-xs mt-5 pt-5 border-t border-default">
              <ClockIcon /> Mon – Sat, 9 AM – 7 PM IST
            </div>
          </div>

          {/* Support */}
          <div className="bg-surface rounded-2xl p-7 border border-default relative overflow-hidden">
            <div className="absolute top-0 right-0 w-28 h-28 rounded-bl-full" style={{ background: "rgba(var(--bg-surface-inverse-rgb, 26,26,46),0.04)" }} />
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 text-white bg-surface-inverse">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
              </svg>
            </div>
            <p className="text-xs font-bold tracking-widest uppercase mb-1 text-secondary">Support Team</p>
            <h3 className="text-primary font-bold text-lg mb-2">Need Help?</h3>
            <p className="text-secondary text-sm leading-relaxed mb-5">
              Already booked with us? Our support team handles changes, cancellations, and on-trip assistance 24/7.
            </p>
            <div className="flex flex-col gap-3">
              <a href={contact.support.phoneUrl} className="flex items-center gap-3 text-primary text-sm font-semibold hover:text-brand transition-colors no-underline">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(245,166,35,0.1)", color: "#F5A623" }}>
                  <PhoneIcon />
                </span>
                {contact.support.phone}
              </a>
              <a href={contact.support.emailUrl} className="flex items-center gap-3 text-primary text-sm font-semibold hover:text-brand transition-colors no-underline">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(245,166,35,0.1)", color: "#F5A623" }}>
                  <MailIcon />
                </span>
                {contact.support.email}
              </a>
            </div>
            <div className="flex items-center gap-2 text-muted text-xs mt-5 pt-5 border-t border-default">
              <ClockIcon /> 24/7 Emergency Assistance
            </div>
          </div>
        </div>

        {/* Form + Info Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">

          {/* ── Contact Form ─────────────────────────────────────────────── */}
          <div className="bg-surface rounded-2xl border border-default p-7 sm:p-9 h-fit">
            <p className="text-xs font-bold tracking-widest uppercase text-brand mb-1">Send a Message</p>
            <h2 className="text-primary font-bold mb-1" style={{ fontSize: "1.6rem" }}>Start Your Adventure</h2>
            <p className="text-secondary text-sm mb-7">Tell us where you want to go — we'll handle the rest.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

              {/* Name */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-primary mb-1.5">
                  Your Name <span className="text-brand">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={form.name}
                  onChange={set("name")}
                  className={`w-full px-4 py-2.5 rounded-xl text-sm text-primary bg-page border transition-colors outline-none focus:ring-2 ring-focus placeholder-color ${fieldErrors.name ? "border-error" : "border-default focus:border-focus"}`}
                />
                <FieldError field="name" />
              </div>

              {/* Email */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-primary mb-1.5">
                  Email Address
                  <span className="text-muted font-normal ml-1">(optional)</span>
                </label>
                <input
                  type="email"
                  placeholder="rahul@example.com"
                  value={form.email}
                  onChange={set("email")}
                  className={`w-full px-4 py-2.5 rounded-xl text-sm text-primary bg-page border transition-colors outline-none focus:ring-2 ring-focus placeholder-color ${fieldErrors.email ? "border-error" : "border-default focus:border-focus"}`}
                />
                <FieldError field="email" />
              </div>

              {/* Phone — country code + number */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-primary mb-1.5">
                  Phone Number <span className="text-brand">*</span>
                </label>
                <div className="flex gap-2">
                  {/* Country code select */}
                  <div className="relative flex-shrink-0" style={{ minWidth: "120px" }}>
                    <select
                      value={form.countryCode}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, countryCode: e.target.value, phone: "" }));
                        if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                      }}
                      className="w-full h-full appearance-none px-3 pr-8 py-2.5 rounded-xl text-sm font-medium text-primary bg-page border border-default focus:border-focus focus:ring-2 ring-focus outline-none cursor-pointer transition-colors"
                    >
                      {COUNTRY_CODES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.dial}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted">
                      <ChevronDownIcon />
                    </span>
                  </div>

                  {/* Phone number input */}
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder={`Enter ${maxPhoneLength}-digit number`}
                    value={form.phone}
                    onChange={set("phone")}
                    maxLength={maxPhoneLength}
                    className={`flex-1 px-4 py-2.5 rounded-xl text-sm text-primary bg-page border transition-colors outline-none focus:ring-2 ring-focus placeholder-color ${fieldErrors.phone ? "border-error" : "border-default focus:border-focus"}`}
                  />
                </div>
                <FieldError field="phone" />
              </div>

              {/* Message */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-primary mb-1.5">
                  Your Message <span className="text-brand">*</span>
                </label>
                <textarea
                  placeholder="Tell us your dream destination, travel dates, group size, budget..."
                  value={form.message}
                  onChange={set("message")}
                  rows={12}
                  className={`w-full px-4 py-2.5 rounded-xl text-sm text-primary bg-page border transition-colors outline-none focus:ring-2 ring-focus placeholder-color resize-y ${fieldErrors.message ? "border-error" : "border-default focus:border-focus"}`}
                />
                <FieldError field="message" />
              </div>

            </div>

            {/* Submit button */}
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                disabled={isPending}
                onClick={handleSubmit}
                className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all
disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed
${isPending
                    ? "bg-red-400"
                    : "bg-gradient-to-br from-red-500 to-red-600 shadow-[0_4px_16px_rgba(239,68,68,0.35)] hover:from-red-600 hover:to-red-700"
                  }`}
              >
                {isPending ? (
                  <>
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    Sending...
                  </>
                ) : (
                  <>
                    <SendIcon />
                    Send My Enquiry
                  </>
                )}
              </button>
            </div>

            {/* ── Success / Failure banner below button ─────────────────── */}
            {result && (
              <div className={`mt-5 flex items-start gap-3 rounded-xl px-4 py-3 border text-sm ${result.success ? "bg-success-subtle border-success text-success" : "bg-error-subtle border-error text-error"}`}>
                <span className="flex-shrink-0 mt-0.5">
                  {result.success ? <CheckCircleIcon size={18} /> : <XCircleIcon size={18} />}
                </span>
                <div>
                  <p className="font-semibold">{result.success ? "Message Sent!" : "Submission Failed"}</p>
                  <p className="mt-0.5 opacity-90">{result.message}</p>
                  {!result.success && (
                    <button
                      type="button"
                      onClick={() => setResult(null)}
                      className="mt-1.5 text-xs underline underline-offset-2 opacity-75 hover:opacity-100"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Right Column ─────────────────────────────────────────────── */}
          <div className="flex flex-col gap-5">

            {/* Office Info */}
            <div className="bg-surface rounded-2xl border border-default p-6">
              <p className="text-xs font-bold tracking-widest uppercase text-brand mb-1">Our Office</p>
              <h3 className="text-primary font-bold text-lg mb-5">Visit Us In Person</h3>

              <div className="flex gap-3 mb-4">
                <span className="w-9 h-9 rounded-lg flex items-center justify-center text-brand flex-shrink-0" style={{ background: "rgba(245,166,35,0.1)" }}>
                  <MapPinIcon />
                </span>
                <div>
                  <p className="text-sm font-semibold text-primary mb-0.5">Dreams Yatri (OPC) Private Limited</p>
                  <p className="text-secondary text-sm leading-relaxed">Shimla, Himachal Pradesh – 171001<br />India</p>
                </div>
              </div>

              <div className="flex gap-3">
                <span className="w-9 h-9 rounded-lg flex items-center justify-center text-brand flex-shrink-0" style={{ background: "rgba(245,166,35,0.1)" }}>
                  <ClockIcon />
                </span>
                <div>
                  <p className="text-sm font-semibold text-primary mb-0.5">Office Hours</p>
                  <p className="text-secondary text-sm leading-relaxed">Mon – Sat: 9:00 AM – 7:00 PM<br />Sunday: By Appointment</p>
                </div>
              </div>
            </div>

            {/* Map */}
            <div className="bg-surface rounded-2xl border border-default overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-4 border-b border-default">
                <span className="text-brand"><MapPinIcon /></span>
                <div>
                  <p className="text-sm font-bold text-primary leading-tight">Dreams Yatri Office</p>
                  <p className="text-xs text-muted">Shimla, Himachal Pradesh</p>
                </div>
              </div>
              <iframe
                title="Dreams Yatri Location"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d55196.5!2d77.1734!3d31.1048!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39057831c99d5555%3A0x85bc3d3bcbe63af0!2sShimla%2C%20Himachal%20Pradesh!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin"
                width="100%"
                height="220"
                style={{ border: 0, display: "block" }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>

            {/* Why Us */}
            <div className="bg-surface-inverse rounded-2xl p-6 text-white">
              <p className="text-xs font-bold tracking-widest uppercase mb-1 text-red-500">
                Why Dreams Yatri
              </p>

              <h3 className="font-bold text-base mb-4 text-inverse">
                Your Journey, Our Expertise
              </h3>

              <div className="flex flex-col gap-3">
                {[
                  "Customised itineraries for every budget",
                  "Himalayan, heritage & international specialists",
                  "On-ground support across all destinations",
                  "Transparent pricing, no hidden charges",
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 text-sm text-white/80"
                  >
                    <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-white bg-red-500">
                      <CheckIcon />
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>


    </div>
  );
}