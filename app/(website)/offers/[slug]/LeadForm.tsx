"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { submitPackageEnquiry } from "@/app/actions/enquiry/submit";
import { fireConversion } from "./gtag";
import { COUNTRY_CODES, DEFAULT_COUNTRY } from "@/app/lib/assets/country-codes";

export function LeadForm({
  destination, packageName, pageUrl, googleAdsSendToForm, onSuccess, className,
}: {
  destination: string | null;
  packageName?: string;
  pageUrl: string;
  googleAdsSendToForm: string | null;
  onSuccess?: () => void;
  className?: string;
}) {
  const [values, setValues] = useState({ name: "", phone: "" });
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY.code);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrors({});
    setFormError(null);

    const result = await submitPackageEnquiry({
      name: values.name,
      phone: values.phone,
      countryCode,
      packageName,
      destination: destination || undefined,
      packageUrl: pageUrl,
      pageUrl,
      source: "LANDING_PAGE",
    });

    if (result.ok) {
      setStatus("done");
      fireConversion(googleAdsSendToForm);
      onSuccess?.();
    } else {
      setStatus("idle");
      if (result.fieldErrors) setErrors(result.fieldErrors as Record<string, string>);
      else setFormError(result.formError ?? "Something went wrong. Please try again.");
    }
  }

  if (status === "done") {
    return (
      <div className={className}>
        <p className="text-lg font-bold text-neutral-900">Thank you! 🎉</p>
        <p className="mt-1 text-sm text-neutral-600">
          We&apos;ve received your enquiry{packageName ? ` for ${packageName}` : ""}. Our travel expert will call or WhatsApp you shortly with a custom quote — completely free, no obligation.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={className} noValidate>
      <div className="space-y-3">
        <div>
          <input
            type="text" placeholder="Full Name" value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            className="w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
            required
          />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
        </div>
        <div>
          <div className="flex items-stretch overflow-hidden rounded-lg border border-neutral-300 focus-within:border-red-500 focus-within:ring-1 focus-within:ring-red-500">
            <div className="relative flex shrink-0 items-center">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                aria-label="Country code"
                className="h-full appearance-none bg-transparent py-2.5 pr-7 pl-3 text-sm outline-none"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>{c.flag} {c.dial}</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 text-neutral-400" />
            </div>
            <span className="my-2 w-px shrink-0 bg-neutral-300" aria-hidden="true" />
            <input
              type="tel" placeholder="98765 43210" value={values.phone}
              onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value.replace(/[^\d\s-]/g, "") }))}
              className="w-full min-w-0 px-3.5 py-2.5 text-sm outline-none"
              required
            />
          </div>
          {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
        </div>
      </div>

      {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-4 w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
      >
        {status === "submitting" ? "Sending…" : "Get a callback"}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-500">Your details are secure and never shared.</p>
    </form>
  );
}
