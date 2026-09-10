/**
 * The lead manager report's arithmetic.
 *
 * Modelled on the day that prompted it: 108 leads received, but 112 handed to
 * our own execs plus a batch sold on to agencies — which read as a miscount
 * when the report printed intake and handovers as though they were one
 * population. Every case here is one a real day produces.
 *
 * No database — the counting takes the rows it is handed, so the rows are the
 * whole input.
 */
import {
  summariseHandovers,
  summariseByExec,
  summariseBy,
  tallyLeads,
  filterExecLeads,
  isGroup,
  destinationLabel,
  execReportTitle,
  describeExecFilters,
  GROUP_MIN_PERSONS,
  NO_FILTERS,
  type AssignedLead,
  type ExecLead,
  type ExecReportFilters,
} from "../app/(dashboard)/dashboard/(main)/actions/leadReportTotals";

let failures = 0;
function check(what: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`  ${ok ? "✓" : "✗"} ${what}: ${JSON.stringify(got)}${ok ? "" : ` (expected ${JSON.stringify(want)})`}`);
}

const AGENCY_A = "agency-a";
const AGENCY_B = "agency-b";
const partners = new Set([AGENCY_A, AGENCY_B]);

const lead = (assignedTo: string, assignedToName: string, status = "ASSIGNED"): AssignedLead =>
  ({ assignedTo, assignedToName, status });

// ── The shape of the day that prompted this ──────────────────────────────
// 112 handovers to our own execs (Vaibhav 8 of them) and 15 sold on, out of a
// day that only received 108 leads. The report is not wrong: the extra
// handovers are last night's leads going out this morning.
console.log("\nThe 108-received / 127-handed-over day:");
{
  const rows: AssignedLead[] = [];
  for (let i = 0; i < 8; i++) rows.push(lead("exec-vaibhav", "Vaibhav"));
  for (let i = 0; i < 60; i++) rows.push(lead("exec-priya", "Priya"));
  for (let i = 0; i < 44; i++) rows.push(lead("exec-rahul", "Rahul"));
  for (let i = 0; i < 10; i++) rows.push(lead(AGENCY_A, "Skyline Travels"));
  for (let i = 0; i < 5; i++) rows.push(lead(AGENCY_B, "Orbit Holidays"));

  const t = summariseHandovers(rows, partners);
  check("handed over in range", t.handedOverInRange, 127);
  check("to our execs", t.inHouse, 112);
  check("to partner agencies", t.partnerAgency, 15);
  check("in-house + agency = total", t.inHouse + t.partnerAgency, t.handedOverInRange);
  check("Vaibhav's row", t.byAssignee.inHouse.find((r) => r.name === "Vaibhav")?.value, 8);
  check("agencies listed separately", t.byAssignee.partners.map((r) => r.name), ["Skyline Travels", "Orbit Holidays"]);
  check("no agency leaks into the exec block", t.byAssignee.inHouse.some((r) => r.name.includes("Skyline")), false);
  check(
    "exec rows sum to the in-house subtotal",
    t.byAssignee.inHouse.reduce((s, r) => s + r.value, 0),
    t.inHouse,
  );
  check(
    "agency rows sum to the agency subtotal",
    t.byAssignee.partners.reduce((s, r) => s + r.value, 0),
    t.partnerAgency,
  );
}

// ── An unnamed assignee still has to be counted ──────────────────────────
// Dropping the row would quietly lose a handover from a total that gets
// checked against the day's assignment mails.
console.log("\nUnnamed assignee:");
{
  const t = summariseHandovers(
    [lead("exec-1", "Vaibhav"), { assignedTo: "exec-2", assignedToName: null, status: "ASSIGNED" },
     { assignedTo: "exec-3", assignedToName: "   ", status: "ASSIGNED" }],
    partners,
  );
  check("total still counts all three", t.handedOverInRange, 3);
  check("unnamed rows are grouped, not dropped", t.byAssignee.inHouse.find((r) => r.name === "Unnamed")?.value, 2);
}

// ── Conversion is of handovers, not of intake ────────────────────────────
console.log("\nConversion:");
{
  const t = summariseHandovers(
    [lead("e", "A", "CONVERTED"), lead("e", "A", "PAYMENT_INITIATED"), lead("e", "A", "ASSIGNED"), lead("e", "A", "CLOSED")],
    partners,
  );
  check("payment-initiated counts as won", t.converted, 2);
  check("rate is of handovers", t.convRate, 50);
}

// ── Edges ────────────────────────────────────────────────────────────────
console.log("\nEdges:");
{
  const t = summariseHandovers([], partners);
  check("empty range is zero, not NaN", [t.handedOverInRange, t.inHouse, t.partnerAgency, t.convRate], [0, 0, 0, 0]);
}
{
  // A day where everything was sold on — the exec block must be empty rather
  // than absorbing the agencies.
  const t = summariseHandovers([lead(AGENCY_A, "Skyline Travels"), lead(AGENCY_A, "Skyline Travels")], partners);
  check("all-agency day: in-house is empty", t.byAssignee.inHouse, []);
  check("all-agency day: subtotal", t.partnerAgency, 2);
}
{
  // No agencies configured at all: every handover is in-house.
  const t = summariseHandovers([lead("exec-1", "Vaibhav")], new Set<string>());
  check("no agencies configured", [t.inHouse, t.partnerAgency], [1, 0]);
}
{
  // Ranked highest-first, so the biggest recipient is readable without
  // scanning — ties fall back to name so the order is stable between runs.
  const t = summariseHandovers(
    [lead("a", "Zara"), lead("b", "Amit"), lead("b", "Amit"), lead("c", "Bela")],
    partners,
  );
  check("ranked by count, then name", t.byAssignee.inHouse.map((r) => r.name), ["Amit", "Bela", "Zara"]);
}

// ── Exec report (the filterable PDF) ─────────────────────────────────────
const execLead = (over: Partial<ExecLead> = {}): ExecLead => ({
  assignedTo: "exec-priya", assignedToName: "Priya", isPartnerAgency: false,
  status: "ASSIGNED", groupSize: 2, destination: "Goa", channel: "Google",
  ...over,
});

console.log("\nWhat counts as a group:");
check("5 or more persons is a group", [4, 5, 6, 40].map(isGroup), [false, true, true, true]);
check("no size, zero or negative is not", [null, 0, -8].map(isGroup), [false, false, false]);

console.log("\nOne exec's breakdown:");
{
  const [r] = summariseByExec([
    execLead({ groupSize: 2, status: "CONVERTED" }),
    execLead({ groupSize: 5, status: "PAYMENT_INITIATED", destination: "goa " }),
    execLead({ groupSize: 12, status: "CLIENT_DECLINED", destination: "Kerala", channel: "Meta" }),
    execLead({ groupSize: null, status: "FOLLOW_UP", destination: null, channel: "Meta" }),
    execLead({ groupSize: 0, status: "CLOSED", destination: "Kerala" }),
  ]);
  check("leads", r.leads, 5);
  check("groups are the 5+ parties", r.groups, 2);
  check("persons counts only leads that gave a size", r.persons, 19);
  check("size not given", r.sizeNotGiven, 2);
  check("outcomes", [r.open, r.converted, r.lost], [1, 2, 2]);
  check("outcomes add up to leads", r.open + r.converted + r.lost, r.leads);
  check("conversion rate", r.convRate, 40);
}

console.log("\nFilters:");
{
  const leads: ExecLead[] = [
    execLead({ groupSize: 8, destination: "Goa", channel: "Google", status: "CONVERTED" }),
    execLead({ groupSize: 3, destination: "goa", channel: "Meta" }),
    execLead({ assignedTo: "exec-rahul", assignedToName: "Rahul", groupSize: 6, destination: "Kerala", channel: "Meta", status: "CLOSED" }),
    execLead({ assignedTo: "exec-rahul", assignedToName: "Rahul", groupSize: null, destination: "Kerala" }),
    execLead({ assignedTo: AGENCY_A, assignedToName: "Skyline Travels", isPartnerAgency: true, groupSize: 10 }),
  ];
  const run = (f: Partial<ExecReportFilters>) => filterExecLeads(leads, { ...NO_FILTERS, ...f }).length;
  check("no filters keeps everything", run({}), 5);
  check("one exec", run({ assignee: "exec:exec-rahul" }), 2);
  check("our execs only", run({ assignee: "inhouse" }), 4);
  check("agencies only", run({ assignee: "partners" }), 1);
  check("destination matches however it was typed", run({ destination: "Goa" }), 3);
  check("source", run({ source: "Meta" }), 2);
  check("outcome", [run({ outcome: "converted" }), run({ outcome: "lost" }), run({ outcome: "open" })], [1, 1, 3]);
  check("min persons 5 is the group report", run({ minPersons: GROUP_MIN_PERSONS }), 3);
  check(
    "a party of exactly 5 is in the group report, 4 is not",
    filterExecLeads([execLead({ groupSize: 5 }), execLead({ groupSize: 4 })], { ...NO_FILTERS, minPersons: GROUP_MIN_PERSONS }).map((q) => q.groupSize),
    [5],
  );
  check("min persons leaves out leads with no size", run({ minPersons: 1 }), 4);
  check("min persons 0 means any", run({ minPersons: 0 }), 5);
  check("filters combine", run({ assignee: "inhouse", minPersons: 6, source: "Meta" }), 1);
  check(
    "filtered tally",
    tallyLeads(filterExecLeads(leads, { ...NO_FILTERS, minPersons: 6 })),
    { leads: 3, groups: 3, persons: 24, sizeNotGiven: 0, open: 1, converted: 1, lost: 1, convRate: 33 },
  );
  check(
    "by destination",
    summariseBy(leads, (q) => destinationLabel(q.destination)).map((r) => [r.name, r.leads, r.groups]),
    [["Goa", 3, 2], ["Kerala", 2, 1]],
  );
}

console.log("\nReport title and filter line:");
check("default", execReportTitle(NO_FILTERS), "Leads per Executive");
check("groups", execReportTitle({ ...NO_FILTERS, minPersons: 6 }), "Group Leads per Executive");
check("one exec wins over groups", execReportTitle({ ...NO_FILTERS, assignee: "exec:x", minPersons: 6 }, "Priya"), "Lead Report: Priya");
check("nothing filtered, nothing listed", describeExecFilters(NO_FILTERS), []);
check(
  "every filter named",
  describeExecFilters({ assignee: "partners", destination: "Goa", source: "Meta", outcome: "lost", minPersons: 6 }),
  ["Partner agencies only", "Destination: Goa", "Source: Meta", "Outcome: Lost", "6+ persons (leads with no size given left out)"],
);

console.log("\nRows across execs:");
{
  const rows = summariseByExec([
    execLead({ assignedTo: "exec-rahul-1", assignedToName: "Rahul" }),
    execLead({ assignedTo: "exec-rahul-2", assignedToName: "Rahul" }),
    execLead({ assignedTo: "exec-rahul-2", assignedToName: "Rahul" }),
    execLead({ assignedTo: AGENCY_A, assignedToName: "Skyline Travels", isPartnerAgency: true }),
    execLead({ assignedTo: AGENCY_A, assignedToName: "Skyline Travels", isPartnerAgency: true }),
    execLead({ assignedTo: AGENCY_A, assignedToName: "Skyline Travels", isPartnerAgency: true }),
    execLead({ assignedTo: "exec-new", assignedToName: "  " }),
  ]);
  check("two execs named Rahul stay two rows", rows.filter((r) => r.name === "Rahul").map((r) => r.leads), [2, 1]);
  check("rows sum to every handover", rows.reduce((s, r) => s + r.leads, 0), 7);
  check("our execs first, agencies last", rows.map((r) => r.name), ["Rahul", "Rahul", "Unnamed", "Skyline Travels"]);
  check("empty range", summariseByExec([]), []);
}

console.log(`\n${failures === 0 ? "All passed" : `${failures} failed`}\n`);
process.exit(failures === 0 ? 0 : 1);
