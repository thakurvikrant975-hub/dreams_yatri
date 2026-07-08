"use client";

import { useActionState, useState } from "react";
import { signupAction, type SignupState } from "./actions";
import Link from "next/link";
import { EnvelopeSimple, Lock, Eye, EyeSlash, Phone, User, Buildings, ArrowRight } from "@phosphor-icons/react";
import Button from "@/app/components/ui/Button";
import { Input } from "../../(main)/components/ui/input";
import { Label } from "../../(main)/components/ui/label";

const initialState: SignupState = {};

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-xs text-red-500">{error[0]}</p>}
    </div>
  );
}

export default function SignupForm() {
  const [state, formAction, isPending] = useActionState(signupAction, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [clientMismatch, setClientMismatch] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (confirmPassword && password !== confirmPassword) {
      e.preventDefault();
      setClientMismatch(true);
      return;
    }
    setClientMismatch(false);
  }

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight mb-1.5">
          List your property
        </h1>
        <p className="text-sm text-neutral-500">
          Create your partner account to start listing on DreamsYatri.
        </p>
      </div>

      <form action={formAction} onSubmit={handleSubmit} className="space-y-4">
        {state.error && (
          <div className="rounded-lg px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200">
            {state.error}
          </div>
        )}

        {/* Name + Phone */}
        <div className="grid grid-cols-2 gap-3">
          <Field id="name" label="Your name" error={state.fieldErrors?.name}>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="Full name"
                required
                className="pl-9"
                aria-invalid={!!state.fieldErrors?.name}
              />
            </div>
          </Field>

          <Field id="phone" label="Mobile" error={state.fieldErrors?.phone}>
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="10-digit"
                required
                maxLength={10}
                className="pl-9"
                aria-invalid={!!state.fieldErrors?.phone}
              />
            </div>
          </Field>
        </div>

        {/* Business name */}
        <Field id="businessName" label="Business / property name" error={state.fieldErrors?.businessName}>
          <div className="relative">
            <Buildings size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            <Input
              id="businessName"
              name="businessName"
              type="text"
              placeholder="e.g. The Grand Shimla Resort"
              required
              className="pl-9"
              aria-invalid={!!state.fieldErrors?.businessName}
            />
          </div>
        </Field>

        {/* Email */}
        <Field id="email" label="Work email" error={state.fieldErrors?.email}>
          <div className="relative">
            <EnvelopeSimple size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@yourhotel.com"
              required
              autoComplete="email"
              className="pl-9"
              aria-invalid={!!state.fieldErrors?.email}
            />
          </div>
        </Field>

        {/* Passwords */}
        <div className="grid grid-cols-2 gap-3">
          <Field id="password" label="Password" error={state.fieldErrors?.password}>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Min. 8 chars"
                required
                autoComplete="new-password"
                className="pl-9 pr-9"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!state.fieldErrors?.password}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeSlash size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </Field>

          <Field
            id="confirmPassword"
            label="Confirm"
            error={state.fieldErrors?.confirmPassword ?? (clientMismatch ? ["Passwords do not match."] : undefined)}
          >
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirm ? "text" : "password"}
                placeholder="Repeat"
                required
                autoComplete="new-password"
                className="pl-9 pr-9"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setClientMismatch(false); }}
                aria-invalid={!!state.fieldErrors?.confirmPassword || clientMismatch}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer"
              >
                {showConfirm ? <EyeSlash size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </Field>
        </div>

        <p className="text-xs text-neutral-400 leading-relaxed pt-1">
          By registering you agree to DreamsYatri&apos;s partner terms and commission structure.
          You can start listing your property immediately after sign-up.
        </p>

        <Button
          type="submit"
          disabled={isPending}
          className="w-full h-10 rounded-lg text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white gap-2"
        >
          {isPending ? (
            <>
              <svg className="animate-spin size-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Setting up your account…
            </>
          ) : (
            <>
              Create Account &amp; Start Listing
              <ArrowRight size={14} weight="bold" />
            </>
          )}
        </Button>
      </form>

      <div className="mt-6 pt-5 border-t border-neutral-100 text-center">
        <p className="text-sm text-neutral-500">
          Already have an account?{" "}
          <Link
            href="/hotel-connect/login"
            className="font-semibold text-primary-600 hover:text-primary-700 transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
