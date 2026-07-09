"use client";

import { useState } from "react";
import { resendVerificationEmail } from "@/app/(hotel-connect)/hotel-connect/(auth)/verify-email/actions";

export default function ResendVerificationLink() {
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
        className="text-xs font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900 disabled:opacity-50"
      >
        {status === "sending" ? "Sending…" : "Resend verification email"}
      </button>
      {message && <p className="text-xs text-amber-700 mt-0.5">{message}</p>}
      {devUrl && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1">
          Dev mode — email delivery is skipped, verify directly:{" "}
          <a href={devUrl} className="underline font-medium">{devUrl}</a>
        </p>
      )}
    </div>
  );
}
