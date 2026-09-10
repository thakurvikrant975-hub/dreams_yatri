/**
 * The arithmetic behind the lead manager's report, kept out of the server
 * action so it can be exercised without a database
 * (scripts/test-lead-report.ts) — the same reason todaysAssignments.ts sits
 * apart from its dialog. These figures are read as a daily fact about the
 * team and mailed on, and a miscount here is the kind that gets believed.
 *
 * The whole population is leads HANDED OVER in the range. The report used to
 * mix that with intake — totals and charts counted leads that ARRIVED in the
 * range while the per-exec table counted handovers — and printed both on one
 * page as though they were the same thing. They never can be: most of a
 * morning's handovers are last night's leads, so "108 received today" beside
 * 112 leads assigned to our own execs reads as a miscount. Everything below
 * counts the same rows, so it all reconciles.
 */

/** Only what the counting needs — so a fixture need not be a whole lead. */
export type AssignedLead = {
  assignedTo: string | null;
  assignedToName: string | null;
  status: string;
};

export type AssigneeRow = { name: string; value: number };

export type HandoverTotals = {
  /** Handovers in range. Every other figure is a cut of these rows. */
  handedOverInRange: number;
  /** Of those, the ones our own sales executives were given. */
  inHouse: number;
  /** And the ones sold on to an outside agency. Adds with `inHouse` back up
   * to `handedOverInRange`. */
  partnerAgency: number;
  converted: number;
  convRate: number;
  /** Who got what, split rather than ranked as one list: in-house and
   * sold-on are different outcomes, and the split is read before the
   * ranking. The two subtotals account for every handover. */
  byAssignee: { inHouse: AssigneeRow[]; partners: AssigneeRow[] };
};

/** A lead counts as won once the money is in motion, not only once it has
 * fully converted — matching how the rest of the dashboard reads these. */
const CONVERTED_STATUSES = ["CONVERTED", "PAYMENT_INITIATED"];

/**
 * @param assigned  Leads handed over inside the range.
 * @param partnerIds Which assignee ids are outside agencies. Agencies reach
 *   leads through the same `assignedTo` column our own staff do, so the
 *   assignee's role flag is the only thing that distinguishes a sold lead
 *   from a worked one.
 */
export function summariseHandovers(
  assigned: AssignedLead[],
  partnerIds: ReadonlySet<string>,
): HandoverTotals {
  const isPartner = (assignedTo: string | null) => !!assignedTo && partnerIds.has(assignedTo);

  const inHouseCounts = new Map<string, number>();
  const partnerCounts = new Map<string, number>();
  let partnerAgency = 0;
  let converted = 0;

  for (const q of assigned) {
    const partner = isPartner(q.assignedTo);
    if (partner) partnerAgency += 1;
    if (CONVERTED_STATUSES.includes(q.status)) converted += 1;

    // Grouped by name, since that is what the report prints. An unnamed
    // assignee still has to appear — dropping the row would quietly lose a
    // handover from a total that is checked against the day's mails.
    const name = q.assignedToName?.trim() || "Unnamed";
    const target = partner ? partnerCounts : inHouseCounts;
    target.set(name, (target.get(name) ?? 0) + 1);
  }

  const rank = (m: Map<string, number>): AssigneeRow[] =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, value]) => ({ name, value }));

  return {
    handedOverInRange: assigned.length,
    inHouse: assigned.length - partnerAgency,
    partnerAgency,
    converted,
    convRate: assigned.length > 0 ? Math.round((converted / assigned.length) * 100) : 0,
    byAssignee: { inHouse: rank(inHouseCounts), partners: rank(partnerCounts) },
  };
}

// ── Per-exec breakdown ──────────────────────────────────────────────────
//
// What kind of leads each assignee was handed, for the lead manager's Excel
// download. Same population as everything above — handovers in range — so
// the rows add back up to `handedOverInRange`, and so do each row's bands,
// outcomes, destinations and sources to that row's own `groups`.

/** Travellers per lead, bucketed. A lead is one travelling group, so these
 * describe what kind of groups an exec is being given rather than how many. */
export const GROUP_SIZE_BANDS = [
  { key: "1-2", label: "1–2 pax", max: 2 },
  { key: "3-5", label: "3–5 pax", max: 5 },
  { key: "6-10", label: "6–10 pax", max: 10 },
  { key: "11+", label: "11+ pax", max: Infinity },
] as const;
export type GroupSizeBand = (typeof GROUP_SIZE_BANDS)[number]["key"];

/** Null when the lead never said — counted as "not given" rather than being
 * guessed into a band. Zero or negative is a typo, not a group. */
export function groupSizeBand(size: number | null): GroupSizeBand | null {
  if (size == null || !Number.isFinite(size) || size < 1) return null;
  return GROUP_SIZE_BANDS.find((b) => size <= b.max)!.key;
}

/** Closed without a sale. Everything neither won nor lost is still open. */
const LOST_STATUSES = ["REJECTED", "CLIENT_DECLINED", "CLOSED"];

/** `destination` is free text on the query, so "Goa" and "goa " are one
 * place — the same case-insensitive grouping the rest of the report uses. */
export function destinationLabel(raw: string | null): string {
  const t = raw?.trim();
  return t ? t.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : "Not specified";
}

export type ExecLead = {
  assignedTo: string | null;
  assignedToName: string | null;
  isPartnerAgency: boolean;
  status: string;
  groupSize: number | null;
  destination: string | null;
  /** Already resolved from source/utmSource by the report's server side. */
  channel: string;
};

export type ExecBreakdownRow = {
  /** Keyed on the assignee's id, not their name as summariseHandovers is:
   * two execs who share a name are two people and must stay two rows. */
  id: string;
  name: string;
  isPartnerAgency: boolean;
  /** Leads handed over — one lead is one group. */
  groups: number;
  /** Travellers across the groups that gave a size. */
  pax: number;
  sizeNotGiven: number;
  bands: Record<GroupSizeBand, number>;
  open: number;
  converted: number;
  lost: number;
  convRate: number;
  byDestination: Record<string, number>;
  byChannel: Record<string, number>;
};

/**
 * @param leads Handovers in range, newest first — the name shown for an
 *   assignee is the one on their most recent handover.
 * @returns Our own execs first, then agencies; each block ranked by groups,
 *   ties broken by name so the order is stable between downloads.
 */
export function summariseByExec(leads: ExecLead[]): ExecBreakdownRow[] {
  const rows = new Map<string, ExecBreakdownRow>();

  for (const q of leads) {
    const id = q.assignedTo ?? "__unassigned__";
    let row = rows.get(id);
    if (!row) {
      row = {
        id,
        name: "",
        isPartnerAgency: q.isPartnerAgency,
        groups: 0, pax: 0, sizeNotGiven: 0,
        bands: { "1-2": 0, "3-5": 0, "6-10": 0, "11+": 0 },
        open: 0, converted: 0, lost: 0, convRate: 0,
        byDestination: {}, byChannel: {},
      };
      rows.set(id, row);
    }
    // An unnamed assignee is still counted — see summariseHandovers.
    if (!row.name) row.name = q.assignedToName?.trim() ?? "";

    row.groups += 1;

    const band = groupSizeBand(q.groupSize);
    if (band) {
      row.bands[band] += 1;
      row.pax += q.groupSize!;
    } else {
      row.sizeNotGiven += 1;
    }

    if (CONVERTED_STATUSES.includes(q.status)) row.converted += 1;
    else if (LOST_STATUSES.includes(q.status)) row.lost += 1;
    else row.open += 1;

    const dest = destinationLabel(q.destination);
    row.byDestination[dest] = (row.byDestination[dest] ?? 0) + 1;
    row.byChannel[q.channel] = (row.byChannel[q.channel] ?? 0) + 1;
  }

  for (const row of rows.values()) {
    if (!row.name) row.name = "Unnamed";
    row.convRate = row.groups > 0 ? Math.round((row.converted / row.groups) * 100) : 0;
  }

  return [...rows.values()].sort(
    (a, b) =>
      Number(a.isPartnerAgency) - Number(b.isPartnerAgency) ||
      b.groups - a.groups ||
      a.name.localeCompare(b.name),
  );
}
