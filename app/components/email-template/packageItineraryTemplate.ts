// app/lib/email/templates/packageItineraryTemplate.ts

import { buildEmail } from "./emailWrapper";
import {
  EmailLabel,
  EmailTitle,
  EmailText,
  EmailButton,
  EmailMuted,
  EmailCoverImage,
  EmailDetailsTable,
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
  shareUrl:         string;
  execName?:        string | null;
};

/**
 * Place/destination names come straight from DB fields an exec typed freehand
 * ("mysore, Kodagu") — title-cased for display so the email always reads as
 * proper nouns regardless of how it was entered, without touching the
 * underlying data.
 */
function titleCase(s: string): string {
  return s.replace(/\p{L}[\p{L}'’]*/gu, (word) =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
  );
}

export function packageItineraryTemplate(params: PackageItineraryParams): string {
  const detailRows = [
    { label: "Destination", value: titleCase(params.destination) },
    { label: "Travel Date", value: params.travelDateStr },
    { label: "Duration",    value: params.durationStr },
    { label: "Travellers",  value: params.paxLine },
  ];
  if (params.execName) {
    detailRows.push({ label: "Travel Manager", value: params.execName });
  }

  const body = `
    ${params.coverImage ? EmailCoverImage(params.coverImage, params.packageTitle) : ""}
    ${EmailLabel("Your Itinerary Is Ready")}
    ${EmailTitle(params.packageTitle)}
    ${EmailMuted(titleCase(params.routeLine))}
    <div style="height:20px;"></div>
    ${EmailText(`Dear ${params.clientName}, thank you for choosing DreamsYatri. Your customised travel itinerary has been finalised — please find the trip summary below.`)}
    ${EmailDetailsTable(detailRows)}
    ${EmailButton("View Full Itinerary and Book", params.shareUrl)}
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
    titleCase(params.routeLine),
    "",
    `Dear ${params.clientName},`,
    "",
    "Thank you for choosing DreamsYatri. Your customised travel itinerary has been finalised — here is the trip summary.",
    "",
    `Destination: ${titleCase(params.destination)}`,
    `Travel Date: ${params.travelDateStr}`,
    `Duration: ${params.durationStr}`,
    `Travellers: ${params.paxLine}`,
    params.execName ? `Travel Manager: ${params.execName}` : null,
    "",
    `View your full itinerary and book: ${params.shareUrl}`,
    "",
    "Dreams Yatri (OPC) Private Limited, Shimla, Himachal Pradesh",
    "This is an automated message. Please do not reply to this email.",
  ];

  return lines.filter((l): l is string => l !== null).join("\n");
}
