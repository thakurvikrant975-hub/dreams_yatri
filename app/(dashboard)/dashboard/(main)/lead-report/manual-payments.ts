import { istDayKey, istLocalToDate } from "./ist";
import type { PaymentRow, Platform, Medium } from "./actions";

/**
 * Offline payments — cash and bank transfers taken outside the gateway, which
 * never reach the `payments` table and so can't be queried like the rest.
 * They're typed into the report and kept in the browser until the offline
 * flow records them properly, at which point this whole module goes away.
 *
 * Held in one list rather than bucketed per report-window, so a payment
 * entered once shows up in every window that covers it — a payment belongs to
 * the moment it was taken, not to the report it was first typed into.
 */

export type ManualPayment = {
  id: string;
  /** IST wall-clock, as the datetime-local input produces it. */
  paidAtLocal: string;
  clientName: string;
  agentName: string;
  destination: string;
  platform: Platform | null;
  medium: Medium | null;
  amount: number;
};

const KEY = "dy_lead_report_manual_payments";

/** Entries older than this are dropped on load. Without it the list grows for
 * as long as the browser profile lives, and a payment from last year has no
 * business being carried around for a report that can't reach back that far. */
const KEEP_DAYS = 120;

function isManualPayment(v: unknown): v is ManualPayment {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  return typeof p.id === "string"
    && typeof p.paidAtLocal === "string"
    && typeof p.clientName === "string"
    && typeof p.amount === "number"
    && Number.isFinite(p.amount);
}

export function loadManualPayments(): ManualPayment[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const cutoff = new Date(Date.now() - KEEP_DAYS * 24 * 3600 * 1000);
    return parsed.filter(isManualPayment).filter((p) => istLocalToDate(p.paidAtLocal) >= cutoff);
  } catch {
    return [];
  }
}

export function saveManualPayments(list: ManualPayment[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Private windows and blocked site data mean the entry isn't remembered
    // past this session. The report still builds from what's on screen.
  }
}

/** The ones falling inside the report's window, as report rows. Compared as
 * IST wall-clock strings on both sides, which is exactly what the window and
 * the input are already expressed in — no timezone arithmetic needed. */
export function manualRowsInWindow(
  list: ManualPayment[],
  fromLocal: string,
  toLocal: string,
): PaymentRow[] {
  return list
    .filter((p) => p.paidAtLocal >= fromLocal && p.paidAtLocal <= toLocal)
    .map((p) => {
      const paidAt = istLocalToDate(p.paidAtLocal);
      return {
        id: p.id,
        paidAt: paidAt.toISOString(),
        dayKey: istDayKey(paidAt),
        amount: p.amount,
        bookingNumber: "—",
        clientName: p.clientName,
        agentName: p.agentName.trim() || null,
        destination: p.destination.trim() || null,
        platform: p.platform,
        medium: p.medium,
        gateway: "OFFLINE",
        isManual: true,
      };
    });
}

/** The source dropdown's options, flattened — a platform and a medium is two
 * questions to answer for what reads as one fact ("it was a Google call"). */
export const SOURCE_OPTIONS: { value: string; label: string; platform: Platform | null; medium: Medium | null }[] = [
  { value: "", label: "Direct / walk-in", platform: null, medium: null },
  { value: "GOOGLE:FORM", label: "Google form", platform: "GOOGLE", medium: "FORM" },
  { value: "GOOGLE:CALL", label: "Google call", platform: "GOOGLE", medium: "CALL" },
  { value: "GOOGLE:WHATSAPP", label: "Google WhatsApp", platform: "GOOGLE", medium: "WHATSAPP" },
  { value: "META:FORM", label: "Meta form", platform: "META", medium: "FORM" },
  { value: "META:CALL", label: "Meta call", platform: "META", medium: "CALL" },
  { value: "META:WHATSAPP", label: "Meta WhatsApp", platform: "META", medium: "WHATSAPP" },
  { value: "OTHER:CALL", label: "Referral / other", platform: "OTHER", medium: "CALL" },
];
