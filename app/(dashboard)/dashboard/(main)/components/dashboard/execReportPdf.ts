import { jsPDF } from "jspdf";
import type { LeadRow } from "../../actions/lead-manager-analytics-actions";
import {
  GROUP_MIN_PERSONS, describeExecFilters, destinationLabel, execReportTitle, summariseBy, summariseByExec,
  tallyLeads, type ExecReportFilters, type LeadTally,
} from "../../actions/leadReportTotals";
import { IST_TZ } from "../../lead-report/ist";
import { resolveRgb } from "./pdf-color";

const MARGIN = 14;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

type Col = { header: string; width: number; align?: "left" | "right" };

/**
 * The lead manager's exec report: who was handed which leads in the range,
 * narrowed by the filters on the page. Deliberately plain — a heading, four
 * numbers, and tables — and it drops any breakdown that would be a single
 * row, so one filter set reads as a per-exec report and another as a single
 * exec's or a single destination's without a separate layout for each.
 *
 * @param rows Handovers in range with the filters already applied.
 */
export function buildExecReportPdf(
  rows: LeadRow[],
  opts: {
    filters: ExecReportFilters;
    assigneeName?: string;
    range: { from: string; to: string };
    includeLeadList: boolean;
    generatedByName?: string;
  },
): jsPDF {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const primary = resolveRgb("var(--color-dashboard-primary)");
  let y = MARGIN;

  function ensureSpace(needed: number) {
    if (y + needed > PAGE_HEIGHT - MARGIN - 10) {
      pdf.addPage();
      y = MARGIN;
    }
  }

  // ── Heading ─────────────────────────────────────────────────────────────
  const fmtDay = (d: string) =>
    new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${d}T00:00:00`));
  const rangeLabel = opts.range.from === opts.range.to
    ? fmtDay(opts.range.from)
    : `${fmtDay(opts.range.from)}  –  ${fmtDay(opts.range.to)}`;

  pdf.setFillColor(...primary);
  pdf.rect(0, 0, PAGE_WIDTH, 26, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(17);
  pdf.text(execReportTitle(opts.filters, opts.assigneeName), MARGIN, 13);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.text(rangeLabel, MARGIN, 20.5);
  pdf.setFontSize(8.5);
  pdf.text(
    `Generated ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: IST_TZ }).format(new Date())}${opts.generatedByName ? ` by ${opts.generatedByName}` : ""}`,
    PAGE_WIDTH - MARGIN, 20.5, { align: "right" },
  );
  y = 34;

  pdf.setFontSize(8.5);
  pdf.setTextColor(90, 90, 90);
  const filterLine = describeExecFilters(opts.filters, opts.assigneeName);
  const scope = `Leads assigned in this range, counted on the day of assignment (IST). A group is ${GROUP_MIN_PERSONS} or more persons.`;
  for (const line of [scope, filterLine.length ? `Filters: ${filterLine.join(" · ")}` : "Filters: none — every lead assigned in the range."]) {
    const wrapped = pdf.splitTextToSize(line, CONTENT_WIDTH) as string[];
    pdf.text(wrapped, MARGIN, y);
    y += wrapped.length * 4;
  }
  y += 3;

  // ── Four numbers ────────────────────────────────────────────────────────
  const total = tallyLeads(rows);
  const stats: [string, string][] = [
    ["Leads", String(total.leads)],
    [`Groups (${GROUP_MIN_PERSONS}+ persons)`, String(total.groups)],
    ["Persons", total.sizeNotGiven ? `${total.persons}*` : String(total.persons)],
    ["Converted", `${total.converted} (${total.convRate}%)`],
  ];
  const gap = 3;
  const boxW = (CONTENT_WIDTH - gap * (stats.length - 1)) / stats.length;
  stats.forEach(([label, value], i) => {
    const x = MARGIN + i * (boxW + gap);
    pdf.setFillColor(250, 250, 251);
    pdf.setDrawColor(232, 233, 236);
    pdf.roundedRect(x, y, boxW, 17, 2, 2, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(...primary);
    pdf.text(value, x + 4, y + 8.5);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(105, 105, 110);
    pdf.text(label, x + 4, y + 13.5);
  });
  y += 21;
  if (total.sizeNotGiven) {
    pdf.setFontSize(7.5);
    pdf.setTextColor(120, 120, 120);
    pdf.text(`* ${total.sizeNotGiven} lead${total.sizeNotGiven === 1 ? "" : "s"} gave no group size and ${total.sizeNotGiven === 1 ? "is" : "are"} not in the persons count.`, MARGIN, y);
    y += 5;
  }

  // ── Table drawing ───────────────────────────────────────────────────────
  function sectionTitle(title: string) {
    y += 5;
    ensureSpace(20);
    pdf.setFillColor(...primary);
    pdf.roundedRect(MARGIN, y - 3.2, 2, 4.2, 0.6, 0.6, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(20, 20, 20);
    pdf.text(title, MARGIN + 4.5, y);
    y += 4;
  }

  function drawTable<T>(cols: Col[], body: T[], cell: (row: T, ci: number) => string, totalRow?: string[]) {
    const rowH = 6.5;
    const headH = 7;
    const cellX = (ci: number) => MARGIN + 2 + cols.slice(0, ci).reduce((s, c) => s + c.width, 0);

    function writeRow(values: string[], bold: boolean) {
      pdf.setFont("helvetica", bold ? "bold" : "normal");
      values.forEach((text, ci) => {
        const col = cols[ci];
        const room = col.width - 4;
        let t = text;
        while (t.length > 1 && pdf.getTextWidth(t) > room) t = t.slice(0, -2) + "…";
        const x = col.align === "right" ? cellX(ci) + col.width - 4 : cellX(ci);
        pdf.text(t, x, y + 4.5, { align: col.align === "right" ? "right" : "left" });
      });
    }
    function header() {
      pdf.setFillColor(31, 41, 55);
      pdf.rect(MARGIN, y, CONTENT_WIDTH, headH, "F");
      pdf.setFontSize(8);
      pdf.setTextColor(255, 255, 255);
      writeRow(cols.map((c) => c.header), true);
      y += headH;
    }

    header();
    pdf.setFontSize(8);
    body.forEach((row, ri) => {
      ensureSpace(rowH + 2);
      if (y === MARGIN) header();
      if (ri % 2 === 1) {
        pdf.setFillColor(248, 249, 251);
        pdf.rect(MARGIN, y, CONTENT_WIDTH, rowH, "F");
      }
      pdf.setFontSize(8);
      pdf.setTextColor(40, 40, 40);
      writeRow(cols.map((_, ci) => cell(row, ci)), false);
      y += rowH;
    });
    if (totalRow) {
      ensureSpace(rowH + 2);
      pdf.setDrawColor(31, 41, 55);
      pdf.line(MARGIN, y, MARGIN + CONTENT_WIDTH, y);
      pdf.setFontSize(8);
      pdf.setTextColor(20, 20, 20);
      writeRow(totalRow, true);
      y += rowH;
    }
    y += 4;
  }

  const num = (n: number) => String(n);
  const tallyCells = (t: LeadTally) => [num(t.leads), num(t.groups), num(t.persons), num(t.converted)];
  const breakdownCols = (first: string): Col[] => [
    { header: first, width: 82 },
    { header: "Leads", width: 25, align: "right" },
    { header: `Groups ${GROUP_MIN_PERSONS}+`, width: 25, align: "right" },
    { header: "Persons", width: 25, align: "right" },
    { header: "Converted", width: 25, align: "right" },
  ];

  // ── Per executive ───────────────────────────────────────────────────────
  const execs = summariseByExec(rows);
  if (execs.length > 1) {
    sectionTitle("Per executive");
    drawTable(
      [
        { header: "Executive", width: 44 },
        { header: "Leads", width: 16, align: "right" },
        { header: `Groups ${GROUP_MIN_PERSONS}+`, width: 18, align: "right" },
        { header: "Persons", width: 18, align: "right" },
        { header: "Open", width: 14, align: "right" },
        { header: "Won", width: 14, align: "right" },
        { header: "Lost", width: 14, align: "right" },
        { header: "Conv %", width: 16, align: "right" },
        { header: "Top destination", width: 28 },
      ],
      execs,
      (r, ci) => {
        const top = Object.entries(r.byDestination).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
        return [
          r.isPartnerAgency ? `${r.name} (agency)` : r.name,
          num(r.leads), num(r.groups), num(r.persons), num(r.open), num(r.converted), num(r.lost),
          `${r.convRate}%`, top ? top[0] : "",
        ][ci];
      },
      ["Total", num(total.leads), num(total.groups), num(total.persons), num(total.open), num(total.converted), num(total.lost), `${total.convRate}%`, ""],
    );
  }

  // ── By destination / by source ──────────────────────────────────────────
  const byDest = summariseBy(rows, (q) => destinationLabel(q.destination));
  if (byDest.length > 1) {
    sectionTitle("By destination");
    drawTable(breakdownCols("Destination"), byDest, (r, ci) => [r.name, ...tallyCells(r)][ci], ["Total", ...tallyCells(total)]);
  }
  const bySource = summariseBy(rows, (q) => q.channel);
  if (bySource.length > 1) {
    sectionTitle("By source");
    drawTable(breakdownCols("Source"), bySource, (r, ci) => [r.name, ...tallyCells(r)][ci], ["Total", ...tallyCells(total)]);
  }

  // ── Every lead ──────────────────────────────────────────────────────────
  if (opts.includeLeadList) {
    const when = new Intl.DateTimeFormat("en-IN", {
      timeZone: IST_TZ, day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
    });
    const status = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
    sectionTitle(`Every lead (${rows.length})`);
    drawTable(
      [
        { header: "Assigned (IST)", width: 28 },
        { header: "Lead", width: 34 },
        { header: "Executive", width: 32 },
        { header: "Destination", width: 28 },
        { header: "Persons", width: 18, align: "right" },
        { header: "Source", width: 22 },
        { header: "Status", width: 20 },
      ],
      rows,
      (q, ci) => [
        q.assignedAt ? when.format(new Date(q.assignedAt)) : "—",
        q.name,
        q.assignedToName?.trim() || "Unnamed",
        destinationLabel(q.destination),
        q.groupSize != null && q.groupSize > 0 ? num(q.groupSize) : "—",
        q.channel,
        status(q.status),
      ][ci],
    );
  }

  // ── Footer, once the page count is known ────────────────────────────────
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(228, 229, 233);
    pdf.line(MARGIN, PAGE_HEIGHT - 12, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 12);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(140, 140, 140);
    pdf.text("Dreams Yatri · Exec Report", MARGIN, PAGE_HEIGHT - 7);
    pdf.text(`Page ${i} of ${pages}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 7, { align: "right" });
  }

  return pdf;
}
