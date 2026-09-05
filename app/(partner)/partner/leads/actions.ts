import "server-only";
import { db } from "@/app/lib/db";
import type { Prisma } from "@/app/generated/prisma";
import type { PartnerLeadRow } from "./lead-format";

export type { PartnerLeadRow };

export const LEADS_PAGE_SIZE = 25;

/** Which date the range applies to. Both are dates the agency thinks about:
 * when the lead landed on their desk, and when the customer wants to travel. */
export type LeadDateField = "received" | "travel";

export type LeadFilters = {
  q: string;
  dateField: LeadDateField;
  from: string | null;  // yyyy-mm-dd, inclusive, read as an IST day
  to: string | null;    // yyyy-mm-dd, inclusive, read as an IST day
  destination: string | null;
  page: number;
};

/** IST day boundaries. A partner picking "5 Sep" means the day they lived
 * through, not a UTC one that ends at 5:30 in the morning. */
const istStart = (day: string) => new Date(`${day}T00:00:00.000+05:30`);
const istEnd = (day: string) => new Date(`${day}T23:59:59.999+05:30`);

const validDay = (day: string | null) =>
  day && /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(istStart(day).getTime())
    ? day
    : null;

function rangeFilter(from: string | null, to: string | null) {
  const gte = validDay(from) ? istStart(from!) : undefined;
  const lte = validDay(to) ? istEnd(to!) : undefined;
  return gte || lte ? { gte, lte } : null;
}

/**
 * The filters, read from whatever the caller has — a URL's searchParams on the
 * server, or the same query string handed back by the browser for "copy all".
 *
 * Everything is parsed here rather than at the two call sites so the page and
 * the copy button can never disagree about what the URL means: an unparseable
 * date or an unknown date field falls back to the unfiltered reading instead
 * of erroring, because a partner should get a list, not a stack trace.
 */
export function parseLeadFilters(raw: Record<string, string | undefined>): LeadFilters {
  return {
    q: typeof raw.q === "string" ? raw.q.slice(0, 120) : "",
    dateField: raw.dateField === "travel" ? "travel" : "received",
    from: validDay(raw.from ?? null),
    to: validDay(raw.to ?? null),
    destination: raw.destination ? raw.destination.slice(0, 200) : null,
    page: Math.max(1, Number.parseInt(raw.page ?? "1", 10) || 1),
  };
}

/** Is anything actually narrowing the list? Drives the "Clear" affordance. */
export const hasActiveFilters = (f: LeadFilters) =>
  Boolean(f.q.trim() || f.from || f.to || f.destination);

/**
 * Turn the filters into a where clause, always anchored to one agency.
 *
 * The `assignedTo` equality is the first term and never comes from the
 * browser — everything else narrows a set that is already this agency's.
 */
function buildWhere(memberId: string, f: LeadFilters): Prisma.package_queriesWhereInput {
  const where: Prisma.package_queriesWhereInput = {
    assignedTo: memberId,
    deletedAt: null,
  };

  const and: Prisma.package_queriesWhereInput[] = [];

  const range = rangeFilter(f.from, f.to);
  if (range) {
    if (f.dateField === "travel") {
      and.push({ travelDate: range });
    } else {
      // "Received" is assignedAt where we have it and createdAt otherwise —
      // the same fallback the row displays, so the filter cannot hide a lead
      // that is visibly inside the range.
      and.push({
        OR: [
          { assignedAt: range },
          { assignedAt: null, createdAt: range },
        ],
      });
    }
  }

  if (f.destination) and.push({ destination: f.destination });

  const q = f.q.trim();
  if (q) {
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { email: { contains: q, mode: "insensitive" } },
        { destination: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (and.length) where.AND = and;
  return where;
}

const toRow = (l: {
  id: string; name: string; phone: string; email: string | null;
  destination: string | null; groupSize: number | null;
  travelDate: Date | null; assignedAt: Date | null; createdAt: Date;
}): PartnerLeadRow => ({
  id: l.id,
  receivedAt: (l.assignedAt ?? l.createdAt).toISOString(),
  name: l.name,
  phone: l.phone,
  email: l.email,
  destination: l.destination,
  groupSize: l.groupSize,
  travelDate: l.travelDate?.toISOString() ?? null,
});

const SELECT = {
  id: true, name: true, phone: true, email: true,
  destination: true, groupSize: true, travelDate: true,
  assignedAt: true, createdAt: true,
} as const;

/**
 * One page of the leads an agency has been given, plus the counts and the
 * destination list the toolbar needs to describe itself.
 *
 * Scoped by an id the caller resolved from the session, never from anything
 * the browser sent — that id is the only thing standing between one agency
 * and another's customers, so it is the query's own input rather than a
 * filter applied to a wider result.
 *
 * Ordered by when the lead was handed over, which is the order the agency
 * experiences them in.
 */
export async function getAgencyLeads(memberId: string, filters: LeadFilters): Promise<{
  rows: PartnerLeadRow[];
  total: number;
  totalAll: number;
  destinations: string[];
}> {
  const where = buildWhere(memberId, filters);
  const page = Math.max(1, filters.page);

  const [total, totalAll, leads, destinationRows] = await Promise.all([
    db.package_queries.count({ where }),
    db.package_queries.count({ where: { assignedTo: memberId, deletedAt: null } }),
    db.package_queries.findMany({
      where,
      orderBy: [{ assignedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * LEADS_PAGE_SIZE,
      take: LEADS_PAGE_SIZE,
      select: SELECT,
    }),
    // The dropdown offers only destinations this agency has actually been
    // sent, so an empty result is never a filter the partner could pick.
    db.package_queries.findMany({
      where: { assignedTo: memberId, deletedAt: null, destination: { not: null } },
      distinct: ["destination"],
      orderBy: { destination: "asc" },
      select: { destination: true },
    }),
  ]);

  return {
    rows: leads.map(toRow),
    total,
    totalAll,
    destinations: destinationRows.map((d) => d.destination!).filter(Boolean),
  };
}

/**
 * Every lead matching the current filters, for "copy all".
 *
 * Capped, because this is text destined for a clipboard rather than a screen:
 * past a few hundred blocks nothing useful can be pasted anywhere, and the
 * cap keeps one button from pulling an agency's whole history into memory.
 */
export const COPY_ALL_LIMIT = 500;

export async function getAgencyLeadsForCopy(
  memberId: string,
  filters: LeadFilters,
): Promise<{ rows: PartnerLeadRow[]; truncated: boolean; total: number }> {
  const where = buildWhere(memberId, filters);

  const [total, leads] = await Promise.all([
    db.package_queries.count({ where }),
    db.package_queries.findMany({
      where,
      orderBy: [{ assignedAt: "desc" }, { createdAt: "desc" }],
      take: COPY_ALL_LIMIT,
      select: SELECT,
    }),
  ]);

  return { rows: leads.map(toRow), truncated: total > COPY_ALL_LIMIT, total };
}
