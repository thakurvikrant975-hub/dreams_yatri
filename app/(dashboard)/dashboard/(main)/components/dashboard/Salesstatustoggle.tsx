"use client";

// app/(dashboard)/components/dashboard/SalesStatusToggle.tsx
import { useTransition, useState, useEffect } from "react";
import { toggleMemberStatus } from "../../actions/member-actions";

interface SalesStatusToggleProps {
  memberId:      string;
  initialActive: boolean;
}

export function SalesStatusToggle({ memberId, initialActive }: SalesStatusToggleProps) {
  const [isActive, setIsActive]     = useState(initialActive);
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted]        = useState(false);

  useEffect(() => setMounted(true), []);

  const handleToggle = () => {
    if (isPending) return;
    const next = !isActive;
    setIsActive(next);
    startTransition(async () => {
      const result = await toggleMemberStatus(memberId, next);
      if (!result.success) setIsActive(!next);
    });
  };

  if (!mounted) return null;

  return (
    <>
      <style>{`
        @keyframes tog-spin {
          to { transform: rotate(360deg); }
        }
        .tog-spin {
          animation: tog-spin 0.7s linear infinite;
        }
      `}</style>

      <div className="inline-flex items-center gap-2.5">

        {/* The pill track */}
        <button
          onClick={handleToggle}
          disabled={isPending}
          aria-pressed={isActive}
          aria-label={isActive ? "Set inactive" : "Set active"}
          className={[
            "relative flex items-center",
            "w-[72px] h-[34px] rounded-full p-[3px]",
            "border-0 outline-none",
            "transition-[background] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
            "focus-visible:ring-2 focus-visible:ring-offset-2",
            isActive
              ? "bg-green-400 focus-visible:ring-green-400"
              : "bg-slate-300 dark:bg-slate-600 focus-visible:ring-slate-400",
            isPending ? "cursor-wait opacity-70" : "cursor-pointer",
          ].join(" ")}
        >
          {/* ON label — visible when active */}
          <span
            aria-hidden="true"
            className={[
              "absolute left-2.5 top-1/2 -translate-y-1/2",
              "text-[10px] font-bold tracking-wide text-white",
              "transition-opacity duration-200 select-none pointer-events-none",
              isActive ? "opacity-100" : "opacity-0",
            ].join(" ")}
          >
            ON
          </span>

          {/* OFF label — visible when inactive */}
          <span
            aria-hidden="true"
            className={[
              "absolute right-2 top-1/2 -translate-y-1/2",
              "text-[10px] font-bold tracking-wide text-slate-700 dark:text-slate-400",
              "transition-opacity duration-200 select-none pointer-events-none",
              isActive ? "opacity-0" : "opacity-100",
            ].join(" ")}
          >
            OFF
          </span>

          {/* Thumb */}
          <span
            aria-hidden="true"
            className={[
              "relative flex items-center justify-center",
              "w-7 h-7 rounded-full bg-white",
              "transition-transform duration-[350ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
              isActive ? "translate-x-[38px]" : "translate-x-0",
            ].join(" ")}
          >
            {/* Icon inside thumb */}
            {isPending ? (
              <svg
                className="tog-spin w-3.5 h-3.5 text-slate-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
              >
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
            ) : isActive ? (
              <svg
                className="w-3.5 h-3.5 text-green-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg
                className="w-3 h-3 text-slate-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            )}
          </span>
        </button>

        {/* Status label beside the toggle */}
        <span
          className={[
            "text-xs font-semibold tabular-nums min-w-[48px]",
            "transition-colors duration-300 select-none",
            isPending
              ? "text-muted-foreground"
              : isActive
              ? "text-green-600 dark:text-green-400"
              : "text-slate-400 dark:text-slate-500",
          ].join(" ")}
        >
          {isPending ? "Saving…" : isActive ? "Active" : "Inactive"}
        </span>
      </div>
    </>
  );
}