"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { partnerLoginAction, type LoginState } from "./actions";

const initial: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(partnerLoginAction, initial);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
      <label className="block space-y-1">
        <span className="text-xs text-neutral-600">Email</span>
        <input
          name="email" type="email" autoComplete="username" required
          className="h-10 w-full rounded-md border border-neutral-300 px-3 text-sm outline-none focus:border-neutral-900"
        />
        {state.fieldErrors?.email && <p className="text-xs text-red-600">{state.fieldErrors.email[0]}</p>}
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-neutral-600">Password</span>
        <input
          name="password" type="password" autoComplete="current-password" required
          className="h-10 w-full rounded-md border border-neutral-300 px-3 text-sm outline-none focus:border-neutral-900"
        />
        {state.fieldErrors?.password && <p className="text-xs text-red-600">{state.fieldErrors.password[0]}</p>}
      </label>

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>
      )}

      <button
        type="submit" disabled={pending}
        className="h-10 w-full rounded-md bg-neutral-900 text-white text-sm font-medium disabled:opacity-60 inline-flex items-center justify-center gap-2"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Sign in
      </button>
    </form>
  );
}
