"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Lock, Eye, EyeSlash, ArrowRight, CheckCircle } from "@phosphor-icons/react";
import Button from "@/app/components/ui/Button";
import { Input } from "../../(main)/components/ui/input";
import { Label } from "../../(main)/components/ui/label";
import { resetPassword, type ResetPasswordState } from "./actions";

const initialState: ResetPasswordState = {};

export default function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(resetPassword, initialState);
  const [showPassword, setShowPassword] = useState(false);

  if (state.ok) {
    return (
      <div className="w-full text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle size={28} weight="fill" className="text-emerald-500" />
        </div>
        <h1 className="text-xl font-bold text-neutral-900 mb-1.5">Password updated</h1>
        <p className="text-sm text-neutral-500 mb-6">You can now log in with your new password.</p>
        <Link href="/hotel-connect/login" className="inline-flex items-center justify-center w-full h-10 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold transition-colors">
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight mb-1.5">Reset password</h1>
        <p className="text-sm text-neutral-500">Choose a new password for your account.</p>
      </div>

      <form action={formAction} className="space-y-5">
        <input type="hidden" name="token" value={token} />
        {state.error && (
          <div className="rounded-lg px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200">
            {state.error}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">New password</Label>
          <div className="relative">
            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Min. 8 characters"
              required
              autoComplete="new-password"
              className="pl-9 pr-10"
              aria-invalid={!!state.fieldErrors?.password}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer">
              {showPassword ? <EyeSlash size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {state.fieldErrors?.password && <p className="text-xs text-red-500">{state.fieldErrors.password[0]}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={showPassword ? "text" : "password"}
            placeholder="Repeat password"
            required
            autoComplete="new-password"
            aria-invalid={!!state.fieldErrors?.confirmPassword}
          />
          {state.fieldErrors?.confirmPassword && <p className="text-xs text-red-500">{state.fieldErrors.confirmPassword[0]}</p>}
        </div>

        <Button type="submit" disabled={isPending} className="w-full h-10 rounded-lg text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white gap-2">
          {isPending ? "Updating…" : <>Update password <ArrowRight size={15} weight="bold" /></>}
        </Button>
      </form>
    </div>
  );
}
