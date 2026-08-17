import "server-only";
import { db } from "@/app/lib/db";

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
  Other: "var(--color-dashboard-neutral)",
};
const FALLBACK_PALETTE = [
  "var(--color-dashboard-primary)", "var(--color-dashboard-secondary)", "var(--color-dashboard-info)",
  "var(--color-dashboard-success)", "var(--color-dashboard-warning)", "#a78bfa", "#fb923c", "#f472b6",
];
const DEST_PALETTE = FALLBACK_PALETTE;

function fmtDay(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(d);
}
function dayKey(d: Date): string {
  return d.toISOString().split("T")[0];
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
  assignedToName: string | null;
  createdAt: string;
};

export type DestinationChannelBreakdown = {
  destination: string;
  total: number;
  channels: { name: string; value: number; color: string }[];
};

export type LeadManagerAnalyticsData = {
  summary: {
    todayLeads: number;
    totalLeads: number;
    converted: number;
    convRate: number;
    uniqueDestinations: number;
  };
  dailyTrend: { date: string; leads: number }[];
  byDestination: { name: string; value: number; color: string }[];
  byChannel: { name: string; value: number; color: string }[];
  /** Every destination (not capped, unlike byDestination's top-7-for-a-chart
   * cap) with its own per-channel lead split — feeds the PDF report's
   * per-destination source breakdown. */
  destinationChannelBreakdown: DestinationChannelBreakdown[];
  /** How many leads (in range) are currently assigned to each team member —
   * "Unassigned" bucket included when relevant. */
  byTeamMember: { name: string; value: number }[];
  todaysLeads: LeadRow[];
  reportRows: LeadRow[];
  range: { from: string; to: string };
};

function toLeadRow(q: {
  id: string; name: string; phone: string; destination: string | null;
  source: string; utmSource: string | null; status: string;
  assignedToName: string | null; createdAt: Date;
}): LeadRow {
  return {
    id: q.id,
    name: q.name,
    phone: q.phone,
    destination: q.destination,
    channel: resolveChannel(q.source, q.utmSource),
    status: q.status,
    assignedToName: q.assignedToName,
    createdAt: q.createdAt.toISOString(),
  };
}

export async function getLeadManagerAnalytics(fromStr: string, toStr: string): Promise<LeadManagerAnalyticsData> {
  const from = new Date(`${fromStr}T00:00:00`);
  const to = new Date(`${toStr}T23:59:59.999`);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const selectFields = {
    id: true, name: true, phone: true, destination: true,
    source: true, utmSource: true, status: true,
    assignedToName: true, createdAt: true,
  } as const;

  const [rangeLeads, todaysLeadsRaw] = await Promise.all([
    db.package_queries.findMany({
      where: { deletedAt: null, createdAt: { gte: from, lte: to } },
      select: selectFields,
      orderBy: { createdAt: "desc" },
    }),
    db.package_queries.findMany({
      where: { deletedAt: null, createdAt: { gte: todayStart, lte: todayEnd } },
      select: selectFields,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const reportRows = rangeLeads.map(toLeadRow);
  const todaysLeads = todaysLeadsRaw.map(toLeadRow);

  const converted = rangeLeads.filter((q) => q.status === "CONVERTED" || q.status === "PAYMENT_INITIATED").length;

  // ── Destination breakdown — grouped case-insensitively (trimmed) so
  // "Kerala" / "kerala " land in one bucket, displayed title-cased. Every
  // destination is returned (no "Other" catch-all) so the report always
  // reflects the real data — the UI is responsible for staying readable
  // when the list is long (scrollable chart, paginated table).
  const destCounts = new Map<string, { display: string; count: number }>();
  for (const q of rangeLeads) {
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
  for (const q of rangeLeads) {
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
  for (const q of rangeLeads) {
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

  // ── Leads by team member ─────────────────────────────────────────────────
  const memberCounts = new Map<string, number>();
  for (const q of rangeLeads) {
    const name = q.assignedToName?.trim() || "Unassigned";
    memberCounts.set(name, (memberCounts.get(name) ?? 0) + 1);
  }
  const byTeamMember = [...memberCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));

  // ── Daily trend ──────────────────────────────────────────────────────────
  const dayBuckets = new Map<string, number>();
  for (const q of rangeLeads) {
    const key = dayKey(q.createdAt);
    dayBuckets.set(key, (dayBuckets.get(key) ?? 0) + 1);
  }
  const dailyTrend: LeadManagerAnalyticsData["dailyTrend"] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  let guard = 0;
  while (cursor <= end && guard < MAX_DAYS) {
    const key = dayKey(cursor);
    dailyTrend.push({ date: fmtDay(cursor), leads: dayBuckets.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }

  return {
    summary: {
      todayLeads: todaysLeads.length,
      totalLeads: rangeLeads.length,
      converted,
      convRate: rangeLeads.length > 0 ? Math.round((converted / rangeLeads.length) * 100) : 0,
      uniqueDestinations,
    },
    dailyTrend,
    byDestination,
    byChannel,
    destinationChannelBreakdown,
    byTeamMember,
    todaysLeads,
    reportRows,
    range: { from: fromStr, to: toStr },
  };
}
