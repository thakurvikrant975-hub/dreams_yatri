/**
 * Channel-management Phase 4 — structured cancellation resolver.
 *
 * Pure (no DB / no server-only) so it's usable on the server, in the owner
 * calendar, on the guest hotel page, and by channel adapters. Works off the
 * existing `HotelCancellationPolicy` enum, now attachable per **rate plan**
 * (`hotel_room_pricing.cancellation_policy`) with fallback to the hotel-level
 * policy. This is a "free-until-deadline, else non-refundable" model — the shape
 * OTAs expect for these enum tiers.
 */

export type CancellationPolicy =
  | "FREE_TILL_CHECKIN"
  | "FREE_TILL_24H"
  | "FREE_TILL_48H"
  | "FREE_TILL_72H"
  | "FREE_TILL_7D"
  | "NON_REFUNDABLE";

/** Hours before check-in until which cancellation is free. null = never free. */
const FREE_HOURS: Record<CancellationPolicy, number | null> = {
  FREE_TILL_CHECKIN: 0,
  FREE_TILL_24H: 24,
  FREE_TILL_48H: 48,
  FREE_TILL_72H: 72,
  FREE_TILL_7D: 168,
  NON_REFUNDABLE: null,
};

const LABELS: Record<CancellationPolicy, string> = {
  FREE_TILL_CHECKIN: "Free cancellation until check-in",
  FREE_TILL_24H: "Free cancellation until 24 hours before check-in",
  FREE_TILL_48H: "Free cancellation until 48 hours before check-in",
  FREE_TILL_72H: "Free cancellation until 72 hours before check-in",
  FREE_TILL_7D: "Free cancellation until 7 days before check-in",
  NON_REFUNDABLE: "Non-refundable",
};

export type CancellationOutcome = {
  policy: CancellationPolicy;
  refundable: boolean; // true if cancelling at `now` is free
  penaltyPercent: number; // 0 when refundable, else 100
  freeUntilISO: string | null; // deadline for free cancellation; null = non-refundable
  label: string;
};

export function cancellationLabel(policy: CancellationPolicy): string {
  return LABELS[policy];
}

/** Effective policy for a rate plan: rate-level wins, else hotel-level, else non-refundable. */
export function effectivePolicy(
  ratePolicy: CancellationPolicy | null | undefined,
  hotelPolicy: CancellationPolicy | null | undefined,
): CancellationPolicy {
  return ratePolicy ?? hotelPolicy ?? "NON_REFUNDABLE";
}

/**
 * Resolve whether a cancellation at `now` (default: current time) is free, and
 * the deadline for free cancellation.
 */
export function resolveCancellation(
  policy: CancellationPolicy,
  checkInISO: string,
  nowISO?: string,
): CancellationOutcome {
  const label = LABELS[policy];
  const freeHours = FREE_HOURS[policy];

  if (freeHours == null) {
    return { policy, refundable: false, penaltyPercent: 100, freeUntilISO: null, label };
  }

  const checkIn = new Date(checkInISO);
  const deadline = new Date(checkIn.getTime() - freeHours * 3600_000);
  const now = nowISO ? new Date(nowISO) : new Date();
  const refundable = now.getTime() <= deadline.getTime();

  return {
    policy,
    refundable,
    penaltyPercent: refundable ? 0 : 100,
    freeUntilISO: deadline.toISOString(),
    label,
  };
}
