/**
 * Pure-unit tests for the booking email builders.
 * Run:  npm run test:notify
 *
 * Amounts assert the ROUNDED-UP whole-rupee display (`formatPaiseRoundedUp`),
 * which is what the templates render — e.g. 911335 paise → "₹9,114", not
 * "₹9,113.35". The exact paise remain the charge source of truth.
 */
import { bookingConfirmationEmail, cancellationEmail, refundConfirmedEmail, opsNewBookingEmail } from "../app/services/notifications/booking-emails";

let passed = 0;
const failures: string[] = [];
const check = (n: string, c: boolean) => { if (c) passed++; else { failures.push(n); console.error(`  ✗ ${n}`); } };

console.log("Notifications:");

// Booking confirmation (deposit)
{
    const m = bookingConfirmationEmail({
        bookingNumber: "DY-260603-AB12CD", packageTitle: "Manali Honeymoon", travelStartDate: "2026-09-30", travelEndDate: "2026-10-03",
        travellers: 2, isFull: false, paidPaise: 911335, balancePaise: 2734003, balanceDueDate: "2026-09-15", voucherUrl: "https://x/voucher",
    });
    check("confirmation subject has package + booking", m.subject.includes("Manali Honeymoon") && m.subject.includes("DY-260603-AB12CD"));
    check("confirmation shows deposit paid", m.html.includes("Deposit paid") && m.html.includes("₹9,114"));
    check("confirmation shows balance + due", m.html.includes("₹27,341") && m.html.includes("Balance due") && m.html.includes("2026"));
    check("confirmation has voucher link", m.html.includes("https://x/voucher"));
}

// Booking confirmation (full) → no balance row
{
    const m = bookingConfirmationEmail({
        bookingNumber: "DY-1", packageTitle: "Goa", travelStartDate: "2026-06-10", travelEndDate: "2026-06-13",
        travellers: 1, isFull: true, paidPaise: 5000000, balancePaise: 0, voucherUrl: "https://x/v",
    });
    check("full shows paid in full", m.html.includes("Paid in full") && m.html.includes("₹50,000"));
    check("full has no balance-due row", !m.html.includes("Balance due"));
}

// Cancellation
{
    const m = cancellationEmail({ bookingNumber: "DY-2", packageTitle: "Manali", refundablePaise: 820202, feePaise: 91133 });
    check("cancellation subject", m.subject.toLowerCase().includes("cancelled") && m.subject.includes("DY-2"));
    check("cancellation shows refund + fee", m.html.includes("₹8,203") && m.html.includes("₹912"));
}

// Refund confirmed
{
    const m = refundConfirmedEmail({ bookingNumber: "DY-3", packageTitle: "Manali", refundAmountPaise: 820202 });
    check("refund subject has amount", m.subject.includes("₹8,203") && m.subject.includes("DY-3"));
    check("refund body has amount", m.html.includes("₹8,203"));
}

// Ops
{
    const m = opsNewBookingEmail({ bookingNumber: "DY-4", packageTitle: "Manali", travelStartDate: "2026-09-30", travellers: 2, paidPaise: 911335 });
    check("ops subject", m.subject.includes("New paid booking") && m.subject.includes("DY-4"));
    check("ops body has amount + pax", m.html.includes("₹9,114") && m.html.includes("Travellers"));
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
