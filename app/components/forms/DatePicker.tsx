"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronLeftIcon, ChevronRightIcon, CalendarDaysIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { cn } from "@/app/lib/utils";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}
function toDateString(date: Date) {
  return date.toISOString().split("T")[0]; // YYYY-MM-DD
}
function parseDate(val: string): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}
function formatDisplay(val: string): string {
  const d = parseDate(val);
  if (!d) return "";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

interface DatePickerProps {
  id?:          string;
  value?:       string;            // YYYY-MM-DD
  onChange?:    (value: string) => void;
  placeholder?: string;
  disabled?:    boolean;
  error?:       string;
  minDate?:     string;            // YYYY-MM-DD
  maxDate?:     string;            // YYYY-MM-DD
  className?:   string;
}

export function DatePicker({
  id,
  value = "",
  onChange,
  placeholder = "Select date",
  disabled = false,
  error,
  minDate,
  maxDate,
  className,
}: DatePickerProps) {
  const today      = new Date();
  const selected   = parseDate(value);

  const [open,       setOpen]       = useState(false);
  const [viewYear,   setViewYear]   = useState(selected?.getFullYear()  ?? today.getFullYear());
  const [viewMonth,  setViewMonth]  = useState(selected?.getMonth()     ?? today.getMonth());
  const [mode,       setMode]       = useState<"calendar" | "month" | "year">("calendar");

  const wrapperRef = useRef<HTMLDivElement>(null);

  // Year range for year picker: ±50 years
  const yearStart  = today.getFullYear() - 100;
  const yearEnd    = today.getFullYear() + 10;
  const years      = Array.from({ length: yearEnd - yearStart + 1 }, (_, i) => yearStart + i);
  const yearRef    = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setMode("calendar");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Scroll selected year into view when year panel opens
  useEffect(() => {
    if (mode === "year" && yearRef.current) {
      const el = yearRef.current.querySelector("[data-selected=true]") as HTMLElement;
      el?.scrollIntoView({ block: "center" });
    }
  }, [mode]);

  // Sync view when value changes externally
  useEffect(() => {
    if (selected) {
      setViewYear(selected.getFullYear());
      setViewMonth(selected.getMonth());
    }
  }, [value]);

  const minD = parseDate(minDate ?? "");
  const maxD = parseDate(maxDate ?? "");

  function isDisabledDay(year: number, month: number, day: number): boolean {
    const d = new Date(year, month, day);
    if (minD && d < minD) return true;
    if (maxD && d > maxD) return true;
    return false;
  }

  function handleDayClick(day: number) {
    if (isDisabledDay(viewYear, viewMonth, day)) return;
    const d = new Date(viewYear, viewMonth, day);
    onChange?.(toDateString(d));
    setOpen(false);
    setMode("calendar");
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange?.("");
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function handleMonthSelect(m: number) {
    setViewMonth(m);
    setMode("calendar");
  }

  function handleYearSelect(y: number) {
    setViewYear(y);
    setMode("calendar");
  }

  const daysInMonth  = getDaysInMonth(viewYear, viewMonth);
  const firstDay     = getFirstDayOfMonth(viewYear, viewMonth);
  const cells        = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? null : i - firstDay + 1
  );
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div ref={wrapperRef} className={cn("relative w-full", className)}>

      {/* ── Trigger ── */}
      <div
        id={id}
        onClick={() => { if (!disabled) { setOpen(o => !o); setMode("calendar"); } }}
        className={cn(
          "w-full h-10 rounded-xl px-3 text-sm font-medium flex items-center justify-between cursor-pointer ring-[0.09em] ring-inset transition outline-none select-none",
          disabled
            ? "bg-neutral-100 text-neutral-400 ring-neutral-300 cursor-not-allowed"
            : error
            ? "text-error-800 ring-error-300 bg-error-500/15"
            : "bg-white text-neutral-900 hover:ring-neutral-400 ring-neutral-400/60"
        )}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <CalendarDaysIcon className="size-4 text-neutral-400 shrink-0" />
          <span className={cn("truncate", !value && "text-neutral-400 font-normal")}>
            {value ? formatDisplay(value) : placeholder}
          </span>
        </div>

        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="ml-1 text-neutral-400 hover:text-neutral-600 transition shrink-0"
          >
            <XMarkIcon className="size-3.5" />
          </button>
        )}
      </div>

      {/* ── Popover ── */}
      {open && !disabled && (
        <div className="absolute z-50 mt-1.5 left-0 w-72 rounded-2xl bg-white ring-1 ring-black/10 shadow-lg overflow-hidden w-full">

          {/* ── Calendar View ── */}
          {mode === "calendar" && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-neutral-100">
                <button type="button" onClick={prevMonth}
                  className="p-1 rounded-lg hover:bg-neutral-100 transition text-neutral-500">
                  <ChevronLeftIcon className="size-4" />
                </button>

                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setMode("month")}
                    className="text-sm font-medium px-2 py-0.5 rounded-lg hover:bg-neutral-100 transition">
                    {MONTHS[viewMonth]}
                  </button>
                  <button type="button" onClick={() => setMode("year")}
                    className="text-sm font-medium px-2 py-0.5 rounded-lg hover:bg-neutral-100 transition">
                    {viewYear}
                  </button>
                </div>

                <button type="button" onClick={nextMonth}
                  className="p-1 rounded-lg hover:bg-neutral-100 transition text-neutral-500">
                  <ChevronRightIcon className="size-4" />
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 px-3 pt-2">
                {DAYS.map(d => (
                  <div key={d} className="text-center text-[11px] font-medium text-neutral-400 pb-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 px-3 pb-3 gap-y-0.5">
                {cells.map((day, i) => {
                  if (!day) return <div key={`e-${i}`} />;

                  const isToday =
                    day === today.getDate() &&
                    viewMonth === today.getMonth() &&
                    viewYear === today.getFullYear();

                  const isSelected =
                    selected &&
                    day === selected.getDate() &&
                    viewMonth === selected.getMonth() &&
                    viewYear === selected.getFullYear();

                  const disabled = isDisabledDay(viewYear, viewMonth, day);

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleDayClick(day)}
                      disabled={disabled}
                      className={cn(
                        "h-8 w-full rounded-lg text-sm transition select-none",
                        disabled && "opacity-30 cursor-not-allowed",
                        !disabled && !isSelected && "hover:bg-neutral-100",
                        isSelected
                          ? "bg-neutral-900 text-white font-medium"
                          : isToday
                          ? "text-blue-600 font-medium ring-1 ring-blue-300"
                          : "text-neutral-800"
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              {/* Today shortcut */}
              <div className="border-t border-neutral-100 px-3 py-2">
                <button
                  type="button"
                  onClick={() => {
                    onChange?.(toDateString(today));
                    setOpen(false);
                    setMode("calendar");
                  }}
                  className="text-xs text-blue-600 font-medium hover:underline"
                >
                  Today
                </button>
              </div>
            </>
          )}

          {/* ── Month Picker ── */}
          {mode === "month" && (
            <div className="p-3">
              <button type="button" onClick={() => setMode("calendar")}
                className="text-xs text-neutral-400 hover:text-neutral-600 mb-2 flex items-center gap-1">
                <ChevronLeftIcon className="size-3" /> Back
              </button>
              <div className="grid grid-cols-3 gap-1.5">
                {MONTHS.map((m, i) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleMonthSelect(i)}
                    className={cn(
                      "py-2 text-sm rounded-xl transition",
                      i === viewMonth
                        ? "bg-neutral-900 text-white font-medium"
                        : "hover:bg-neutral-100 text-neutral-700"
                    )}
                  >
                    {m.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Year Picker ── */}
          {mode === "year" && (
            <div className="p-3">
              <button type="button" onClick={() => setMode("calendar")}
                className="text-xs text-neutral-400 hover:text-neutral-600 mb-2 flex items-center gap-1">
                <ChevronLeftIcon className="size-3" /> Back
              </button>
              <div ref={yearRef} className="grid grid-cols-4 gap-1 max-h-52 overflow-y-auto">
                {years.map(y => (
                  <button
                    key={y}
                    type="button"
                    data-selected={y === viewYear}
                    onClick={() => handleYearSelect(y)}
                    className={cn(
                      "py-1.5 text-sm rounded-xl transition",
                      y === viewYear
                        ? "bg-neutral-900 text-white font-medium"
                        : "hover:bg-neutral-100 text-neutral-700"
                    )}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-error-500 mt-1.5 text-xs font-medium">{error}</p>
      )}
    </div>
  );
}