"use client";

import { CalendarDays, X } from "lucide-react";
import { cn } from "@/app/lib/utils";

type Props = {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  error?: boolean;
  className?: string;
};

export function DateRangePicker({ from, to, onFromChange, onToChange, error, className }: Props) {
  function clear() {
    onFromChange("");
    onToChange("");
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-md border bg-background px-3 h-9 text-sm transition-colors",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        error && "border-destructive",
        className,
      )}
    >
      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <input
        type="date"
        value={from}
        onChange={e => onFromChange(e.target.value)}
        className="bg-transparent outline-none text-sm w-[118px] cursor-pointer"
        placeholder="From"
      />
      <span className="text-muted-foreground/50 shrink-0 select-none">→</span>
      <input
        type="date"
        value={to}
        min={from || undefined}
        onChange={e => onToChange(e.target.value)}
        className="bg-transparent outline-none text-sm w-[118px] cursor-pointer"
        placeholder="To"
      />
      {(from || to) && (
        <button
          type="button"
          onClick={clear}
          className="ml-auto text-muted-foreground/50 hover:text-foreground transition-colors shrink-0"
          tabIndex={-1}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
