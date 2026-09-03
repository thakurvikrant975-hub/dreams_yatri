import "server-only";
import { db } from "@/app/lib/db";
import { autoAssignLead } from "@/app/lib/queries/auto-assign";
import type { QuerySource } from "@/app/generated/prisma";

/**
 * The one path a lead takes into `package_queries`, whoever sent it.
 *
 * Extracted from the website's server action so the external REST endpoint
 * (app/api/leads/external) writes leads exactly the way the site's own forms
 * do — same rate limits, same duplicate guards, same LeadProfile upsert, same
 * auto-assignment. A second insert written alongside this one would drift,
 * and the leads that skipped it would silently never reach a sales exec.
 */

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; //  15 min — same phone, any package
const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000; //  24 h  — same phone + same package

/** How far back an idempotency key is honoured. Long enough for a retry queue
 * on the sending side to drain after an outage, short enough that the scan
 * stays bounded by the createdAt index. */
const EXTERNAL_ID_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type IntakeInput = {
  name: string;
  phone: string;
  countryCode?: string;
  email?: string;
  packageName?: string;
  destination?: string;
  packageUrl?: string;
  pageUrl?: string;
  travelDate?: string;
  travellers?: number;
  message?: string;
  source?: QuerySource;
  gclid?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  /** Caller's own id for this submission. When supplied, re-sending it is a
   * no-op rather than a second lead — which is what makes a retry safe. */
  externalId?: string;
  /** Anything the schema has no column for (a landing page's own extra
   * questions, the visitor's city). Stored on `requirements` as-is. */
  extra?: Record<string, unknown>;
};

export type IntakeResult =
  /** `duplicate` means the lead was recognised, not that anything failed —
   * callers that retry must treat it as success or they will retry forever. */
  | { ok: true; id: string; duplicate: boolean }
  | { ok: false; reason: "RATE_LIMITED" | "DUPLICATE"; message: string }
  | { ok: false; reason: "FAILED"; message: string };

/** `LeadProfile.phone` is unique, so the same human must normalise to the same
 * key however they typed it. Matches the rule the website already used. */
export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-().+]/g, "");
}

export async function createLead(input: IntakeInput): Promise<IntakeResult> {
  const {
    name, email, phone, countryCode, travelDate, travellers, message,
    packageName, destination, packageUrl, pageUrl, source,
    gclid, utmSource, utmMedium, utmCampaign, externalId, extra,
  } = input;

  // ── Idempotency: the same submission re-sent is the same lead ───────────
  // Checked before the rate limit, so a retry gets the original lead's id
  // back rather than a "you already submitted" refusal.
  if (externalId) {
    const seen = await db.package_queries.findFirst({
      where: {
        createdAt: { gte: new Date(Date.now() - EXTERNAL_ID_WINDOW_MS) },
        OR: [
          { requirements: { path: ["leadMeta", "externalId"], equals: externalId } },
          // Leads forwarded before the metadata was namespaced.
          { requirements: { path: ["externalId"], equals: externalId } },
        ],
      },
      select: { id: true },
    });
    if (seen) return { ok: true, id: seen.id, duplicate: true };
  }

  // ── Rate limiting: same phone within 15 minutes ────────────────────────
  const recentByPhone = await db.package_queries.findFirst({
    where: { phone, createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) } },
    select: { id: true },
  });
  if (recentByPhone) {
    return {
      ok: false,
      reason: "RATE_LIMITED",
      message: "You already submitted a query. Our team will contact you shortly.",
    };
  }

  // ── Duplicate guard: same phone + same package within 24 hours ─────────
  if (packageName) {
    const duplicate = await db.package_queries.findFirst({
      where: {
        phone,
        packageName,
        createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
      },
      select: { id: true },
    });
    if (duplicate) {
      return {
        ok: false,
        reason: "DUPLICATE",
        message: "You have already enquired about this package. Our team will be in touch soon.",
      };
    }
  }

  try {
    const profile = await db.leadProfile.upsert({
      where: { phone: normalizePhone(phone) },
      update: {
        name,
        ...(email ? { email } : {}),
        lastSeenAt: new Date(),
        totalQueries: { increment: 1 },
      },
      create: { phone: normalizePhone(phone), name, email: email || null },
    });

    /*
     * Nested under `leadMeta`, never spread across the top level.
     *
     * `requirements` is not a scratch field: the sales screens read a specific
     * shape out of it (journey, travellers, stay …) and some of them reach
     * straight through to a nested key. Writing foreign keys alongside that
     * shape produced an object with no `journey`, which crashed the sales
     * queue for the one exec who had been assigned such a lead. One key of our
     * own keeps this data out of the way of that structure entirely.
     */
    const meta = { ...(extra ?? {}), ...(externalId ? { externalId } : {}) };
    const requirements = Object.keys(meta).length > 0 ? { leadMeta: meta } : undefined;

    const created = await db.package_queries.create({
      data: {
        name,
        phone,
        countryCode: countryCode || "IN",
        email: email || null,
        packageName: packageName || null,
        destination: destination || null,
        packageUrl: packageUrl || null,
        pageUrl: pageUrl || null,
        travelDate: travelDate ? new Date(travelDate) : null,
        groupSize: travellers ?? null,
        message: message || null,
        source: source ?? "PACKAGE_FORM",
        gclid: gclid || null,
        utmSource: utmSource || null,
        utmMedium: utmMedium || null,
        utmCampaign: utmCampaign || null,
        status: "SUBMITTED",
        leadProfileId: profile.id,
        ...(requirements ? { requirements } : {}),
      },
    });

    await autoAssignLead(created.id);

    return { ok: true, id: created.id, duplicate: false };
  } catch (e) {
    console.error("[intake] failed to create lead:", e);
    return { ok: false, reason: "FAILED", message: "Failed to submit enquiry. Please try again." };
  }
}
