/**
 * Seed the throwaway Sales Executive used for live ₹1 payment testing.
 *
 * The three ₹1 fixtures all credit their bookings to a real exec —
 * seed-custom-package-payment-test defaults to chirag@dreamsyatri.com — which
 * means every smoke test lands test leads, test packages and "Booking won 🎉"
 * notifications in a working exec's queue, and skews their pipeline count and
 * their sales target. This stands up a disposable exec to point those fixtures
 * at instead:
 *
 *     npm run seed:test-exec -- --commit
 *     TEST_EXEC_EMAIL=<the email it prints> npm run seed:custom-pay-test -- --count=5 --commit
 *
 * The account is a REAL dashboard login (bcrypt password, Sales Executive
 * role), because a fake one would not test the thing under test: the exec has
 * to be able to sign in and see the lead, the quote and the notification.
 * Treat the printed password as a live credential until the teardown runs.
 *
 * Kept OUT of the auto-assign rotation (`autoAssignActive = false`) so real
 * inbound leads are never round-robined to an account nobody reads. It can
 * still be assigned leads explicitly, which is what the fixtures do.
 *
 * Idempotent — re-running updates the same member in place (and re-randomises
 * the password unless TEST_EXEC_PASSWORD is set).
 *
 * Run:  npm run seed:test-exec                      dry run — writes nothing
 *       npm run seed:test-exec -- --commit
 *       npm run seed:test-exec -- --teardown --commit
 *
 *       TEST_EXEC_PASSWORD=...   use a fixed password instead of a random one
 */
import { randomBytes } from "crypto";
import { hash } from "bcryptjs";
import { db, dbTarget } from "./_db";

const COMMIT = process.argv.includes("--commit");
const TEARDOWN = process.argv.includes("--teardown");

/** Loud enough that nobody mistakes this for a colleague in the team list. */
const EXEC_NAME = "[TEST — DELETE ME] Payment Test Exec";
const EXEC_EMAIL = "payment-test-exec@dreamsyatri.com";
const EMPLOYEE_ID = "DY-TEST-PAY";
const ROLE_NAME = "Sales Executive";

/** Random by default: a fixed default password on a real, role-bearing login
 *  that lives in a production database is a standing invitation, and this
 *  account is only ever driven by whoever ran the script. */
const PASSWORD = process.env.TEST_EXEC_PASSWORD ?? randomBytes(9).toString("base64url");

function step(msg: string) {
    console.log(`${COMMIT ? "  ✓" : "  ·"} ${msg}`);
}

async function teardown() {
    const member = await db.teamMember.findUnique({
        where: { email: EXEC_EMAIL },
        select: { id: true, name: true },
    });
    if (!member) {
        console.log("  nothing to remove — no test exec exists\n");
        return;
    }

    // Anything still pointing at this member would fail the delete on its FK,
    // so say what is in the way rather than throwing a raw constraint error.
    const [leads, bookings, notifications] = await Promise.all([
        db.package_queries.count({ where: { assignedTo: member.id } }),
        db.booking.count({ where: { salesAgentId: member.id } }),
        db.notification.count({ where: { recipientId: member.id } }),
    ]);
    console.log(`  attached: ${leads} lead(s), ${bookings} booking(s), ${notifications} notification(s)`);
    if (leads > 0 || bookings > 0) {
        console.log("  ⚠ run the fixture teardown first:");
        console.log("      npm run seed:custom-pay-test -- --teardown --with-bookings --commit\n");
        return;
    }

    step(`delete team_members  ${member.name}`);
    if (COMMIT) {
        await db.notification.deleteMany({ where: { recipientId: member.id } });
        await db.teamMember.delete({ where: { id: member.id } });
    }
}

async function main() {
    console.log(
        TEARDOWN
            ? `\n▸ Removing the ₹1 test sales exec (${COMMIT ? "COMMIT" : "DRY RUN"})`
            : `\n▸ Seeding the ₹1 test sales exec (${COMMIT ? "COMMIT — writing to the database" : "DRY RUN — nothing will be written; pass --commit to apply"})`,
    );
    console.log(`  target: ${dbTarget}\n`);

    if (TEARDOWN) {
        await teardown();
        await db.$disconnect();
        return;
    }

    const role = await db.teamRole.findFirst({ where: { name: ROLE_NAME }, select: { id: true, name: true } });
    if (!role) throw new Error(`No "${ROLE_NAME}" role found — cannot create the test exec.`);

    // Optional, and deliberately not created if absent: a missing department or
    // sales team costs this account nothing (both FKs are nullable), and
    // inventing rows in a production org chart to seed a test login is worse
    // than leaving them null.
    const dept = await db.department.findFirst({ where: { name: "Sales" }, select: { id: true, name: true } });
    const team = await db.salesTeam.findFirst({ where: { name: "Team Testing" }, select: { id: true, name: true } });

    console.log(`  role:       ${role.name}`);
    console.log(`  department: ${dept?.name ?? "(none — left null)"}`);
    console.log(`  sales team: ${team?.name ?? "(none — left null)"}\n`);

    const existing = await db.teamMember.findUnique({ where: { email: EXEC_EMAIL }, select: { id: true } });
    step(`${existing ? "update" : "create"} team_members  ${EXEC_EMAIL}  employeeId=${EMPLOYEE_ID}`);
    step(`autoAssignActive=false  (kept out of the round robin)`);

    if (!COMMIT) {
        console.log("\n  Dry run — re-run with --commit to apply.\n");
        await db.$disconnect();
        return;
    }

    const passwordHash = await hash(PASSWORD, 10);
    const member = await db.teamMember.upsert({
        where: { email: EXEC_EMAIL },
        update: {
            name: EXEC_NAME, password: passwordHash, isActive: true,
            teamRoleId: role.id, departmentId: dept?.id ?? null, salesTeamId: team?.id ?? null,
            autoAssignActive: false,
            // Invalidates any session still holding the previous password.
            sessionVersion: { increment: 1 },
        },
        create: {
            name: EXEC_NAME, email: EXEC_EMAIL, password: passwordHash, employeeId: EMPLOYEE_ID,
            isActive: true, teamRoleId: role.id, departmentId: dept?.id ?? null, salesTeamId: team?.id ?? null,
            autoAssignActive: false,
        },
        select: { id: true, email: true, employeeId: true },
    });

    console.log(`\n  ── dashboard login ──────────────────────────────`);
    console.log(`     url:      /dashboard/login`);
    console.log(`     email:    ${member.email}`);
    console.log(`     password: ${PASSWORD}`);
    console.log(`     memberId: ${member.id}`);
    console.log(`     employee: ${member.employeeId}`);
    console.log(`  ─────────────────────────────────────────────────`);
    console.log(`\n  Next:  TEST_EXEC_EMAIL=${member.email} npm run seed:custom-pay-test -- --count=5 --commit\n`);

    await db.$disconnect();
}

main().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
