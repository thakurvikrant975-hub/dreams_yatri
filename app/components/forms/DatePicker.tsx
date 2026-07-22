"use client";

import { useState, useRef, useEffect } from "react";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useClick,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
  size,
} from "@floating-ui/react";
import { ChevronLeftIcon, ChevronRightIcon, CalendarDaysIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { cn } from "@/app/lib/utils";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}
function toDateString(date: Date) {
  return date.toISOString().split("T")[0];
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
  id?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  minDate?: string;
  maxDate?: string;
  className?: string;
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
  const today = new Date();
  const selected = parseDate(value);

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth());
  const [mode, setMode] = useState<"calendar" | "month" | "year">("calendar");

  const yearRef = useRef<HTMLDivElement>(null);
  const yearStart = today.getFullYear() - 100;
  const yearEnd = today.getFullYear() + 10;
  const years = Array.from({ length: yearEnd - yearStart + 1 }, (_, i) => yearStart + i);

  // ── Floating UI setup ──────────────────────────────────────────────────────
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: (next) => {
      setOpen(next);
      if (!next) setMode("calendar"); // reset mode on close
    },
    placement: "bottom-start",
    middleware: [
      offset(6),
      flip({
        fallbackPlacements: ["top-start", "bottom-end", "top-end"],
        padding: 8,
      }),
      shift({ padding: 8 }),
      size({
        apply({ rects, elements, availableHeight }) {
          Object.assign(elements.floating.style, {
            width: `${rects.reference.width}px`,
            maxHeight: `${Math.min(availableHeight - 8, 320)}px`,
          });
        },
        padding: 8,
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const click = useClick(context, { enabled: !disabled });
  const dismiss = useDismiss(context, { outsidePress: true });
  const role = useRole(context, { role: "dialog" });

  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, role]);

  // Scroll selected year into view when year panel opens — scoped to the
  // year grid's own scroll container (block: "nearest") so this can never
  // walk up and move the page's scroll position, only the grid's.
  useEffect(() => {
    if (mode === "year" && yearRef.current) {
      const el = yearRef.current.querySelector("[data-selected='true']") as HTMLElement;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [mode]);

  // Switching mode (year/month → calendar) unmounts the clicked button; the
  // browser then drops focus to <body> per spec, which some browsers resolve
  // by auto-scrolling the page back to the top. Keep focus inside the popover
  // instead, with preventScroll so refocusing itself can't trigger a scroll.
  useEffect(() => {
    if (open) refs.floating.current?.focus({ preventScroll: true });
  }, [mode, open, refs.floating]);

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
    onChange?.(toDateString(new Date(viewYear, viewMonth, day)));
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

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? null : i - firstDay + 1
  );
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className={cn("relative w-full", className)}>

      {/* ── Trigger ── */}
      <div
        id={id}
        ref={refs.setReference}
        {...getReferenceProps()}
        className={cn(
          "w-full h-10 rounded-xl px-3 text-sm font-medium flex items-center justify-between cursor-pointer ring-[0.09em] ring-inset transition outline-none select-none",
          disabled
            ? "bg-neutral-100 text-neutral-400 ring-neutral-300 cursor-not-allowed"
            : error
              ? "text-error-800 ring-error-300 bg-error-500/15"
              : open
                ? "ring-neutral-500 bg-white text-neutral-900"
                : "bg-white text-neutral-900 hover:ring-neutral-400 ring-neutral-400/60"
        )}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <CalendarDaysIcon className={cn(
            "size-4 shrink-0",
            value ? "text-neutral-500" : "text-neutral-400"
          )} />
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

        {/* ── Floating Popover ── */}
        {open && !disabled && (
          <FloatingPortal>
            <div
              ref={refs.setFloating}
              tabIndex={-1}
              style={floatingStyles}
              {...getFloatingProps()}
              className="z-99999 rounded-2xl bg-white ring-1 ring-black/10 shadow-xl overflow-hidden outline-none"
            >

              {/* ── Calendar ── */}
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
                      const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
                      const isSelected = !!(selected && day === selected.getDate() && viewMonth === selected.getMonth() && viewYear === selected.getFullYear());
                      const isOff = isDisabledDay(viewYear, viewMonth, day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => handleDayClick(day)}
                          disabled={isOff}
                          className={cn(
                            "h-8 w-full rounded-lg text-sm transition select-none",
                            isOff && "opacity-30 cursor-not-allowed",
                            !isOff && !isSelected && "hover:bg-neutral-100",
                            isSelected ? "bg-neutral-900 text-white font-medium"
                              : isToday ? "text-blue-600 font-medium ring-1 ring-blue-300"
                                : "text-neutral-800"
                          )}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>

                  {/* Footer */}
                  <div className="border-t border-neutral-100 px-3 py-2 flex items-center justify-between">
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
                    <span className="text-[11px] text-neutral-400">
                      {MONTHS[viewMonth].slice(0, 3)} {viewYear}
                    </span>
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
                        onClick={() => { setViewMonth(i); setMode("calendar"); }}
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
                        data-selected={y === viewYear ? "true" : "false"}
                        onClick={() => { setViewYear(y); setMode("calendar"); }}
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
          </FloatingPortal>
        )}


      {error && (
        <p className="text-error-500 mt-1.5 text-xs font-medium">{error}</p>
      )}
    </div>
  );
}