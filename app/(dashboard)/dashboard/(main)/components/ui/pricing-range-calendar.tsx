"use client";

import * as React from "react";
import type { DateRange } from "react-day-picker";
import { CalendarDays, X, Check } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { Calendar, CalendarDayButton } from "./calendar";
import { Button } from "./button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover";

// ── Public types ──────────────────────────────────────────────────────────

export type { DateRange };

/** A single season's date range + prices. `from`/`to` are "MM-DD" strings. */
export type SeasonRange = {
  from: string;            // "MM-DD"  e.g. "01-01"
  to:   string;            // "MM-DD"  e.g. "03-31"
  weekdayPrice:   number;
  weekendPrice?:  number | null;
  weekendEnabled?: boolean;
};

export interface PricingRangeCalendarProps {
  value?:    DateRange;
  onChange?: (range: DateRange | undefined) => void;
  /** All configured seasons for this vehicle (used for per-date price lookup). */
  seasons?:   SeasonRange[];
  /** Fallback price shown on dates not covered by any season. */
  basePrice?: number;
  className?: string;
  disabled?:  boolean;
}

export interface PricingRangeCalendarPickerProps
  extends Omit<PricingRangeCalendarProps, "className"> {
  placeholder?:    string;
  triggerClassName?: string;
  error?:          boolean;
}

// ── Price helpers ─────────────────────────────────────────────────────────

function formatPrice(n?: number): string {
  if (n == null || n <= 0) return "";
  return `₹${n.toLocaleString("en-IN")}`;
}

/** True when mmdd (e.g. "05-21") falls within [from, to] (handles year-wrap). */
function inMonthDayRange(mmdd: string, from: string, to: string): boolean {
  if (from <= to) return from <= mmdd && mmdd <= to;
  return mmdd >= from || mmdd <= to; // cross-year: e.g. "11-01" – "02-28"
}

function getPriceForDate(
  date:      Date,
  seasons:   SeasonRange[],
  basePrice: number,
): number {
  const mm   = String(date.getMonth() + 1).padStart(2, "0");
  const dd   = String(date.getDate()).padStart(2, "0");
  const mmdd = `${mm}-${dd}`;
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

  for (const s of seasons) {
    if (inMonthDayRange(mmdd, s.from, s.to)) {
      const p =
        isWeekend && s.weekendEnabled && s.weekendPrice != null
          ? s.weekendPrice
          : s.weekdayPrice;
      return p;
    }
  }
  return basePrice;
}

// ── Trigger label (no year) ───────────────────────────────────────────────

function formatRangeLabel(range?: DateRange): string {
  if (!range?.from) return "";
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  if (!range.to) return `From ${fmt(range.from)}`;
  return `${fmt(range.from)}  →  ${fmt(range.to)}`;
}

// ── Fixed-year constants (all seasons use year 2000) ─────────────────────

const REF_YEAR   = 2000;
const START_MONTH = new Date(REF_YEAR, 0, 1);   // Jan 2000
const END_MONTH   = new Date(REF_YEAR, 11, 31);  // Dec 2000

// ── Popover picker ────────────────────────────────────────────────────────

export function PricingRangeCalendarPicker({
  value,
  onChange,
  placeholder = "Select date range",
  triggerClassName,
  error,
  ...calendarProps
}: PricingRangeCalendarPickerProps) {
  const [open, setOpen] = React.useState(false);

  const label    = formatRangeLabel(value);
  const hasRange = !!(value?.from && value?.to);

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange?.(undefined);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2 rounded-md border bg-background px-3 h-9 text-sm",
            "hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            error && "border-destructive",
            open  && "ring-2 ring-ring",
            triggerClassName,
          )}
        >
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className={cn("flex-1 text-left truncate", !label && "text-muted-foreground")}>
            {label || placeholder}
          </span>
          {label && (
            <span
              role="button"
              tabIndex={-1}
              onClick={handleClear}
              className="ml-auto text-muted-foreground/50 hover:text-foreground transition-colors shrink-0 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-auto p-0 rounded-xl shadow-lg"
      >
        <PricingRangeCalendar
          value={value}
          onChange={onChange}
          {...calendarProps}
          className="border-0 shadow-none rounded-xl"
        />
        <div className="px-3 pb-3 flex items-center gap-2">
          {label && (
            <p className="flex-1 text-xs text-muted-foreground truncate">{label}</p>
          )}
          <Button
            type="button"
            size="sm"
            disabled={!hasRange}
            onClick={() => setOpen(false)}
            className="ml-auto h-7 px-3 text-xs gap-1.5 bg-dashboard-primary text-white hover:bg-dashboard-primary/90"
          >
            <Check className="h-3 w-3" />
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Calendar ──────────────────────────────────────────────────────────────

export function PricingRangeCalendar({
  value,
  onChange,
  seasons    = [],
  basePrice  = 0,
  className,
  disabled   = false,
}: PricingRangeCalendarProps) {
  return (
    <Calendar
      mode="range"
      selected={value}
      onSelect={onChange}
      disabled={disabled}
      showOutsideDays
      captionLayout="label"
      defaultMonth={value?.from ?? START_MONTH}
      startMonth={START_MONTH}
      endMonth={END_MONTH}
      className={cn(
        "rounded-xl border bg-background shadow-sm p-3 [--cell-size:--spacing(9)] w-full",
        className,
      )}
      classNames={{
        weekdays: "flex mb-1",
        weekday:  "flex-1 text-[0.75rem] font-normal text-muted-foreground text-center",
        week:     "mt-1 flex w-full",
        // Container cell — no gap; range classes paint the band directly on the td
        day:          "group/day relative flex-1 p-0 text-center select-none",
        // Band: left-cap, middle strip, right-cap; first:/last: handle row-wrap edges
        range_start:  "relative isolate z-0 rounded-l-md bg-dashboard-primary/15 last:rounded-r-md",
        range_end:    "relative isolate z-0 rounded-r-md bg-dashboard-primary/15 first:rounded-l-md",
        range_middle: "relative isolate z-0 bg-dashboard-primary/15 first:rounded-l-md last:rounded-r-md",
        // Remove default today container bg — handled on the button below
        today:        "",
      }}
      formatters={{
        // Show only month name — no year
        formatCaption: (date) =>
          date.toLocaleString("default", { month: "long" }),
      }}
      components={{
        DayButton: ({ children, modifiers, day, className: dayBtnCn, ...props }) => {
          const price      = modifiers.outside ? 0 : getPriceForDate(day.date, seasons, basePrice);
          const priceLabel = modifiers.outside ? "" : formatPrice(price);

          const isSelected = modifiers.selected && !modifiers.range_middle;
          const isMiddle   = modifiers.range_middle;
          const isOutside  = modifiers.outside;
          const isToday    = modifiers.today;

          return (
            <CalendarDayButton
              day={day}
              modifiers={modifiers}
              className={cn(
                dayBtnCn,
                // Shared: full height, vertical rhythm
                "w-full py-1.5 flex flex-col items-center justify-center gap-0.5",
                // Normal cell — small side margin creates subtle breathing room between cells
                !isOutside && !isSelected && !isMiddle && [
                  "mx-px rounded-md bg-muted/40 hover:bg-muted/60",
                  isToday && "ring-2 ring-inset ring-dashboard-primary/50",
                ],
                // Range start / end / single — solid primary pill
                isSelected && "bg-dashboard-primary! text-white! rounded-md!",
                // Range middle — transparent; band colour comes from the td container
                isMiddle   && "bg-transparent! rounded-none! text-foreground!",
              )}
              {...props}
            >
              {children}
              {priceLabel && (
                <span
                  className={cn(
                    "text-[10px] font-medium leading-none",
                    isSelected && "text-white/75",
                    isMiddle   && "text-dashboard-primary/70",
                    !isSelected && !isMiddle && "text-muted-foreground",
                  )}
                >
                  {priceLabel}
                </span>
              )}
            </CalendarDayButton>
          );
        },
      }}
    />
  );
}
