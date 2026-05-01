// app/dashboard/components/shared/SalesStatusToggle.tsx
"use client";

import { useTransition, useState } from "react";
import { cn } from "@/app/lib/utils";
import { toggleMemberStatus } from "../../actions/member-actions";

interface SalesStatusToggleProps {
  memberId: string;
  initialActive: boolean;
}

export function SalesStatusToggle({ memberId, initialActive }: SalesStatusToggleProps) {
  const [isActive, setIsActive] = useState(initialActive);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    const next = !isActive;
    setIsActive(next); // optimistic
    startTransition(async () => {
      const result = await toggleMemberStatus(memberId, next);
      if (!result.success) setIsActive(!next); // rollback on error
    });
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={cn(
        "group relative flex items-center gap-2.5 px-3.5 py-2 rounded-xl border transition-all duration-200",
        "text-sm font-medium select-none",
        isActive
          ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/15"
          : "border-border bg-muted/50 text-muted-foreground hover:bg-muted",
        isPending && "opacity-60 cursor-not-allowed"
      )}
    >
      {/* Pulsing dot */}
      <span className="relative flex h-2 w-2">
        {isActive && !isPending && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
        )}
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full",
            isActive ? "bg-green-500" : "bg-muted-foreground/50",
            isPending && "animate-pulse"
          )}
        />
      </span>

      {isPending ? "Updating..." : isActive ? "Active" : "Offline"}

      {/* Toggle pill */}
      <span
        className={cn(
          "ml-1 inline-flex items-center h-4 w-7 rounded-full border transition-colors duration-200",
          isActive ? "bg-green-500 border-green-500" : "bg-muted-foreground/20 border-border"
        )}
      >
        <span
          className={cn(
            "h-3 w-3 rounded-full bg-white shadow transition-transform duration-200",
            isActive ? "translate-x-3.5" : "translate-x-0.5"
          )}
        />
      </span>
    </button>
  );
}