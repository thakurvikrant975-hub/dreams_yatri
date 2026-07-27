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

    ${EmailDashedDivider()}

    ${EmailImageStrip(barcodeUrl, "Payment reference", barcodeRef)}

    ${EmailButton("View Booking", params.bookingUrl)}

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
