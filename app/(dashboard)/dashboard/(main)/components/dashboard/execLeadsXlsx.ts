import * as XLSX from "xlsx";
import type { LeadManagerAnalyticsData } from "../../actions/lead-manager-analytics-actions";
import {
  GROUP_SIZE_BANDS, destinationLabel, summariseByExec, type ExecBreakdownRow,
} from "../../actions/leadReportTotals";
import { dateToIstLocal } from "../../lead-report/ist";

/**
 * The lead manager's "who was given what" workbook: how many groups each
 * sales executive was handed in the range, and what kind — group size,
 * destination, source, and how they have turned out since.
 *
 * Built from the rows the analytics page already holds, so it is exactly the
 * population on screen (handovers in range, on the day of the handover) and
 * its totals reconcile with the page's tiles. Phone numbers are left out on
 * purpose: this file gets forwarded, and nobody needs them to read a split.
 *
 * Four sheets:
 *  - Summary: one row per assignee.
 *  - By destination / By source: assignee × destination and × source.
 *  - Leads: every handover, one row each, to check any number above against.
 */
export function buildExecLeadsWorkbook(
  data: LeadManagerAnalyticsData,
  opts: { generatedByName?: string } = {},
): XLSX.WorkBook {
  const rows = summariseByExec(data.reportRows);
  const total = data.reportRows.length;

  const fmtDay = (d: string) =>
    new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${d}T00:00:00`));
  const rangeLabel = data.range.from === data.range.to ? fmtDay(data.range.from) : `${fmtDay(data.range.from)} – ${fmtDay(data.range.to)}`;
  const generated = `Generated ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date())}${opts.generatedByName ? ` by ${opts.generatedByName}` : ""}`;

  // Each sheet opens with the same three lines, so a sheet copied out on its
  // own still says what it counts.
  const preamble = (title: string): (string | number | null)[][] => [
    [title],
    [`${rangeLabel} · leads counted on the day they were assigned (IST)`],
    [generated],
    [],
  ];
  const HEADER_ROW = 4; // zero-based index of each table's header row

  const typeLabel = (r: { isPartnerAgency: boolean }) => (r.isPartnerAgency ? "Partner agency" : "Our exec");
  const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);
  const top = (m: Record<string, number>) => {
    const [name, n] = Object.entries(m).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? [];
    return name ? `${name} (${n})` : "";
  };
  const avgSize = (pax: number, sized: number) => (sized > 0 ? Math.round((pax / sized) * 10) / 10 : null);
  const sum = (pick: (r: ExecBreakdownRow) => number) => rows.reduce((s, r) => s + pick(r), 0);

  // ── Summary ─────────────────────────────────────────────────────────────
  const bandLabels = GROUP_SIZE_BANDS.map((b) => b.label);
  const summaryHeader = [
    "Executive", "Type", "Groups assigned", "Share %", "Total pax", "Avg group size",
    ...bandLabels, "Size not given", "Open", "Converted", "Lost", "Conversion %",
    "Top destination", "Top source",
  ];
  const summaryBody = rows.map((r) => [
    r.name, typeLabel(r), r.groups, pct(r.groups, total), r.pax, avgSize(r.pax, r.groups - r.sizeNotGiven),
    ...GROUP_SIZE_BANDS.map((b) => r.bands[b.key]), r.sizeNotGiven,
    r.open, r.converted, r.lost, r.convRate,
    top(r.byDestination), top(r.byChannel),
  ]);
  const allPax = sum((r) => r.pax);
  const allSized = total - sum((r) => r.sizeNotGiven);
  const allConverted = sum((r) => r.converted);
  const summaryTotal = [
    "All assignees", "", total, total > 0 ? 100 : 0, allPax, avgSize(allPax, allSized),
    ...GROUP_SIZE_BANDS.map((b) => sum((r) => r.bands[b.key])), sum((r) => r.sizeNotGiven),
    sum((r) => r.open), allConverted, sum((r) => r.lost), pct(allConverted, total),
    "", "",
  ];
  const summary = sheet(
    [
      ...preamble("Leads assigned per executive"),
      summaryHeader, ...summaryBody, [], summaryTotal,
      [],
      [`For context — leads that arrived in this range: ${data.summary.receivedInRange}; still unassigned: ${data.summary.unassignedInRange}. Those are arrivals, not handovers, so they will not match the totals above.`],
    ],
    [22, 14, 10, 8, 9, 10, ...bandLabels.map(() => 8), 10, 7, 9, 7, 11, 24, 22],
    HEADER_ROW, summaryHeader.length, summaryBody.length,
  );

  // ── Pivots ──────────────────────────────────────────────────────────────
  // Columns ordered by overall volume so the ones that matter sit leftmost;
  // a zero is left blank so the counts that exist stand out.
  function pivot(title: string, pick: (r: ExecBreakdownRow) => Record<string, number>): XLSX.WorkSheet {
    const overall = new Map<string, number>();
    for (const r of rows) for (const [k, n] of Object.entries(pick(r))) overall.set(k, (overall.get(k) ?? 0) + n);
    const keys = [...overall.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k);

    const header = ["Executive", "Type", "Groups", ...keys];
    const body = rows.map((r) => [r.name, typeLabel(r), r.groups, ...keys.map((k) => pick(r)[k] ?? null)]);
    const totalRow = ["All assignees", "", total, ...keys.map((k) => overall.get(k) ?? 0)];
    return sheet(
      [...preamble(title), header, ...body, [], totalRow],
      [22, 14, 8, ...keys.map((k) => Math.min(24, Math.max(8, k.length + 2)))],
      HEADER_ROW, header.length, body.length,
    );
  }
  const byDestination = pivot("Groups per executive, by destination", (r) => r.byDestination);
  const bySource = pivot("Groups per executive, by source", (r) => r.byChannel);

  // ── Leads ───────────────────────────────────────────────────────────────
  // IST as sortable text rather than Excel dates: an Excel date has no zone,
  // and would be shifted by whatever zone the opening machine happens to use.
  const ist = (iso: string | null) => (iso ? dateToIstLocal(new Date(iso)).replace("T", " ") : "");
  const leadsHeader = ["Assigned on (IST)", "Came in (IST)", "Executive", "Type", "Lead", "Destination", "Group size", "Source", "Status"];
  const leadsBody = data.reportRows.map((q) => [
    ist(q.assignedAt), ist(q.createdAt), q.assignedToName?.trim() || "Unnamed", typeLabel(q),
    q.name, destinationLabel(q.destination), q.groupSize, q.channel, statusLabel(q.status),
  ]);
  const leads = sheet(
    [...preamble("Every lead assigned"), leadsHeader, ...leadsBody],
    [17, 17, 22, 14, 24, 18, 10, 16, 16],
    HEADER_ROW, leadsHeader.length, leadsBody.length,
  );

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, summary, "Summary");
  XLSX.utils.book_append_sheet(wb, byDestination, "By destination");
  XLSX.utils.book_append_sheet(wb, bySource, "By source");
  XLSX.utils.book_append_sheet(wb, leads, "Leads");
  return wb;
}

/** A sheet with column widths and a filter over the table (header row plus
 * body — not the totals row, which a filter would otherwise sort into the
 * middle of the data). */
function sheet(
  aoa: (string | number | null)[][],
  widths: number[],
  headerRow: number,
  cols: number,
  bodyRows: number,
): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = widths.map((wch) => ({ wch }));
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({ s: { r: headerRow, c: 0 }, e: { r: headerRow + Math.max(bodyRows, 1), c: cols - 1 } }),
  };
  return ws;
}

function statusLabel(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
}
