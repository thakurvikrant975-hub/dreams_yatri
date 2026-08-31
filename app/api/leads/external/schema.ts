import { z } from "zod";

/**
 * What an external site may POST as a lead.
 *
 * Deliberately far more forgiving than the website's own enquiry schema: the
 * landing pages on the .com site are hand-built and not uniform — some ask for
 * a party size and a package, some ask only for a name and a number — so
 * everything except a name and a phone is optional here. A page that doesn't
 * ask a question must be able to stay silent about it rather than send a
 * placeholder that reaches the sales team as if the visitor had answered.
 */

/** HTML forms post absent fields as "", and PHP forwards them that way. An
 * empty string is "not answered", never a value — collapsing it here keeps
 * every field below from having to spell that out. */
const blankToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const optionalText = (max: number) =>
  z.preprocess(blankToUndefined, z.string().trim().max(max).optional());

export const externalLeadSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(100),
  phone: z
    .string()
    .trim()
    .min(7, "Phone number is too short.")
    .max(20, "Phone number is too long.")
    .regex(/^[+\d][\d\s\-().]{5,}$/, "Enter a valid phone number."),
  countryCode: z.preprocess(blankToUndefined, z.string().trim().max(4).optional()),

  // Optional because a page may not ask. An unparseable or empty value is
  // dropped rather than rejected — a real lead with a junk party size is still
  // a real lead, and losing it to a validation error would be the worse bug.
  email: z.preprocess(blankToUndefined, z.string().trim().email().max(200).optional().catch(undefined)),
  persons: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(500).optional().catch(undefined)),
  travelDate: z.preprocess(
    blankToUndefined,
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  ),

  /** The package or plan the visitor picked, when the page offers a choice —
   * e.g. "Munnar & Tea Gardens – 2N/3D". */
  packageName: optionalText(200),
  /** Where the trip is. May be absent from the form entirely, which is what
   * `fallbackDestination` below is for. */
  destination: optionalText(120),
  /**
   * The destination this landing page is *about*, sent by the page itself
   * rather than typed by the visitor.
   *
   * A Kerala landing page is a Kerala lead whether or not it asked the
   * question, and the lead report groups by destination — so without this,
   * every lead from a page with no destination field lands under "Not
   * specified" and the per-destination table goes blank for exactly the
   * campaigns being spent on.
   */
  fallbackDestination: optionalText(120),

  message: optionalText(1000),
  /** No column of its own; folded into the note the sales exec reads. */
  city: optionalText(120),

  pageUrl: optionalText(500),
  packageUrl: optionalText(500),

  // Ad attribution. Without these a lead is credited to nobody and shows up
  // under "Other / untagged" on the lead report, which is what makes the
  // Google-vs-Meta split on that report meaningless.
  gclid: optionalText(255),
  utmSource: optionalText(120),
  utmMedium: optionalText(120),
  utmCampaign: optionalText(200),

  /** A closed set: a public endpoint must never be able to claim an
   * internal-only origin like PHONE_CALL or REFERRAL. */
  source: z.enum(["LANDING_PAGE", "PACKAGE_FORM", "CONTACT_FORM"]).optional(),

  /** The sender's own id for this submission — makes a retry a no-op. */
  externalId: optionalText(120),

  /** Anything a particular landing page asks that has no column here. */
  extra: z.record(z.string(), z.unknown()).optional(),
});

export type ExternalLeadInput = z.infer<typeof externalLeadSchema>;
