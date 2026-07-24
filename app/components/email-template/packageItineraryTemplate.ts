// app/lib/email/templates/packageItineraryTemplate.ts

import { buildEmail } from "./emailWrapper";
import {
  EmailLabel,
  EmailTitle,
  EmailText,
  EmailButton,
  EmailDivider,
  EmailMuted,
  EmailCoverImage,
  EmailDetailsTable,
  EmailPricePanel,
} from "./emailBlocks";

type PackageItineraryParams = {
  clientName:       string;
  packageTitle:     string;
  routeLine:        string;
  coverImage?:      string | null;
  destination:      string;
  travelDateStr:    string;
  durationStr:      string;
  paxLine:          string;
  priceStr:         string;
  perPersonStr?:    string | null;
  shareUrl:         string;
  hasPdfAttachment: boolean;
  execName?:        string | null;
  execEmail?:       string | null;
};

export function packageItineraryTemplate(params: PackageItineraryParams): string {
  const detailRows = [
    { label: "Destination", value: params.destination },
    { label: "Travel Date", value: params.travelDateStr },
    { label: "Duration",    value: params.durationStr },
    { label: "Travellers",  value: params.paxLine },
  ];
  if (params.execName) {
    detailRows.push({ label: "Travel Manager", value: params.execName });
  }

  const closingText = params.execName
    ? `For any questions or changes to this plan, please contact your travel manager, ${params.execName}${params.execEmail ? ` (${params.execEmail})` : ""}.`
    : "For any questions or changes to this plan, please get in touch with our team.";

  const body = `
    ${params.coverImage ? EmailCoverImage(params.coverImage, params.packageTitle) : ""}
    ${EmailLabel("Your Itinerary Is Ready")}
    ${EmailTitle(params.packageTitle)}
    ${EmailMuted(params.routeLine)}
    <div style="height:20px;"></div>
    ${EmailText(`Dear ${params.clientName}, thank you for choosing DreamsYatri. Your customised travel itinerary has been finalised — please find the trip summary and pricing below.`)}
    ${EmailDetailsTable(detailRows)}
    ${EmailButton("View Full Itinerary and Book", params.shareUrl)}
    ${params.hasPdfAttachment ? EmailMuted("A detailed PDF copy of this itinerary is attached to this email.") : ""}
    ${EmailDivider()}
    ${EmailMuted(closingText)}
  `;

  return buildEmail(body);
}

/**
 * Plain-text alternative for the same email — every send should include one
 * alongside the HTML (see sendEmail's `text` param): it's what plain-text/
 * screen-reader clients render, and its absence hurts spam scoring since a
 * legitimate transactional email normally has both parts (multipart/
 * alternative), not HTML-only.
 */
export function packageItineraryTextTemplate(params: PackageItineraryParams): string {
  // `null` = line omitted entirely; `""` = an intentional blank line kept for
  // paragraph spacing — filtered separately so the two aren't conflated.
  const lines: (string | null)[] = [
    `Your itinerary is ready — ${params.packageTitle}`,
    params.routeLine,
    "",
    `Dear ${params.clientName},`,
    "",
    "Thank you for choosing DreamsYatri. Your customised travel itinerary has been finalised — here is the trip summary and pricing.",
    "",
    `Destination: ${params.destination}`,
    `Travel Date: ${params.travelDateStr}`,
    `Duration: ${params.durationStr}`,
    `Travellers: ${params.paxLine}`,
    params.execName ? `Travel Manager: ${params.execName}` : null,
    "",
    `Total Package Price: ${params.priceStr}`,
    params.perPersonStr ? params.perPersonStr : null,
    "",
    `View your full itinerary and book: ${params.shareUrl}`,
    "",
    params.hasPdfAttachment ? "A detailed PDF copy of this itinerary is attached to this email." : null,
    "",
    params.execName
      ? `For any questions or changes to this plan, please contact your travel manager, ${params.execName}${params.execEmail ? ` (${params.execEmail})` : ""}.`
      : "For any questions or changes to this plan, please get in touch with our team.",
    "",
    "Dreams Yatri (OPC) Private Limited, Shimla, Himachal Pradesh",
    "This is an automated message. Please do not reply to this email.",
  ];

  return lines.filter((l): l is string => l !== null).join("\n");
}
