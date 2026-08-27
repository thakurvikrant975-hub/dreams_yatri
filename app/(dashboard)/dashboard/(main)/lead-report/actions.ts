import "server-only";
import { db } from "@/app/lib/db";

/**
 * The lead manager's daily report — the dashboard equivalent of the sheet
 * that used to be written out by hand each evening (leads by platform, the
 * mail/calling split, per-destination counts, what was handed to the team,
 * and the day's payments).
 *
 * Two things make this different from the analytics dashboard's own lead
 * report (lead-manager-analytics-actions.ts), and are the reason it isn't
 * just another view over that data:
 *
 *  1. The window is a *datetime* range, not a pair of dates — the report is
 *     genuinely run as "yesterday 11am to today 3pm", so the day boundary is
 *     not a useful unit here.
 *  2. Everything is bucketed in IST. The report is read by a team in India
 *     and a window like "1pm–3pm" means IST wall-clock, so a server running
 *     in UTC must not be allowed to shift it by 5:30.
 */

/** IST is a fixed UTC+05:30 with no DST, so the offset can be a constant —
 * no timezone database lookup is needed to convert either direction. */
const IST_OFFSET = "+05:30";
export const IST_TZ = "Asia/Kolkata";

/** Converts an IST wall-clock `datetime-local` string ("2026-08-27T13:00",
 * as produced by the picker) into the absolute instant it names. Appending
 * the fixed offset lets the platform's own parser do the arithmetic, which
 * is why this never depends on the server's local timezone. */
export function istLocalToDate(local: string): Date {
  const withSeconds = local.length === 16 ? `${local}:00` : local;
  return new Date(`${withSeconds}${IST_OFFSET}`);
}

/** The IST calendar day an instant falls on, as YYYY-MM-DD. The payments
 * list is grouped by this: a report run from yesterday evening to this
 * afternoon has to separate last night's payments from today's, the way the
 * handwritten sheet always did. */
export function istDayKey(d: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(typeof d === "string" ? new Date(d) : d);
}

/** The inverse — an instant rendered back as the `datetime-local` value that
 * names it in IST, for seeding the picker's defaults server-side. */
export function dateToIstLocal(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  // en-CA gives 24-hour parts, but midnight can come back as "24" — the
  // datetime-local input rejects that, and it means hour 00 of the same day.
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

// ── Platform + medium classification ────────────────────────────────────

/** The three buckets the report's two halves are built from. Anything the
 * ad platforms didn't bring in (referrals, organic forms, untagged calls)
 * lands in OTHER rather than being silently attributed to a platform. */
export type Platform = "GOOGLE" | "META" | "OTHER";

/** How the lead reached us, which is the "mail leads / calling leads" split
 * on the handwritten sheet. FORM covers every written enquiry (website,
 * landing page, package and contact forms). */
export type Medium = "FORM" | "CALL" | "WHATSAPP";

type Classifiable = { source: string; utmSource: string | null; gclid: string | null };

/**
 * Which ad platform a lead is credited to.
 *
 * `utmSource` is checked first because it's the most specific signal — it's
 * what marketing actually tags campaigns with — and `gclid` is conclusive
 * proof of a Google Ads click even when the UTM tags were dropped somewhere
 * in the redirect chain. The `source` enum is the fallback for the channels
 * that have no UTM concept at all (WhatsApp, phone calls, referrals).
 *
 * Note the deliberate gap: a phone call typed in by hand carries no UTM and
 * no gclid, so it can only be credited to a platform if whoever entered it
 * tagged it. Those land in OTHER, and the report surfaces the count rather
 * than guessing — see `untaggedCalls` on the returned data.
 */
export function classifyPlatform(q: Classifiable): Platform {
  if (q.gclid?.trim()) return "GOOGLE";

  const utm = q.utmSource?.trim().toLowerCase();
  if (utm) {
    if (utm.includes("google") || utm.includes("gads") || utm.includes("adwords")) return "GOOGLE";
    if (utm.includes("facebook") || utm.includes("instagram") || utm.includes("meta") || utm === "fb" || utm === "ig") return "META";
  }

  switch (q.source) {
    case "WHATSAPP_GOOGLE":
      return "GOOGLE";
    // WHATSAPP is Meta's WhatsApp Business API — the sheet's "WhatsApp Meta".
    case "WHATSAPP":
    case "META":
      return "META";
    default:
      return "OTHER";
  }
}

export function classifyMedium(source: string): Medium {
  switch (source) {
    case "PHONE_CALL":
      return "CALL";
    case "WHATSAPP":
    case "WHATSAPP_GOOGLE":
      return "WHATSAPP";
    default:
      return "FORM";
  }
}

const PLATFORM_LABEL: Record<Platform, string> = {
  GOOGLE: "Google",
  META: "Meta",
  OTHER: "Other / untagged",
};

// ── Returned shapes ─────────────────────────────────────────────────────

export type PlatformBlock = {
  platform: Platform;
  label: string;
  /** Written enquiries — the sheet's "mail leads". */
  formLeads: number;
  /** The sheet's "calling leads". */
  callLeads: number;
  whatsappLeads: number;
  total: number;
  /** Leads created in this window that already have an owner. */
  assigned: number;
  unassigned: number;
};

export type DestinationRow = {
  destination: string;
  total: number;
  google: number;
  meta: number;
  other: number;
  assigned: number;
};

export type PaymentRow = {
  id: string;
  /** ISO instant — formatted for display in IST at the edges. */
  paidAt: string;
  /** IST calendar day (YYYY-MM-DD) this payment lands on, so the page and the
   * PDF group the list into the same buckets without recomputing it. */
  dayKey: string;
  amount: number;
  bookingNumber: string;
  clientName: string;
  /** The sales exec credited with the booking, when one is recorded. */
  agentName: string | null;
  destination: string | null;
  /** Where the originating lead came from — null when the booking has no
   * lead behind it (a walk-in or a directly-created booking). */
  platform: Platform | null;
  medium: Medium | null;
  gateway: string;
};

export type LeadReportData = {
  range: { from: string; to: string; fromLocal: string; toLocal: string };
  totals: {
    leads: number;
    assignedInWindow: number;
    converted: number;
    /** Phone leads with no platform tag — the report's own accuracy caveat.
     * A non-zero count means the calling split below is understated. */
    untaggedCalls: number;
  };
  platforms: PlatformBlock[];
  destinations: DestinationRow[];
  payments: PaymentRow[];
  paymentsTotal: number;
};

// ── Query ───────────────────────────────────────────────────────────────

function titleCase(s: string): string {
  return s.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function getLeadReport(fromLocal: string, toLocal: string): Promise<LeadReportData> {
  const from = istLocalToDate(fromLocal);
  const to = istLocalToDate(toLocal);

  const [leads, assignedInWindow, payments] = await Promise.all([
    db.package_queries.findMany({
      where: { deletedAt: null, createdAt: { gte: from, lte: to } },
      select: {
        id: true, source: true, utmSource: true, gclid: true,
        destination: true, status: true, assignedTo: true, createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),

    // Counted by `assignedAt`, not `createdAt` — "leads given to the team in
    // this window" is a different number from "leads that arrived in this
    // window and happen to have an owner now", and on a report that spans
    // midnight it's the former the lead manager is reporting.
    db.package_queries.count({
      where: { deletedAt: null, assignedAt: { gte: from, lte: to } },
    }),

    db.payment.findMany({
      where: {
        paidAt: { gte: from, lte: to },
        status: { in: ["ADVANCE_PAID", "FULLY_PAID"] },
      },
      select: {
        id: true, paidAt: true, amount: true, gateway: true,
        booking: {
          select: {
            bookingNumber: true,
            salesAgentName: true,
            destination: { select: { name: true } },
            user: { select: { name: true } },
            contactEmail: true,
            sourceQuery: {
              select: { name: true, source: true, utmSource: true, gclid: true, destination: true },
            },
          },
        },
      },
      orderBy: { paidAt: "asc" },
    }),
  ]);

  // ── Platform blocks ───────────────────────────────────────────────────
  const blank = (platform: Platform): PlatformBlock => ({
    platform, label: PLATFORM_LABEL[platform],
    formLeads: 0, callLeads: 0, whatsappLeads: 0, total: 0, assigned: 0, unassigned: 0,
  });
  const blocks: Record<Platform, PlatformBlock> = {
    GOOGLE: blank("GOOGLE"), META: blank("META"), OTHER: blank("OTHER"),
  };

  let untaggedCalls = 0;

  for (const lead of leads) {
    const platform = classifyPlatform(lead);
    const medium = classifyMedium(lead.source);
    const block = blocks[platform];

    if (medium === "CALL") block.callLeads += 1;
    else if (medium === "WHATSAPP") block.whatsappLeads += 1;
    else block.formLeads += 1;

    block.total += 1;
    if (lead.assignedTo) block.assigned += 1;
    else block.unassigned += 1;

    if (medium === "CALL" && platform === "OTHER") untaggedCalls += 1;
  }

  // ── Destination rows ──────────────────────────────────────────────────
  // Grouped case-insensitively on trimmed text, since `destination` is free
  // text on the query and "Goa" / "goa " are the same place.
  const destMap = new Map<string, DestinationRow>();
  for (const lead of leads) {
    const raw = lead.destination?.trim();
    const key = raw ? raw.toLowerCase() : "__unspecified__";
    const row = destMap.get(key) ?? {
      destination: raw ? titleCase(raw) : "Not specified",
      total: 0, google: 0, meta: 0, other: 0, assigned: 0,
    };
    const platform = classifyPlatform(lead);
    row.total += 1;
    if (platform === "GOOGLE") row.google += 1;
    else if (platform === "META") row.meta += 1;
    else row.other += 1;
    if (lead.assignedTo) row.assigned += 1;
    destMap.set(key, row);
  }
  const destinations = [...destMap.values()].sort((a, b) => b.total - a.total);

  // ── Payments ──────────────────────────────────────────────────────────
  const paymentRows: PaymentRow[] = payments.map((p) => {
    const q = p.booking?.sourceQuery;
    const paidAt = p.paidAt ?? new Date();
    return {
      id: p.id,
      paidAt: paidAt.toISOString(),
      dayKey: istDayKey(paidAt),
      amount: Number(p.amount),
      bookingNumber: p.booking?.bookingNumber ?? "—",
      clientName: q?.name ?? p.booking?.user?.name ?? "—",
      agentName: p.booking?.salesAgentName ?? null,
      destination: p.booking?.destination?.name ?? q?.destination?.trim() ?? null,
      platform: q ? classifyPlatform(q) : null,
      medium: q ? classifyMedium(q.source) : null,
      gateway: p.gateway,
    };
  });

  const converted = leads.filter(
    (l) => l.status === "CONVERTED" || l.status === "PAYMENT_INITIATED",
  ).length;

  return {
    range: {
      from: from.toISOString(), to: to.toISOString(),
      fromLocal, toLocal,
    },
    totals: {
      leads: leads.length,
      assignedInWindow,
      converted,
      untaggedCalls,
    },
    platforms: [blocks.GOOGLE, blocks.META, blocks.OTHER],
    destinations,
    payments: paymentRows,
    paymentsTotal: paymentRows.reduce((s, p) => s + p.amount, 0),
  };
}
