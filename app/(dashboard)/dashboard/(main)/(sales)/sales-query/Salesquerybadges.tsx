"use client";

import { Badge } from "../../components/ui/badge";
import { CheckCircle2, XCircle, TrendingUp } from "lucide-react";
import type { SalesQueryStatus } from "./actions";

const STATUS_CONFIG: Record<SalesQueryStatus, {
    label: string;
    icon: React.ElementType;
    className: string;
}> = {
    ACTIVE: {
        label: "Active",
        icon: TrendingUp,
        className: "bg-green-500/10 text-green-600 border-green-200 dark:border-green-800",
    },
    CLOSED: {
        label: "Closed",
        icon: XCircle,
        className: "bg-slate-500/10 text-slate-500 border-slate-200 dark:border-slate-700",
    },
};

export function SalesQueryStatusBadge({ status }: { status: SalesQueryStatus }) {
    const cfg = STATUS_CONFIG[status];
    const Icon = cfg.icon;
    return (
        <Badge
            variant="outline"
            className={`gap-1 text-[11px] font-medium py-0.5 ${cfg.className}`}
        >
            <Icon className="h-3 w-3" />
            {cfg.label}
        </Badge>
    );
}