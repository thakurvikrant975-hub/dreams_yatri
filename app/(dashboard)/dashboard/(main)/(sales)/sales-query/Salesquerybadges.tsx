"use client";

import { Badge } from "../../components/ui/badge";
import {
    Inbox, PhoneCall, XCircle, UserCheck,
    ClipboardList, Send, ThumbsUp, ThumbsDown,
    CreditCard, CheckCircle2, Lock, CalendarClock, Clock, ShieldCheck,
} from "lucide-react";
import type { QueryStatus } from "./query-status";
import type { SentPackageInfo } from "./actions";

type StatusConfig = {
    label: string;
    icon: React.ElementType;
    className: string;
};

const STATUS_CONFIG: Record<QueryStatus, StatusConfig> = {
    SUBMITTED: {
        label: "Submitted",
        icon: Inbox,
        className: "bg-slate-500/10 text-slate-600 border-slate-200 dark:border-slate-700",
    },
    VERIFIED: {
        label: "Verified",
        icon: UserCheck,
        className: "bg-green-500/10 text-green-600 border-green-200 dark:border-green-800",
    },
    REJECTED: {
        label: "Rejected",
        icon: XCircle,
        className: "bg-red-500/10 text-red-600 border-red-200 dark:border-red-800",
    },
    ASSIGNED: {
        label: "New / Assigned",
        icon: Inbox,
        className: "bg-sky-500/10 text-sky-600 border-sky-200 dark:border-sky-800",
    },
    IN_PROGRESS: {
        label: "In Progress",
        icon: PhoneCall,
        className: "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800",
    },
    FOLLOW_UP: {
        label: "Follow Up",
        icon: CalendarClock,
        className: "bg-orange-500/10 text-orange-600 border-orange-200 dark:border-orange-800",
    },
    PACKAGE_SENT: {
        label: "Package Sent",
        icon: Send,
        className: "bg-cyan-500/10 text-cyan-600 border-cyan-200 dark:border-cyan-800",
    },
    CLIENT_ACCEPTED: {
        label: "Client Accepted",
        icon: ThumbsUp,
        className: "bg-green-500/10 text-green-600 border-green-200 dark:border-green-800",
    },
    CLIENT_DECLINED: {
        label: "Client Declined",
        icon: ThumbsDown,
        className: "bg-orange-500/10 text-orange-600 border-orange-200 dark:border-orange-800",
    },
    PAYMENT_INITIATED: {
        label: "Payment Initiated",
        icon: CreditCard,
        className: "bg-indigo-500/10 text-indigo-600 border-indigo-200 dark:border-indigo-800",
    },
    CONVERTED: {
        label: "Converted ✓",
        icon: CheckCircle2,
        className: "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:border-emerald-800",
    },
    CLOSED: {
        label: "Closed",
        icon: Lock,
        className: "bg-slate-500/10 text-slate-500 border-slate-200 dark:border-slate-700",
    },
};

export function SalesQueryStatusBadge({ status }: { status: QueryStatus | string }) {
    const cfg = STATUS_CONFIG[status as QueryStatus];

    if (!cfg) {
        return (
            <Badge variant="outline" className="text-xs gap-1 rounded-md">
                {status ?? "Unknown"}
            </Badge>
        );
    }

    const Icon = cfg.icon;

    return (
        <Badge
            variant="outline"
            className={`gap-1 text-[11px] font-medium py-0.5 rounded-md ${cfg.className}`}
        >
            <Icon className="h-3 w-3" />
            {cfg.label}
        </Badge>
    );
}

/**
 * Verification-team pricing sign-off on a sent package — independent of the
 * client-facing SalesQueryStatusBadge above. Shown next to "View Package" so
 * an exec sees at a glance whether ops has cleared the price, or sent it
 * back for rework (with the reason, so it's clear what to fix).
 */
export function PackageVerificationBadge({ pkg }: { pkg: SentPackageInfo }) {
    if (pkg.verified) {
        return (
            <Badge
                variant="outline"
                className="gap-1 text-[11px] font-medium py-0.5 rounded-md bg-green-500/10 text-green-600 border-green-200 dark:border-green-800"
            >
                <ShieldCheck className="h-3 w-3" /> Verified
            </Badge>
        );
    }
    if (pkg.rejectedAt) {
        return (
            <Badge
                variant="outline"
                title={pkg.rejectionNote ?? undefined}
                className="gap-1 text-[11px] font-medium py-0.5 rounded-md bg-red-500/10 text-red-600 border-red-200 dark:border-red-800"
            >
                <XCircle className="h-3 w-3" /> Rejected: {pkg.rejectionReasonLabel ?? "See details"}
            </Badge>
        );
    }
    return (
        <Badge
            variant="outline"
            className="gap-1 text-[11px] font-medium py-0.5 rounded-md bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800"
        >
            <Clock className="h-3 w-3" /> Pricing Pending
        </Badge>
    );
}