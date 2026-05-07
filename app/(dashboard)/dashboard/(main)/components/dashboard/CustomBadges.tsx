"use client";

import { Badge } from "../ui/badge";
import {
  CheckCircle2,
  Clock,
  XCircle,
  Inbox,
  Phone,
  Globe,
  MessageCircle,
  Users,
  AlertCircle,
  UserCheck,
  FileText,
  Send,
  ThumbsUp,
  ThumbsDown,
  CreditCard,
  Star,
  Lock,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type QueryStatus =
  | "SUBMITTED"
  | "VERIFIED"
  | "REJECTED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "PACKAGE_SENT"
  | "CLIENT_ACCEPTED"
  | "CLIENT_DECLINED"
  | "PAYMENT_INITIATED"
  | "CONVERTED"
  | "CLOSED";

export type QuerySource =
  | "WEBSITE_FORM"
  | "LANDING_PAGE"
  | "WHATSAPP"
  | "PHONE_CALL"
  | "REFERRAL"
  | "OTHER";

// ── Status Config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  QueryStatus,
  {
    label: string;
    icon: React.ElementType;
    className: string;
  }
> = {
  SUBMITTED: {
    label: "Submitted",
    icon: Inbox,
    className:
      "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-600",
  },
  VERIFIED: {
    label: "Verified",
    icon: CheckCircle2,
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700",
  },
  REJECTED: {
    label: "Rejected",
    icon: XCircle,
    className:
      "bg-red-50 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700",
  },
  ASSIGNED: {
    label: "Assigned",
    icon: UserCheck,
    className:
      "bg-violet-50 text-violet-700 border-violet-300 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-700",
  },
  IN_PROGRESS: {
    label: "In Progress",
    icon: Clock,
    className:
      "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700",
  },
  PACKAGE_SENT: {
    label: "Package Sent",
    icon: Send,
    className:
      "bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-700",
  },
  CLIENT_ACCEPTED: {
    label: "Client Accepted",
    icon: ThumbsUp,
    className:
      "bg-teal-50 text-teal-700 border-teal-300 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-700",
  },
  CLIENT_DECLINED: {
    label: "Client Declined",
    icon: ThumbsDown,
    className:
      "bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700",
  },
  PAYMENT_INITIATED: {
    label: "Payment Initiated",
    icon: CreditCard,
    className:
      "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700",
  },
  CONVERTED: {
    label: "Converted",
    icon: Star,
    className:
      "bg-green-50 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700",
  },
  CLOSED: {
    label: "Closed",
    icon: Lock,
    className:
      "bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-800/40 dark:text-zinc-400 dark:border-zinc-600",
  },
};

// ── Source Config ─────────────────────────────────────────────────────────────

const SOURCE_CONFIG: Record<
  QuerySource,
  {
    label: string;
    icon: React.ElementType;
    className: string;
  }
> = {
  WEBSITE_FORM: {
    label: "Website Form",
    icon: FileText,
    className:
      "bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-700",
  },
  LANDING_PAGE: {
    label: "Landing Page",
    icon: Globe,
    className:
      "bg-cyan-50 text-cyan-700 border-cyan-300 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-700",
  },
  WHATSAPP: {
    label: "WhatsApp",
    icon: MessageCircle,
    className:
      "bg-green-50 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700",
  },
  PHONE_CALL: {
    label: "Phone Call",
    icon: Phone,
    className:
      "bg-violet-50 text-violet-700 border-violet-300 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-700",
  },
  REFERRAL: {
    label: "Referral",
    icon: Users,
    className:
      "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700",
  },
  OTHER: {
    label: "Other",
    icon: AlertCircle,
    className:
      "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-600",
  },
};

// ── QueryStatusBadge ──────────────────────────────────────────────────────────

export function QueryStatusBadge({ status }: { status: QueryStatus }) {
  const cfg = STATUS_CONFIG[status];

  if (!cfg) {
    return (
      <Badge variant="outline" className="text-xs">
        Unknown
      </Badge>
    );
  }

  const Icon = cfg.icon;

  return (
    <Badge
      variant="outline"
      className={`gap-1.5 text-[11px] font-medium py-0.5 px-2 ${cfg.className}`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {cfg.label}
    </Badge>
  );
}

// ── QuerySourceBadge ──────────────────────────────────────────────────────────

export function QuerySourceBadge({ source }: { source: QuerySource }) {
  const cfg = SOURCE_CONFIG[source];

  if (!cfg) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <AlertCircle className="h-3 w-3" />
        Unknown
      </span>
    );
  }

  const Icon = cfg.icon;

  return (
    <Badge
      variant="outline"
      className={`gap-1.5 text-[11px] font-medium py-0.5 px-2 ${cfg.className}`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {cfg.label}
    </Badge>
  );
}

// ── CallAttemptsDots ──────────────────────────────────────────────────────────

export function CallAttemptsDots({ count }: { count: number }) {
  const MAX = 5;
  return (
    <div className="flex items-center gap-1" title={`${count} call attempt(s)`}>
      {Array.from({ length: MAX }).map((_, i) => (
        <span
          key={i}
          className={[
            "h-2 w-2 rounded-full transition-colors",
            i < count ? "bg-amber-500" : "bg-muted",
          ].join(" ")}
        />
      ))}
      {count > MAX && (
        <span className="text-[10px] text-muted-foreground ml-0.5">
          +{count - MAX}
        </span>
      )}
    </div>
  );
}

// ── Re-export configs for custom use ──────────────────────────────────────────

export { STATUS_CONFIG, SOURCE_CONFIG };