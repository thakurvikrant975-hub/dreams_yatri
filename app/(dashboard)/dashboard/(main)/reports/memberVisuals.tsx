"use client";

import { cn } from "@/app/lib/utils";

// ── Shared member identity helpers ──────────────────────────────────────────
// Used by HotelReportTab / TravelReportTab / CabReportTab so a given team
// member always renders with the exact same color in their avatar, count
// badge, selected-card accent, and trend-chart line — drawn only from the
// CRM's own design tokens (globals.css), never a generic/off-brand palette.

export function initials(name: string): string {
  return name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export type MemberPaletteSlot = {
  css:    string; // raw CSS value — for inline style / chart series color
  bg:     string; // tinted background utility
  text:   string; // full-strength text utility
  border: string; // full-strength border utility (selected-card accent)
  ring:   string; // avatar ring utility
};

// Fixed hue order — cycles through the app's real semantic tokens instead of
// a hash-generated or generic Tailwind color, so every identity color still
// "belongs" to this CRM's brand.
const MEMBER_PALETTE: MemberPaletteSlot[] = [
  { css: "var(--color-dashboard-primary)",   bg: "bg-dashboard-primary/10",   text: "text-dashboard-primary",   border: "border-dashboard-primary",   ring: "ring-dashboard-primary/20" },
  { css: "var(--color-dashboard-secondary)", bg: "bg-dashboard-secondary/10", text: "text-dashboard-secondary", border: "border-dashboard-secondary", ring: "ring-dashboard-secondary/20" },
  { css: "var(--color-dashboard-accent)",    bg: "bg-dashboard-accent/10",    text: "text-dashboard-accent",    border: "border-dashboard-accent",    ring: "ring-dashboard-accent/20" },
  { css: "var(--color-dashboard-success)",   bg: "bg-dashboard-success/10",   text: "text-dashboard-success",   border: "border-dashboard-success",   ring: "ring-dashboard-success/20" },
  { css: "var(--color-dashboard-warning)",   bg: "bg-dashboard-warning/15",   text: "text-dashboard-warning",   border: "border-dashboard-warning",   ring: "ring-dashboard-warning/20" },
  { css: "var(--color-dashboard-error)",     bg: "bg-dashboard-error/10",     text: "text-dashboard-error",     border: "border-dashboard-error",     ring: "ring-dashboard-error/20" },
  { css: "var(--color-dashboard-neutral)",   bg: "bg-dashboard-neutral/10",   text: "text-dashboard-neutral",   border: "border-dashboard-neutral",   ring: "ring-dashboard-neutral/20" },
];

// Hashed by member ID (never name) — two people can share a display name,
// but never an ID, so this can never assign the same color to two identities
// or a different color to the same identity across renders.
export function memberPalette(id: string): MemberPaletteSlot {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return MEMBER_PALETTE[h % MEMBER_PALETTE.length];
}

// ── Avatar ───────────────────────────────────────────────────────────────────

export function MemberAvatar({
  member, size = "md",
}: {
  member: { id: string; name: string; profilePicUrl?: string | null };
  size?: "sm" | "md" | "lg";
}) {
  const sz = size === "sm" ? "h-8 w-8 text-xs" : size === "lg" ? "h-14 w-14 text-lg" : "h-11 w-11 text-sm";
  if (member.profilePicUrl) {
    return (
      <img
        src={member.profilePicUrl}
        alt={member.name}
        className={cn("rounded-full object-cover shrink-0 ring-2 ring-dashboard-base-100", sz)}
      />
    );
  }
  const p = memberPalette(member.id);
  return (
    <div className={cn("rounded-full flex items-center justify-center font-bold shrink-0 ring-2 ring-dashboard-base-100", sz, p.bg, p.text)}>
      {initials(member.name)}
    </div>
  );
}

// ── Stat chip ────────────────────────────────────────────────────────────────
// Colors here are per STAT TYPE (hotels/rooms/images/…), not per member —
// always a dashboard-* semantic token, never an off-brand Tailwind color.

export function StatChip({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] leading-none">
      <span className={cn("font-semibold tabular-nums", color)}>{value}</span>
      <span className="text-dashboard-base-content/40">{label}</span>
    </span>
  );
}
