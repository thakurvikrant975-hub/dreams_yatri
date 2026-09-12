"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  endOfMonth, endOfWeek, format, isValid, parseISO,
  startOfMonth, startOfWeek, subDays, subMonths,
} from "date-fns";
import type { DateRange as DayPickerRange } from "react-day-picker";
import { CalendarDays, ChevronDown } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { Calendar } from "./calendar";
import { Button } from "./button";

/**
 * A date-range filter with named presets, in the shape analytics tools use:
 * presets down the left, an editable range and a two-month calendar on the
 * right, nothing applied until Apply is pressed.
 *
 * Dates are plain "YYYY-MM-DD" strings, inclusive of both ends, and never Date
 * objects across the boundary — a Date is an instant, and turning one back into
 * a calendar day in another timezone is how reports end up a day out.
 *
 * `today` is whose "today" the presets mean. The ads reports pass the ad
 * account's own date (Asia/Calcutta), so "Last 7 days" here matches what Google
 * shows; without it the browser's date is used.
 *
 * Presets follow the same convention as Google Ads and GA: the rolling windows
 * ("Last 7 / 14 / 30 days") end **yesterday**, because today is still
 * accumulating and a partial day drags every average down. "Today" and the
 * "…up to today" boxes are there when you do want the live figure.
 */

export type DateRangeValue = { from: string; to: string };

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const parse = (s: string) => parseISO(s);
const sameRange = (a: DateRangeValue, b: DateRangeValue) => a.from === b.from && a.to === b.to;

type Preset = { id: string; label: string; of: (today: Date, earliest?: string) => DateRangeValue };

const PRESETS: Preset[] = [
  { id: "today", label: "Today", of: (t) => ({ from: iso(t), to: iso(t) }) },
  { id: "yesterday", label: "Yesterday", of: (t) => ({ from: iso(subDays(t, 1)), to: iso(subDays(t, 1)) }) },
  { id: "thisWeek", label: "This week (Sun – Today)", of: (t) => ({ from: iso(startOfWeek(t, { weekStartsOn: 0 })), to: iso(t) }) },
  { id: "last7", label: "Last 7 days", of: (t) => ({ from: iso(subDays(t, 7)), to: iso(subDays(t, 1)) }) },
  {
    id: "lastWeek", label: "Last week (Sun – Sat)",
    of: (t) => {
      const start = startOfWeek(subDays(startOfWeek(t, { weekStartsOn: 0 }), 1), { weekStartsOn: 0 });
      return { from: iso(start), to: iso(endOfWeek(start, { weekStartsOn: 0 })) };
    },
  },
  { id: "last14", label: "Last 14 days", of: (t) => ({ from: iso(subDays(t, 14)), to: iso(subDays(t, 1)) }) },
  { id: "thisMonth", label: "This month", of: (t) => ({ from: iso(startOfMonth(t)), to: iso(t) }) },
  { id: "last30", label: "Last 30 days", of: (t) => ({ from: iso(subDays(t, 30)), to: iso(subDays(t, 1)) }) },
  {
    id: "lastMonth", label: "Last month",
    of: (t) => {
      const start = startOfMonth(subMonths(t, 1));
      return { from: iso(start), to: iso(endOfMonth(start)) };
    },
  },
  {
    id: "allTime", label: "All time",
    // Falls back to two years when nothing knows where the data starts.
    of: (t, earliest) => ({ from: earliest ?? iso(subDays(t, 730)), to: iso(t) }),
  },
];

/** "12 Jul – 12 Aug 2026", or a preset's name when the range is exactly one. */
export function describeRange(value: DateRangeValue, today: Date, earliest?: string): string {
  const preset = PRESETS.find((p) => sameRange(p.of(today, earliest), value));
  if (preset) return preset.label;
  const from = parse(value.from), to = parse(value.to);
  if (!isValid(from) || !isValid(to)) return "Select dates";
  if (value.from === value.to) return format(from, "d MMM yyyy");
  const sameYear = from.getFullYear() === to.getFullYear();
  return `${format(from, sameYear ? "d MMM" : "d MMM yyyy")} – ${format(to, "d MMM yyyy")}`;
}

export function DateRangeFilter({
  value,
  onApply,
  today: todayIso,
  earliest,
  className,
  busy = false,
}: {
  value: DateRangeValue;
  onApply: (range: DateRangeValue) => void;
  /** Whose "today" the presets mean, "YYYY-MM-DD". Defaults to this browser's. */
  today?: string;
  /** Earliest date with data, for "All time". */
  earliest?: string;
  className?: string;
  busy?: boolean;
}) {
  const today = useMemo(() => (todayIso ? parse(todayIso) : parse(iso(new Date()))), [todayIso]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRangeValue>(value);
  const panel = useRef<HTMLDivElement>(null);

  /** Reopening always starts from what is actually applied, never a stale draft.
   * Done on the click rather than in an effect, which would cascade a render. */
  const toggle = () => {
    if (!open) setDraft(value);
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (panel.current && !panel.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const apply = useCallback((range: DateRangeValue) => {
    const ordered = range.from > range.to ? { from: range.to, to: range.from } : range;
    setOpen(false);
    if (!sameRange(ordered, value)) onApply(ordered);
  }, [onApply, value]);

  const valid = isValid(parse(draft.from)) && isValid(parse(draft.to));
  const activePreset = PRESETS.find((p) => sameRange(p.of(today, earliest), draft))?.id;

  return (
    <div className={cn("relative", className)}>
      <Button
        type="button"
        variant="outline"
        onClick={toggle}
        disabled={busy}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="gap-2 font-normal"
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-dashboard-base-content/60" />
        <span>{describeRange(value, today, earliest)}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-dashboard-base-content/50 transition-transform", open && "rotate-180")} />
      </Button>

      {open && (
        <div
          ref={panel}
          role="dialog"
          aria-label="Choose a date range"
          className="absolute z-50 mt-2 flex max-h-[80vh] w-[min(44rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 shadow-xl sm:flex-row"
        >
          {/* Presets */}
          <div className="flex shrink-0 flex-col overflow-y-auto border-b border-dashboard-base-300 py-1.5 sm:w-56 sm:border-b-0 sm:border-r">
            {PRESETS.map((p) => {
              const range = p.of(today, earliest);
              const active = activePreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setDraft(range)}
                  onDoubleClick={() => apply(range)}
                  aria-pressed={active}
                  className={cn(
                    "px-4 py-2 text-left text-sm transition-colors",
                    active
                      ? "bg-dashboard-primary/10 font-medium text-dashboard-primary"
                      : "text-dashboard-base-content/80 hover:bg-dashboard-base-200",
                  )}
                >
                  {p.label}
                </button>
              );
            })}

            <div className="mt-1 space-y-2 border-t border-dashboard-base-300 px-4 pt-3 pb-2">
              <RelativeDays label="days up to today" onPick={(n) => setDraft({ from: iso(subDays(today, n - 1)), to: iso(today) })} />
              <RelativeDays label="days up to yesterday" onPick={(n) => setDraft({ from: iso(subDays(today, n)), to: iso(subDays(today, 1)) })} />
            </div>
          </div>

          {/* Range + calendar */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2 border-b border-dashboard-base-300 px-4 py-3">
              <DateBox label="Start date" value={draft.from} max={draft.to} onChange={(v) => setDraft((d) => ({ ...d, from: v }))} />
              <span className="pt-5 text-dashboard-base-content/40">—</span>
              <DateBox label="End date" value={draft.to} min={draft.from} max={iso(today)} onChange={(v) => setDraft((d) => ({ ...d, to: v }))} />
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-2 py-1">
              <Calendar
                mode="range"
                numberOfMonths={2}
                captionLayout="dropdown"
                startMonth={earliest ? parse(earliest) : subMonths(today, 24)}
                endMonth={today}
                defaultMonth={subMonths(valid ? parse(draft.to) : today, 1)}
                selected={valid ? { from: parse(draft.from), to: parse(draft.to) } : undefined}
                onSelect={(range: DayPickerRange | undefined) => {
                  if (!range?.from) return;
                  setDraft({ from: iso(range.from), to: iso(range.to ?? range.from) });
                }}
                disabled={{ after: today }}
                className="bg-transparent"
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-dashboard-base-300 px-4 py-3">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="button" size="sm" disabled={!valid} onClick={() => apply(draft)}>Apply</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** "[ 30 ] days up to today" — applies as you type, like the tools this copies. */
function RelativeDays({ label, onPick }: { label: string; onPick: (days: number) => void }) {
  const [days, setDays] = useState("30");
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={1}
        max={730}
        value={days}
        onChange={(e) => {
          setDays(e.target.value);
          const n = Number(e.target.value);
          if (Number.isInteger(n) && n >= 1 && n <= 730) onPick(n);
        }}
        className="w-16 rounded-md border border-dashboard-base-300 bg-dashboard-base-100 px-2 py-1 text-sm"
        aria-label={label}
      />
      <span className="text-xs text-dashboard-base-content/70">{label}</span>
    </div>
  );
}

function DateBox({
  label, value, min, max, onChange,
}: { label: string; value: string; min?: string; max?: string; onChange: (v: string) => void }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-[11px] font-medium text-dashboard-base-content/60">{label}</span>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="w-full rounded-md border border-dashboard-base-300 bg-dashboard-base-100 px-2 py-1.5 text-sm"
      />
    </label>
  );
}
