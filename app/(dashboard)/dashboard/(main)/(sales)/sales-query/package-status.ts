// Plain (non-"use server") helpers for shaping a custom_packages row into
// what the status badges/drawer render. Deliberately kept out of actions.ts:
// that file has "use server" at the top, and Next.js requires every export
// from a Server Actions module to be an async function — mapCustomPackage
// and deriveHotelRequestStatus are synchronous data transforms, not actions,
// so they live here and get imported by both server and client code instead.

export type SentPackageInfo = {
    id:             string;
    title:          string;
    status:         string;
    createdAt:      Date;
    sentAt:         Date | null;
    readyAt:        Date | null;
    totalPrice:     number | null;
    pricePerPerson: number | null;
    pdfUrl:         string | null;
    verified:            boolean;
    verifiedAt:          Date | null;
    verifiedByName:      string | null;
    rejectedAt:          Date | null;
    rejectedByName:      string | null;
    rejectionNote:       string | null;
    rejectionReasonLabel: string | null;
    /** Rolled up from this package's itineraries — "rejected" wins over
     * "pending" (most actionable first), which wins over "filled" (the
     * hotel team fulfilled at least one day this way, still worth showing
     * even once nothing's outstanding). Null if this package never had a
     * hotel-team request at all. See HotelRequestBadge. */
    hotelRequestStatus: "pending" | "rejected" | "filled" | null;
    /** The rejection note for display, when hotelRequestStatus is "rejected". */
    hotelRequestNote:   string | null;
    /** Which days are in that status, for a "Day 2, Day 4" style tooltip. */
    hotelRequestDays:   number[];
};

/** Rolls up a package's per-day hotel-request fields (see actions.ts's
 * CUSTOM_PACKAGE_SELECT.itineraries) into the one status/note/days a badge
 * actually renders. */
function deriveHotelRequestStatus(itineraries: {
    day: number; hotelPending: boolean; hotelRejectedAt: Date | null;
    hotelRejectionNote: string | null; hotelFilledAt: Date | null;
}[]): Pick<SentPackageInfo, "hotelRequestStatus" | "hotelRequestNote" | "hotelRequestDays"> {
    const rejected = itineraries.filter((it) => it.hotelPending && it.hotelRejectedAt);
    if (rejected.length > 0) {
        return {
            hotelRequestStatus: "rejected",
            hotelRequestNote: rejected[0].hotelRejectionNote,
            hotelRequestDays: rejected.map((it) => it.day),
        };
    }
    const pending = itineraries.filter((it) => it.hotelPending);
    if (pending.length > 0) {
        return { hotelRequestStatus: "pending", hotelRequestNote: null, hotelRequestDays: pending.map((it) => it.day) };
    }
    const filled = itineraries.filter((it) => it.hotelFilledAt);
    if (filled.length > 0) {
        return { hotelRequestStatus: "filled", hotelRequestNote: null, hotelRequestDays: filled.map((it) => it.day) };
    }
    return { hotelRequestStatus: null, hotelRequestNote: null, hotelRequestDays: [] };
}

/** Flattens one CUSTOM_PACKAGE_SELECT result into the shape SentPackageInfo's
 * consumers (badges, the drawer) expect — rejectionReason.label pulled up to
 * rejectionReasonLabel, itineraries rolled up via deriveHotelRequestStatus.
 * Shared by every reader of custom_packages so the drawer (getSalesQueryById)
 * and the table (getSalesQueries) never drift into showing different data
 * for the same package. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapCustomPackage(cp: any): SentPackageInfo {
    return {
        ...cp,
        rejectionReasonLabel: cp.rejectionReason?.label ?? null,
        ...deriveHotelRequestStatus(cp.itineraries ?? []),
    };
}
