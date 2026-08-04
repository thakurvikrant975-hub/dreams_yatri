// app/lib/email/templates/paymentInvoiceTemplate.ts

import { buildEmail } from "./emailWrapper";
import {
  EmailTitle,
  EmailText,
  EmailButton,
  EmailDashedDivider,
  EmailTwoColumnRow,
  EmailDetailsTable,
  EmailInfoPanel,
  EmailImageStrip,
  EmailMuted,
} from "./emailBlocks";

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://dreamsyatri.org";

export type PaymentInvoiceParams = {
  clientName:       string;
  bookingNumber:    string;
  amountStr:        string;
  paidAtStr:        string;
  paymentMethod:    string;
  transactionId:    string;
  bookingUrl:        string;
  /**
   * Full invoice figures, taken from the SAME buildInvoiceViewModel the web
   * invoice and dashboard invoice render — so a customer comparing the emailed
   * receipt against the printable one never sees two different sets of numbers.
   * Optional so a caller that genuinely has no booking context still sends the
   * plain payment confirmation rather than an invoice with blank totals.
   */
  invoice?: {
    lineItemLabel: string;
    lineItemDetail: string | null;
    taxableStr:    string;
    gstStr:        string;
    gstPct:        number;
    totalStr:      string;
    paidStr:       string;
    balanceStr:    string;
    invoiceUrl:    string;
  };
};

export function paymentInvoiceTemplate(params: PaymentInvoiceParams): string {
  const barcodeRef = `${params.bookingNumber}-${params.transactionId}`;
  const barcodeUrl = `${SITE_URL}/api/invoice-barcode?ref=${encodeURIComponent(barcodeRef)}`;

  const body = `
    <div style="text-align:center;margin:0 0 4px;font-size:40px;line-height:1;">🎉</div>
    <div style="text-align:center;">
      ${EmailTitle("Thank You!")}
    </div>
    <p style="margin:-16px 0 28px;text-align:center;font-size:14px;color:#6b7280;">
      Your payment has been received successfully
    </p>

    ${EmailDashedDivider()}

    ${EmailTwoColumnRow(
      { label: "Booking ID", value: params.bookingNumber },
      { label: "Amount Paid", value: params.amountStr },
    )}
    ${EmailDetailsTable([{ label: "Date & Time", value: params.paidAtStr }])}
    ${EmailInfoPanel([
      { label: "Payment Method", value: params.paymentMethod },
      { label: "Transaction ID", value: params.transactionId },
    ])}

    ${params.invoice ? `
    ${EmailDashedDivider()}
    <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#374151;">Invoice summary</p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;font-size:14px;">
      <tr>
        <td style="padding:10px 12px;color:#374151;border-bottom:1px solid #e5e7eb;">
          ${params.invoice.lineItemLabel}
          ${params.invoice.lineItemDetail ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;">${params.invoice.lineItemDetail}</div>` : ""}
        </td>
        <td style="padding:10px 12px;text-align:right;color:#374151;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${params.invoice.taxableStr}</td>
      </tr>
      ${params.invoice.gstPct > 0 ? `
      <tr>
        <td style="padding:10px 12px;color:#6b7280;border-bottom:1px solid #e5e7eb;">GST (${params.invoice.gstPct}%)</td>
        <td style="padding:10px 12px;text-align:right;color:#6b7280;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${params.invoice.gstStr}</td>
      </tr>` : ""}
      <tr>
        <td style="padding:10px 12px;font-weight:700;color:#111827;">Total</td>
        <td style="padding:10px 12px;text-align:right;font-weight:700;color:#111827;white-space:nowrap;">${params.invoice.totalStr}</td>
      </tr>
      <tr>
        <td style="padding:6px 12px;color:#6b7280;">Amount paid</td>
        <td style="padding:6px 12px;text-align:right;color:#111827;white-space:nowrap;">${params.invoice.paidStr}</td>
      </tr>
      <tr>
        <td style="padding:6px 12px;color:#6b7280;border-top:1px solid #e5e7eb;">Balance due</td>
        <td style="padding:6px 12px;text-align:right;font-weight:600;color:#111827;border-top:1px solid #e5e7eb;white-space:nowrap;">${params.invoice.balanceStr}</td>
      </tr>
    </table>
    ` : ""}

    ${EmailDashedDivider()}

    ${EmailImageStrip(barcodeUrl, "Payment reference", barcodeRef)}

    ${params.invoice
      ? EmailButton("View &amp; print invoice", params.invoice.invoiceUrl)
      : EmailButton("View Booking", params.bookingUrl)}

    ${EmailText(`Dear ${params.clientName}, this email confirms your payment for booking ${params.bookingNumber}. Keep this for your records.`)}
    ${EmailMuted("This is a payment receipt, not a travel voucher — your booking/travel documents are shared separately.")}
  `;

  return buildEmail(body);
}

export function paymentInvoiceTextTemplate(params: PaymentInvoiceParams): string {
  const lines = [
    "Thank you! Your payment has been received successfully.",
    "",
    `Booking ID: ${params.bookingNumber}`,
    `Amount Paid: ${params.amountStr}`,
    `Date & Time: ${params.paidAtStr}`,
    `Payment Method: ${params.paymentMethod}`,
    `Transaction ID: ${params.transactionId}`,
    ...(params.invoice
      ? [
          "",
          "INVOICE SUMMARY",
          `${params.invoice.lineItemLabel}${params.invoice.lineItemDetail ? ` (${params.invoice.lineItemDetail})` : ""}: ${params.invoice.taxableStr}`,
          ...(params.invoice.gstPct > 0 ? [`GST (${params.invoice.gstPct}%): ${params.invoice.gstStr}`] : []),
          `Total: ${params.invoice.totalStr}`,
          `Amount paid: ${params.invoice.paidStr}`,
          `Balance due: ${params.invoice.balanceStr}`,
          "",
          `View & print invoice: ${params.invoice.invoiceUrl}`,
        ]
      : []),
    "",
    `View your booking: ${params.bookingUrl}`,
    "",
    `Dear ${params.clientName}, this email confirms your payment for booking ${params.bookingNumber}. Keep this for your records.`,
    "This is a payment receipt, not a travel voucher — your booking/travel documents are shared separately.",
    "",
    "Dreams Yatri (OPC) Private Limited, Shimla, Himachal Pradesh",
    "This is an automated message. Please do not reply to this email.",
  ];
  return lines.join("\n");
}
