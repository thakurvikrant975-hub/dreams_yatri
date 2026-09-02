// ─────────────────────────────────────────────────────────────────────────────
// Why the mattresses on this night aren't what you asked for.
//
// A sales exec types "2" into Mattresses and one of four things happens:
//
//   1. two mattresses are added and charged                        — fine
//   2. two are added and charged at ₹0, because the room's rate sheet
//      prices no extra bed
//   3. the auto count reads 0 however many people are in the room, because
//      the hotel team never set an extra-bed capacity on the room
//   4. two are recorded against a room that can physically take one
//
// Only the first is visible. Cases 2–4 look identical to case 1 in the
// builder, reach costing as a wrong or free line, and come back as a rejection
// with a note the exec then has to decode. Every one of them is caused by a
// piece of hotel data that isn't there — which the exec cannot see, cannot
// guess, and (importantly) cannot fix themselves. Naming the missing field and
// who owns it turns a rejection into a two-minute message to the hotel team.
//
// Pure functions over one day plus the party. No React and no I/O: the hotel
// drawer, the day list, the pricing gap badges and (through the same rules
// restated server-side in computeBuilderHotelPricing) costing's own breakdown
// all read from here, so what the exec is warned about and what costing sees
// cannot drift.
// ─────────────────────────────────────────────────────────────────────────────

import { planRoomOccupancy } from "@/app/lib/room-capacity";
import type { DayItinerary } from "@/app/(dashboard)/dashboard/(builder)/package-builder/action";

export type StayIssueCode =
  /** The room has no extra-bed capacity in the catalog, so no mattress can be
   * costed against it however many are typed. */
  | "mattresses-not-enabled"
  /** More mattresses asked for than the room's own capacity across the rooms
   * booked. */
  | "mattresses-over-capacity"
  /** Mattresses are on the night but nothing prices them — they'll be free. */
  | "no-mattress-rate"
  /** The party doesn't fit the rooms booked, even counting every mattress the
   * room has. */
  | "party-does-not-fit";

/** How a BuilderHotelDayLine.gap reads on a costing breakdown.
 *
 * The same vocabulary as StayIssueCode above, plus the room-price gap that
 * only the pricing engine can see. Kept here rather than in the pricing
 * service because that module is "use server" and its every export has to be
 * an async function — a label map cannot live there, which is exactly why both
 * costing screens grew their own two-way ternary and stopped agreeing with the
 * engine the moment it learned a third gap.
 *
 * `undefined` for an unrecognised value rather than a crash: an older
 * pricingSnapshot on a SENT package is replayed verbatim and may carry a gap
 * string this build has never heard of. */
export const HOTEL_GAP_LABELS: Record<string, string> = {
  "no-room-price": "No room rate set",
  "no-mattress-rate": "Mattresses have no rate — they add ₹0",
  "mattresses-not-enabled": "Room has no extra mattresses enabled in the catalog",
  "mattresses-over-capacity": "More mattresses than the rooms can take",
};

export function hotelGapLabel(gap: string | null | undefined): string | null {
  return gap ? HOTEL_GAP_LABELS[gap] ?? null : null;
}

export type StayIssueSeverity =
  /** Costing will reject this, or the client is charged the wrong amount. */
  | "error"
  /** Probably deliberate, but nobody can tell from the itinerary. */
  | "warning";

export type StayIssue = {
  code: StayIssueCode;
  severity: StayIssueSeverity;
  /** Whether this stops Mark Ready.
   *
   * Deliberately NOT derived from severity. Submitting is a one-way door —
   * once the package is with costing the exec cannot edit it — so a block has
   * to be something the exec can actually clear from where they are standing.
   * A mattress count they typed against a room that can't take it qualifies:
   * they change the number. A room whose catalog data contradicts itself does
   * not: it is serious enough to shout about, but blocking on it would strand
   * the exec behind a field only the hotel team can edit, which is a worse
   * outcome than the quote going to costing with a note on it. */
  blocksSubmit: boolean;
  /** What is wrong, in the exec's terms. */
  message: string;
  /** What to do about it — and, when the answer is "someone else owns this
   * data", who. An exec who is told a rate is missing but not that the hotel
   * team owns it will go looking for a field that isn't theirs to edit. */
  fix: string;
};

export type StayParty = { adults: number; children: number };

/** The room's capacity fields as snapshotted on the day. */
function capsOf(day: DayItinerary) {
  return {
    max_occupancy: day.accommodationRoomCapacity,
    extra_bed_capacity: day.accommodationExtraBedCapacity,
    max_adults: day.accommodationMaxAdults,
    max_children: day.accommodationMaxChildren,
  };
}

/** Beds in the OTHER room types booked for this night — a combo (3 Deluxe + 2
 * Standard at one hotel) is one booking, so its rooms count towards whether
 * the party fits. Extra rooms take no mattresses (see
 * computeBuilderHotelPricing), so their base capacity is all of it; a room
 * whose capacity the catalog never recorded contributes nothing rather than a
 * guess. */
function extraRoomBeds(day: DayItinerary): number {
  return (day.extraRooms ?? []).reduce(
    (sum, r) => sum + Math.max(1, r.quantity) * Math.max(0, r.roomCapacity ?? 0), 0,
  );
}

/** Every room the night holds — the primary at its effective count plus each
 * extra type at the quantity asked for. */
function roomsOnNight(day: DayItinerary, primaryRooms: number): number {
  return primaryRooms + (day.extraRooms ?? []).reduce((sum, r) => sum + Math.max(1, r.quantity), 0);
}

/** What this night will actually be charged per mattress, by the same rule
 * computeBuilderHotelPricing uses: the exec's typed rate wins outright,
 * otherwise the room's own catalog rate, otherwise nothing. */
export function effectiveMattressRate(day: DayItinerary): number {
  if (day.manualExtraBedRate != null) return day.manualExtraBedRate;
  return day.accommodationExtraBedRate ?? 0;
}

/** How many mattresses this night charges for — the exec's explicit count when
 * they gave one, otherwise the count derived from the room split. Mirrors the
 * pricing engine exactly; a second opinion here would be worse than none. */
export function effectiveMattressCount(day: DayItinerary, party: StayParty): number {
  if (day.roomPricingId == null) return Math.max(0, day.manualExtraBeds ?? 0);
  if (day.manualExtraBeds != null) return Math.max(0, day.manualExtraBeds);
  return planRoomOccupancy(party.adults, party.children, capsOf(day), day.roomsCount).mattresses;
}

/**
 * Everything wrong with this night's mattresses, most serious first.
 *
 * Empty for a night with no stay, a night still out with the hotel team, and —
 * the common case — a night that is simply fine. A warning next to something
 * that is fine teaches people to ignore warnings, which costs more than the one
 * it was trying to save.
 */
export function stayMattressIssues(day: DayItinerary, party: StayParty): StayIssue[] {
  if (day.hotelPending) return [];
  if (!day.accommodation?.trim() && day.roomPricingId == null) return [];

  const issues: StayIssue[] = [];
  const isCatalog = day.roomPricingId != null;
  const rooms = day.roomsCount && day.roomsCount > 0
    ? day.roomsCount
    : planRoomOccupancy(party.adults, party.children, capsOf(day), day.roomsCount).rooms;
  const wanted = effectiveMattressCount(day, party);
  const asked = day.manualExtraBeds ?? null;
  const rate = effectiveMattressRate(day);

  if (isCatalog) {
    const perRoomCapacity = day.accommodationExtraBedCapacity ?? 0;
    const totalCapacity = perRoomCapacity * rooms;

    // The one the exec cannot possibly diagnose. The room simply has no extra
    // beds configured, so the auto count is 0 no matter how full the room is,
    // and a typed count is a number with no room behind it.
    if (perRoomCapacity <= 0 && (asked ?? 0) > 0) {
      issues.push({
        code: "mattresses-not-enabled",
        blocksSubmit: true,
        severity: "error",
        message:
          `${day.accommodation || "This room"} has no extra mattresses enabled in the catalog, `
          + `so the ${asked} you've entered has nothing behind it — costing will see a mattress `
          + `count on a room that can't take one.`,
        fix:
          "The hotel team sets this on the room (Hotels → the property → Rooms → Extra bed "
          + "capacity). Ask them to enable it, or pick a room that already has mattresses.",
      });
    } else if (perRoomCapacity <= 0 && party.adults + party.children > 0) {
      // Nothing typed, but the party may still need beds this room can't give.
      const plan = planRoomOccupancy(party.adults, party.children, capsOf(day), day.roomsCount);
      const primaryBeds = plan.rooms * (day.accommodationRoomCapacity ?? 0);
      // Counted alongside the primary, because the party is split across both:
      // "3 Deluxe + 2 Standard" fits ten people that the deluxe rooms alone do
      // not, and flagging that as an overflow would put an error on a night
      // that is correct — which teaches execs to scroll past errors.
      const beds = primaryBeds + extraRoomBeds(day);
      if (primaryBeds > 0 && party.adults + party.children > beds) {
        issues.push({
          code: "party-does-not-fit",
        blocksSubmit: false,
          severity: "error",
          message:
            `${party.adults + party.children} guests don't fit in the `
            + `${roomsOnNight(day, plan.rooms)} room${roomsOnNight(day, plan.rooms) !== 1 ? "s" : ""} `
            + "booked for this night, and the room has no extra mattresses enabled to take "
            + "the overflow.",
          fix:
            "Add a room, add another room type from this hotel, pick a larger room type, or ask "
            + "the hotel team to set the room's extra bed capacity if the property does in fact "
            + "provide mattresses.",
        });
      }
    } else if (asked != null && totalCapacity > 0 && asked > totalCapacity) {
      issues.push({
        code: "mattresses-over-capacity",
        blocksSubmit: true,
        severity: "error",
        message:
          `${asked} mattresses asked for, but this room takes ${perRoomCapacity} `
          + `per room and ${rooms} room${rooms !== 1 ? "s" : ""} are booked — `
          + `${totalCapacity} is the most the hotel can provide.`,
        fix: `Bring it down to ${totalCapacity}, or book another room.`,
      });
    }
  }

  // Applies to both kinds of night, and is the quiet one: the mattresses ARE
  // on the itinerary, the client will be given them, and nobody is charged.
  if (wanted > 0 && rate <= 0) {
    issues.push({
      code: "no-mattress-rate",
        blocksSubmit: false,
      severity: "warning",
      message:
        `${wanted} mattress${wanted !== 1 ? "es" : ""} on this night with no rate behind `
        + `${wanted !== 1 ? "them" : "it"} — ${wanted !== 1 ? "they add" : "it adds"} ₹0 to the package.`,
      fix: isCatalog
        ? "Type a rate per mattress below if you know it, or ask the hotel team to add the "
          + "room's extra bed rate to its rate sheet. Leave it if the property really does "
          + "provide them free."
        : "Fill in “Rate / mattress”, or leave it if they're complimentary.",
    });
  }

  return issues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1));
}

/** The blocking message for Mark Ready, or null when nothing blocks.
 *
 * Only issues the exec can clear themselves — see blocksSubmit. A free mattress
 * is never one: sometimes it is the truth.
 *
 * Names every affected night at once rather than one per submit attempt —
 * fixing them a toast at a time is the same work spread over five rounds.
 */
export function blockingStayIssuesError(
  days: DayItinerary[], party: StayParty,
): string | null {
  const flagged = days
    .map((d) => ({ day: d.day, issues: stayMattressIssues(d, party).filter((i) => i.blocksSubmit) }))
    .filter((x) => x.issues.length > 0);
  if (flagged.length === 0) return null;

  const first = flagged[0].issues[0];
  const where = flagged.length === 1
    ? `Day ${flagged[0].day}`
    : `Days ${flagged.map((f) => f.day).join(", ")}`;
  return `${where}: ${first.message} ${first.fix}`;
}
