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
