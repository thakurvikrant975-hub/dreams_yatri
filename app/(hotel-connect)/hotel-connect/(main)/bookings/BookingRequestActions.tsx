"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/Button";
import { acceptHotelBookingRequest, rejectHotelBookingRequest } from "./actions";

export default function BookingRequestActions({ bookingId }: { bookingId: string }) {
  const [isPending, startTransition] = useTransition();

  function onAccept() {
    startTransition(async () => {
      const res = await acceptHotelBookingRequest(bookingId);
      if (res.success) toast.success("Booking confirmed. The guest has been notified.");
      else toast.error(res.error);
    });
  }

  function onReject() {
    if (!window.confirm("Reject this booking? The guest will be fully refunded immediately — this can't be undone.")) return;
    startTransition(async () => {
      const res = await rejectHotelBookingRequest(bookingId);
      if (res.success) toast.success("Booking rejected and guest refunded.");
      else toast.error(res.error);
    });
  }

  return (
    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
      <Button variant="outline" size="xs" disabled={isPending} onClick={onReject}>
        Reject
      </Button>
      <Button variant="success" size="xs" loading={isPending} disabled={isPending} onClick={onAccept}>
        Accept
      </Button>
    </div>
  );
}
