// app/dashboard/components/shared/StatCard.tsx
import { cn } from "@/app/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number | string;
  sub?: string;
  icon?: LucideIcon;
  iconColor?: string;   // tailwind bg class e.g. "bg-blue-500/10"
  iconText?: string;    // tailwind text class e.g. "text-blue-600"
  trend?: {
    value: string;      // e.g. "+12%" or "-3"
    positive?: boolean;
  };
  highlight?: boolean;  // primary-tinted card
  muted?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconColor = "bg-primary/10",
  iconText = "text-primary",
  trend,
  highlight = false,
  muted = false,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card px-4 py-3.5 space-y-3",
        highlight && "border-primary/30 bg-primary/5",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
        {Icon && (
          <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center", iconColor)}>
            <Icon className={cn("h-3.5 w-3.5", iconText)} />
          </div>
        )}
      </div>

      <div className="flex items-end justify-between gap-2">
        <p
          className={cn(
            "text-2xl font-semibold leading-none",
            muted && "text-muted-foreground"
          )}
        >
          {value}
        </p>
        {trend && (
          <span
            className={cn(
              "text-xs font-medium px-1.5 py-0.5 rounded-full",
              trend.positive
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            )}
          >
            {trend.value}
          </span>
        )}
      </div>

      {sub && (
        <p className="text-xs text-muted-foreground leading-snug">{sub}</p>
      )}
    </div>
  );
}

/** Convenience grid wrapper */
export function StatGrid({
  children,
  cols = 4,
  className,
}: {
  children: React.ReactNode;
  cols?: 2 | 3 | 4 | 5;
  className?: string;
}) {
  const colClass = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
  }[cols];

  return (
    <div className={cn("grid gap-3", colClass, className)}>
      {children}
    </div>
  );
}