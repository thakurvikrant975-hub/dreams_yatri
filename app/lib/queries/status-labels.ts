// Shared pure helpers — no "use server", safe to import anywhere (client or server).
//
// The Sales Manager requirements asked for a status vocabulary (New Query,
// Contacted, Connecting, Working, ...) that reads cleaner than the raw
// QueryStatus enum values, plus a "Hot Client" concept and an "Active
// Client"/"Active Group" concept. Rather than renaming the underlying
// QueryStatus enum (a live Postgres enum with existing rows and ~10 call
// sites keying off the old names — auto-assign.ts, analytics, badges), this
// file gives every existing QueryStatus value its client-facing label. The
// data model is unchanged; only what people read/select changes.
//
// "Hot Client" is deliberately NOT a status here — see `isHot` on
// package_queries — a lead can be hot at any pipeline stage. "Active
// Client"/"Active Group" are not statuses either: they describe the
// post-conversion lifecycle (CustomPackageStatus / BookingStatus), not the
// lead's own QueryStatus.

import type { QueryStatus } from "@/app/generated/prisma/client";

export const STATUS_LABELS: Record<QueryStatus, string> = {
  SUBMITTED:         "New Query",
  VERIFIED:          "Contacted",
  ASSIGNED:          "Connecting",
  IN_PROGRESS:       "Working",
  PACKAGE_SENT:      "Package Sent",
  FOLLOW_UP:         "Follow-Up",
  CLIENT_ACCEPTED:   "Negotiation",
  PAYMENT_INITIATED: "Payment Pending",
  CONVERTED:         "Confirmed",
  CLIENT_DECLINED:   "Declined",
  REJECTED:          "Rejected",
  CLOSED:            "Lost/Closed",
};

export function statusLabel(status: QueryStatus | string): string {
  return STATUS_LABELS[status as QueryStatus] ?? status;
}

// Ordered for status dropdowns/legends — mirrors the pipeline's real sequence.
export const STATUS_ORDER: QueryStatus[] = [
  "SUBMITTED", "VERIFIED", "ASSIGNED", "IN_PROGRESS", "PACKAGE_SENT",
  "FOLLOW_UP", "CLIENT_ACCEPTED", "PAYMENT_INITIATED", "CONVERTED",
  "CLIENT_DECLINED", "REJECTED", "CLOSED",
];
