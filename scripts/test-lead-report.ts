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
  type AssignedLead,
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

console.log(`\n${failures === 0 ? "All passed" : `${failures} failed`}\n`);
process.exit(failures === 0 ? 0 : 1);
