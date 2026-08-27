"use client";

import { useState } from "react";
import { CheckCircle2, UserRoundPen } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { OnboardingPopup } from "./OnboardingPopup";
import type { ProfileData } from "../../profile/ProfileClient";

/** Header pill that surfaces the same "May I know you" form from anywhere in
 * the dashboard — not just the moment a required field is missing. The
 * dashboard layout auto-opens this popup once when required fields are
 * missing (autoOpen); this button opens the identical instance manually so
 * someone can review or update their details at any time. "Complete" here
 * means the required fields are filled in — it is not a claim that anyone
 * has verified the documents. */
export function ProfileCompletionBadge({
  profile, isComplete, autoOpen,
}: {
  profile: ProfileData;
  isComplete: boolean;
  autoOpen: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={isComplete ? "Your details are on file — click to review" : "A few required details are still missing"}
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
          isComplete
            ? "border-dashboard-success/30 bg-dashboard-success/10 text-dashboard-success hover:bg-dashboard-success/15"
            : "border-dashboard-warning/30 bg-dashboard-warning/10 text-dashboard-warning hover:bg-dashboard-warning/15",
        )}
      >
        {isComplete ? <CheckCircle2 size={14} /> : <UserRoundPen size={14} />}
        {isComplete ? "Profile Complete" : "Complete Your Profile"}
      </button>

      <OnboardingPopup profile={profile} open={open} onOpenChange={setOpen} />
    </>
  );
}