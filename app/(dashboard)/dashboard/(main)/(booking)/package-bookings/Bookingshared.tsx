"use client";

import { BookingStatus, TimelineAction } from "@/app/generated/prisma";
import {
  CheckCircle2, Clock, Hotel, Car, Eye, XCircle,
  AlertTriangle, CalendarCheck, Plane, Ban,
  UserCheck, MessageSquare, Mail, RefreshCw,
  CircleDot,
} from "lucide-react";
import { format } from "date-fns";

// ── Status Badge ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  BookingStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  PENDING_REVIEW:           { label: "Pending Review",     color: "bg-yellow-50 text-yellow-800 border-yellow-200",   icon: <Clock className="h-3 w-3" /> },
  HOTEL_VERIFICATION:       { label: "Hotel Verification", color: "bg-blue-50 text-blue-800 border-blue-200",         icon: <Hotel className="h-3 w-3" /> },
  HOTEL_CONFIRMED:          { label: "Hotel Confirmed",    color: "bg-blue-100 text-blue-900 border-blue-300",        icon: <Hotel className="h-3 w-3" /> },
  CAB_VERIFICATION:         { label: "Cab Verification",   color: "bg-purple-50 text-purple-800 border-purple-200",   icon: <Car className="h-3 w-3" /> },
  CAB_CONFIRMED:            { label: "Cab Confirmed",      color: "bg-purple-100 text-purple-900 border-purple-300",  icon: <Car className="h-3 w-3" /> },
  OPS_REVIEW:               { label: "Ops Review",         color: "bg-orange-50 text-orange-800 border-orange-200",   icon: <Eye className="h-3 w-3" /> },
  CONFIRMED:                { label: "Confirmed",           color: "bg-green-50 text-green-800 border-green-200",      icon: <CheckCircle2 className="h-3 w-3" /> },
  UPCOMING:                 { label: "Upcoming",            color: "bg-teal-50 text-teal-800 border-teal-200",         icon: <CalendarCheck className="h-3 w-3" /> },
  ONGOING:                  { label: "Ongoing",             color: "bg-indigo-50 text-indigo-800 border-indigo-200",   icon: <Plane className="h-3 w-3" /> },
  COMPLETED:                { label: "Completed",           color: "bg-gray-50 text-gray-700 border-gray-200",         icon: <CheckCircle2 className="h-3 w-3" /> },
  MODIFICATION_REQUESTED:   { label: "Modification",        color: "bg-amber-50 text-amber-800 border-amber-200",      icon: <AlertTriangle className="h-3 w-3" /> },
  CANCELLED:                { label: "Cancelled",           color: "bg-red-50 text-red-700 border-red-200",            icon: <Ban className="h-3 w-3" /> },
  REJECTED:                 { label: "Rejected",            color: "bg-red-100 text-red-900 border-red-300",           icon: <XCircle className="h-3 w-3" /> },
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${cfg.color}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ── Timeline ──────────────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<
  TimelineAction,
  { label: string; icon: React.ReactNode; color: string }
> = {
  BOOKING_CREATED:        { label: "Booking Created",          icon: <CircleDot className="h-3.5 w-3.5" />,    color: "text-blue-600 bg-blue-50" },
  STATUS_CHANGED:         { label: "Status Changed",           icon: <RefreshCw className="h-3.5 w-3.5" />,    color: "text-purple-600 bg-purple-50" },
  DEPARTMENT_ASSIGNED:    { label: "Department Assigned",      icon: <UserCheck className="h-3.5 w-3.5" />,    color: "text-indigo-600 bg-indigo-50" },
  MEMBER_ASSIGNED:        { label: "Member Assigned",          icon: <UserCheck className="h-3.5 w-3.5" />,    color: "text-indigo-600 bg-indigo-50" },
  DEPARTMENT_CONFIRMED:   { label: "Department Confirmed",     icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "text-green-600 bg-green-50" },
  DEPARTMENT_FLAGGED:     { label: "Issue Flagged",            icon: <AlertTriangle className="h-3.5 w-3.5" />,color: "text-amber-600 bg-amber-50" },
  NOTE_ADDED:             { label: "Note Added",               icon: <MessageSquare className="h-3.5 w-3.5" />,color: "text-gray-600 bg-gray-100" },
  MODIFICATION_REQUESTED: { label: "Modification Requested",  icon: <AlertTriangle className="h-3.5 w-3.5" />,color: "text-amber-600 bg-amber-50" },
  EMAIL_SENT:             { label: "Email Sent",               icon: <Mail className="h-3.5 w-3.5" />,         color: "text-teal-600 bg-teal-50" },
  REFUND_INITIATED:       { label: "Refund Initiated",         icon: <RefreshCw className="h-3.5 w-3.5" />,    color: "text-red-600 bg-red-50" },
};

type TimelineEntry = {
  id: string;
  action: TimelineAction;
  fromStatus?: BookingStatus | null;
  toStatus?: BookingStatus | null;
  note?: string | null;
  createdAt: Date;
  performedBy: { name: string } | null;
  department?: { name: string } | null;
  performedByName: string;
};

export function BookingTimeline({ entries }: { entries: TimelineEntry[] }) {
  if (!entries.length) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No activity yet</p>;
  }

  return (
    <div className="relative space-y-0">
      {/* vertical line */}
      <div className="absolute left-[18px] top-0 bottom-0 w-px bg-border" />

      {entries.map((entry, idx) => {
        const cfg = ACTION_CONFIG[entry.action];
        return (
          <div key={entry.id} className="relative flex gap-3 pb-5">
            {/* dot */}
            <div className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-background ${cfg.color}`}>
              {cfg.icon}
            </div>

            <div className="flex-1 pt-1.5 min-w-0">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <p className="text-sm font-medium leading-tight">{cfg.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {entry.performedBy?.name ?? entry.performedByName}
                    {entry.department && (
                      <span className="ml-1 text-muted-foreground/70">· {entry.department.name}</span>
                    )}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {format(new Date(entry.createdAt), "dd MMM, h:mm a")}
                </span>
              </div>

              {/* Status transition */}
              {entry.fromStatus && entry.toStatus && (
                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                  <BookingStatusBadge status={entry.fromStatus} />
                  <span className="text-xs text-muted-foreground">→</span>
                  <BookingStatusBadge status={entry.toStatus} />
                </div>
              )}

              {/* Note */}
              {entry.note && (
                <p className="mt-1.5 text-xs text-muted-foreground bg-muted/50 rounded-md px-2.5 py-1.5 border">
                  {entry.note}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}