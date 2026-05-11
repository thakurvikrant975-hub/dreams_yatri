// components/dashboard/PageHeader.tsx
import { cn } from "@/app/lib/utils";
import type { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  iconColor?: string;   // e.g. "text-dashboard-primary"
  iconBg?: string;      // e.g. "bg-dashboard-primary/10"
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  iconColor = "text-dashboard-base-content",
  iconBg    = "bg-dashboard-base-100",
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      {/* Left: icon + title + description */}
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className={cn("h-10 w-10 shrink-0 rounded-xl flex items-center justify-center", iconBg)}>
            <Icon className={cn("h-5 w-5", iconColor)} />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-dashboard-base-content truncate">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-dashboard-base-content truncate">
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Right: actions slot */}
      {actions && (
        <div className="shrink-0 flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}