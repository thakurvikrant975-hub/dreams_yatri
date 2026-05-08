"use client";

import { useActionState, useState } from "react";
import { loginAction, type LoginState } from "./actions";
import Image from "next/image";

import {
  EnvelopeSimple,
  Lock,
  Eye,
  EyeSlash,
  ArrowRight,
  AirplaneTilt,
} from "@phosphor-icons/react";
import Button from "@/app/components/ui/Button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../(main)/components/ui/dialog";
const initialState: LoginState = {};

type ForgotPasswordDialogProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export function ForgotPasswordDialog({ open, setOpen }: ForgotPasswordDialogProps) {
  return (
    <>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm text-center">
          {/* Playful Icon */}
          <div className="flex justify-center mb-2">
            <div className="relative">
              <Image
                src="/dashboard/login-security3.jpg"
                alt="Login security"
                width={80}
                height={80}
                className="rounded-full bg-red-50 shadow-inner object-cover"
              />
            </div>
          </div>

          <DialogHeader className="text-center space-y-1">
            <DialogTitle className="text-center text-lg font-bold text-gray-800">
              Uh-oh!
            </DialogTitle>
            <DialogDescription className="text-center text-sm text-gray-500 leading-relaxed">
              No worries — it happens to the best of us.
            </DialogDescription>
          </DialogHeader>

          {/* Message Box */}
          <div className="mt-2 rounded-xl border border-dashed border-red-200 bg-red-50 px-4 py-4 text-center space-y-1">
            <p className="text-sm font-semibold text-red-600">
              This is an internal dashboard.
            </p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Password resets are handled manually. Please ping your{" "}
              <span className="font-semibold text-gray-700">Admin</span> or{" "}
              <span className="font-semibold text-gray-700">Developer Team</span> — they&apos;ll
              sort this.</p>
          </div>

          {/* Contact Hint */}
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-400">
            <span>🚨</span>
            <span>
              No stress — security doing its job.
            </span>
          </div>

          <DialogFooter className="mt-4 flex justify-center">
            <DialogClose asChild>
              <Button
                variant="premium"
                className="w-full border-red-200 text-red-500"
              >
                Got it, I&apos;ll ask them 👍
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [open, setOpen] = useState(false);

  return (
    <div className="relative z-10 w-full max-w-md mx-4">
      {/* Glass card */}
      <ForgotPasswordDialog open={open} setOpen={setOpen} />
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
              style={{ boxShadow: "0 4px 12px rgba(239,68,68,0.3)" }}
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
              background:
                "linear-gradient(to right, transparent, rgba(239,68,68,0.4), transparent)",
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
            Let&apos;s help the world travel the world together 🤜🤛
          </p>
        </div>

        {/* Form */}
        <form action={formAction} className="space-y-4">

          {/* Global error */}
          {state.error && (
            <div className="rounded-xl px-4 py-3 text-sm font-medium text-red-700 bg-red-50 border border-red-200">
              {state.error}
            </div>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <label
              className="block text-xs font-semibold uppercase tracking-widest text-gray-500"
              style={{ letterSpacing: "0.14em" }}
            >
              Email Address
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <EnvelopeSimple size={18} weight="duotone" className="text-gray-400" />
              </div>
              <input
                name="email"
                type="email"
                placeholder="name@dreamsyatri.com"
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
            {state.fieldErrors?.email && (
              <p className="text-xs text-red-500">{state.fieldErrors.email[0]}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label
              className="block text-xs font-semibold uppercase tracking-widest text-gray-500"
              style={{ letterSpacing: "0.14em" }}
            >
              Password
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <Lock size={18} weight="duotone" className="text-gray-400" />
              </div>
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Password here..."
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

          {/* Forgot password */}
          {/* Forgot Password Trigger */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="text-xs font-medium text-red-500 hover:text-red-600 transition-colors duration-200 cursor-pointer"
            >
              Forgot password?
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending}
            className="relative w-full py-3.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 overflow-hidden transition-all duration-300 group cursor-pointer"
            style={{
              background: isPending
                ? "#fca5a5"
                : "linear-gradient(135deg, rgb(239,68,68) 0%, rgb(185,28,28) 50%, rgb(153,27,27) 100%)",
              boxShadow: isPending ? "none" : "0 8px 24px rgba(239,68,68,0.3)",
              letterSpacing: "0.03em",
            }}
          >
            {!isPending && (
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background:
                    "linear-gradient(135deg, #ff3b3b 0%, #d90429 60%, #8b0000 100%)",
                }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {isPending ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                  Diving In...
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
            DreamsYatri © {new Date().getFullYear()} — The Journey to a Billion-Dollar Vision
          </span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
      </div>
    </div>
  );
}