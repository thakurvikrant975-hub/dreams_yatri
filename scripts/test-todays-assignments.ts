/**
 * The "Today's Assignments" popup's arithmetic, checked against a fixed clock.
 *
 * Modelled on the day that prompted this: 32 leads received and 43 assignments
 * made, which read as a miscount when the two sat side by side. Every case
 * here is one a real day on the queries page produces — a morning spent
 * handing out last night's leads, and the two IST midnight edges.
 *
 * No database — the panel counts a list it is already handed, so the list is
 * the whole input.
 */
import {
  summariseTodaysAssignments,
  type AssignmentLead,
} from "../app/(dashboard)/dashboard/(main)/(marketing)/queries/todaysAssignments";

// 2026-09-02 14:33 IST. The IST day runs 2026-09-01T18:30Z .. 2026-09-02T18:30Z.
const NOW = new Date("2026-09-02T09:03:00Z");

type Spec = { createdAt: string; assignedTo?: string; assignedToName?: string; assignedAt?: string };
const lead = (o: Spec): AssignmentLead => ({
  createdAt: new Date(o.createdAt),
  assignedTo: o.assignedTo ?? null,
  assignedToName: o.assignedToName ?? null,
  assignedAt: o.assignedAt ? new Date(o.assignedAt) : null,
});

let failures = 0;
function check(what: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`  ${ok ? "✓" : "✗"} ${what}: ${JSON.stringify(got)}${ok ? "" : ` (expected ${JSON.stringify(want)})`}`);
}

// ── The shape of the day that prompted this ──────────────────────────────
// 32 in today, 30 of them already handed out, 2 still sitting. Plus 13 of
// last night's leads assigned this morning: 43 assignments in total.
const leads: AssignmentLead[] = [];
for (let i = 0; i < 30; i++) {
  leads.push(lead({
    createdAt: "2026-09-02T04:00:00Z", assignedTo: `m${i % 5}`,
    assignedToName: `Exec ${i % 5}`, assignedAt: "2026-09-02T05:00:00Z",
  }));
}
leads.push(lead({ createdAt: "2026-09-02T06:00:00Z" }));
leads.push(lead({ createdAt: "2026-09-02T06:30:00Z" }));
for (let i = 0; i < 13; i++) {
  leads.push(lead({
    createdAt: "2026-09-01T15:00:00Z", assignedTo: `m${i % 5}`,
    assignedToName: `Exec ${i % 5}`, assignedAt: "2026-09-02T03:30:00Z",
  }));
}
// Entirely yesterday — must not appear anywhere.
leads.push(lead({ createdAt: "2026-09-01T09:00:00Z", assignedTo: "m0", assignedToName: "Exec 0", assignedAt: "2026-09-01T09:05:00Z" }));

console.log("a morning spent handing out last night's leads:");
const s = summariseTodaysAssignments(leads, NOW);
check("received today", s.totalReceivedToday, 32);
check("of those, assigned", s.receivedAssigned, 30);
check("of those, still unassigned", s.receivedUnassigned, 2);
check("the two split back to received", s.receivedAssigned + s.receivedUnassigned, s.totalReceivedToday);
check("handed out today", s.handedOutToday, 43);
check("of those, carried over from earlier days", s.carriedOver, 13);
check("today's own leads among them", s.handedOutFromToday, 30);
check("the split adds back up to the handovers", s.handedOutFromToday + s.carriedOver, s.handedOutToday);
check("bars sum to the handovers", s.rows.reduce((n, r) => n + r.count, 0), s.handedOutToday);

// ── The IST midnight edges ────────────────────────────────────────────────
console.log("\nthe IST day boundary:");
check("00:00:00 IST is today", summariseTodaysAssignments([lead({ createdAt: "2026-09-01T18:30:00Z" })], NOW).totalReceivedToday, 1);
check("23:59 IST yesterday is not", summariseTodaysAssignments([lead({ createdAt: "2026-09-01T18:29:00Z" })], NOW).totalReceivedToday, 0);
check("late tonight is still today", summariseTodaysAssignments([lead({ createdAt: "2026-09-02T18:29:00Z" })], NOW).totalReceivedToday, 1);
check("tomorrow is not", summariseTodaysAssignments([lead({ createdAt: "2026-09-02T18:30:00Z" })], NOW).totalReceivedToday, 0);
check("assigned just after IST midnight counts today",
  summariseTodaysAssignments([lead({ createdAt: "2026-08-30T09:00:00Z", assignedTo: "m1", assignedToName: "A", assignedAt: "2026-09-01T18:31:00Z" })], NOW).handedOutToday, 1);

// ── Leads with no owner never become a bar ────────────────────────────────
console.log("\nan unassigned lead:");
const orphan = summariseTodaysAssignments([lead({ createdAt: "2026-09-02T04:00:00Z" })], NOW);
check("counts as received", orphan.totalReceivedToday, 1);
check("shows as unassigned", orphan.receivedUnassigned, 1);
check("no bar for nobody", orphan.rows.length, 0);
check("nothing handed out", orphan.handedOutToday, 0);

// ── A quiet start ─────────────────────────────────────────────────────────
console.log("\na quiet start:");
const quiet = summariseTodaysAssignments([lead({ createdAt: "2026-08-30T09:00:00Z", assignedTo: "m1", assignedToName: "A", assignedAt: "2026-08-30T09:01:00Z" })], NOW);
check("received", quiet.totalReceivedToday, 0);
check("handed out", quiet.handedOutToday, 0);
check("no bars", quiet.rows.length, 0);

// ── The after-hours backlog ───────────────────────────────────────────────
// Leads arriving after the office closes belong to "yesterday" by the time
// anyone opens the panel, so they must be counted somewhere.
console.log("\nunassigned leads from earlier days:");
const backlog = summariseTodaysAssignments([
  // last night, 11:20pm IST — nobody has picked it up
  lead({ createdAt: "2026-09-01T17:50:00Z" }),
  // yesterday afternoon, unassigned
  lead({ createdAt: "2026-09-01T09:00:00Z" }),
  // three days ago, still unassigned
  lead({ createdAt: "2026-08-30T09:00:00Z" }),
  // yesterday but already assigned — not backlog
  lead({ createdAt: "2026-09-01T09:30:00Z", assignedTo: "m1", assignedToName: "A", assignedAt: "2026-09-01T10:00:00Z" }),
  // today, unassigned — belongs to today's tile, not the backlog
  lead({ createdAt: "2026-09-02T04:00:00Z" }),
], NOW);
check("from yesterday", backlog.unassignedYesterday, 2);
check("from before that", backlog.unassignedOlder, 1);
check("today's own unassigned stays in today's tile", backlog.receivedUnassigned, 1);
check("an assigned lead is not backlog", backlog.unassignedYesterday + backlog.unassignedOlder, 3);

// ── The day the manager checked against his inbox ─────────────────────────
// 48 leads in today and all of them handed out, plus 14 of the previous
// days' leads: 62 assignment mails. The panel now leads with 62 precisely
// because that is the number the inbox can be counted against — 48 could
// not be, and reading it as the day's total is what looked like a mismatch.
console.log("\nreconciling against the assignment mails:");
const inbox: AssignmentLead[] = [];
for (let i = 0; i < 48; i++) {
  inbox.push(lead({
    createdAt: "2026-09-02T04:00:00Z", assignedTo: `m${i % 6}`,
    assignedToName: `Exec ${i % 6}`, assignedAt: "2026-09-02T05:30:00Z",
  }));
}
for (let i = 0; i < 14; i++) {
  inbox.push(lead({
    createdAt: "2026-09-01T14:00:00Z", assignedTo: `m${i % 6}`,
    assignedToName: `Exec ${i % 6}`, assignedAt: "2026-09-02T04:15:00Z",
  }));
}
const mails = summariseTodaysAssignments(inbox, NOW);
check("mails sent today", mails.handedOutToday, 62);
check("of today's leads", mails.handedOutFromToday, 48);
check("that came in earlier", mails.carriedOver, 14);
check("today's intake, all placed", mails.receivedAssigned, 48);
check("nothing from today left waiting", mails.receivedUnassigned, 0);
check("no earlier lead left waiting either", mails.unassignedYesterday + mails.unassignedOlder, 0);

// ── The panel's own screenshot, reproduced ────────────────────────────────
// 57 in today and all placed, 14 earlier leads picked up today, and 10 earlier
// ones still waiting (4 from yesterday, 6 from before). The waiting figure used
// to be the only thing the panel said about earlier days, so it could report a
// backlog without ever saying whether the rest had been dealt with. These two
// are now shown side by side, and this pins the pairing.
console.log("\nearlier days, picked up vs still waiting:");
const panel: AssignmentLead[] = [];
for (let i = 0; i < 57; i++) {
  panel.push(lead({
    createdAt: "2026-09-02T04:00:00Z", assignedTo: `m${i % 5}`,
    assignedToName: `Exec ${i % 5}`, assignedAt: "2026-09-02T05:00:00Z",
  }));
}
for (let i = 0; i < 14; i++) {
  panel.push(lead({
    createdAt: "2026-09-01T14:00:00Z", assignedTo: `m${i % 5}`,
    assignedToName: `Exec ${i % 5}`, assignedAt: "2026-09-02T04:30:00Z",
  }));
}
for (let i = 0; i < 4; i++) panel.push(lead({ createdAt: "2026-09-01T14:00:00Z" }));
for (let i = 0; i < 6; i++) panel.push(lead({ createdAt: "2026-08-29T14:00:00Z" }));

const p = summariseTodaysAssignments(panel, NOW);
check("handed out today", p.handedOutToday, 71);
check("of today's leads", p.handedOutFromToday, 57);
check("earlier leads picked up today", p.carriedOver, 14);
check("today's intake all placed", p.receivedAssigned, 57);
check("nothing from today waiting", p.receivedUnassigned, 0);
check("earlier leads still waiting", p.unassignedYesterday + p.unassignedOlder, 10);
check("  of which yesterday", p.unassignedYesterday, 4);
check("  of which older", p.unassignedOlder, 6);
// The pairing the panel now shows: picked up today and still waiting are two
// separate facts about earlier days, NOT a split of one population — an
// earlier lead assigned on an earlier day is in neither.
check("the two earlier-day figures do not pretend to be a total",
  p.carriedOver + p.unassignedYesterday + p.unassignedOlder, 24);

console.log(failures === 0 ? "\nall good" : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
