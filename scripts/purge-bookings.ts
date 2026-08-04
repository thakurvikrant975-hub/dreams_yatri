/**
 * Delete named bookings outright, together with the payment records and gateway
 * webhook events that hang off them.
 *
 * Built for clearing test traffic out of a database before launch — ₹1 gateway
 * smoke tests, abandoned checkouts from a QA pass. It is deliberately explicit:
 * bookings are named one by one on the command line and there is no "delete
 * everything matching X" mode, because the difference between a test booking and
 * a real one is a judgement call no pattern can make safely.
 *
 * Deleting a booking cascades through its itinerary, travellers, timeline, meals,
 * hotel/cab/activity legs, installments, conversations and reviews (see the
 * onDelete: Cascade relations on Booking). Two children do NOT cascade and are
 * removed here first: Payment and TripDocument. WebhookEvent references bookings
 * and payments by plain string id with no FK, so those rows are cleared too —
 * left behind they would be unresolvable audit entries.
 *
 * Money already captured at the gateway is NOT refunded and not otherwise
 * affected; this only removes our own records. Reconcile anything you delete
 * against the gateway dashboard yourself if the amounts matter.
 *
 * Run:  npm run purge:bookings -- --numbers=DY-260804-771FB1,DY-260804-25BFAD
 *       npm run purge:bookings -- --numbers=... --commit
 */
import { db, dbTarget } from "./_db";

const COMMIT = process.argv.includes("--commit");

const numbersArg = process.argv.find((a) => a.startsWith("--numbers="));
const NUMBERS = (numbersArg?.slice("--numbers=".length) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

async function main() {
    console.log(
        COMMIT
            ? "\n▸ Purging bookings (COMMIT — deleting rows)"
            : "\n▸ Purging bookings (DRY RUN — pass --commit to delete)",
    );
    console.log(`  target: ${dbTarget}`);

    if (NUMBERS.length === 0) {
        console.error("\n  No bookings named. Pass --numbers=DY-...,DY-...");
        console.error("  This script never selects bookings on its own.\n");
        process.exit(1);
    }

    const bookings = await db.booking.findMany({
        where: { bookingNumber: { in: NUMBERS } },
        select: {
            id: true, bookingNumber: true, status: true, paymentStatus: true,
            totalAmount: true, paidAmount: true, createdAt: true,
            user: { select: { email: true } },
            payments: { select: { id: true, status: true, amount: true, gateway: true, gatewayPaymentId: true } },
            documents: { select: { id: true } },
            _count: { select: { hotelBookings: true, cabBookings: true, bookingActivities: true, timeline: true, travellersList: true, installments: true, conversations: true, reviews: true } },
        },
        orderBy: { createdAt: "asc" },
    });

    const found = new Set(bookings.map((b) => b.bookingNumber));
    const missing = NUMBERS.filter((n) => !found.has(n));
    if (missing.length) console.log(`\n  not found (already gone?): ${missing.join(", ")}`);
    if (bookings.length === 0) { console.log("\n  Nothing to do.\n"); return; }

    const paymentIds = bookings.flatMap((b) => b.payments.map((p) => p.id));
    const bookingIds = bookings.map((b) => b.id);
    const hookCount = await db.webhookEvent.count({
        where: { OR: [{ bookingId: { in: bookingIds } }, ...(paymentIds.length ? [{ paymentId: { in: paymentIds } }] : [])] },
    });

    console.log(`\n  ${bookings.length} booking(s):`);
    for (const b of bookings) {
        const c = b._count;
        console.log(`    ${b.bookingNumber}  ${b.status}/${b.paymentStatus}  total=${b.totalAmount} paid=${b.paidAmount}  ${b.createdAt.toISOString().slice(0, 10)}  ${b.user?.email ?? "no user"}`);
        for (const p of b.payments) {
            console.log(`        payment ${p.status} ${p.gateway} ${p.gatewayPaymentId ?? "(no gateway id)"} ₹${p.amount}`);
        }
        const kids = Object.entries(c).filter(([, n]) => n > 0).map(([k, n]) => `${k}=${n}`);
        if (kids.length) console.log(`        cascades: ${kids.join(" ")}`);
        if (b.documents.length) console.log(`        documents: ${b.documents.length}`);
    }
    console.log(`\n    webhook events to clear: ${hookCount}`);

    // Captured money is the one thing that cannot be undone by re-seeding.
    const captured = bookings.filter((b) => Number(b.paidAmount) > 0);
    if (captured.length) {
        console.log(`\n  ⚠ ${captured.length} of these have money captured at the gateway (₹${captured.reduce((s, b) => s + Number(b.paidAmount), 0)} total).`);
        console.log("    Deleting the record does not refund it — reconcile at the gateway if needed.");
    }

    if (!COMMIT) {
        console.log("\n  Re-run with --commit to delete.\n");
        return;
    }

    // One transaction per booking: a partial delete leaves a booking with its
    // payments already gone, which is worse than not having started.
    let done = 0;
    for (const b of bookings) {
        const payIds = b.payments.map((p) => p.id);
        await db.$transaction([
            db.webhookEvent.deleteMany({
                where: { OR: [{ bookingId: b.id }, ...(payIds.length ? [{ paymentId: { in: payIds } }] : [])] },
            }),
            db.tripDocument.deleteMany({ where: { bookingId: b.id } }),
            db.payment.deleteMany({ where: { bookingId: b.id } }),
            db.booking.delete({ where: { id: b.id } }),
        ]);
        console.log(`  ✓ ${b.bookingNumber}`);
        done++;
    }

    console.log(`\n  Deleted ${done} booking(s).\n`);
}

main()
    .catch((e) => { console.error("\npurge-bookings failed:", e); process.exit(1); })
    .finally(() => db.$disconnect());
