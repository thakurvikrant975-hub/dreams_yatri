import { cn } from "@/app/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number | string;
  sub?: string;
  icon?: LucideIcon;
  iconColor?: string;
  iconText?: string;
  trend?: { value: string; positive?: boolean };
  highlight?: boolean;
  muted?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconColor = "bg-dashboard-primary/10",
  iconText  = "text-dashboard-primary",
  trend,
  highlight = false,
  muted     = false,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl px-4 py-3.5 space-y-3 border bg-dashboard-base-100 border-dashboard-base-300",
        className
      )}
    >
      {/* Label + Icon */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-dashboard-base-content">
          {label}
        </p>
        {Icon && (
          <div className={cn("h-12 w-12 rounded-lg flex items-center justify-center bg-dashboard-primary/6")}>
            <Icon className={cn("h-4.5 w-4.5 text-dashboard-primary")} />
          </div>
        )}
      </div>

      {/* Value + Trend */}
      <div className="flex items-end justify-between gap-2">
        <p className={cn(
          "text-2xl font-semibold leading-none text-dashboard-base-content")}>
          {value}
        </p>
        {trend && (
          <span
            className="text-xs font-medium px-1.5 py-0.5 rounded-full"
            style={
              trend.positive
                ? { backgroundColor: "color-mix(in oklch, var(--color-dashboard-success) 15%, transparent)", color: "var(--color-dashboard-success)" }
                : { backgroundColor: "color-mix(in oklch, var(--color-dashboard-error) 15%, transparent)",   color: "var(--color-dashboard-error)" }
            }
          >
            {trend.value}
          </span>
        )}
      </div>

      {/* Sub */}
      {sub && (
        <p className="text-xs leading-snug text-dashboard-base-content/45">{sub}</p>
      )}
    </div>
  );
}

// In Statcard.tsx — update StatGrid
export function StatGrid({
  children,
  cols = 4,
  className,
}: {
  children: React.ReactNode;
  cols?: 2 | 3 | 4 | 5 | 6 | 7;
  className?: string;
}) {
  const colClass = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
    6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
    7: "grid-cols-2 sm:grid-cols-4 lg:grid-cols-7",
  }[cols];

  return (
    <div className={cn("grid gap-3", colClass, className)}>
      {children}
    </div>
  );
}