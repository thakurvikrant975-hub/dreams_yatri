"use client";

import { useState, ChangeEvent, FormEvent } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailFormState {
  name: string;
  phone: string;
  email: string;
}

interface FormStatus {
  type: "idle" | "loading" | "success" | "error";
  message: string;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function EmailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 6l-10 7L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Background Pattern ───────────────────────────────────────────────────────

function TravelPattern({ color = "rgba(0,0,0,0.045)" }: { color?: string }) {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <pattern id="travel-pattern" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
          {/* Airplane */}
          <text x="8" y="22" fontSize="18" fill={color} transform="rotate(-30 18 18)">✈</text>
          {/* Location pin */}
          <text x="48" y="52" fontSize="14" fill={color}>📍</text>
          {/* Star / snowflake */}
          <text x="28" y="68" fontSize="12" fill={color}>✳</text>
          {/* Map */}
          <text x="60" y="20" fontSize="13" fill={color}>🗺</text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#travel-pattern)" />
    </svg>
  );
}

// ─── Email Subscription Card ──────────────────────────────────────────────────

function EmailCard() {
  const [form, setForm] = useState<EmailFormState>({ name: "", phone: "", email: "" });
  const [status, setStatus] = useState<FormStatus>({ type: "idle", message: "" });

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;

    setStatus({ type: "loading", message: "" });

    // Replace with your actual API call
    await new Promise((res) => setTimeout(res, 1000));
    setStatus({ type: "success", message: "You're subscribed! Watch your inbox for exclusive deals." });
    setForm({ name: "", phone: "", email: "" });
  };

  return (
    <div className="relative rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm">
      {/* Top accent bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-rose-400 to-red-500" />

      {/* Background pattern */}
      <TravelPattern color="rgba(239,68,68,0.06)" />

      {/* Content */}
      <div className="relative px-6 pt-6 pb-8">
        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-500 text-xs font-semibold mb-5">
          <EmailIcon />
          Email Alerts
        </div>

        <h3 className="text-xl font-extrabold text-slate-900 mb-1.5">
          Get Exclusive Deals in Your Inbox
        </h3>
        <p className="text-slate-500 text-sm mb-6 max-w-lg">
          Flash sales, seasonal packages, and early-bird offers — delivered before they sell out. No spam. Unsubscribe anytime.
        </p>

        {status.type === "success" ? (
          <div className="flex items-center gap-2 text-emerald-600 font-medium text-sm bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-xl">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {status.message}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Row 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Your Name</label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="eg. Rahul Sharma"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all bg-white"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Phone (Optional)</label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="eg. 9812345678"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all bg-white"
                />
              </div>
            </div>

            {/* Row 2 — email + submit */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Email Address</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="eg. rahul@gmail.com"
                  required
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all bg-white"
                />
                <button
                  type="submit"
                  disabled={status.type === "loading"}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 text-white text-sm font-semibold shadow-md shadow-rose-200 hover:shadow-rose-300 hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {status.type === "loading" ? (
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : (
                    <>Subscribe <ArrowRightIcon /></>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── WhatsApp Card ────────────────────────────────────────────────────────────

const WHATSAPP_LINK = "https://chat.whatsapp.com/your-group-link"; // ← replace

function WhatsAppCard() {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm">
      {/* Top accent bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-green-400 to-emerald-500" />

      {/* Background pattern */}
      <TravelPattern color="rgba(34,197,94,0.07)" />

      {/* Content */}
      <div className="relative px-6 pt-6 pb-8">
        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 border border-green-200 text-green-600 text-xs font-semibold mb-5">
          <WhatsAppIcon size={14} />
          WhatsApp Alerts
        </div>

        <h3 className="text-xl font-extrabold text-slate-900 mb-1.5">
          Join Our WhatsApp Deal Community
        </h3>
        <p className="text-slate-500 text-sm mb-6 max-w-lg">
          Instant deal alerts, last-minute offers, and personalized trip suggestions — straight to your WhatsApp.{" "}
          <span className="font-semibold text-slate-700">6,800+ travelers</span> already inside.
        </p>

        <a
          href={WHATSAPP_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-semibold shadow-md shadow-green-200 hover:shadow-green-300 hover:-translate-y-0.5 active:scale-95 transition-all"
        >
          <WhatsAppIcon size={18} />
          Join WhatsApp Community
        </a>
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function NewsletterSection() {
  return (
    <section className="py-16 lg:py-20 bg-slate-50">
      <div className="max-w-5xl mx-auto px-6 lg:px-10 flex flex-col gap-6">
        <EmailCard />
        <WhatsAppCard />
      </div>
    </section>
  );
}