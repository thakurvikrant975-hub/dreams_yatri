import "server-only";
import { db } from "@/app/lib/db";
import { getLeaderScope } from "@/app/lib/sales-teams/leader-scope";

const MAX_DAYS = 366;
const CONVERTED_STATUSES = ["CONVERTED", "PAYMENT_INITIATED"] as const;

// Mirrors SOURCE_CONFIG's labels in CustomBadges.tsx — kept as a local,
// server-only copy (same convention as lead-manager-analytics-actions.ts)
// so this stays a plain data-fetch module with no client-component bundle.
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
/** The IST day an instant falls on. toISOString() gave the UTC day, so every
 * lead between IST midnight and 5:30am landed in the previous bucket. */
function dayKey(d: Date): string {
  return istDayKey(d);
}
function titleCase(s: string): string {
  return s.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
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
import { istDayBounds } from "@/app/lib/ist-window";
import { istDayKey } from "../lead-report/ist";

export type TeamLeadRow = {
  id: string;
  name: string;
  phone: string;
  destination: string | null;
  channel: string;
  status: string;
  assignedTo: string | null;
  assignedToName: string | null;
  createdAt: string;
};

export type TeamMemberPerf = {
  id: string;
  name: string;
  totalLeads: number;
  converted: number;
  convRate: number;
};

export type TeamLeaderAnalyticsData = {
  teamId: string;
  teamName: string;
  teamMembers: { id: string; name: string }[];
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
  byTeamMember: TeamMemberPerf[];
  reportRows: TeamLeadRow[];
  range: { from: string; to: string };
};

function toTeamLeadRow(q: {
  id: string; name: string; phone: string; destination: string | null;
  source: string; utmSource: string | null; status: string;
  assignedTo: string | null; assignedToName: string | null; createdAt: Date; assignedAt: Date | null;
}): TeamLeadRow {
  return {
    id: q.id,
    name: q.name,
    phone: q.phone,
    destination: q.destination,
    channel: resolveChannel(q.source, q.utmSource),
    status: q.status,
    assignedTo: q.assignedTo,
    assignedToName: q.assignedToName,
    createdAt: q.createdAt.toISOString(),
  };
}

/** Team-scoped counterpart to getLeadManagerAnalytics — every lead assigned
 * to anyone on the logged-in Team Leader's SalesTeam (leader included, since
 * SalesTeam.members always includes them), for the given date range. Returns
 * null if the actor doesn't currently lead a team. */
export async function getTeamLeaderAnalytics(fromStr: string, toStr: string): Promise<TeamLeaderAnalyticsData | null> {
  const scope = await getLeaderScope();
  if (!scope?.ledTeamId) return null;

  const team = await db.salesTeam.findUnique({
    where: { id: scope.ledTeamId },
    select: { id: true, name: true, members: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
  });
  if (!team) return null;

  const teamMemberIds = team.members.map((m) => m.id);

  // The picker's dates are IST wall-clock dates and the server runs in UTC,
  // so both ends need the offset or the window silently slides by 5½ hours.
  const from = new Date(`${fromStr}T00:00:00+05:30`);
  const to = new Date(`${toStr}T23:59:59.999+05:30`);
  const { start: todayStart, end: todayEnd } = istDayBounds();

  const selectFields = {
    id: true, name: true, phone: true, destination: true,
    source: true, utmSource: true, status: true,
    assignedTo: true, assignedToName: true, createdAt: true, assignedAt: true,
  } as const;

  const [rangeLeads, todaysLeadsRaw] = await Promise.all([
    /*
     * A team's leads are the ones handed to it, so the window is assignedAt
     * — the same call sales-query's own date filter already makes. Keyed on
     * createdAt, a landing-page lead that arrived at 11pm and reached an exec
     * the next morning fell outside both windows, and execs were reporting
     * leads they had been given that their numbers did not show.
     */
    db.package_queries.findMany({
      where: { deletedAt: null, assignedTo: { in: teamMemberIds }, assignedAt: { gte: from, lte: to } },
      select: selectFields,
      orderBy: { assignedAt: "desc" },
    }),
    db.package_queries.findMany({
      where: { deletedAt: null, assignedTo: { in: teamMemberIds }, assignedAt: { gte: todayStart, lte: todayEnd } },
      select: selectFields,
    }),
  ]);

  const reportRows = rangeLeads.map(toTeamLeadRow);

  const converted = rangeLeads.filter((q) => (CONVERTED_STATUSES as readonly string[]).includes(q.status)).length;

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

  // ── Per-member breakdown — every roster member, including those with zero
  // leads in range, so a leader can see who's idle, not just who's busy.
  const byTeamMember: TeamMemberPerf[] = team.members
    .map((m) => {
      const memberLeads = rangeLeads.filter((q) => q.assignedTo === m.id);
      const memberConverted = memberLeads.filter((q) => (CONVERTED_STATUSES as readonly string[]).includes(q.status)).length;
      return {
        id: m.id,
        name: m.name,
        totalLeads: memberLeads.length,
        converted: memberConverted,
        convRate: memberLeads.length > 0 ? Math.round((memberConverted / memberLeads.length) * 100) : 0,
      };
    })
    .sort((a, b) => b.totalLeads - a.totalLeads);

  /*
   * Bucketed by the day the lead was handed over, matching the window above.
   * Grouped by createdAt while the window selected on assignedAt, a lead
   * could land in no bucket the axis draws — it was counted in the totals and
   * missing from the chart.
   */
  const dayBuckets = new Map<string, number>();
  for (const q of rangeLeads) {
    const at = q.assignedAt ?? q.createdAt;
    dayBuckets.set(dayKey(at), (dayBuckets.get(dayKey(at)) ?? 0) + 1);
  }
  const dailyTrend: TeamLeaderAnalyticsData["dailyTrend"] = [];
  // `from` is already IST midnight; IST has no DST, so a flat 24 hours walks
  // the calendar correctly.
  let cursor = new Date(from);
  let guard = 0;
  while (cursor <= to && guard < MAX_DAYS) {
    dailyTrend.push({ date: fmtDay(cursor), leads: dayBuckets.get(dayKey(cursor)) ?? 0 });
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    guard += 1;
  }

  return {
    teamId: team.id,
    teamName: team.name,
    teamMembers: team.members,
    summary: {
      todayLeads: todaysLeadsRaw.length,
      totalLeads: rangeLeads.length,
      converted,
      convRate: rangeLeads.length > 0 ? Math.round((converted / rangeLeads.length) * 100) : 0,
      uniqueDestinations,
    },
    dailyTrend,
    byDestination,
    byChannel,
    byTeamMember,
    reportRows,
    range: { from: fromStr, to: toStr },
  };
}
