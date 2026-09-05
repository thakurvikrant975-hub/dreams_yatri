/**
 * Seed the ₹1 CUSTOM-PACKAGE share link used for live payment-gateway testing.
 *
 * Third of the three test fixtures, and the only one that exercises the sales
 * exec's own path end to end:
 *
 *   seed-test-payment-skus.ts    the ₹1 catalogue package + hotel
 *   clone-test-skus.ts           a ₹1 deep clone of a real catalogue package
 *   this one                     a ₹1 custom package and its client share link
 *
 * WHY IT HAS TO EXIST SEPARATELY. The two catalogue fixtures cannot test the
 * one thing the sales team cares about: `runPaymentConfirmedEffects` only
 * congratulates an exec when `booking.salesAgentId` is set, and that field is
 * written in exactly two places — createBookingFromCustomPackage (from the
 * lead's current owner) and lib/bookings/create-from-query. A booking made off
 * the catalogue has no sales agent, so notifySalesAgentBookingWon returns at
 * its first line and the notification silently never fires. Only a booking
 * made through a custom share link tests it.
 *
 * WHAT IT DOES NOT DO. It writes the package straight to SENT rather than
 * walking the builder → costing → send chain, because what is under test here
 * is everything AFTER the client presses Pay: gateway, payment rows, invoice,
 * receipt email, exec notification. The row is shaped exactly as
 * sendPackageToClient leaves one — including the pricingSnapshot, which the
 * client page reads for the discount and which reconcile compares against — so
 * nothing downstream can tell the difference.
 *
 * HOW IT LANDS ON ₹1. totalPrice is written directly with margin and GST at 0,
 * the same trick seed-sales-workflow-test.ts uses for its approval step: a
 * component-built total would not survive as ₹1, since margin and GST each
 * round up independently and would add ₹1 apiece.
 *
 * NOTE ON THE PAYMENT PLAN. The ₹10,000 minimum-deposit floor collapses a ₹1
 * total to a single FULL leg, so this fixture cannot exercise the
 * DEPOSIT → balance flow. That needs a total above ~₹40,000 and travel more
 * than PAYMENT_BALANCE_DUE_DAYS_BEFORE_TRAVEL (15) days out. Set TEST_PRICE to
 * do that once the ₹1 pass is clean.
 *
 * Idempotent — re-running updates the same package in place rather than
 * leaving a second link behind.
 *
 * Run:  npm run seed:custom-pay-test                    dry run — writes nothing
 *       npm run seed:custom-pay-test -- --commit
 *       npm run seed:custom-pay-test -- --teardown --commit
 *
 *       TEST_EXEC_EMAIL=someone@dreamsyatri.com  which exec gets the credit
 *       TEST_PRICE=45000                         to reach the deposit path
 */
import { db, dbTarget } from "./_db";

const COMMIT = process.argv.includes("--commit");
const TEARDOWN = process.argv.includes("--teardown");

/** Which exec should receive the "your trip just landed" notification. */
const EXEC_EMAIL = process.env.TEST_EXEC_EMAIL ?? "chirag@dreamsyatri.com";

/** The price under test. ₹1 by default; see the note above about the deposit
 *  floor before raising it. */
const TEST_PRICE = Number(process.env.TEST_PRICE ?? 1);

/** Loud enough that nobody mistakes it for a real quote, and stable enough to
 *  be the idempotency key — re-running never creates a second package. */
const PACKAGE_TITLE = "[TEST — DO NOT BOOK] ₹1 Payment Gateway Test";
const LEAD_NAME = "[TEST — DO NOT CONTACT] Payment Gateway Test Lead";

function step(msg: string) {
  console.log(`${COMMIT ? "  ✓" : "  ·"} ${msg}`);
}

/** Far enough out that the balance window (15 days) is not the reason a plan
 *  comes back FULL — so raising TEST_PRICE is the only change needed to reach
 *  the deposit path. */
function travelDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 90);
  return new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

async function findExec() {
  const member = await db.teamMember.findUnique({
    where: { email: EXEC_EMAIL },
    select: { id: true, name: true, isActive: true, teamRole: { select: { name: true } } },
  });
  if (!member) throw new Error(`No team member with email ${EXEC_EMAIL} — set TEST_EXEC_EMAIL`);
  return member;
}

async function teardown() {
  const lead = await db.package_queries.findFirst({ where: { name: LEAD_NAME }, select: { id: true } });
  const pkgs = await db.custom_packages.findMany({
    where: { title: PACKAGE_TITLE },
    select: { id: true },
  });
  console.log(`\n  test packages: ${pkgs.length}   test lead: ${lead ? lead.id : "none"}`);

  // A booking made against the link holds it by packageUrl, and Booking has no
  // cascade from custom_packages — so a paid test would be orphaned rather
  // than deleted. Say so instead of silently leaving it.
  const bookings = pkgs.length
    ? await db.booking.findMany({
      where: { packageUrl: { in: pkgs.map((p) => `/custom-package/${p.id}`) } },
      select: { id: true, bookingNumber: true, status: true },
    })
    : [];
  if (bookings.length) {
    console.log(`\n  ⚠ ${bookings.length} booking(s) were made against this link and are NOT removed:`);
    for (const b of bookings) console.log(`      ${b.bookingNumber}  ${b.status}  (${b.id})`);
    console.log("    Delete those by hand first if you want a clean slate.");
  }
  if (!COMMIT) { console.log("\n  Re-run with --commit to apply.\n"); return; }

  for (const p of pkgs) await db.custom_packages.delete({ where: { id: p.id } });
  if (lead) {
    await db.queryTimeline.deleteMany({ where: { queryId: lead.id } });
    await db.queryNote.deleteMany({ where: { queryId: lead.id } });
    // Only if nothing else was built from it in the meantime.
    const others = await db.custom_packages.count({ where: { queryId: lead.id } });
    if (others === 0) await db.package_queries.delete({ where: { id: lead.id } });
    else console.log(`  · lead kept — ${others} other package(s) still reference it`);
  }
  console.log("\n  Removed.\n");
}

async function main() {
  console.log(
    TEARDOWN
      ? "\n▸ Removing the ₹1 custom-package test fixture"
      : COMMIT
        ? `\n▸ Seeding the ₹${TEST_PRICE} custom-package test link (COMMIT — writing)`
        : `\n▸ Seeding the ₹${TEST_PRICE} custom-package test link (DRY RUN — nothing will be written)`,
  );
  console.log(`  target: ${dbTarget}\n`);

  if (TEARDOWN) return teardown();

  const member = await findExec();
  console.log(`  exec: ${member.name} <${EXEC_EMAIL}> — ${member.teamRole?.name ?? "no role"}`);
  if (!member.isActive) console.log("  ⚠ that exec is INACTIVE — the notification may not reach anyone");

  // Borrowed rather than invented, the same way seed-test-payment-skus does it:
  // without a cover the client page opens on an empty black hero, which is not
  // what the real thing looks like and so not what should be under test.
  const donor = await db.packages.findFirst({
    where: { thumbnail: { not: null } },
    orderBy: { id: "asc" },
    select: { thumbnail: true },
  });

  const existingLead = await db.package_queries.findFirst({ where: { name: LEAD_NAME }, select: { id: true } });
  const existingPkg = await db.custom_packages.findFirst({ where: { title: PACKAGE_TITLE }, select: { id: true } });
  const date = travelDate();

  if (!COMMIT) {
    console.log(`\n  Would ${existingLead ? "reuse" : "create"} lead        ${LEAD_NAME}`);
    console.log(`  Would ${existingPkg ? "update" : "create"} package     ${PACKAGE_TITLE}`);
    step(`assignedTo       ${member.name} (${member.id}) → booking.salesAgentId`);
    step(`totalPrice       ₹${TEST_PRICE}, margin 0%, GST 0%`);
    step(`travelDate       ${date.toISOString().slice(0, 10)} (90 days out)`);
    step(`status           SENT + pricingSnapshot, as sendPackageToClient leaves it`);
    step(`itinerary        1 day, hand-typed stay (no catalog room, no extra rooms)`);
    step(`cover            ${donor?.thumbnail ? "borrowed from catalogue" : "none available (hero renders plain)"}`);
    step("stayOptions      none — a single-stay package, so the option-pricing gate never applies");
    console.log("\n  Re-run with --commit to apply.\n");
    return;
  }

  // ── The lead ──────────────────────────────────────────────────────────────
  // Its assignedTo is the whole point: createBookingFromCustomPackage copies it
  // onto booking.salesAgentId, which is what notifySalesAgentBookingWon needs.
  const lead = existingLead
    ? await db.package_queries.update({
      where: { id: existingLead.id },
      data: { assignedTo: member.id, assignedToName: member.name, assignedAt: new Date(), status: "ASSIGNED" },
      select: { id: true },
    })
    : await db.package_queries.create({
      data: {
        name: LEAD_NAME,
        phone: "7807727100",
        countryCode: "IN",
        email: "hello@dreamyatri.com",
        whatsappSameAsPhone: true,
        message: "Internal payment-gateway test. Not a real enquiry — do not contact.",
        destination: "Goa",
        travelDate: date,
        groupSize: 1,
        source: "OTHER",
        status: "ASSIGNED",
        verified: true,
        verifiedAt: new Date(),
        assignedTo: member.id,
        assignedToName: member.name,
        assignedAt: new Date(),
      },
      select: { id: true },
    });
  step(`package_queries  ${lead.id}`);

  // ── The snapshot, shaped as sendPackageToClient writes it ─────────────────
  // Everything at zero except the final price: the client page reads listPrice
  // and discountAmount off this, and reconcile compares finalPrice against what
  // was charged.
  const pricingSnapshot = {
    lockedAt: new Date().toISOString(),
    currency: "INR",
    hotel: { subtotal: TEST_PRICE, nightsCounted: 1, lines: [], overridden: false },
    cab: { subtotal: 0, daysCounted: 0, lines: [], overridden: false },
    tickets: { subtotal: 0, lines: [] },
    addOns: { subtotal: 0, lines: [] },
    baseCost: TEST_PRICE,
    marginPercentage: 0,
    hotelCabMarginAmount: 0,
    ticketsMarginAmount: 0,
    marginAmount: 0,
    taxable: TEST_PRICE,
    gstPercentage: 0,
    gstAmount: 0,
    listPrice: TEST_PRICE,
    discountType: null,
    discountValue: null,
    discountAmount: 0,
    finalPrice: TEST_PRICE,
    pricePerPerson: TEST_PRICE,
    displayedTotalPrice: TEST_PRICE,
    displayedPricePerPerson: TEST_PRICE,
  };

  const data = {
    queryId: lead.id,
    title: PACKAGE_TITLE,
    description: "Internal payment-gateway test package. Do not book.",
    coverImage: donor?.thumbnail ?? null,
    destination: "Goa",
    startingPoint: "Goa",
    totalDays: 2,
    totalNights: 1,
    travelDate: date,
    adults: 1,
    children: 0,
    infants: 0,
    pricePerPerson: TEST_PRICE,
    totalPrice: TEST_PRICE,
    // Both zero, or each rounds up independently and adds ₹1 apiece.
    marginPercentage: 0,
    gstPercentage: 0,
    currency: "INR",
    inclusions: ["Stay as per itinerary"],
    exclusions: ["Anything not listed"],
    termsConditions: ["Internal test package — not a real offer."],
    paymentPolicy: ["Full payment at booking."],
    amendmentPolicy: ["Not applicable — internal test."],
    travelBenefits: [],
    status: "SENT" as const,
    sentAt: new Date(),
    verified: true,
    verifiedAt: new Date(),
    verifiedByName: "Payment test fixture",
    builtBy: member.id,
    builtByName: member.name,
    pricingSnapshot,
  };

  const pkg = existingPkg
    ? await db.custom_packages.update({ where: { id: existingPkg.id }, data, select: { id: true } })
    : await db.custom_packages.create({ data, select: { id: true } });
  step(`custom_packages  ${pkg.id}`);

  // ── One day, one hand-typed stay ─────────────────────────────────────────
  // Deliberately no roomPricingId: a catalog room would price the day against
  // real inventory, and this package's total is written directly.
  await db.custom_itineraries.deleteMany({ where: { customPackageId: pkg.id } });
  await db.custom_itineraries.create({
    data: {
      customPackageId: pkg.id,
      day: 1,
      title: "Arrival — payment gateway test",
      description: "Internal test itinerary. This package exists to exercise the checkout.",
      meals: [],
      accommodation: "Test Property — Test Room",
      accommodationLocation: "Goa",
      accommodationRoomSpecs: "1 Double Bed | Test",
      roomsCount: 1,
      hotelCheckIn: "12:00 PM",
      hotelCheckOut: "11:00 AM",
    },
  });
  step("custom_itineraries day 1");

  // The lead moves to PACKAGE_SENT the way sendPackageToClient leaves it, so
  // the exec's queue reads correctly while the test is in flight.
  await db.package_queries.update({ where: { id: lead.id }, data: { status: "PACKAGE_SENT" } });
  step("package_queries  status=PACKAGE_SENT");

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  console.log(`\n  Share link:  ${base}/custom-package/${pkg.id}`);
  console.log(`  Review step: ${base}/custom-package/${pkg.id}/book`);
  console.log(`  Credit goes to: ${member.name} (booking.salesAgentId)\n`);
  console.log("  Watch the server log for [confirmed] lines — every effect after");
  console.log("  capture is best-effort and failures are logged, not surfaced.\n");
}

main()
  .catch((err) => { console.error("\nseed-custom-package-payment-test failed:", err); process.exitCode = 1; })
  .finally(() => db.$disconnect());
