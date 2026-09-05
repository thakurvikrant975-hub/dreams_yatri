"use server";

import { getCurrentAgency } from "@/app/lib/auth-partner";
import { getAgencyLeadsForCopy, parseLeadFilters } from "./actions";
import { leadsToText } from "./lead-format";

/**
 * "Copy all N" — the text for every lead the current filters match, not just
 * the page on screen.
 *
 * Two things arrive from the browser and neither is trusted: the agency is
 * resolved here from the session rather than passed in, and the filters are
 * re-parsed from their raw query string by the same function the page uses,
 * so a hand-edited request can only ever narrow this agency's own leads.
 */
export async function copyFilteredLeads(query: Record<string, string>): Promise<
  | { ok: true; text: string; count: number; truncated: boolean; total: number }
  | { ok: false; error: string }
> {
  const agency = await getCurrentAgency();
  if (!agency) return { ok: false, error: "Your session has expired — please sign in again." };

  const filters = { ...parseLeadFilters(query), page: 1 };
  const { rows, truncated, total } = await getAgencyLeadsForCopy(agency.id, filters);

  if (!rows.length) return { ok: false, error: "No leads match these filters." };

  return { ok: true, text: leadsToText(rows), count: rows.length, truncated, total };
}
