// app/lib/email/templates/bookingConfirmationTemplate.ts

import { buildEmail } from "./emailWrapper";
import {
  EmailLabel,
  EmailTitle,
  EmailText,
  EmailAlert,
  EmailDivider,
  EmailMuted,
} from "./emailBlocks";

export function bookingConfirmationTemplate(name: string, destination: string, date: string): string {
  const body = `
    ${EmailLabel("Booking Confirmed")}
    ${EmailTitle(`Your trip to ${destination} is booked!`)}
    ${EmailText(`Hi ${name}, your booking has been confirmed. Our team will reach out within 24 hours with your full itinerary.`)}
    ${EmailAlert(`Departure date: <strong>${date}</strong>`)}
    ${EmailDivider()}
    ${EmailMuted("For any queries, contact us at support@dreamsyatri.com or call +91-XXXXXXXXXX.")}
  `;

  return buildEmail(body);
}