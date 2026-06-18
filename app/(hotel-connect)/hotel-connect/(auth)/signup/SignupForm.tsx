"use client";

import { useActionState, useState } from "react";
import { signupAction, type SignupState } from "./actions";
import Link from "next/link";
import {
  User,
  EnvelopeSimple,
  Phone,
  Buildings,
  Lock,
  Eye,
  EyeSlash,
  CheckCircle,
} from "@phosphor-icons/react";

const initialState: SignupState = {};

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error[0]}</p>}
    </div>
  );
}

const inputBase =
  "w-full pl-11 pr-4 py-3 rounded-xl text-sm text-gray-800 placeholder-gray-400 outline-none transition-all duration-200";
const inputStyle = { background: "#f9fafb", border: "1px solid #d1d5db" };

function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.border = "1px solid #f97316";
  e.target.style.background = "#ffffff";
  e.target.style.boxShadow = "0 0 0 3px rgba(249,115,22,0.08)";
}
function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.border = "1px solid #d1d5db";
  e.target.style.background = "#f9fafb";
  e.target.style.boxShadow = "none";
}

export default function SignupForm() {
  const [state, formAction, isPending] = useActionState(signupAction, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (state.success) {
    return (
      <div className="relative z-10 w-full max-w-md mx-4">
        <div
          className="rounded-3xl p-8 text-center"
          style={{
            background: "rgba(255,255,255,0.9)",
            backdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.95)",
            boxShadow: "0 20px 60px rgba(100,116,139,0.14)",
          }}
        >
          <div className="flex justify-center mb-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #f97316, #dc2626)" }}
            >
              <CheckCircle size={32} weight="fill" color="white" />
            </div>
          </div>
          <h2
            className="text-2xl font-bold text-gray-900 mb-2"
            style={{ fontFamily: "'Georgia', serif" }}
          >
            Registration submitted!
          </h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            Your account is under review. The DreamsYatri team will verify your
            details and activate your account within 1–2 business days. You'll
            receive a confirmation email once you're approved.
          </p>
          <div className="rounded-xl bg-orange-50 border border-orange-200 px-4 py-3 text-sm text-orange-700 mb-6">
            Check your inbox at the email address you registered with.
          </div>
          <Link
            href="/hotel-connect/login"
            className="inline-flex items-center gap-2 text-sm font-semibold text-orange-500 hover:text-orange-600 transition-colors"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 w-full max-w-lg mx-4">
      <div
        className="rounded-3xl p-8"
        style={{
          background: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.95)",
          boxShadow: "0 20px 60px rgba(100,116,139,0.14), inset 0 1px 0 rgba(255,255,255,1)",
        }}
      >
        {/* Brand */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2.5 mb-2">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #f97316 0%, #dc2626 100%)",
                boxShadow: "0 4px 12px rgba(249,115,22,0.35)",
              }}
            >
              <Buildings size={20} weight="fill" color="white" />
            </div>
            <div className="text-left">
              <span
                className="text-xl font-black tracking-tight text-gray-900 block leading-none"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                Dreams<span className="text-orange-500">Yatri</span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-orange-500 leading-none">
                connect
              </span>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h1
            className="text-2xl font-bold text-gray-900 mb-1"
            style={{ fontFamily: "'Georgia', serif" }}
          >
            List your property
          </h1>
          <p className="text-sm text-gray-500">
            Join hundreds of hotels on DreamsYatri and grow your bookings.
          </p>
        </div>

        {state.error && (
          <div className="rounded-xl px-4 py-3 text-sm font-medium text-red-700 bg-red-50 border border-red-200 mb-4">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          {/* Name + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Your Name" error={state.fieldErrors?.name}>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <User size={16} weight="duotone" className="text-gray-400" />
                </div>
                <input
                  name="name"
                  type="text"
                  placeholder="Full name"
                  required
                  className={inputBase}
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>
            </Field>
            <Field label="Mobile Number" error={state.fieldErrors?.phone}>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Phone size={16} weight="duotone" className="text-gray-400" />
                </div>
                <input
                  name="phone"
                  type="tel"
                  placeholder="10-digit number"
                  required
                  maxLength={10}
                  className={inputBase}
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>
            </Field>
          </div>

          <Field label="Business / Property Name" error={state.fieldErrors?.businessName}>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <Buildings size={16} weight="duotone" className="text-gray-400" />
              </div>
              <input
                name="businessName"
                type="text"
                placeholder="e.g. The Grand Shimla Resort"
                required
                className={inputBase}
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>
          </Field>

          <Field label="Work Email" error={state.fieldErrors?.email}>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <EnvelopeSimple size={16} weight="duotone" className="text-gray-400" />
              </div>
              <input
                name="email"
                type="email"
                placeholder="you@yourhotel.com"
                required
                autoComplete="email"
                className={inputBase}
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>
          </Field>

          {/* Passwords */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Password" error={state.fieldErrors?.password}>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Lock size={16} weight="duotone" className="text-gray-400" />
                </div>
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 8 chars"
                  required
                  autoComplete="new-password"
                  className="w-full pl-11 pr-10 py-3 rounded-xl text-sm text-gray-800 placeholder-gray-400 outline-none transition-all duration-200"
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>
            <Field label="Confirm Password" error={state.fieldErrors?.confirmPassword}>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Lock size={16} weight="duotone" className="text-gray-400" />
                </div>
                <input
                  name="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  placeholder="Repeat password"
                  required
                  autoComplete="new-password"
                  className="w-full pl-11 pr-10 py-3 rounded-xl text-sm text-gray-800 placeholder-gray-400 outline-none transition-all duration-200"
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  {showConfirm ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>
          </div>

          {/* Terms */}
          <p className="text-xs text-gray-400 leading-relaxed">
            By registering you agree to DreamsYatri&apos;s partner terms and our
            commission structure. Your account will be reviewed within 1–2 business days.
          </p>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer"
            style={{
              background: isPending
                ? "#fed7aa"
                : "linear-gradient(135deg, #f97316 0%, #ea580c 50%, #dc2626 100%)",
              boxShadow: isPending ? "none" : "0 8px 24px rgba(249,115,22,0.3)",
            }}
          >
            {isPending ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Submitting...
              </>
            ) : (
              "Create Partner Account"
            )}
          </button>
        </form>

        <div className="mt-5 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link
            href="/hotel-connect/login"
            className="font-semibold text-orange-500 hover:text-orange-600 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
