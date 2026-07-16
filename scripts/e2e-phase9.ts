/**
 * Phase 9 integration e2e — booking with traveller/contact details + ₹10k floor + payment choice.
 * Run:  npm run e2e:phase9   (needs DATABASE_URL; gateway order step expected to throw w/o keys)
 * DB-mutating, self-cleaning, NOT part of `npm test`.
 */
import { db } from "../app/lib/db";
import { createQuote } from "../app/actions/quote/create-quote.service";
import { createBookingAndOrder } from "../app/actions/payment/create-booking.service";

const failures: string[] = [];
const expect = (n: string, c: boolean) => { if (!c) { failures.push(n); console.error(`  ✗ ${n}`); } };
function future(d: number) { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); }
const quoteIds: string[] = [];
const bookingIds: string[] = [];

async function mkQuote() {
    const pkg = await db.packages.findUnique({ where: { slug: "manali-honeymoon-package" }, select: { id: true, stay_categories: { select: { id: true, slug: true, is_default: true } } } });
    const dur = await db.package_durations.findFirst({ where: { slug: "4d-3n", package: { slug: "manali-honeymoon-package" } }, select: { id: true, routes: { select: { id: true, slug: true } } } });
    const route = dur!.routes.find(r => r.slug === "manali-jammu-gulmarg") ?? dur!.routes[0];
    const stay = pkg!.stay_categories.find(s => s.slug === "standard") ?? pkg!.stay_categories[0];
    const q = await createQuote({ package_id: pkg!.id, duration_id: dur!.id, route_id: route.id, stay_category_id: stay.id, package_slug: "manali-honeymoon-package", duration_slug: "4d-3n", route_slug: "manali-jammu-gulmarg", stay_slug: "standard", adults: 2, travel_date: future(60) });
    if (!q.success) throw new Error("quote failed");
    quoteIds.push(q.quote.id);
    return { quoteId: q.quote.id, totalPaise: Math.round(q.quote.total_amount * 100) };
}
const details = {
    travellers: [
        { type: "ADULT" as const, title: "Mrs" as const, firstName: "Asha", lastName: "Rao", dob: "1990-01-01", gender: "FEMALE" as const },
        { type: "ADULT" as const, title: "Mr" as const, firstName: "Vikram", lastName: "Rao", dob: "1988-05-09", gender: "MALE" as const },
    ],
    contact: { email: "asha@example.com", phone: "+91 98123 45678" },
    gstStateCode: "",
};
const fetchBooking = (quoteId: string) => db.booking.findUnique({ where: { quoteId }, select: { id: true, paymentPlan: true, advanceAmount_paise: true, balanceAmount_paise: true, totalAmount_paise: true, contactEmail: true, travellersList: { select: { firstName: true, isLead: true } }, payments: { select: { amount_paise: true } } } });

async function main() {
    const user = await db.user.findFirst({ select: { id: true } });

    // pax mismatch rejected
    const qm = await mkQuote();
    const bad = await createBookingAndOrder({ quoteId: qm.quoteId, userId: user!.id, details: { ...details, travellers: [details.travellers[0]] } });
    expect("pax mismatch rejected", bad.success === false);

    // DEPOSIT with details → ₹10k floor + travellers + contact
    const q1 = await mkQuote();
    try { await createBookingAndOrder({ quoteId: q1.quoteId, userId: user!.id, details, paymentChoice: "DEPOSIT" }); } catch { /* order throws w/o keys */ }
    const b1 = await fetchBooking(q1.quoteId);
    if (b1) bookingIds.push(b1.id);
    expect("DEPOSIT plan + ₹10k floor deposit", b1?.paymentPlan === "DEPOSIT" && b1?.advanceAmount_paise === 1_000_000);
    expect("2 travellers persisted, lead = Asha", b1?.travellersList.length === 2 && b1.travellersList.some(t => t.isLead && t.firstName === "Asha"));
    expect("contact persisted, first payment = deposit", b1?.contactEmail === "asha@example.com" && b1?.payments[0].amount_paise === 1_000_000);

    // FULL choice → full single leg
    const q2 = await mkQuote();
    try { await createBookingAndOrder({ quoteId: q2.quoteId, userId: user!.id, details, paymentChoice: "FULL" }); } catch { /* */ }
    const b2 = await fetchBooking(q2.quoteId);
    if (b2) bookingIds.push(b2.id);
    expect("FULL plan, payment = total", b2?.paymentPlan === "FULL" && b2?.payments[0].amount_paise === q2.totalPaise && b2?.balanceAmount_paise === 0);

    console.log(failures.length === 0 ? "PHASE9_E2E_PASS" : `PHASE9_E2E_FAIL (${failures.length})`);
}

main().catch(e => { console.error("E2E ERROR", e); failures.push("threw"); }).finally(async () => {
    for (const id of bookingIds) { await db.payment.deleteMany({ where: { bookingId: id } }).catch(() => {}); await db.booking.delete({ where: { id } }).catch(() => {}); }
    for (const id of quoteIds) await db.package_quote.deleteMany({ where: { id } }).catch(() => {});
    await db.$disconnect();
    process.exit(failures.length === 0 ? 0 : 1);
});
