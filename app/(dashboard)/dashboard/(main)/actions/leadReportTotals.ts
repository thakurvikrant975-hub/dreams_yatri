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

// ── Exec report ─────────────────────────────────────────────────────────
//
// What kind of leads each assignee was handed, for the lead manager's
// filterable PDF. Same population as everything above — handovers in range —
// narrowed by whatever filters are set, so with none set every figure adds
// back up to `handedOverInRange`.

/** A lead counts as a group from this many persons up — five travelling
 * together is already a group, as the sales team uses the word. Smaller
 * parties are still leads, just not groups. */
export const GROUP_MIN_PERSONS = 5;

/** Only a lead that states its size can be called a group. Zero or negative
 * is a typo, not a party. */
export function isGroup(size: number | null): boolean {
  return size != null && Number.isFinite(size) && size >= GROUP_MIN_PERSONS;
}

/** A size worth adding up — null, zero and negatives are "not given". */
function knownSize(size: number | null): number | null {
  return size != null && Number.isFinite(size) && size >= 1 ? size : null;
}

/** Closed without a sale. Everything neither won nor lost is still open. */
const LOST_STATUSES = ["REJECTED", "CLIENT_DECLINED", "CLOSED"];

export type LeadOutcome = "open" | "converted" | "lost";

export function leadOutcome(status: string): LeadOutcome {
  if (CONVERTED_STATUSES.includes(status)) return "converted";
  if (LOST_STATUSES.includes(status)) return "lost";
  return "open";
}

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

// ── Filters ──

/** Who the report is about: everyone, one side of the in-house/agency split,
 * or one assignee (`exec:<id>`). */
export type AssigneeFilter = "all" | "inhouse" | "partners" | `exec:${string}`;

export type ExecReportFilters = {
  assignee: AssigneeFilter;
  /** A destinationLabel, or null for every destination. */
  destination: string | null;
  /** A resolved channel, or null for every source. */
  source: string | null;
  outcome: LeadOutcome | null;
  /** Leads with at least this many persons. A lead that never gave a size
   * cannot be shown to meet it, so any value here leaves those out. */
  minPersons: number | null;
};

export const NO_FILTERS: ExecReportFilters = {
  assignee: "all", destination: null, source: null, outcome: null, minPersons: null,
};

export function filterExecLeads<T extends ExecLead>(leads: T[], f: ExecReportFilters): T[] {
  const min = f.minPersons != null && f.minPersons > 0 ? f.minPersons : null;
  return leads.filter((q) => {
    if (f.assignee === "inhouse" && q.isPartnerAgency) return false;
    if (f.assignee === "partners" && !q.isPartnerAgency) return false;
    if (f.assignee.startsWith("exec:") && q.assignedTo !== f.assignee.slice(5)) return false;
    if (f.destination != null && destinationLabel(q.destination) !== f.destination) return false;
    if (f.source != null && q.channel !== f.source) return false;
    if (f.outcome != null && leadOutcome(q.status) !== f.outcome) return false;
    if (min != null && (knownSize(q.groupSize) ?? 0) < min) return false;
    return true;
  });
}

const OUTCOME_LABEL: Record<LeadOutcome, string> = { open: "Open", converted: "Converted", lost: "Lost" };

/** What the filters make the report about — its heading, on the page and on
 * the PDF alike. */
export function execReportTitle(f: ExecReportFilters, assigneeName?: string): string {
  if (f.assignee.startsWith("exec:")) return `Lead Report: ${assigneeName ?? "Executive"}`;
  if (f.minPersons != null && f.minPersons >= GROUP_MIN_PERSONS) return "Group Leads per Executive";
  return "Leads per Executive";
}

/** The filters in force, one phrase each — printed under the heading so a
 * forwarded copy says what it left out. Empty when nothing is filtered. */
export function describeExecFilters(f: ExecReportFilters, assigneeName?: string): string[] {
  const out: string[] = [];
  if (f.assignee === "inhouse") out.push("Our execs only");
  else if (f.assignee === "partners") out.push("Partner agencies only");
  else if (f.assignee.startsWith("exec:")) out.push(`Assigned to ${assigneeName ?? "one executive"}`);
  if (f.destination) out.push(`Destination: ${f.destination}`);
  if (f.source) out.push(`Source: ${f.source}`);
  if (f.outcome) out.push(`Outcome: ${OUTCOME_LABEL[f.outcome]}`);
  if (f.minPersons != null && f.minPersons > 0) out.push(`${f.minPersons}+ persons (leads with no size given left out)`);
  return out;
}

// ── Tallies ──

export type LeadTally = {
  leads: number;
  /** Of those, parties of GROUP_MIN_PERSONS or more. */
  groups: number;
  /** Persons across the leads that gave a size. */
  persons: number;
  sizeNotGiven: number;
  open: number;
  converted: number;
  lost: number;
  convRate: number;
};

function emptyTally(): LeadTally {
  return { leads: 0, groups: 0, persons: 0, sizeNotGiven: 0, open: 0, converted: 0, lost: 0, convRate: 0 };
}

function addToTally(t: LeadTally, q: ExecLead) {
  t.leads += 1;
  if (isGroup(q.groupSize)) t.groups += 1;
  const size = knownSize(q.groupSize);
  if (size != null) t.persons += size;
  else t.sizeNotGiven += 1;
  t[leadOutcome(q.status)] += 1;
}

function finishTally(t: LeadTally) {
  t.convRate = t.leads > 0 ? Math.round((t.converted / t.leads) * 100) : 0;
}

export function tallyLeads(leads: ExecLead[]): LeadTally {
  const t = emptyTally();
  for (const q of leads) addToTally(t, q);
  finishTally(t);
  return t;
}

export type ExecBreakdownRow = LeadTally & {
  /** Keyed on the assignee's id, not their name as summariseHandovers is:
   * two execs who share a name are two people and must stay two rows. */
  id: string;
  name: string;
  isPartnerAgency: boolean;
};

/**
 * @param leads Handovers, newest first — the name shown for an assignee is
 *   the one on their most recent handover.
 * @returns Our own execs first, then agencies; each block ranked by leads,
 *   ties broken by name so the order is stable between downloads.
 */
export function summariseByExec(leads: ExecLead[]): ExecBreakdownRow[] {
  const rows = new Map<string, ExecBreakdownRow>();

  for (const q of leads) {
    const id = q.assignedTo ?? "__unassigned__";
    let row = rows.get(id);
    if (!row) {
      row = { ...emptyTally(), id, name: "", isPartnerAgency: q.isPartnerAgency };
      rows.set(id, row);
    }
    // An unnamed assignee is still counted — see summariseHandovers.
    if (!row.name) row.name = q.assignedToName?.trim() ?? "";

    addToTally(row, q);
  }

  for (const row of rows.values()) {
    if (!row.name) row.name = "Unnamed";
    finishTally(row);
  }

  return [...rows.values()].sort(
    (a, b) =>
      Number(a.isPartnerAgency) - Number(b.isPartnerAgency) ||
      b.leads - a.leads ||
      a.name.localeCompare(b.name),
  );
}

/** One tally per value of `keyOf` — destinations, sources — ranked by leads
 * then name. */
export function summariseBy(leads: ExecLead[], keyOf: (q: ExecLead) => string): (LeadTally & { name: string })[] {
  const rows = new Map<string, LeadTally & { name: string }>();
  for (const q of leads) {
    const name = keyOf(q);
    let row = rows.get(name);
    if (!row) rows.set(name, (row = { ...emptyTally(), name }));
    addToTally(row, q);
  }
  for (const row of rows.values()) finishTally(row);
  return [...rows.values()].sort((a, b) => b.leads - a.leads || a.name.localeCompare(b.name));
}
