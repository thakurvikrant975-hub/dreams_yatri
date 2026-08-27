/**
 * Seed the dummy lead used for end-to-end sales-workflow testing, and approve
 * the package built from it.
 *
 * Companion to seed-test-payment-skus.ts. That one covers the *catalogue*
 * checkout; this one covers the path a sales exec actually walks — a lead
 * lands in their queue, they build a custom package from it in the builder,
 * costing approves the price, the client gets a link and pays.
 *
 * Why a script rather than clicking: a Sales Executive cannot create their own
 * lead. /dashboard/queries (the only Add Query dialog) is marketing/admin and
 * redirects an exec away, and submitting the public enquiry form is worse — it
 * would auto-assign a fake lead round-robin into a REAL exec's pipeline and
 * could earn a real follow-up call to a made-up number. So the lead is written
 * here, assigned directly to the named exec, and labelled loudly.
 *
 * Likewise the approval: `editMargin` ("margin %, GST %, and the final quoted
 * price" — see workspace-caps.ts) resolves only for costing/platform-manager,
 * so an exec cannot price their own package at ₹2 or sign it off. --approve is
 * that step, standing in for a costing reviewer.
 *
 * Run:
 *   npm run seed:sales-test                     dry run — prints the plan
 *   npm run seed:sales-test -- --commit         create the lead
 *   npm run seed:sales-test -- --approve <id> --commit   price ₹2 + verify
 *   npm run seed:sales-test -- --teardown --commit       remove lead + packages
 */
import { db, dbTarget } from "./_db";

const COMMIT = process.argv.includes("--commit");
const TEARDOWN = process.argv.includes("--teardown");
const APPROVE_AT = process.argv.indexOf("--approve");
const APPROVE_ID = APPROVE_AT === -1 ? null : process.argv[APPROVE_AT + 1];

/** Overridable so the same script can stage a lead for any exec under test. */
const EXEC_EMAIL = process.env.TEST_EXEC_EMAIL ?? "tanisha@dreamsyatri.com";

/** Loud enough that nobody mistakes it for a real enquiry, and stable enough
 * to be the idempotency key — re-running never creates a second lead. */
const LEAD_NAME = "[TEST — DO NOT CONTACT] Sales Workflow Test Lead";

/** The price under test. Written straight onto the package alongside margin
 * and GST of 0, so nothing downstream can round it back up — a component-built
 * total would not survive as ₹1. Overridable for a gateway that refuses very
 * small amounts. */
const TEST_PRICE = Number(process.env.TEST_PRICE ?? 1);

function step(msg: string) {
    console.log(`${COMMIT ? "  ✓" : "  ·"} ${msg}`);
}

async function findExec() {
    const member = await db.teamMember.findUnique({
        where: { email: EXEC_EMAIL },
        select: { id: true, name: true, isActive: true, teamRole: { select: { name: true } } },
    });
    if (!member) throw new Error(`No team member with email ${EXEC_EMAIL}`);
    return member;
}

async function teardown() {
    const lead = await db.package_queries.findFirst({
        where: { name: LEAD_NAME },
        select: { id: true },
    });
    if (!lead) { console.log("  nothing to remove — no test lead found\n"); return; }

    const pkgs = await db.custom_packages.findMany({
        where: { queryId: lead.id },
        select: { id: true, title: true },
    });
    step(`custom_packages to delete: ${pkgs.length}${pkgs.length ? ` (${pkgs.map(p => p.id).join(", ")})` : ""}`);
    step(`package_queries to delete: ${lead.id}`);
    if (!COMMIT) { console.log("\n  Re-run with --commit to apply.\n"); return; }

    // Timeline/notes hang off the query by FK — clear them before the lead so
    // the delete can't trip a constraint on a half-worked test lead.
    await db.queryTimeline.deleteMany({ where: { queryId: lead.id } });
    await db.queryNote.deleteMany({ where: { queryId: lead.id } });
    for (const p of pkgs) await db.custom_packages.delete({ where: { id: p.id } });
    await db.package_queries.delete({ where: { id: lead.id } });
    console.log("\n  Removed.\n");
}

async function approve(packageId: string) {
    const pkg = await db.custom_packages.findUnique({
        where: { id: packageId },
        select: { id: true, title: true, status: true, verified: true, totalPrice: true, readyAt: true, builtByName: true },
    });
    if (!pkg) throw new Error(`No custom package ${packageId}`);

    console.log(`  package: ${pkg.title}`);
    console.log(`  now:     status=${pkg.status} verified=${pkg.verified} total=${pkg.totalPrice}\n`);

    // Sharing recomputes the price from the itinerary's actual components and
    // overwrites totalPrice with the result (see sendPackageToClient) — and
    // this package has no hotel, cab, ticket or add-on, so that recompute
    // lands on ₹0. Re-running --approve after a send is therefore the normal
    // way to put the price back, which means it must NOT drag the package
    // back to READY: that would strand a share link the client already has.
    const alreadyOut = pkg.status === "SENT" || pkg.status === "ACCEPTED";
    step(`totalPrice / pricePerPerson → ₹${TEST_PRICE}`);
    step("marginPercentage → 0, gstPercentage → 0");
    step(alreadyOut
        ? `status → left at ${pkg.status} (already with the client)`
        : "status → READY (readyAt set — ready_status_requires_ready_at)");
    step("verified → true, verifiedByName → 'Costing (test approval)'");
    if (!COMMIT) { console.log("\n  Re-run with --commit to apply.\n"); return; }

    await db.custom_packages.update({
        where: { id: packageId },
        data: {
            totalPrice: TEST_PRICE,
            pricePerPerson: TEST_PRICE,
            marginPercentage: 0,
            gstPercentage: 0,
            ...(alreadyOut ? {} : { status: "READY" as const, readyAt: pkg.readyAt ?? new Date() }),
            verified: true,
            verifiedAt: new Date(),
            verifiedByName: "Costing (test approval)",
            // Left null deliberately: no real reviewer signed this off, and
            // pointing it at a real costing member's id would put their name
            // behind an approval they never gave.
            verifiedBy: null,
            rejectedAt: null,
            revisionRequestedAt: null,
        },
    });
    console.log(`\n  Approved at ₹${TEST_PRICE}.`);
    console.log(alreadyOut
        ? "  Package is already with the client — the live link now reads ₹" + TEST_PRICE + ".\n"
        : "  The exec can now share it with the client.\n");
}

async function seedLead() {
    const member = await findExec();
    console.log(`  exec: ${member.name} <${EXEC_EMAIL}> — ${member.teamRole?.name ?? "no role"}${member.isActive ? "" : " (INACTIVE)"}\n`);

    const existing = await db.package_queries.findFirst({
        where: { name: LEAD_NAME },
        select: { id: true, status: true, assignedToName: true },
    });
    if (existing) {
        console.log(`  lead already exists: ${existing.id} (${existing.status}, assigned to ${existing.assignedToName})`);
        console.log(`  → build from it: /dashboard/package-builder/<new-uuid>?fromQuery=${existing.id}\n`);
        return;
    }

    const data = {
        name: LEAD_NAME,
        // Routed to the company's own helpline and inbox, so a stray call or
        // mail from anyone working the queue loops back internally instead of
        // reaching a member of the public.
        phone: "7807727100",
        countryCode: "IN",
        email: "hello@dreamyatri.com",
        whatsappSameAsPhone: true,
        message: "Internal end-to-end workflow test. Not a real enquiry — do not contact.",
        destination: "Goa",
        travelDate: new Date(Date.now() + 30 * 86_400_000),
        groupSize: 1,
        source: "OTHER" as const,
        // Past lead-verification already, so it lands straight in the exec's
        // workable pipeline rather than sitting in an admin approval queue.
        status: "ASSIGNED" as const,
        verified: true,
        verifiedAt: new Date(),
        assignedTo: member.id,
        assignedToName: member.name,
        assignedAt: new Date(),
    };

    console.log("  Would create package_queries row:");
    for (const [k, v] of Object.entries(data)) {
        console.log(`    ${k.padEnd(20)} ${v instanceof Date ? v.toISOString().slice(0, 10) : String(v)}`);
    }
    if (!COMMIT) { console.log("\n  Re-run with --commit to apply.\n"); return; }

    const lead = await db.package_queries.create({ data, select: { id: true } });
    await db.queryTimeline.create({
        data: { queryId: lead.id, event: `Test lead seeded and assigned to ${member.name}`, actorName: "System" },
    });
    console.log(`\n  ✓ package_queries ${lead.id}`);
    console.log(`  → shows in /dashboard/sales-query for ${member.name}`);
    console.log(`  → build from it: /dashboard/package-builder/<new-uuid>?fromQuery=${lead.id}\n`);
}

async function main() {
    const mode = TEARDOWN ? "Removing test lead + packages" : APPROVE_ID ? "Approving test package" : "Seeding test lead";
    console.log(`\n▸ ${mode} (${COMMIT ? "COMMIT — writing to the database" : "DRY RUN — nothing will be written"})`);
    console.log(`  target: ${dbTarget}\n`);

    if (TEARDOWN) return teardown();
    if (APPROVE_ID) return approve(APPROVE_ID);
    return seedLead();
}

main()
    .catch((e) => { console.error("\nseed-sales-workflow-test failed:", e.message); process.exit(1); })
    .finally(() => db.$disconnect());
