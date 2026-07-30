// app/lib/email/templates/hotelsAndCabsConfirmedTemplate.ts

import { buildEmail } from "./emailWrapper";
import {
  EmailLabel,
  EmailTitle,
  EmailText,
  EmailButton,
  EmailDetailsTable,
  EmailMuted,
} from "./emailBlocks";

export type HotelsAndCabsConfirmedParams = {
  clientName:    string;
  bookingNumber: string;
  packageTitle:  string;
  travelDateStr: string; // e.g. "12 Aug 2026 – 16 Aug 2026"
  paxLine:       string; // e.g. "3 Adults"
  voucherUrl:    string;
  statusUrl:     string;
};

export function hotelsAndCabsConfirmedTemplate(params: HotelsAndCabsConfirmedParams): string {
  const detailRows = [
    { label: "Booking ID",   value: params.bookingNumber },
    { label: "Travel Dates", value: params.travelDateStr },
    { label: "Travellers",   value: params.paxLine },
  ];

  const body = `
    ${EmailLabel("Hotels & Cabs Confirmed")}
    ${EmailTitle(params.packageTitle)}
    ${EmailText(`Dear ${params.clientName}, great news — every hotel and cab for your trip has been confirmed by our team. Your voucher is ready.`)}
    ${EmailDetailsTable(detailRows)}
    ${EmailButton("View Your Voucher", params.voucherUrl)}
    ${EmailMuted(`You can also track live status and re-download your voucher anytime from your <a href="${params.statusUrl}" style="color:#dc2626;">trip status page</a>.`)}
  `;

  return buildEmail(body);
}

export function hotelsAndCabsConfirmedTextTemplate(params: HotelsAndCabsConfirmedParams): string {
  const lines = [
    `Hotels & cabs confirmed — ${params.packageTitle}`,
    "",
    `Dear ${params.clientName},`,
    "",
    "Great news — every hotel and cab for your trip has been confirmed by our team. Your voucher is ready.",
    "",
    `Booking ID: ${params.bookingNumber}`,
    `Travel Dates: ${params.travelDateStr}`,
    `Travellers: ${params.paxLine}`,
    "",
    `View your voucher: ${params.voucherUrl}`,
    `Track live status: ${params.statusUrl}`,
    "",
    "Dreams Yatri (OPC) Private Limited, Shimla, Himachal Pradesh",
    "This is an automated message. Please do not reply to this email.",
  ];
  return lines.join("\n");
}
