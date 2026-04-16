"use client";

import { useState, useEffect } from "react";
import {
  EnvelopeSimple,
  Lock,
  Eye,
  EyeSlash,
  ArrowRight,
  AirplaneTilt,
} from "@phosphor-icons/react";

const quotes = [
  {
    text: "The world is a book, and those who do not travel read only one page.",
    author: "Saint Augustine",
  },
  {
    text: "To travel is to live.",
    author: "Hans Christian Andersen",
  },
  {
    text: "A journey of a thousand miles begins with a single step.",
    author: "Lao Tzu",
  },
  {
    text: "Not all those who wander are lost.",
    author: "J.R.R. Tolkien",
  },
  {
    text: "Travel is the only thing you buy that makes you richer.",
    author: "Anonymous",
  },
  {
    text: "We travel not to escape life, but for life not to escape us.",
    author: "Anonymous",
  },
];

// Hot Air Balloon SVG Component
function HotAirBalloon({
  color1,
  color2,
  color3,
  size = 80,
  style,
}: {
  color1: string;
  color2: string;
  color3: string;
  size?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size * 1.4}
      viewBox="0 0 80 112"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      {/* Balloon body */}
      <ellipse cx="40" cy="40" rx="36" ry="38" fill={color1} opacity="0.9" />
      {/* Stripe 1 */}
      <path
        d="M40 2 Q60 20 60 40 Q60 60 40 78 Q20 60 20 40 Q20 20 40 2Z"
        fill={color2}
        opacity="0.6"
      />
      {/* Stripe 2 */}
      <path
        d="M40 2 Q30 20 28 40 Q30 60 40 78 Q50 60 52 40 Q50 20 40 2Z"
        fill={color3}
        opacity="0.5"
      />
      {/* Highlight */}
      <ellipse cx="28" cy="22" rx="8" ry="10" fill="white" opacity="0.28" />
      {/* Basket ropes */}
      <line x1="28" y1="76" x2="24" y2="94" stroke="#78350f" strokeWidth="1.5" />
      <line x1="52" y1="76" x2="56" y2="94" stroke="#78350f" strokeWidth="1.5" />
      <line x1="36" y1="78" x2="30" y2="94" stroke="#78350f" strokeWidth="1.5" />
      <line x1="44" y1="78" x2="50" y2="94" stroke="#78350f" strokeWidth="1.5" />
      {/* Basket */}
      <rect x="22" y="94" width="36" height="16" rx="3" fill="#78350f" />
      <rect x="24" y="96" width="32" height="12" rx="2" fill="#92400e" />
      {/* Basket weave lines */}
      <line x1="32" y1="96" x2="32" y2="108" stroke="#78350f" strokeWidth="1" />
      <line x1="40" y1="96" x2="40" y2="108" stroke="#78350f" strokeWidth="1" />
      <line x1="48" y1="96" x2="48" y2="108" stroke="#78350f" strokeWidth="1" />
      <line x1="24" y1="102" x2="56" y2="102" stroke="#78350f" strokeWidth="1" />
    </svg>
  );
}

// Cloud SVG — cool blue-grey tones for light sky
function Cloud({ style }: { style?: React.CSSProperties }) {
  return (
    <svg
      width="160"
      height="70"
      viewBox="0 0 160 70"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      <ellipse cx="80" cy="50" rx="75" ry="20" fill="#b8cfe0" opacity="0.45" />
      <ellipse cx="55" cy="42" rx="40" ry="26" fill="#c4d8e8" opacity="0.4" />
      <ellipse cx="108" cy="38" rx="34" ry="22" fill="#c4d8e8" opacity="0.4" />
      <ellipse cx="80" cy="32" rx="28" ry="20" fill="#d0e2ee" opacity="0.35" />
    </svg>
  );
}

// Bird SVG — grey strokes visible on light sky
function Birds({ style }: { style?: React.CSSProperties }) {
  return (
    <svg
      width="80"
      height="30"
      viewBox="0 0 80 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      <path d="M0 15 Q5 8 10 15" stroke="#6b7280" strokeWidth="1.5" fill="none" opacity="0.55" />
      <path d="M15 10 Q20 3 25 10" stroke="#6b7280" strokeWidth="1.5" fill="none" opacity="0.45" />
      <path d="M30 18 Q35 11 40 18" stroke="#6b7280" strokeWidth="1.5" fill="none" opacity="0.55" />
      <path d="M50 8 Q55 1 60 8" stroke="#6b7280" strokeWidth="1.5" fill="none" opacity="0.35" />
      <path d="M65 14 Q70 7 75 14" stroke="#6b7280" strokeWidth="1.5" fill="none" opacity="0.45" />
    </svg>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentQuote, setCurrentQuote] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setCurrentQuote((prev) => (prev + 1) % quotes.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 2000));
    setIsLoading(false);
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center py-8">

      {/* ── Light Sky Gradient Background ── */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(170deg, #dce8f5 0%, #e8eff7 35%, #eff4f8 60%, #f4f5f3 80%, #edecea 100%)",
        }}
      />

      {/* ── Subtle dot-grid texture ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, #9db4c8 0.8px, transparent 0.8px)",
          backgroundSize: "28px 28px",
          opacity: 0.18,
        }}
      />

      {/* ── Clouds ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <Cloud
          style={{ position: "absolute", top: "8%", left: "-5%", animation: "driftCloud1 42s linear infinite" }}
        />
        <Cloud
          style={{
            position: "absolute", top: "22%", left: "-8%",
            animation: "driftCloud2 56s linear infinite",
            animationDelay: "-22s",
            transform: "scale(0.7)",
          }}
        />
        <Cloud
          style={{
            position: "absolute", top: "55%", left: "-6%",
            animation: "driftCloud1 50s linear infinite",
            animationDelay: "-38s",
            transform: "scale(1.1)",
          }}
        />
        <Cloud
          style={{
            position: "absolute", top: "5%", right: "-4%",
            animation: "driftCloud3 47s linear infinite",
            animationDelay: "-12s",
          }}
        />
      </div>

      {/* ── Birds ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <Birds
          style={{
            position: "absolute", top: "14%", left: "-10%",
            animation: "flyBirds 36s linear infinite",
            animationDelay: "-5s",
          }}
        />
        <Birds
          style={{
            position: "absolute", top: "38%", left: "-10%",
            animation: "flyBirds 46s linear infinite",
            animationDelay: "-28s",
            transform: "scale(0.6)",
          }}
        />
      </div>

      {/* ── Hot Air Balloons ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Balloon 1 — red/amber, large, left */}
        <div style={{ position: "absolute", left: "5%", top: "0%", animation: "floatBalloon1 18s ease-in-out infinite" }}>
          <HotAirBalloon color1="#ef4444" color2="#fbbf24" color3="#f97316" size={110} />
        </div>
        {/* Balloon 2 — purple/pink, right */}
        <div style={{ position: "absolute", right: "8%", top: "10%", animation: "floatBalloon2 22s ease-in-out infinite", animationDelay: "-8s" }}>
          <HotAirBalloon color1="#8b5cf6" color2="#ec4899" color3="#a78bfa" size={85} />
        </div>
        {/* Balloon 3 — teal/cyan, far left */}
        <div style={{ position: "absolute", left: "20%", top: "5%", animation: "floatBalloon3 20s ease-in-out infinite", animationDelay: "-14s" }}>
          <HotAirBalloon color1="#10b981" color2="#06b6d4" color3="#34d399" size={65} />
        </div>
        {/* Balloon 4 — amber, far right */}
        <div style={{ position: "absolute", right: "22%", top: "2%", animation: "floatBalloon1 25s ease-in-out infinite", animationDelay: "-5s" }}>
          <HotAirBalloon color1="#f59e0b" color2="#fbbf24" color3="#fb923c" size={55} />
        </div>
        {/* Balloon 5 — blue/purple, center top */}
        <div style={{ position: "absolute", left: "45%", top: "-2%", animation: "floatBalloon2 16s ease-in-out infinite", animationDelay: "-3s" }}>
          <HotAirBalloon color1="#3b82f6" color2="#a855f7" color3="#60a5fa" size={45} />
        </div>
      </div>

      {/* ── Horizon warm glow ── */}
      <div
        className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none"
        style={{
          background: "linear-gradient(to top, rgba(251,191,36,0.08), transparent)",
        }}
      />

      {/* ── Login Card ── */}
      <div
        className={`relative z-10 w-full max-w-md mx-4 transition-all duration-700 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        {/* Glass card — light mode */}
        <div
          className="rounded-3xl p-8"
          style={{
            background: "rgba(255,255,255,0.78)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.95)",
            boxShadow:
              "0 20px 60px rgba(100,116,139,0.16), 0 4px 16px rgba(100,116,139,0.08), inset 0 1px 0 rgba(255,255,255,1)",
          }}
        >
          {/* Logo & Brand */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500"
                style={{
                  boxShadow: "0 4px 12px rgba(239,68,68,0.3)",
                }}
              >
                <AirplaneTilt size={22} weight="fill" color="white" />
              </div>
              <span
                className="text-2xl font-black tracking-tight text-gray-900"
                style={{ fontFamily: "'Georgia', serif", letterSpacing: "-0.02em" }}
              >
                Dreams<span className="text-red-500">Yatri</span>
              </span>
            </div>
            <p
              className="text-xs font-semibold uppercase tracking-widest text-gray-400"
              style={{ letterSpacing: "0.18em" }}
            >
              We love your dedication
            </p>
            <div
              className="mt-3 mx-auto h-px w-16"
              style={{
                background: "linear-gradient(to right, transparent, rgba(239,68,68,0.4), transparent)",
              }}
            />
          </div>

          {/* Heading */}
          <div className="mb-7">
            <h1
              className="text-3xl font-bold text-gray-900 mb-1"
              style={{ fontFamily: "'Georgia', serif" }}
            >
              Welcome back 😉
            </h1>
            <p className="text-sm text-gray-500">
              Let&apos;s help them explore the world together 🤜🤛
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div className="space-y-1.5">
              <label
                className="block text-xs font-semibold uppercase tracking-widest text-grey-500"
                style={{ letterSpacing: "0.14em" }}
              >
                Email Address
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <EnvelopeSimple size={18} weight="duotone" className="text-grey-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@dreamsyatri.com"
                  required
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl text-sm text-gray-800 placeholder-gray-400 outline-none transition-all duration-200"
                  style={{
                    background: "#f9fafb",
                    border: "1px solid #d1d5db",
                    fontFamily: "inherit",
                  }}
                  onFocus={(e) => {
                    e.target.style.border = "1px solid #f87171";
                    e.target.style.background = "#ffffff";
                    e.target.style.boxShadow = "0 0 0 3px rgba(239,68,68,0.08)";
                  }}
                  onBlur={(e) => {
                    e.target.style.border = "1px solid #d1d5db";
                    e.target.style.background = "#f9fafb";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label
                className="block text-xs font-semibold uppercase tracking-widest text-grey-500"
                style={{ letterSpacing: "0.14em" }}
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Lock size={18} weight="duotone" className="text-grey-500" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full pl-11 pr-12 py-3.5 rounded-xl text-sm text-gray-800 placeholder-gray-400 outline-none transition-all duration-200"
                  style={{
                    background: "#f9fafb",
                    border: "1px solid #d1d5db",
                    fontFamily: "inherit",
                  }}
                  onFocus={(e) => {
                    e.target.style.border = "1px solid #f87171";
                    e.target.style.background = "#ffffff";
                    e.target.style.boxShadow = "0 0 0 3px rgba(239,68,68,0.08)";
                  }}
                  onBlur={(e) => {
                    e.target.style.border = "1px solid #d1d5db";
                    e.target.style.background = "#f9fafb";
                    e.target.style.boxShadow = "none";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeSlash size={18} weight="duotone" />
                  ) : (
                    <Eye size={18} weight="duotone" />
                  )}
                </button>
              </div>
            </div>

            {/* Forgot password */}
            <div className="flex justify-end">
              <button
                type="button"
                className="text-xs font-medium text-red-500 hover:text-red-600 transition-colors duration-200"
              >
                Forgot password?
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="relative w-full py-3.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 overflow-hidden transition-all duration-300 group cursor-pointer"
              style={{
                background: isLoading
                  ? "#fca5a5"
                  : "linear-gradient(135deg, rgb(239,68,68) 0%, rgb(185,28,28) 50%, rgb(153,27,27) 100%)",
                boxShadow: isLoading
                  ? "none"
                  : "0 8px 24px rgba(239,68,68,0.3)",
                letterSpacing: "0.03em",
              }}
            >
              {/* Hover shimmer */}
              {!isLoading && (
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background:
                      "linear-gradient(135deg, #ff3b3b 0%, #d90429 60%, #8b0000 100%)",
                  }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle
                        className="opacity-25"
                        cx="12" cy="12" r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      />
                    </svg>
                    Signing In...
                  </>
                ) : (
                  <>
                    Dive Into Dashboard
                    <ArrowRight
                      size={16}
                      weight="bold"
                      className="group-hover:translate-x-1 transition-transform duration-200"
                    />
                  </>
                )}
              </span>
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">
              DreamsYatri © {new Date().getFullYear()}
            </span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Quote carousel */}
          {/* <div className="rounded-2xl px-5 py-4 text-center bg-gray-50 border border-gray-200">
            <p
              className="text-sm italic leading-relaxed text-gray-600 transition-all duration-700"
              style={{
                fontFamily: "'Georgia', serif",
                minHeight: "3.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              &ldquo;{quotes[currentQuote].text}&rdquo;
            </p>

            <div className="flex justify-center gap-1.5 mt-3">
              {quotes.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentQuote(i)}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: i === currentQuote ? "16px" : "6px",
                    height: "6px",
                    background:
                      i === currentQuote ? "#ef4444" : "#d1d5db",
                  }}
                />
              ))}
            </div>
          </div> */}
        </div>
      </div>

      {/* ── CSS Animations ── */}
      <style>{`
        @keyframes floatBalloon1 {
          0%   { transform: translateY(0px) rotate(-1deg); }
          25%  { transform: translateY(-22px) rotate(1deg); }
          50%  { transform: translateY(-10px) rotate(-0.5deg); }
          75%  { transform: translateY(-28px) rotate(1.5deg); }
          100% { transform: translateY(0px) rotate(-1deg); }
        }
        @keyframes floatBalloon2 {
          0%   { transform: translateY(0px) rotate(1deg); }
          30%  { transform: translateY(-18px) rotate(-1deg); }
          60%  { transform: translateY(-32px) rotate(0.5deg); }
          100% { transform: translateY(0px) rotate(1deg); }
        }
        @keyframes floatBalloon3 {
          0%   { transform: translateY(0px); }
          40%  { transform: translateY(-26px) rotate(-1.5deg); }
          70%  { transform: translateY(-14px) rotate(1deg); }
          100% { transform: translateY(0px); }
        }
        @keyframes driftCloud1 {
          0%   { transform: translateX(-220px); opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 1; }
          100% { transform: translateX(110vw); opacity: 0; }
        }
        @keyframes driftCloud2 {
          0%   { transform: translateX(-220px) scale(0.7); opacity: 0; }
          5%   { opacity: 0.9; }
          95%  { opacity: 0.9; }
          100% { transform: translateX(110vw) scale(0.7); opacity: 0; }
        }
        @keyframes driftCloud3 {
          0%   { transform: translateX(110vw); opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 1; }
          100% { transform: translateX(-220px); opacity: 0; }
        }
        @keyframes flyBirds {
          0%   { transform: translateX(-200px) translateY(0px); opacity: 0; }
          5%   { opacity: 1; }
          50%  { transform: translateX(50vw) translateY(-30px); }
          95%  { opacity: 1; }
          100% { transform: translateX(110vw) translateY(-10px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}