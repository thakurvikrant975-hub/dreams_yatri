/**
 * One spelling of a lead, shared by the server page and the client table.
 *
 * The copy buttons live in the browser but the table is rendered on the
 * server, so both sides format the same row — keeping the formatting here
 * means what an agency copies is character-for-character what it sees.
 *
 * No "server-only" import in this file: the client table imports the type.
 */
export type PartnerLeadRow = {
  id: string;
  receivedAt: string;
  name: string;
  phone: string;
  email: string | null;
  destination: string | null;
  groupSize: number | null;
  travelDate: string | null;
};

/** IST throughout: the agency works the same hours we do, and "2 hours ago"
 * cannot be checked against a call log. */
export const fmtDateTime = (iso: string) => new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata", day: "numeric", month: "short",
  hour: "numeric", minute: "2-digit", hour12: true,
}).format(new Date(iso));

export const fmtDate = (iso: string | null) => iso
  ? new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric",
    }).format(new Date(iso))
  : "—";

/**
 * A lead as text to paste into WhatsApp, a CRM or an email.
 *
 * Fields the customer never gave are left out rather than written as a dash —
 * a pasted "Email: —" reads like a value, and the agency would ring us about
 * it. Name and phone are always present in the row, so a block never comes
 * out empty.
 */
export function leadToText(l: PartnerLeadRow): string {
  const lines = [
    `Name: ${l.name}`,
    `Phone: ${l.phone}`,
    l.email ? `Email: ${l.email}` : null,
    l.destination ? `Destination: ${l.destination}` : null,
    l.groupSize ? `People: ${l.groupSize}` : null,
    l.travelDate ? `Travel date: ${fmtDate(l.travelDate)}` : null,
  ];
  return lines.filter(Boolean).join("\n");
}

/** Several leads, one blank line apart — the shape a phone keyboard pastes well. */
export const leadsToText = (rows: PartnerLeadRow[]) =>
  rows.map(leadToText).join("\n\n");
