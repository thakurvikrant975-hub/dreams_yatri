"use client";

// app/(dashboard)/components/dashboard/SalesTargetBadgeShell.tsx
import { type ReactNode, useRef } from "react";

interface BadgeShellProps {
  className?: string;
  ariaLabel:  string;
  children:   ReactNode;
}

export function BadgeShell({ className, ariaLabel, children }: BadgeShellProps) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      role="status"
      aria-label={ariaLabel}
      className={className}
      onMouseEnter={() => { if (ref.current) ref.current.style.transform = "translateY(-1px)"; }}
      onMouseLeave={() => { if (ref.current) ref.current.style.transform = "translateY(0)"; }}
    >
      {children}
    </div>
  );
}