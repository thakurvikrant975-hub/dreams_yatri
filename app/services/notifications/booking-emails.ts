import { formatPaise } from "../../lib/money";

/**
 * Pure transactional-email builders → `{ subject, html }`. No I/O, so trivially
 * unit-testable. Money via `formatPaise`. Sending lives in `send.ts`.
 */

export interface EmailContent {
    subject: string;
    html: string;
}

const BRAND = "Dreams Yatri";

function layout(heading: string, body: string): string {
    return `
<div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
  <div style="background:#0f766e;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0">
    <strong style="font-size:18px">${BRAND}</strong>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:0;border-radius:0 0 8px 8px;padding:20px">
    <h2 style="margin:0 0 12px;font-size:18px">${heading}</h2>
    ${body}
    <p style="margin-top:20px;color:#6b7280;font-size:12px">— Team ${BRAND}</p>
  </div>
</div>`.trim();
}

function fmtDate(iso: string): string {
    const d = new Date(`${iso}T00:00:00`);
    if (isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

function row(label: string, value: string): string {
    return `<tr><td style="padding:6px 0;color:#6b7280">${label}</td><td style="padding:6px 0;text-align:right;font-weight:600">${value}</td></tr>`;
}

function cta(href: string, label: string): string {
    return `<p><a href="${href}" style="display:inline-block;background:#0f766e;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">${label}</a></p>`;
}

// ── Fulfilment status updates (trip ready / item needs an alternative) ──────────
export function tripStatusEmail(d: {
    kind: "READY" | "ATTENTION";
    bookingNumber: string;
    packageTitle: string;
    itemLabel?: string;
    statusUrl: string;
}): EmailContent {
    if (d.kind === "READY") {
        return {
            subject: `Your trip is confirmed — ${d.packageTitle}`,
            html: layout("Your trip is fully confirmed 🎉", `
                <p style="margin:0 0 12px">Great news! Every hotel, transfer and activity for <strong>${d.packageTitle}</strong> (booking ${d.bookingNumber}) is now confirmed.</p>
                <p style="margin:0 0 12px">View your day-by-day status and download your vouchers:</p>
                ${cta(d.statusUrl, "View trip status")}
            `),
        };
    }
    return {
        subject: `Update on your booking ${d.bookingNumber}`,
        html: layout("We're arranging an alternative", `
            <p style="margin:0 0 12px">One item in <strong>${d.packageTitle}</strong>${d.itemLabel ? ` — <strong>${d.itemLabel}</strong>` : ""} isn't available, so our team is lining up the best alternative for you.</p>
            <p style="margin:0 0 12px">We'll share options shortly. You can track progress here:</p>
            ${cta(d.statusUrl, "View trip status")}
        `),
    };
}

// ── Booking confirmation + receipt ────────────────────────────────────────────
export function bookingConfirmationEmail(d: {
    bookingNumber: string;
    packageTitle: string;
    travelStartDate: string; // YYYY-MM-DD
    travelEndDate: string;
    travellers: number;
    isFull: boolean;
    paidPaise: number;
    balancePaise: number;
    balanceDueDate?: string | null;
    voucherUrl: string;
}): EmailContent {
    const balanceRow = !d.isFull && d.balancePaise > 0
        ? row(`Balance due${d.balanceDueDate ? ` by ${fmtDate(d.balanceDueDate)}` : ""}`, formatPaise(d.balancePaise))
        : "";
    return {
        subject: `Booking confirmed — ${d.packageTitle} (${d.bookingNumber})`,
        html: layout("Your booking is confirmed! 🎉", `
      <p>Thank you for booking <strong>${d.packageTitle}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:8px 0">
        ${row("Booking", d.bookingNumber)}
        ${row("Travel", `${fmtDate(d.travelStartDate)} – ${fmtDate(d.travelEndDate)}`)}
        ${row("Travellers", String(d.travellers))}
        ${row(d.isFull ? "Paid in full" : "Deposit paid", formatPaise(d.paidPaise))}
        ${balanceRow}
      </table>
      <p><a href="${d.voucherUrl}" style="color:#0f766e;font-weight:600">View your trip voucher →</a></p>`),
    };
}

// ── Cancellation confirmation ─────────────────────────────────────────────────
export function cancellationEmail(d: {
    bookingNumber: string;
    packageTitle: string;
    refundablePaise: number;
    feePaise: number;
}): EmailContent {
    return {
        subject: `Booking cancelled — ${d.packageTitle} (${d.bookingNumber})`,
        html: layout("Your booking has been cancelled", `
      <p>Booking <strong>${d.bookingNumber}</strong> for <strong>${d.packageTitle}</strong> has been cancelled.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:8px 0">
        ${row("Refund to original method", formatPaise(d.refundablePaise))}
        ${row("Cancellation fee", formatPaise(d.feePaise))}
      </table>
      <p style="color:#6b7280;font-size:13px">Refunds may take a few business days to reflect.</p>`),
    };
}

// ── Refund confirmed ──────────────────────────────────────────────────────────
export function refundConfirmedEmail(d: {
    bookingNumber: string;
    packageTitle: string;
    refundAmountPaise: number;
}): EmailContent {
    return {
        subject: `Refund processed — ${formatPaise(d.refundAmountPaise)} (${d.bookingNumber})`,
        html: layout("Your refund has been processed", `
      <p>We've processed a refund of <strong>${formatPaise(d.refundAmountPaise)}</strong> for booking
      <strong>${d.bookingNumber}</strong> (${d.packageTitle}) to your original payment method.</p>
      <p style="color:#6b7280;font-size:13px">It may take a few business days to appear on your statement.</p>`),
    };
}

// ── Ops notification (internal) ───────────────────────────────────────────────
export function opsNewBookingEmail(d: {
    bookingNumber: string;
    packageTitle: string;
    travelStartDate: string;
    travellers: number;
    paidPaise: number;
}): EmailContent {
    return {
        subject: `New paid booking — ${d.bookingNumber} (${d.packageTitle})`,
        html: layout("New paid booking", `
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:8px 0">
        ${row("Booking", d.bookingNumber)}
        ${row("Package", d.packageTitle)}
        ${row("Travel start", fmtDate(d.travelStartDate))}
        ${row("Travellers", String(d.travellers))}
        ${row("Amount paid", formatPaise(d.paidPaise))}
      </table>
      <p style="color:#6b7280;font-size:13px">Please action this booking in the ops queue.</p>`),
    };
}

// ── Hotel owner notification (hotel-connect) ──────────────────────────────────
export function ownerBookingConfirmedEmail(d: {
    hotelName: string;
    bookingNumber: string;
    checkInDate: string;
    checkOutDate: string;
    roomType: string;
    roomsCount: number;
    bookingsUrl: string;
}): EmailContent {
    return {
        subject: `New confirmed booking — ${d.hotelName}`,
        html: layout("You have a confirmed booking", `
      <p style="margin:0 0 12px">A stay at <strong>${d.hotelName}</strong> has just been confirmed.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:8px 0">
        ${row("Booking", d.bookingNumber)}
        ${row("Check-in", fmtDate(d.checkInDate))}
        ${row("Check-out", fmtDate(d.checkOutDate))}
        ${row("Room", d.roomType)}
        ${row("Rooms", String(d.roomsCount))}
      </table>
      ${cta(d.bookingsUrl, "View in Bookings")}`),
    };
}
