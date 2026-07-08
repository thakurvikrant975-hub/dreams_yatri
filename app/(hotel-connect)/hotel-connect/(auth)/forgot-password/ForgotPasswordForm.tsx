"use client";

import { useActionState } from "react";
import Link from "next/link";
import { EnvelopeSimple, ArrowRight, CheckCircle } from "@phosphor-icons/react";
import Button from "@/app/components/ui/Button";
import { Input } from "../../(main)/components/ui/input";
import { Label } from "../../(main)/components/ui/label";
import { requestPasswordReset, type ForgotPasswordState } from "./actions";

const initialState: ForgotPasswordState = {};

export default function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(requestPasswordReset, initialState);

  if (state.sent) {
    return (
      <div className="w-full text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle size={28} weight="fill" className="text-emerald-500" />
        </div>
        <h1 className="text-xl font-bold text-neutral-900 mb-1.5">Check your email</h1>
        <p className="text-sm text-neutral-500">
          If an account exists with that email, we&apos;ve sent a link to reset your password.
        </p>
        <Link href="/hotel-connect/login" className="inline-block mt-6 text-sm font-semibold text-primary-600 hover:text-primary-700">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight mb-1.5">Forgot password</h1>
        <p className="text-sm text-neutral-500">
          Enter your email and we&apos;ll send you a link to reset your password.
        </p>
      </div>

      <form action={formAction} className="space-y-5">
        {state.error && (
          <div className="rounded-lg px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200">
            {state.error}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email address</Label>
          <div className="relative">
            <EnvelopeSimple size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            <Input id="email" name="email" type="email" placeholder="you@yourhotel.com" required autoComplete="email" className="pl-9" />
          </div>
        </div>

        <Button type="submit" disabled={isPending} className="w-full h-10 rounded-lg text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white gap-2">
          {isPending ? "Sending…" : <>Send reset link <ArrowRight size={15} weight="bold" /></>}
        </Button>
      </form>

      <div className="mt-6 pt-5 border-t border-neutral-100 text-center">
        <Link href="/hotel-connect/login" className="text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors">
          Back to login
        </Link>
      </div>
    </div>
  );
}
