"use client";

import { useState } from "react";
import { Text } from "@/app/components/ui/Typography";
import Button from "@/app/components/ui/Button";
import { ShieldCheck } from "lucide-react";
import type { PayerContact } from "@/app/actions/payment/payer-contact";

export type PayerPrefill = {
  name: string;
  email: string;
  phone: string;
  /** Which channel the sign-in already proved. */
  verified: "email" | "phone" | null;
};

/**
 * The one form between reading a quote and paying for it.
 *
 * Asked only when we cannot address an invoice — see the contact gate in
 * createBookingFromCustomPackage. Opens filled in with whatever the account
 * already holds, so the common case is a single empty field: someone who
 * signed in by phone has no email, someone who signed in with Google has no
 * number.
 *
 * The verified channel is shown and locked. Signing in IS the verification —
 * the phone path consumes an OTP row, the email paths come from a provider
 * that checked the address — so the proved one is not something a form should
 * let you retype, and the other is supplementary by construction. Saying which
 * is which is more honest than presenting three identical boxes.
 */
export default function PayerContactDialog({
  prefill, submitting, error, onCancel, onSubmit,
}: {
  prefill: PayerPrefill;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (c: PayerContact) => void;
}) {
  const [name, setName] = useState(prefill.name);
  const [email, setEmail] = useState(prefill.email);
  const [phone, setPhone] = useState(prefill.phone);
  const [touched, setTouched] = useState(false);

  const nameBad = name.trim().length < 2;
  const emailBad = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const phoneBad = !/^[+\d][\d\s\-().]{6,19}$/.test(phone.trim());
  const invalid = nameBad || emailBad || phoneBad;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (invalid) return;
    onSubmit({ name: name.trim(), email: email.trim(), phone: phone.trim() });
  }

  const field = "w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary-100";
  const bad = "border-error-300 bg-error-50/40";
  const ok = "border-(--border-default)";

  return (
    <div className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center bg-neutral-950/50 px-0 sm:px-4 backdrop-blur-sm">
      <div
        role="dialog" aria-modal="true" aria-labelledby="payer-contact-title"
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl"
      >
        <div className="border-b border-(--border-default) px-5 py-4">
          <h2 id="payer-contact-title" className="font-heading text-base font-bold text-neutral-900">
            Who should we bill this to?
          </h2>
          <Text size="xs" intent="secondary" className="mt-0.5 block">
            These go on your invoice and are how we reach you about the trip.
          </Text>
        </div>

        <form onSubmit={submit} className="px-5 py-4 space-y-3.5" noValidate>
          <div>
            <label htmlFor="pc-name" className="mb-1 block text-xs font-semibold text-neutral-700">Full name</label>
            <input
              id="pc-name" value={name} onChange={(e) => setName(e.target.value)}
              autoComplete="name" placeholder="As it should appear on the invoice"
              className={`${field} ${touched && nameBad ? bad : ok}`}
            />
            {touched && nameBad && <Text size="xs" intent="error" className="mt-1 block">Enter your full name.</Text>}
          </div>

          <div>
            <label htmlFor="pc-email" className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-neutral-700">
              Email
              {prefill.verified === "email" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-1.5 py-0.5 text-[10px] font-semibold text-success-700">
                  <ShieldCheck size={11} /> verified
                </span>
              )}
            </label>
            <input
              id="pc-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              autoComplete="email" placeholder="you@example.com"
              // The proved channel is not editable here: it is what the account
              // signed in with, and changing it belongs in account settings
              // where it can be re-verified, not on a payment screen.
              readOnly={prefill.verified === "email"}
              className={`${field} ${touched && emailBad ? bad : ok} ${prefill.verified === "email" ? "bg-neutral-50 text-neutral-600" : ""}`}
            />
            {touched && emailBad && <Text size="xs" intent="error" className="mt-1 block">Enter a valid email address.</Text>}
          </div>

          <div>
            <label htmlFor="pc-phone" className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-neutral-700">
              Phone
              {prefill.verified === "phone" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-1.5 py-0.5 text-[10px] font-semibold text-success-700">
                  <ShieldCheck size={11} /> verified
                </span>
              )}
            </label>
            <input
              id="pc-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel" placeholder="+91 98765 43210"
              readOnly={prefill.verified === "phone"}
              className={`${field} ${touched && phoneBad ? bad : ok} ${prefill.verified === "phone" ? "bg-neutral-50 text-neutral-600" : ""}`}
            />
            {touched && phoneBad && <Text size="xs" intent="error" className="mt-1 block">Enter a valid phone number.</Text>}
          </div>

          {error && <Text size="xs" intent="error" role="alert" className="block">{error}</Text>}

          <div className="flex gap-2.5 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="premium" className="flex-1" loading={submitting} disabled={submitting}>
              Continue
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
