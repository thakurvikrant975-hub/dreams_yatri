"use client";

// Custom Hour / Minute / AM-PM picker — replaces the native <input type="time">
// for hotel check-in/check-out times. The native control's displayed format
// (12h with AM/PM vs 24h) is decided by the OS locale, not the browser or the
// page — on Windows (whose default locale is usually 24h) it renders with no
// AM/PM indicator at all, so a value typed as "02:00" is ambiguous to the
// user and easy to enter as the wrong half of the day. This picker always
// shows an explicit AM/PM segment regardless of OS, while still producing
// the same "HH:MM" 24h string every consumer of check_in_time/check_out_time
// already expects (see hotel-inventory/[id]/page.tsx's formatTime12h, the
// package builder, the public booking pages, etc.).

import { cn } from "@/app/lib/utils";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../ui/select";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function parse24h(value: string | null | undefined): { hour12: number; minute: number; period: "AM" | "PM" } {
  const [hStr, mStr] = (value ?? "").split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return { hour12: 12, minute: 0, period: "PM" };
  const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return { hour12, minute: m, period };
}

function to24h(hour12: number, minute: number, period: "AM" | "PM"): string {
  const h = period === "PM" ? (hour12 % 12) + 12 : hour12 % 12;
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function TimePicker12h({
  value,
  onChange,
  disabled = false,
  className,
}: {
  /** 24h "HH:MM", e.g. "14:00" — same format the hotels table stores. */
  value:      string;
  onChange:   (value24h: string) => void;
  disabled?:  boolean;
  className?: string;
}) {
  const { hour12, minute, period } = parse24h(value);

  function update(patch: Partial<{ hour12: number; minute: number; period: "AM" | "PM" }>) {
    onChange(to24h(patch.hour12 ?? hour12, patch.minute ?? minute, patch.period ?? period));
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Select disabled={disabled} value={String(hour12)} onValueChange={(v) => update({ hour12: Number(v) })}>
        <SelectTrigger className="w-[64px] bg-dashboard-base-100 border-dashboard-base-content/20 cursor-pointer">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {HOURS.map((h) => (
            <SelectItem key={h} value={String(h)} className="cursor-pointer">{h}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-dashboard-base-content/50 font-medium">:</span>
      <Select disabled={disabled} value={String(minute)} onValueChange={(v) => update({ minute: Number(v) })}>
        <SelectTrigger className="w-[64px] bg-dashboard-base-100 border-dashboard-base-content/20 cursor-pointer">
          <SelectValue>{String(minute).padStart(2, "0")}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {MINUTES.map((m) => (
            <SelectItem key={m} value={String(m)} className="cursor-pointer">{String(m).padStart(2, "0")}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select disabled={disabled} value={period} onValueChange={(v) => update({ period: v as "AM" | "PM" })}>
        <SelectTrigger className="w-[76px] bg-dashboard-base-100 border-dashboard-base-content/20 cursor-pointer">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="AM" className="cursor-pointer">AM</SelectItem>
          <SelectItem value="PM" className="cursor-pointer">PM</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
