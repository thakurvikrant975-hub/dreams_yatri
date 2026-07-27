// app/(website)/profile/components/BookingStatusModal.tsx

'use client'

import { CheckIcon } from "@phosphor-icons/react";
import { cn } from "@/app/lib/utils";
import Modal, { ModalHeader, ModalBody } from "@/app/components/modals/Modal_Structure";
import {
  BOOKING_STATUS_INFO,
  BOOKING_PROGRESS_STEPS,
  bookingProgressStepIndex,
} from "@/app/lib/booking-display-status";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BookingStatusSummary {
  bookingNumber: string;
  rawStatus:     keyof typeof BOOKING_STATUS_INFO;
  cancelReason:  string | null;
  destination:   { name: string } | null;
  package:       { title: string } | null;
}

// ─── Status Detail Modal ──────────────────────────────────────────────────────

export function BookingStatusModal({
  booking,
  open,
  onClose,
}: {
  booking: BookingStatusSummary;
  open: boolean;
  onClose: (open: boolean) => void;
}) {
  const title      = booking.package?.title ?? booking.destination?.name ?? "Trip";
  const info       = BOOKING_STATUS_INFO[booking.rawStatus];
  const stepIndex  = bookingProgressStepIndex(booking.rawStatus);
  const isTerminal = stepIndex === -1; // CANCELLED, REJECTED, MODIFICATION_REQUESTED

  return (
    <Modal open={open} onClose={onClose} maxWidth="sm">
      <ModalHeader onClose={onClose}>Booking status</ModalHeader>
      <ModalBody>
        <div className="mb-4">
          <p className="text-sm font-semibold text-neutral-900">{title}</p>
          <p className="text-[11px] text-neutral-400 mt-0.5">{booking.bookingNumber}</p>
        </div>

        {isTerminal ? (
          <div className={cn(
            "rounded-lg p-3 text-sm",
            booking.rawStatus === "MODIFICATION_REQUESTED" ? "bg-yellow-50 text-yellow-700" : "bg-red-50 text-red-600"
          )}>
            <p className="font-semibold">{info.label}</p>
            <p className="text-xs mt-1">{info.description}</p>
            {booking.rawStatus === "CANCELLED" && booking.cancelReason && (
              <p className="text-xs mt-1.5 pt-1.5 border-t border-current/10">Reason: {booking.cancelReason}</p>
            )}
          </div>
        ) : (
          <div>
            {BOOKING_PROGRESS_STEPS.map((step, i) => {
              const isDone    = i < stepIndex;
              const isCurrent = i === stepIndex;
              const isLast    = i === BOOKING_PROGRESS_STEPS.length - 1;

              return (
                <div key={step.key} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      "size-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold",
                      isDone ? "bg-green-500 text-white" :
                      isCurrent ? "bg-blue-500 text-white" : "bg-neutral-100 text-neutral-400"
                    )}>
                      {isDone ? <CheckIcon weight="bold" className="size-3.5" /> : i + 1}
                    </div>
                    {!isLast && (
                      <div className={cn("w-0.5 flex-1 min-h-8", isDone ? "bg-green-500" : "bg-neutral-200")} />
                    )}
                  </div>
                  <div className={cn("min-w-0", isLast ? "pb-0" : "pb-6")}>
                    <p className={cn(
                      "text-sm font-semibold",
                      isCurrent ? "text-blue-700" : isDone ? "text-neutral-700" : "text-neutral-400"
                    )}>
                      {step.label}
                    </p>
                    {isCurrent && <p className="text-xs text-neutral-500 mt-0.5">{info.description}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ModalBody>
    </Modal>
  );
}
