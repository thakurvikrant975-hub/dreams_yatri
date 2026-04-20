"use client";

import { Badge } from "../../components/ui/badge";
import {
    CheckCircle2, Clock, XCircle, Inbox,
    Phone, Globe, MessageCircle, Users, AlertCircle,
} from "lucide-react";
import type { QueryStatus, QuerySource } from "./actions";

// ── Status Badge ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<QueryStatus, {
    label:     string;
    icon:      React.ElementType;
    className: string;
}> = {
    SUBMITTED:   { label: "Submitted",   icon: Inbox,         className: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800" },
    IN_PROGRESS: { label: "In Progress", icon: Clock,         className: "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800" },
    VERIFIED:    { label: "Verified",    icon: CheckCircle2,  className: "bg-green-500/10 text-green-600 border-green-200 dark:border-green-800" },
    REJECTED:    { label: "Rejected",    icon: XCircle,       className: "bg-red-500/10 text-red-600 border-red-200 dark:border-red-800" },
};

export function QueryStatusBadge({ status }: { status: QueryStatus }) {
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

// ── Source Badge ──────────────────────────────────────────────────────────────

const SOURCE_CONFIG: Record<QuerySource, { label: string; icon: React.ElementType }> = {
    WEBSITE_FORM:  { label: "Website",      icon: Globe },
    LANDING_PAGE:  { label: "Landing Page", icon: Globe },
    WHATSAPP:      { label: "WhatsApp",     icon: MessageCircle },
    PHONE_CALL:    { label: "Phone",        icon: Phone },
    REFERRAL:      { label: "Referral",     icon: Users },
    OTHER:         { label: "Other",        icon: AlertCircle },
};

export function QuerySourceBadge({ source }: { source: QuerySource }) {
    const cfg = SOURCE_CONFIG[source];
    const Icon = cfg.icon;
    return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Icon className="h-3 w-3" />
            {cfg.label}
        </span>
    );
}

// ── Call Attempts Indicator ───────────────────────────────────────────────────

export function CallAttemptsDots({ count }: { count: number }) {
    const MAX = 5;
    return (
        <div className="flex items-center gap-1" title={`${count} call attempt(s)`}>
            {Array.from({ length: MAX }).map((_, i) => (
                <span
                    key={i}
                    className={[
                        "h-2 w-2 rounded-full",
                        i < count ? "bg-amber-500" : "bg-muted",
                    ].join(" ")}
                />
            ))}
            {count > MAX && (
                <span className="text-[10px] text-muted-foreground">+{count - MAX}</span>
            )}
        </div>
    );
}