/**
 * Reading a lead's stored `requirements` without trusting its shape.
 *
 * The column is free-form JSON and not every lead's copy came from the sales
 * form: the .com bridge writes an object holding only its own `leadMeta`, and
 * older leads carry half-filled sections from formats since changed. A plain
 * `requirements &&` check passes all of them straight through to code that
 * reads `.travellers.tripType` — which is how one landing-page lead took an
 * exec's whole queue down with "Cannot read properties of undefined".
 *
 * Two questions get answered here, once, instead of at every read:
 * whether a lead has requirements at all, and what they are when it does.
 */
import type { PackageRequirements } from "../../(marketing)/queries/actions";

/** The six sections the sales form fills. An object carrying none of them —
 * the bridge's `{ leadMeta }` — is not a filled-in requirements record, no
 * matter that the column is non-null. */
const SECTIONS = ["travellers", "journey", "stay", "transport", "activities", "budget"] as const;

/** Neutral, not defaults: nothing here should read as a real answer the exec
 * gave. Callers still decide what is worth showing (a group of 0 travellers
 * is a section that was never filled, not a group of nobody). */
const EMPTY: PackageRequirements = {
    travellers: { leadName: "", adults: 0, children: 0, infants: 0 },
    journey: { departurePoints: [], pickupPoints: [], dateType: "FIXED", noOfDays: 0, noOfNights: 0, destinations: [] },
    stay: { types: [], mealTypes: [] },
    transport: { required: false, cabTypes: [], includeFlights: false, includeTrain: false },
    activities: { selected: [], custom: [] },
    budget: { type: "PER_PERSON", currency: "INR" },
};

function sectionAt(src: Record<string, unknown>, key: string): Record<string, unknown> | null {
    const v = src[key];
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/**
 * The lead's requirements as something safe to read, or null when the stored
 * value holds none of the form's sections.
 *
 * Present sections are merged onto the empty ones rather than trusted whole,
 * so a partially-filled section from an older format is completed instead of
 * leaving holes for the fields above to trip over.
 */
export function readRequirements(value: unknown): PackageRequirements | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const src = value as Record<string, unknown>;
    if (!SECTIONS.some((s) => sectionAt(src, s))) return null;

    // The one place the JSON is cast: everything below it has been merged onto
    // a complete object, so the shape is ours from here on.
    return {
        travellers: { ...EMPTY.travellers, ...sectionAt(src, "travellers") },
        journey: { ...EMPTY.journey, ...sectionAt(src, "journey") },
        stay: { ...EMPTY.stay, ...sectionAt(src, "stay") },
        transport: { ...EMPTY.transport, ...sectionAt(src, "transport") },
        activities: { ...EMPTY.activities, ...sectionAt(src, "activities") },
        budget: { ...EMPTY.budget, ...sectionAt(src, "budget") },
    } as PackageRequirements;
}

/** Whether the exec has actually filled anything in — what the green dot on
 * the queue and the Edit/Fill wording on the buttons are claiming. */
export function hasRequirements(value: unknown): boolean {
    return readRequirements(value) !== null;
}
