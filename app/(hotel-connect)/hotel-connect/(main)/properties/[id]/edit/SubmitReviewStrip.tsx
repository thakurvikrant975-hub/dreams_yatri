"use client";

import { useActionState, useState } from "react";
import Button from "@/app/components/ui/Button";
import {
  CheckCircleIcon,
  PaperPlaneTiltIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react/dist/ssr";
import { submitForReview, type PublishResult } from "./tabs/review-actions";
import { resendVerificationEmail } from "@/app/(hotel-connect)/hotel-connect/(auth)/verify-email/actions";

const EMAIL_VERIFY_MISSING_ITEM = "Verify your account email (check your inbox for the verification link)";

function ResendVerificationLink() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [devUrl, setDevUrl] = useState<string | null>(null);

  async function handleResend() {
    setStatus("sending");
    setMessage(null);
    const result = await resendVerificationEmail();
    if (!result.ok) {
      setStatus("error");
      setMessage(result.error ?? "Failed to resend. Please try again.");
      return;
    }
    setStatus("sent");
    if (result.devUrl) {
      setDevUrl(result.devUrl);
    } else {
      setMessage("Verification email sent — check your inbox.");
    }
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={handleResend}
        disabled={status === "sending"}
        className="text-xs font-semibold text-red-700 underline underline-offset-2 hover:text-red-800 disabled:opacity-50"
      >
        {status === "sending" ? "Sending…" : "Resend verification email"}
      </button>
      {message && <p className="text-xs text-red-600 mt-0.5">{message}</p>}
      {devUrl && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1">
          Dev mode — email delivery is skipped, verify directly:{" "}
          <a href={devUrl} className="underline font-medium">{devUrl}</a>
        </p>
      )}
    </div>
  );
}

export default function SubmitReviewStrip({ hotelId }: { hotelId: number }) {
  const [state, formAction, pending] = useActionState<PublishResult, FormData>(
    submitForReview.bind(null, hotelId),
    { ok: true },
  );
  const missing = state.ok ? [] : state.missing ?? [];

  return (
    <div className="shrink-0 bg-emerald-50 border-t-2 border-emerald-200 px-6 py-3.5">
      <div className="max-w-4xl mx-auto">
        {missing.length > 0 && (
          <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
            <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
              <WarningCircleIcon size={14} weight="fill" /> Please complete these before publishing:
            </p>
            <ul className="mt-1 text-xs text-red-600 list-disc pl-5 space-y-0.5">
              {missing.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            {missing.includes(EMAIL_VERIFY_MISSING_ITEM) && <ResendVerificationLink />}
          </div>
        )}
        <form action={formAction} className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckCircleIcon size={18} weight="fill" className="text-emerald-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-800 leading-none">All sections complete!</p>
              <p className="text-xs text-emerald-600 mt-0.5 truncate">
                Submit for review — approved properties go live with a public page.
              </p>
            </div>
          </div>
          <Button
            type="submit"
            loading={pending}
            variant="primary"
            size="sm"
            className="bg-emerald-500 hover:bg-emerald-600 border-emerald-500 hover:border-emerald-600 shrink-0"
          >
            <PaperPlaneTiltIcon size={14} weight="bold" />
            Submit for Review
          </Button>
        </form>
      </div>
    </div>
  );
}
