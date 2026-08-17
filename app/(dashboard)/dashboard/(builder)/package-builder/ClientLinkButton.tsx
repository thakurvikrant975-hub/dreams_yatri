"use client";

// ─────────────────────────────────────────────────────────────────────────────
// The client's link to the live itinerary.
//
// Sharing a package already publishes it at /custom-package/[id] — a real page
// with the full itinerary and Book Now — and already hands the exec that URL:
// copied to the clipboard, put in the WhatsApp message, and emailed to the
// client. The gap this fills is that the link was only ever *retrievable* in
// the toast at send time. Dismiss it, come back tomorrow, and there was no
// control anywhere to copy it again or open the page and see what the client
// sees. Next to "Download PDF", that made the whole thing look missing.
//
// The URL is built the same way the server builds it (NEXT_PUBLIC_BASE_URL,
// falling back to the production domain — never window.location.origin, which
// would hand someone a localhost link they'd send to a client).
//
// Before the package is sent this renders as a disabled hint rather than
// nothing, because "where is the link" is the question it exists to answer.
// getSharedPackage refuses anything that isn't SENT, on purpose — a draft is
// not visible to someone who merely knows the id — so an early link would be a
// dead one, and saying why beats hiding.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { toast } from "sonner";
import { Link2, Check, ExternalLink } from "lucide-react";

export function clientShareUrl(packageId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://dreamsyatri.org";
  return `${baseUrl}/custom-package/${packageId}`;
}

export function ClientLinkButton({ packageId, isLive, className }: {
  packageId: string;
  /** custom_packages.status === "SENT" — the only state the public page serves. */
  isLive: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const url = clientShareUrl(packageId);

  if (!isLive) {
    return (
      <span
        title="The client's page goes live when you share the package. Costing has to approve it first."
        className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-dashed border-dashboard-base-300 text-dashboard-base-content/45 text-xs font-medium cursor-default ${className ?? ""}`}
      >
        <Link2 size={13} />
        <span className="hidden lg:inline">Link after sharing</span>
      </span>
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Client link copied", { description: url });
    } catch {
      // Clipboard is blocked outside a secure context and on some embedded
      // browsers. The link is the point, so show it to be copied by hand
      // rather than failing silently.
      toast.info("Copy this link", { description: url, duration: 15000 });
    }
  }

  return (
    <span className={`inline-flex items-center ${className ?? ""}`}>
      <button
        type="button"
        onClick={copy}
        title={url}
        className="inline-flex items-center gap-1.5 h-8 pl-2.5 pr-2 rounded-l-md border border-r-0 border-dashboard-base-300 hover:bg-dashboard-base-200 text-dashboard-base-content text-xs font-medium transition-colors"
      >
        {copied ? <Check size={13} className="text-dashboard-success" /> : <Link2 size={13} />}
        <span className="hidden sm:inline">{copied ? "Copied!" : "Client link"}</span>
      </button>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title="Open the client's page in a new tab — exactly what they see"
        className="inline-flex items-center h-8 px-2 rounded-r-md border border-dashboard-base-300 hover:bg-dashboard-base-200 text-dashboard-base-content/70 hover:text-dashboard-base-content transition-colors"
      >
        <ExternalLink size={13} />
      </a>
    </span>
  );
}
