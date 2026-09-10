import "server-only";
import { db } from "@/app/lib/db";
import { istDayBounds } from "@/app/lib/ist-window";
import { istDayKey, IST_TZ } from "../lead-report/ist";
import { summariseHandovers, type AssigneeRow } from "./leadReportTotals";

const MAX_DAYS = 366;

// Mirrors SOURCE_CONFIG's labels in CustomBadges.tsx — kept as a local,
// server-only copy (rather than importing that "use client" file) so this
// stays a plain data-fetch module with no client-component bundle pulled in.
const SOURCE_LABELS: Record<string, string> = {
  WEBSITE_FORM: "Website Form",
  LANDING_PAGE: "Landing Page",
  PACKAGE_FORM: "Package Form",
  CONTACT_FORM: "Contact Form",
  WHATSAPP: "WhatsApp Meta",
  WHATSAPP_GOOGLE: "WhatsApp Google",
  META: "Meta",
  SEO: "SEO",
  SOCIAL_MEDIA: "Social Media",
  PHONE_CALL: "Phone Call",
  REFERRAL: "Referral",
  OTHER: "Other",
};

const CHANNEL_COLORS: Record<string, string> = {
  Meta: "#1877F2",
  Facebook: "#1877F2",
  Instagram: "#E4405F",
  Google: "#EA4335",
  "WhatsApp Meta": "var(--color-dashboard-success)",
  "WhatsApp Google": "#f97316",
  "Website Form": "var(--color-dashboard-primary)",
  "Landing Page": "var(--color-dashboard-info)",
  "Phone Call": "var(--color-dashboard-secondary)",
  Referral: "var(--color-dashboard-warning)",
  "Contact Form": "#10b981",
  "Package Form": "#f43f5e",
  SEO: "#14b8a6",
  "Social Media": "#ec4899",
  Other: "var(--color-dashboard-neutral)",
};
const FALLBACK_PALETTE = [
  "var(--color-dashboard-primary)", "var(--color-dashboard-secondary)", "var(--color-dashboard-info)",
  "var(--color-dashboard-success)", "var(--color-dashboard-warning)", "#a78bfa", "#fb923c", "#f472b6",
];
const DEST_PALETTE = FALLBACK_PALETTE;

function fmtDay(d: Date): string {
  // IST, like the key below — the trend's cursor walks IST midnights, and
  // formatted on a UTC server each of those reads back as the day before.
  return new Intl.DateTimeFormat("en-IN", { timeZone: IST_TZ, day: "numeric", month: "short" }).format(d);
}
/** The IST day an instant falls on. toISOString() gave the UTC day, so every
 * lead between IST midnight and 5:30am landed in the previous bucket. */
function dayKey(d: Date): string {
  return istDayKey(d);
}
function titleCase(s: string): string {
  return s.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Resolves the actual marketing channel for a lead. utmSource (free text,
 * e.g. "google", "facebook-ads") wins when present — it's the most specific
 * signal marketing actually tags campaigns with — normalized to a handful of
 * known brand names. Falls back to the `source` enum's own label otherwise
 * (WhatsApp, Phone Call, Referral, etc., which have no UTM concept). */
function resolveChannel(source: string, utmSource: string | null): string {
  const utm = utmSource?.trim();
  if (utm) {
    const lower = utm.toLowerCase();
    if (lower.includes("google")) return "Google";
    if (lower.includes("facebook") || lower === "fb") return "Facebook";
    if (lower.includes("instagram") || lower === "ig") return "Instagram";
    if (lower.includes("meta")) return "Meta";
    if (lower.includes("bing")) return "Bing";
    return titleCase(utm);
  }
  return SOURCE_LABELS[source] ?? titleCase(source.replace(/_/g, " "));
}

export type LeadRow = {
  id: string;
  name: string;
  phone: string;
  destination: string | null;
  channel: string;
  status: string;
  /** Travellers on the enquiry, when the lead said. */
  groupSize: number | null;
  /** The assignee's id — the per-exec download keys on it, since two execs
   * can share a name. */
  assignedTo: string | null;
  assignedToName: string | null;
  /** Whether the lead was sold on to an outside agency rather than worked
   * in-house. Agencies reach leads through the same `assignedTo` column our
   * own staff do, so nothing else in the row distinguishes them. */
  isPartnerAgency: boolean;
  createdAt: string;
  /** When the lead was handed over. This is the date the report is built
   * around; `createdAt` is kept so a row can still show how long the lead
   * waited before someone got it. */
  assignedAt: string | null;
};

export type DestinationChannelBreakdown = {
  destination: string;
  total: number;
  channels: { name: string; value: number; color: string }[];
};

export type { AssigneeRow };

/**
 * Everything on this report describes one population: the leads HANDED OVER
 * inside the range, windowed on assignedAt.
 *
 * It used to mix two. The totals, the charts and the tables were all intake
 * — leads that arrived in the range — while the per-exec table counted
 * handovers, and the two were printed on one page as though they were the
 * same thing. They cannot be: most of a morning's handovers are last night's
 * leads, so "108 received today" sat next to 112 leads assigned to our own
 * execs and read as a miscount. Now every figure below counts the same rows,
 * and they all add up.
 *
 * Intake has not been dropped, but it is context rather than a second set of
 * headline numbers: `receivedInRange` and `unassignedInRange` answer "what
 * came in, and what is still sitting there" and are labelled as such.
 */
export type LeadManagerAnalyticsData = {
  summary: {
    /** Handovers made today, whichever day each lead came in. */
    handedOverToday: number;
    /** Handovers made across the whole range. Every other figure on this
     * report is a cut of these rows, so they all reconcile to it. */
    handedOverInRange: number;
    /** Of those, the ones our own sales executives were given. */
    inHouse: number;
    /** And the ones sold on to an outside agency. Adds with `inHouse` back
     * up to `handedOverInRange`. */
    partnerAgency: number;
    converted: number;
    convRate: number;
    uniqueDestinations: number;
    /** Context, not a headline: how many leads ARRIVED in the range. This
     * will not match `handedOverInRange` and is not meant to — they are
     * different populations. */
    receivedInRange: number;
    /** Of those arrivals, how many still have nobody. */
    unassignedInRange: number;
  };
  /** Handovers per day, bucketed on the day of the handover. */
  dailyTrend: { date: string; leads: number }[];
  byDestination: { name: string; value: number; color: string }[];
  byChannel: { name: string; value: number; color: string }[];
  /** Every destination (not capped, unlike byDestination's top-7-for-a-chart
   * cap) with its own per-channel lead split — feeds the PDF report's
   * per-destination source breakdown. */
  destinationChannelBreakdown: DestinationChannelBreakdown[];
  /** Who was handed what, kept in two blocks rather than one ranked list:
   * a lead worked in-house and a lead sold to an agency are different kinds
   * of event, and a lead manager reads the split before the ranking. Both
   * blocks together account for every handover in range. */
  byAssignee: { inHouse: AssigneeRow[]; partners: AssigneeRow[] };
  /** Today's handovers. */
  todaysLeads: LeadRow[];
  /** Every handover in range, newest handover first. */
  reportRows: LeadRow[];
  range: { from: string; to: string };
};

function toLeadRow(q: {
  id: string; name: string; phone: string; destination: string | null;
  source: string; utmSource: string | null; status: string; groupSize: number | null;
  assignedTo: string | null; assignedToName: string | null; createdAt: Date; assignedAt: Date | null;
}, isPartnerAgency: boolean): LeadRow {
  return {
    id: q.id,
    name: q.name,
    phone: q.phone,
    destination: q.destination,
    channel: resolveChannel(q.source, q.utmSource),
    status: q.status,
    groupSize: q.groupSize,
    assignedTo: q.assignedTo,
    assignedToName: q.assignedToName,
    isPartnerAgency,
    createdAt: q.createdAt.toISOString(),
    assignedAt: q.assignedAt?.toISOString() ?? null,
  };
}

export async function getLeadManagerAnalytics(fromStr: string, toStr: string): Promise<LeadManagerAnalyticsData> {
  // The picker's dates are IST wall-clock dates and the server runs in UTC,
  // so both ends need the offset or the window silently slides by 5½ hours —
  // a "today" report would start at 5:30am IST and run into tomorrow morning.
  const from = new Date(`${fromStr}T00:00:00+05:30`);
  const to = new Date(`${toStr}T23:59:59.999+05:30`);

  const { start: todayStart, end: todayEnd } = istDayBounds();

  const selectFields = {
    id: true, name: true, phone: true, destination: true,
    source: true, utmSource: true, status: true, groupSize: true,
    assignedTo: true, assignedToName: true, createdAt: true, assignedAt: true,
  } as const;

  /*
   * The report's population: leads HANDED OVER in the range, not leads that
   * arrived in it. Windowed on assignedAt, the way Today's Query Assignments
   * and the team leader's report already count, so one handover is one row
   * and one assignment mail.
   */
  const handedOverWhere = {
    deletedAt: null,
    assignedTo: { not: null },
    assignedAt: { gte: from, lte: to },
  } as const;

  const [assignedLeads, todaysAssignedRaw, receivedInRange, unassignedInRange, partnerMembers] =
    await Promise.all([
      db.package_queries.findMany({
        where: handedOverWhere,
        select: selectFields,
        orderBy: { assignedAt: "desc" },
      }),
      db.package_queries.findMany({
        where: { deletedAt: null, assignedTo: { not: null }, assignedAt: { gte: todayStart, lte: todayEnd } },
        select: selectFields,
        orderBy: { assignedAt: "desc" },
      }),
      // Intake, kept as context. Deliberately a count rather than a second
      // set of rows: it answers "what came in", which is a different question
      // from every other figure here, and printing it as a headline beside
      // them is what made the report look wrong.
      db.package_queries.count({ where: { deletedAt: null, createdAt: { gte: from, lte: to } } }),
      db.package_queries.count({
        where: { deletedAt: null, assignedTo: null, createdAt: { gte: from, lte: to } },
      }),
      // Agencies reach leads through the same `assignedTo` column our own
      // staff do, so the only way to tell a sold lead from a worked one is
      // the assignee's role flag.
      db.teamMember.findMany({
        where: { teamRole: { isPartnerAgency: true } },
        select: { id: true },
      }),
    ]);

  const partnerIds = new Set(partnerMembers.map((m) => m.id));
  const isPartner = (assignedTo: string | null) => !!assignedTo && partnerIds.has(assignedTo);

  const reportRows = assignedLeads.map((q) => toLeadRow(q, isPartner(q.assignedTo)));
  const todaysLeads = todaysAssignedRaw.map((q) => toLeadRow(q, isPartner(q.assignedTo)));

  // The counting itself lives in leadReportTotals so it can be tested
  // without a database — see scripts/test-lead-report.ts.
  const totals = summariseHandovers(assignedLeads, partnerIds);

  // ── Destination breakdown — grouped case-insensitively (trimmed) so
  // "Kerala" / "kerala " land in one bucket, displayed title-cased. Every
  // destination is returned (no "Other" catch-all) so the report always
  // reflects the real data — the UI is responsible for staying readable
  // when the list is long (scrollable chart, paginated table).
  const destCounts = new Map<string, { display: string; count: number }>();
  for (const q of assignedLeads) {
    const raw = q.destination?.trim();
    const key = raw ? raw.toLowerCase() : "__unspecified__";
    const display = raw ? titleCase(raw) : "Not specified";
    const bucket = destCounts.get(key) ?? { display, count: 0 };
    bucket.count += 1;
    destCounts.set(key, bucket);
  }
  const sortedDest = [...destCounts.values()].sort((a, b) => b.count - a.count);
  const byDestination = sortedDest.map((d, i) => ({
    name: d.display, value: d.count, color: DEST_PALETTE[i % DEST_PALETTE.length],
  }));
  const uniqueDestinations = sortedDest.filter((d) => d.display !== "Not specified").length;

  // ── Channel breakdown ("meta, google, etc.") ────────────────────────────
  const channelCounts = new Map<string, number>();
  for (const q of assignedLeads) {
    const channel = resolveChannel(q.source, q.utmSource);
    channelCounts.set(channel, (channelCounts.get(channel) ?? 0) + 1);
  }
  const byChannel = [...channelCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({
      name, value, color: CHANNEL_COLORS[name] ?? FALLBACK_PALETTE[i % FALLBACK_PALETTE.length],
    }));
  const channelColor = new Map(byChannel.map((c) => [c.name, c.color]));

  // ── Destination x channel breakdown ("for Gujarat, how many leads from
  // which source") — every destination, not just the top 7 shown on the
  // chart, since the PDF report needs the full picture.
  const destChannelCounts = new Map<string, Map<string, number>>();
  for (const q of assignedLeads) {
    const raw = q.destination?.trim();
    const destKey = raw ? raw.toLowerCase() : "__unspecified__";
    const channel = resolveChannel(q.source, q.utmSource);
    if (!destChannelCounts.has(destKey)) destChannelCounts.set(destKey, new Map());
    const m = destChannelCounts.get(destKey)!;
    m.set(channel, (m.get(channel) ?? 0) + 1);
  }
  const destinationChannelBreakdown: DestinationChannelBreakdown[] = sortedDest.map((d) => {
    const key = d.display === "Not specified" ? "__unspecified__" : d.display.toLowerCase();
    const channelMap = destChannelCounts.get(key) ?? new Map();
    return {
      destination: d.display,
      total: d.count,
      channels: [...channelMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, value], i) => ({
          name, value, color: channelColor.get(name) ?? CHANNEL_COLORS[name] ?? FALLBACK_PALETTE[i % FALLBACK_PALETTE.length],
        })),
    };
  });

  // ── Daily trend ──────────────────────────────────────────────────────────
  // Bucketed on the day of the handover, matching the window above. Bucketed
  // by createdAt while the window selected on assignedAt, a lead could land
  // in no bucket the axis draws — counted in the totals, missing from the
  // chart.
  const dayBuckets = new Map<string, number>();
  for (const q of assignedLeads) {
    const key = dayKey(q.assignedAt ?? q.createdAt);
    dayBuckets.set(key, (dayBuckets.get(key) ?? 0) + 1);
  }
  const dailyTrend: LeadManagerAnalyticsData["dailyTrend"] = [];
  // `from` is already IST midnight; IST is a fixed +05:30 with no DST, so a
  // flat 24 hours walks the calendar correctly. setDate/setHours would have
  // stepped the server's own midnight, which is 5:30am in the office.
  let cursor = new Date(from);
  let guard = 0;
  while (cursor <= to && guard < MAX_DAYS) {
    const key = dayKey(cursor);
    dailyTrend.push({ date: fmtDay(cursor), leads: dayBuckets.get(key) ?? 0 });
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    guard += 1;
  }

  return {
    summary: {
      handedOverToday: todaysLeads.length,
      handedOverInRange: totals.handedOverInRange,
      inHouse: totals.inHouse,
      partnerAgency: totals.partnerAgency,
      converted: totals.converted,
      convRate: totals.convRate,
      uniqueDestinations,
      receivedInRange,
      unassignedInRange,
    },
    dailyTrend,
    byDestination,
    byChannel,
    destinationChannelBreakdown,
    byAssignee: totals.byAssignee,
    todaysLeads,
    reportRows,
    range: { from: fromStr, to: toStr },
  };
}
