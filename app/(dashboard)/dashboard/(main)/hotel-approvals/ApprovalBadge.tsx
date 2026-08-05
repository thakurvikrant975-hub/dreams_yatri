import { BadgeCheck, CircleAlert, Clock } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { cn } from "@/app/lib/utils";

export const APPROVAL_STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; className: string }
> = {
  PENDING: { label: "Awaiting review", icon: Clock, className: "bg-amber-500/10 text-amber-600 border-amber-200" },
  APPROVED: { label: "Approved", icon: BadgeCheck, className: "bg-emerald-500/10 text-emerald-700 border-emerald-200" },
  CHANGES_REQUESTED: { label: "Changes requested", icon: CircleAlert, className: "bg-red-500/10 text-red-600 border-red-200" },
};

export function ApprovalBadge({ status, className }: { status: string; className?: string }) {
  const cfg = APPROVAL_STATUS_CONFIG[status] ?? { label: status, icon: Clock, className: "bg-muted text-muted-foreground" };
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={cn(cfg.className, "font-medium whitespace-nowrap", className)}>
      <Icon className="size-3" />
      {cfg.label}
    </Badge>
  );
}

/** Share of required content checks a hotel currently passes. */
export function ReadinessBar({ pct, issues }: { pct: number; issues: number }) {
  const tone = pct === 100 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="w-32 space-y-1">
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
          <div className={cn("h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs font-medium tabular-nums">{pct}%</span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {issues === 0 ? "Nothing missing" : `${issues} item${issues === 1 ? "" : "s"} missing`}
      </p>
    </div>
  );
}
