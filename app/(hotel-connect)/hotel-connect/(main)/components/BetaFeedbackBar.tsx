"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { RocketLaunchIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { submitDashboardFeedback } from "./feedback-actions";
import { cn } from "@/app/lib/utils";

const DISMISS_KEY = "hc_beta_bar_dismissed";

function FeedbackModal({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await submitDashboardFeedback(message, pathname);
    setSubmitting(false);
    if (result.ok) {
      setSent(true);
    } else {
      setError(result.error ?? "Failed to send feedback. Please try again.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 size-7 rounded-full flex items-center justify-center text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors"
        >
          <XMarkIcon className="size-4" />
        </button>

        {sent ? (
          <div className="p-6 text-center">
            <div className="mx-auto mb-3 size-12 rounded-full bg-emerald-50 flex items-center justify-center">
              <RocketLaunchIcon className="size-6 text-emerald-500" />
            </div>
            <p className="text-sm font-semibold text-neutral-800">Thanks for the feedback!</p>
            <p className="text-xs text-neutral-500 mt-1">Our team will take a look shortly.</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 h-9 px-4 rounded-lg bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5">
            <p className="text-sm font-semibold text-neutral-800">Share feedback</p>
            <p className="text-xs text-neutral-500 mt-0.5 mb-3">
              Tell us what&apos;s confusing, broken, or missing in the dashboard — every note helps us improve it.
            </p>
            <textarea
              autoFocus
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Rate calendar is slow to load, would love a bulk-edit option…"
              rows={5}
              maxLength={4000}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm text-neutral-800 placeholder:text-neutral-400 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 transition-colors resize-none"
            />
            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-4 rounded-lg text-sm font-medium text-neutral-600 hover:bg-neutral-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !message.trim()}
                className="h-9 px-4 rounded-lg bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? "Sending…" : "Send feedback"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function BetaFeedbackBar() {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Read the dismissal after mount, client-only — matching the server-rendered
  // (bar visible) markup on first paint avoids a hydration mismatch, then this
  // hides it a frame later for anyone who already closed it before.
  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") setDismissed(true);
    } catch {
      // localStorage unavailable (private browsing etc.) — just leave it shown
    }
  }, []);

  function handleDismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore — worst case it reappears next visit
    }
  }

  if (dismissed) return null;

  return (
    <>
      <div className="relative shrink-0 bg-primary-500 text-white px-4 py-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider bg-white/15 rounded-full px-2 py-0.5">
          <RocketLaunchIcon className="size-3" />
          Beta
        </span>
        <p className="text-xs sm:text-sm font-medium">
          You&apos;re using the new Hotel Owner Dashboard — we&apos;re still polishing it.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "text-xs sm:text-sm font-semibold underline underline-offset-2 hover:no-underline transition-all",
          )}
        >
          Share feedback / report an issue
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss beta notice"
          title="Dismiss"
          className="absolute right-2 top-1/2 -translate-y-1/2 size-6 rounded-full flex items-center justify-center text-white/80 hover:bg-white/15 hover:text-white transition-colors"
        >
          <XMarkIcon className="size-3.5" />
        </button>
      </div>

      {open && <FeedbackModal onClose={() => setOpen(false)} />}
    </>
  );
}
