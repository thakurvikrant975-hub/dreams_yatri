"use client";

import { useActionState, useState } from "react";
import { loginAction, type LoginState } from "./actions";
import Link from "next/link";
import {
  EnvelopeSimple,
  Lock,
  Eye,
  EyeSlash,
  ArrowRight,
  Buildings,
} from "@phosphor-icons/react";

const initialState: LoginState = {};

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative z-10 w-full max-w-md mx-4">
      <div
        className="rounded-3xl p-8"
        style={{
          background: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.95)",
          boxShadow:
            "0 20px 60px rgba(100,116,139,0.14), 0 4px 16px rgba(100,116,139,0.08), inset 0 1px 0 rgba(255,255,255,1)",
        }}
      >
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2.5 mb-3">
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
          <p className="text-xs text-gray-400 mt-2">
            Hotel partner portal — list, manage &amp; grow
          </p>
          <div
            className="mt-3 mx-auto h-px w-16"
            style={{
              background:
                "linear-gradient(to right, transparent, rgba(249,115,22,0.4), transparent)",
            }}
          />
        </div>

        {/* Heading */}
        <div className="mb-7">
          <h1
            className="text-2xl font-bold text-gray-900 mb-1"
            style={{ fontFamily: "'Georgia', serif" }}
          >
            Welcome back
          </h1>
          <p className="text-sm text-gray-500">
            Sign in to manage your properties and bookings.
          </p>
        </div>

        {/* Form */}
        <form action={formAction} className="space-y-4">
          {state.error && (
            <div className="rounded-xl px-4 py-3 text-sm font-medium text-orange-800 bg-orange-50 border border-orange-200">
              {state.error}
            </div>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <EnvelopeSimple size={18} weight="duotone" className="text-gray-400" />
              </div>
              <input
                name="email"
                type="email"
                placeholder="you@yourhotel.com"
                required
                autoComplete="email"
                className="w-full pl-11 pr-4 py-3.5 rounded-xl text-sm text-gray-800 placeholder-gray-400 outline-none transition-all duration-200"
                style={{ background: "#f9fafb", border: "1px solid #d1d5db" }}
                onFocus={(e) => {
                  e.target.style.border = "1px solid #f97316";
                  e.target.style.background = "#ffffff";
                  e.target.style.boxShadow = "0 0 0 3px rgba(249,115,22,0.08)";
                }}
                onBlur={(e) => {
                  e.target.style.border = "1px solid #d1d5db";
                  e.target.style.background = "#f9fafb";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>
            {state.fieldErrors?.email && (
              <p className="text-xs text-red-500">{state.fieldErrors.email[0]}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500">
              Password
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <Lock size={18} weight="duotone" className="text-gray-400" />
              </div>
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Your password"
                required
                autoComplete="current-password"
                className="w-full pl-11 pr-12 py-3.5 rounded-xl text-sm text-gray-800 placeholder-gray-400 outline-none transition-all duration-200"
                style={{ background: "#f9fafb", border: "1px solid #d1d5db" }}
                onFocus={(e) => {
                  e.target.style.border = "1px solid #f97316";
                  e.target.style.background = "#ffffff";
                  e.target.style.boxShadow = "0 0 0 3px rgba(249,115,22,0.08)";
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
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors duration-200 cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeSlash size={18} weight="duotone" />
                ) : (
                  <Eye size={18} weight="duotone" />
                )}
              </button>
            </div>
            {state.fieldErrors?.password && (
              <p className="text-xs text-red-500">{state.fieldErrors.password[0]}</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending}
            className="relative w-full py-3.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 overflow-hidden transition-all duration-300 group cursor-pointer mt-2"
            style={{
              background: isPending
                ? "#fed7aa"
                : "linear-gradient(135deg, #f97316 0%, #ea580c 50%, #dc2626 100%)",
              boxShadow: isPending ? "none" : "0 8px 24px rgba(249,115,22,0.3)",
            }}
          >
            <span className="relative z-10 flex items-center gap-2">
              {isPending ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight size={16} weight="bold" className="group-hover:translate-x-1 transition-transform duration-200" />
                </>
              )}
            </span>
          </button>
        </form>

        {/* Sign up link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            New to DreamsYatri Connect?{" "}
            <Link
              href="/hotel-connect/signup"
              className="font-semibold text-orange-500 hover:text-orange-600 transition-colors"
            >
              List your property
            </Link>
          </p>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-xs text-gray-400">DreamsYatri © {new Date().getFullYear()}</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>
      </div>
    </div>
  );
}
