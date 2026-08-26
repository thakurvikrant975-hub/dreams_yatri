"use client";

import { toast } from "sonner";
import { unstable_isUnrecognizedActionError } from "next/navigation";

/** Call from a Server Action's catch block instead of toasting the caught
 * error directly. Distinguishes a genuine network failure from a stale page
 * bundle calling a Server Action ID that no longer exists on the server —
 * which happens whenever someone leaves a tab open across a new deploy, and
 * throws a distinct, typed error (not a network TypeError). Telling them to
 * "check your connection" for that case sends them down the wrong
 * troubleshooting path entirely; what they actually need is to reload. */
export function reportActionError(err: unknown, fallbackMessage: string): void {
  if (unstable_isUnrecognizedActionError(err)) {
    toast.error("This page was updated to a newer version — reload to keep going.", {
      action: { label: "Reload", onClick: () => window.location.reload() },
      duration: 15000,
    });
    return;
  }
  toast.error(fallbackMessage);
}
