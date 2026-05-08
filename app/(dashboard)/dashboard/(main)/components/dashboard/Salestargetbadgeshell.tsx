"use client";

// app/(dashboard)/components/dashboard/SalesTargetBadgeShell.tsx
import { type CSSProperties, type ReactNode, useRef } from "react";

interface BadgeShellProps {
  style?: CSSProperties;
  ariaLabel: string;
  children: ReactNode;
}

/**
 * Thin client wrapper — owns only the hover-lift interaction.
 * Everything else (data, layout, styles) lives in the server component above it.
 */
export function BadgeShell({ style, ariaLabel, children }: BadgeShellProps) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      role="status"
      aria-label={ariaLabel}
      style={style}
      onMouseEnter={() => {
        if (ref.current) ref.current.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={() => {
        if (ref.current) ref.current.style.transform = "translateY(0)";
      }}
    >
      {children}
    </div>
  );
}