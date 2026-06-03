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
