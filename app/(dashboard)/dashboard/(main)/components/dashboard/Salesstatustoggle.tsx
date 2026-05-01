"use client";

import { useTransition, useState, useEffect } from "react";
import { cn } from "@/app/lib/utils";
import { toggleMemberStatus } from "../../actions/member-actions";

interface SalesStatusToggleProps {
  memberId: string;
  initialActive: boolean;
}

const ACTIVE_LABELS   = ["On Fire 🔥", "Beast Mode 🦁", "Closing 💰", "Dialing 📞", "Let's Go ⚡"];
const INACTIVE_LABELS = ["Gone Dark 🌙", "AFK 💤", "Ghosted 👻", "Offline 🪦", "Vanished 🌫️"];

export function SalesStatusToggle({ memberId, initialActive }: SalesStatusToggleProps) {
  const [isActive, setIsActive]       = useState(initialActive);
  const [isPending, startTransition]  = useTransition();
  const [labelSeed]                   = useState(() => Math.floor(Math.random() * 100));
  const [justToggled, setJustToggled] = useState(false);
  const [mounted, setMounted]         = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleToggle = () => {
    if (isPending) return;
    const next = !isActive;
    setIsActive(next);
    setJustToggled(true);
    setTimeout(() => setJustToggled(false), 300);
    startTransition(async () => {
      const result = await toggleMemberStatus(memberId, next);
      if (!result.success) setIsActive(!next);
    });
  };

  const activeLabel   = ACTIVE_LABELS[labelSeed % ACTIVE_LABELS.length];
  const inactiveLabel = INACTIVE_LABELS[labelSeed % INACTIVE_LABELS.length];

  if (!mounted) return null;

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      aria-pressed={isActive}
      className={cn(
        "relative flex items-center gap-3 px-4 py-2.5 rounded-2xl border-2",
        "text-sm font-semibold select-none outline-none cursor-pointer",
        "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isActive
          ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 focus-visible:ring-emerald-400"
          : "border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 focus-visible:ring-zinc-400",
        isPending && "opacity-60 cursor-wait",
      )}
      style={{
        transform: justToggled ? "scale(0.94)" : "scale(1)",
        transition: "transform 150ms ease, background-color 300ms ease, border-color 300ms ease, color 300ms ease",
      }}
    >
      {/* Pulsing status dot */}
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        {isActive && !isPending && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
        )}
        {isPending && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
        )}
        <span
          className="relative inline-flex h-2.5 w-2.5 rounded-full"
          style={{
            backgroundColor: isPending ? "#fbbf24" : isActive ? "#10b981" : "#9ca3af",
            transition: "background-color 300ms ease",
          }}
        />
      </span>

      {/* Label */}
      <span style={{ minWidth: "96px", textAlign: "left" }}>
        {isPending ? "Updating..." : isActive ? activeLabel : inactiveLabel}
      </span>

      {/* Toggle pill */}
      <span
        style={{
          position: "relative",
          display: "inline-block",
          height: "24px",
          width: "44px",
          flexShrink: 0,
          borderRadius: "9999px",
          border: "2px solid",
          borderColor: isActive ? "#10b981" : "#d1d5db",
          backgroundColor: isActive ? "#10b981" : "#e5e7eb",
          transition: "background-color 300ms ease, border-color 300ms ease",
        }}
      >
        {/* Thumb */}
        <span
          style={{
            position: "absolute",
            top: "2px",
            left: isActive ? "22px" : "2px",
            height: "16px",
            width: "16px",
            borderRadius: "9999px",
            backgroundColor: "#ffffff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            transition: "left 300ms ease",
          }}
        />
      </span>
    </button>
  );
}