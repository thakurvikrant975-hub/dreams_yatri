"use client";

import { useActionState, useState } from "react";
import { loginAction, type LoginState } from "./actions";
import Link from "next/link";
import { EnvelopeSimple, Lock, Eye, EyeSlash, ArrowRight } from "@phosphor-icons/react";
import Button from "@/app/components/ui/Button";
import { Input } from "../../(main)/components/ui/input";
import { Label } from "../../(main)/components/ui/label";

const initialState: LoginState = {};

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight mb-1.5">
          Welcome back
        </h1>
        <p className="text-sm text-neutral-500">
          Sign in to manage your properties and bookings.
        </p>
      </div>

      <form action={formAction} className="space-y-5">
        {state.error && (
          <div className="rounded-lg px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200">
            {state.error}
          </div>
        )}

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email address</Label>
          <div className="relative">
            <EnvelopeSimple size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
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
          {state.fieldErrors?.email && (
            <p className="text-xs text-red-500">{state.fieldErrors.email[0]}</p>
          )}
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Your password"
              required
              autoComplete="current-password"
              className="pl-9 pr-10"
              aria-invalid={!!state.fieldErrors?.password}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeSlash size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {state.fieldErrors?.password && (
            <p className="text-xs text-red-500">{state.fieldErrors.password[0]}</p>
          )}
        </div>

        <Button
          type="submit"
          disabled={isPending}
          className="w-full h-10 rounded-lg text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white mt-1 gap-2"
        >
          {isPending ? (
            <>
              <svg className="animate-spin size-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Signing in…
            </>
          ) : (
            <>
              Sign in
              <ArrowRight size={15} weight="bold" />
            </>
          )}
        </Button>
      </form>

      <div className="mt-6 pt-5 border-t border-neutral-100 text-center">
        <p className="text-sm text-neutral-500">
          New to DreamsYatri Connect?{" "}
          <Link
            href="/hotel-connect/signup"
            className="font-semibold text-primary-600 hover:text-primary-700 transition-colors"
          >
            List your property
          </Link>
        </p>
      </div>
    </div>
  );
}
