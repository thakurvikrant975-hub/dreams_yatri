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

export interface PricingRangeCalendarProps {
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
  weekdayPrice?: number | string;
  weekendPrice?: number | string;
  weekendEnabled?: boolean;
  className?: string;
  fromYear?: number;
  toYear?: number;
  disabled?: boolean;
}

export interface PricingRangeCalendarPickerProps extends Omit<PricingRangeCalendarProps, "className"> {
  placeholder?: string;
  triggerClassName?: string;
  error?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatPrice(price?: number | string): string {
  if (price === undefined || price === null || price === "") return "";
  const n = typeof price === "string" ? parseFloat(price) : price;
  if (isNaN(n) || n <= 0) return "";
  return `₹${n.toLocaleString("en-IN")}`;
}

function formatRangeLabel(range?: DateRange): string {
  if (!range?.from) return "";
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  if (!range.to) return `From ${fmt(range.from)}`;
  return `${fmt(range.from)}  →  ${fmt(range.to)}`;
}

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

  const label = formatRangeLabel(value);
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
            open && "ring-2 ring-ring",
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

// ── Calendar (used standalone or inside picker) ───────────────────────────

export function PricingRangeCalendar({
  value,
  onChange,
  weekdayPrice,
  weekendPrice,
  weekendEnabled = false,
  className,
  fromYear,
  toYear,
  disabled = false,
}: PricingRangeCalendarProps) {
  const now = new Date();

  return (
    <Calendar
      mode="range"
      selected={value}
      onSelect={onChange}
      disabled={disabled}
      showOutsideDays
      captionLayout="dropdown"
      defaultMonth={value?.from}
      startMonth={
        fromYear
          ? new Date(fromYear, 0)
          : new Date(now.getFullYear(), now.getMonth())
      }
      endMonth={
        toYear
          ? new Date(toYear, 11)
          : new Date(now.getFullYear() + 5, 11)
      }
      className={cn(
        "rounded-xl border bg-background shadow-sm p-3 [--cell-size:--spacing(9)] w-full",
        className,
      )}
      classNames={{
        weekdays: "flex gap-1.5 mb-1",
        weekday: "flex-1 text-[0.75rem] font-normal text-muted-foreground text-center",
        week: "mt-1.5 flex w-full gap-1.5",
        day: [
          "group/day relative flex-1 aspect-square p-0 text-center select-none",
          "[&>button]:h-full [&>button]:rounded-xl!",
          "[&:last-child[data-selected=true]_button]:rounded-r-xl",
          "[&:first-child[data-selected=true]_button]:rounded-l-xl",
        ].join(" "),
        range_start: "relative isolate z-0",
        range_end: "relative isolate z-0",
      }}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString("default", { month: "long" }),
      }}
      components={{
        DayButton: ({ children, modifiers, day, className: dayBtnCn, ...props }) => {
          const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
          const effectivePrice =
            isWeekend && weekendEnabled && weekendPrice
              ? weekendPrice
              : weekdayPrice;
          const priceLabel = !modifiers.outside
            ? formatPrice(effectivePrice)
            : "";

          const isSelected = modifiers.selected && !modifiers.range_middle;
          const isMiddle   = modifiers.range_middle;
          const isOutside  = modifiers.outside;

          return (
            <CalendarDayButton
              day={day}
              modifiers={modifiers}
              className={cn(
                dayBtnCn,
                !isOutside && !isSelected && !isMiddle && "bg-muted/40",
                isSelected && "bg-dashboard-primary! text-white!",
                isMiddle   && "bg-dashboard-primary/15! text-foreground!",
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
                    !isSelected && !isMiddle && isWeekend && weekendEnabled
                      ? "text-amber-600 dark:text-amber-400"
                      : !isSelected && !isMiddle && "text-muted-foreground",
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
