import { z } from "zod";
import { CLICK_ID_TYPES } from "./attribution";

/**
 * The attribution fields a lead may carry — shared by the website's own forms
 * (enquirySchema) and the external endpoint (externalLeadSchema), so the two
 * can't drift on what they accept.
 *
 * Attribution never costs us a lead. Every field is dropped rather than
 * rejected when it is malformed: an enquiry with a mangled keyword is still a
 * real enquiry, and a validation error here would lose it over bookkeeping —
 * the same reasoning externalLeadSchema already applies to party size and
 * email. Blank strings, which PHP forwards for absent fields, read as absent.
 */
const text = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() || undefined : v),
    z.string().max(max).optional(),
  ).catch(undefined)
    // Outermost so the key is optional in z.input too: a preprocess alone
    // types its input as a required `unknown`, and enquirySchema's input type
    // is what the website's forms are checked against.
    .optional();

export const adClickFields = {
  adsClickId: text(255),
  adsClickIdType: z.enum(CLICK_ID_TYPES).optional().catch(undefined),
  adsCampaignId: text(32),
  adsAdGroupId: text(32),
  adsCreativeId: text(32),
  adsKeyword: text(255),
  adsMatchType: text(16),
  adsNetwork: text(16),
  adsDevice: text(16),
  adsTargetId: text(64),
  adsClickAt: z.iso.datetime({ offset: true }).optional().catch(undefined),
};

/** utm tags, as forgiving as the ids — for the website's forms, which never
 * sent them. externalLeadSchema keeps its own long-standing definitions. */
export const utmFields = {
  utmSource: text(120),
  utmMedium: text(120),
  utmCampaign: text(200),
};
