"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Builder chrome — the shared visual language for everything AROUND the
// document: drawers, the day rail, Trip Setup.
//
// Not the document itself. That has its own identity (see DOC in
// ItineraryDocument) because it's a printed artefact a client reads; this is
// software an exec operates all day, and the two should not look the same.
//
// The rules, so additions stay consistent:
//
//   spacing   4px base. 20px around a drawer's content, 12–16px between
//             groups, 8px inside one.
//   type      11px for labels, 12–13px for content, 15px for a title. Uppercase
//             is reserved for group labels and always gets letter-spacing.
//   radius    10px for surfaces, 8px for controls. Never fully rounded except
//             true pills.
//   depth     borders, not shadows. A drawer is already floating; shadows
//             inside one just make it muddy.
//   colour    chrome is neutral; the accent means "selected" or "primary
//             action" and nothing else. Semantic colour (amber, red) is for
//             state, never decoration.
//   motion    120ms on colour, nothing on layout. A control that moves under
//             the pointer is worse than one that doesn't animate.
// ─────────────────────────────────────────────────────────────────────────────

import { cn } from "@/app/lib/utils";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/app/(dashboard)/dashboard/(main)/components/ui/tooltip";

// ── Structure ───────────────────────────────────────────────────────────────

/** The standard padded body of a drawer. */
export function DrawerBody({ children, className }: {
  children: React.ReactNode; className?: string;
}) {
  return <div className={cn("p-5 space-y-4", className)}>{children}</div>;
}

/** A titled group inside a drawer. The label is what makes a long drawer
 * scannable — without one, six controls in a column read as one undifferentiated
 * form. */
export function Group({ label, hint, action, children }: {
  label?: string;
  hint?: string;
  /** Small trailing control on the label row — "All", "Clear", a count. */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      {(label || action) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-dashboard-base-content/45">
              {label}
            </h3>
          )}
          {action}
        </div>
      )}
      {children}
      {hint && <p className="text-[11px] leading-relaxed text-dashboard-base-content/45">{hint}</p>}
    </section>
  );
}

/** Label + control + optional hint, stacked. */
export function Field({ label, hint, children, className }: {
  label?: string; hint?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <label className={cn("block space-y-1", className)}>
      {label && (
        <span className="block text-[11px] font-medium text-dashboard-base-content/60">{label}</span>
      )}
      {children}
      {hint && <span className="block text-[10.5px] text-dashboard-base-content/45">{hint}</span>}
    </label>
  );
}

// ── Surfaces ────────────────────────────────────────────────────────────────

/** A bordered surface — the default container for anything that isn't a
 * control. `tone` carries state, never decoration. */
export function Card({ tone = "plain", className, children, ...rest }: {
  tone?: "plain" | "selected" | "warning" | "muted";
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn(
        "rounded-[10px] border transition-colors duration-[120ms]",
        tone === "selected" && "border-dashboard-primary bg-dashboard-primary/[0.06]",
        tone === "warning" && "border-amber-300 bg-amber-50",
        tone === "muted" && "border-dashed border-dashboard-base-300 bg-transparent",
        tone === "plain" && "border-dashboard-base-300 bg-transparent",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A selectable row in a list of options — a hotel, a vehicle, an activity.
 * One component so every picker in the builder reads the same way. */
export function OptionRow({ selected, onClick, leading, title, meta, trailing, description, disabled }: {
  selected?: boolean;
  onClick: () => void;
  /** A thumbnail or icon box before the title — e.g. a vehicle/hotel photo. */
  leading?: React.ReactNode;
  title: React.ReactNode;
  /** Small facts under the title — distance, seats, category. */
  meta?: React.ReactNode;
  /** Right-aligned, usually a price. */
  trailing?: React.ReactNode;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "w-full text-left rounded-[10px] border p-2.5 cursor-pointer transition-colors duration-[120ms]",
        "focus-visible:outline-2 focus-visible:outline-dashboard-primary/50",
        selected
          ? "border-dashboard-primary bg-dashboard-primary/[0.06]"
          : "border-dashboard-base-300 hover:bg-dashboard-base-200/50",
        disabled && "opacity-50 pointer-events-none",
      )}
    >
      <div className="flex items-start gap-3">
        {leading && <div className="shrink-0">{leading}</div>}
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-semibold text-dashboard-base-content truncate">{title}</p>
          {meta && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[10.5px] text-dashboard-base-content/50">
              {meta}
            </div>
          )}
          {description && (
            <p className="text-[10.5px] text-dashboard-base-content/55 mt-1 line-clamp-2">{description}</p>
          )}
        </div>
        {trailing && <div className="shrink-0 text-right">{trailing}</div>}
      </div>
    </button>
  );
}

// ── Controls ────────────────────────────────────────────────────────────────

/** Two or three mutually exclusive views. Used for search-vs-manual tabs, which
 * appear in three drawers and were being hand-rolled in each. */
export function Segmented<T extends string>({ value, onChange, options, className }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn("flex rounded-[9px] bg-dashboard-base-200/70 p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "flex-1 rounded-[7px] px-2.5 py-1.5 text-[11px] font-medium transition-colors duration-[120ms]",
            value === o.value
              ? "bg-dashboard-base-100 text-dashboard-base-content shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
              : "text-dashboard-base-content/55 hover:text-dashboard-base-content/85",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A small toggleable token — a day number, a meal, a tone. */
export function Chip({ selected, onClick, children, tone = "primary", title, className }: {
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  tone?: "primary" | "warning";
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={selected}
      className={cn(
        "rounded-[7px] border px-2 py-1 text-[11px] cursor-pointer font-medium transition-colors duration-[120ms]",
        selected
          ? "border-dashboard-primary bg-dashboard-primary/10 text-dashboard-primary"
          : tone === "warning"
            ? "border-dashed border-amber-400/60 text-amber-700/80 hover:bg-amber-50"
            : "border-dashboard-base-300 text-dashboard-base-content/60 hover:bg-dashboard-base-200/60",
        className,
      )}
    >
      {children}
    </button>
  );
}

// ── Feedback ────────────────────────────────────────────────────────────────

/** Nothing here yet. Deliberately a full row rather than a line of grey text —
 * an empty state is where someone is most likely to be stuck, so it gets room
 * and, where there is one, the action that fixes it. */
export function Empty({ children, action }: {
  children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <p className="text-[12.5px] text-dashboard-base-content/50 max-w-[34ch]">{children}</p>
      {action}
    </div>
  );
}

export function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] leading-relaxed text-dashboard-base-content/45">{children}</p>
  );
}

// ── Tooltips ────────────────────────────────────────────────────────────────

/**
 * An instant tooltip for an icon-only control.
 *
 * The builder's floating toolbars are icon-only, so the label IS the
 * affordance — you cannot tell Replace from Remove without it. Those were using
 * the native `title` attribute, whose delay is set by the browser at roughly a
 * second or two and is not adjustable from CSS or JS. Long enough that people
 * clicked to find out what a button did instead of waiting, which for the
 * delete buttons is the wrong way to learn.
 *
 * Carries its own Provider because there's no app-level one, and because this
 * same document renders on the public site where a builder-supplied provider
 * wouldn't exist. Providers are plain context — one per control costs nothing.
 */
export function IconTip({ label, side = "top", children }: {
  label: string;
  side?: "top" | "bottom" | "left" | "right";
  /** The control itself. Must forward ref and props — Radix clones onto it. */
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} sideOffset={6} className="rounded-md px-2 py-1 text-[11px]">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
