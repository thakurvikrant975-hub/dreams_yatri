import { jsPDF } from "jspdf";
import type { LeadManagerAnalyticsData } from "../../actions/lead-manager-analytics-actions";

const MARGIN = 14;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

type Col = { header: string; width: number; align?: "left" | "right" };

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}
function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
function statusLabel(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
}

/** Builds a self-contained, drawn-from-scratch report PDF (no DOM capture —
 * this is a data report, not a screenshot of the UI). Manages its own page
 * breaks and re-draws the table header on every new page. */
export function buildLeadReportPdf(data: LeadManagerAnalyticsData, opts: { generatedByName?: string } = {}): jsPDF {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  function ensureSpace(needed: number) {
    if (y + needed > PAGE_HEIGHT - MARGIN) {
      pdf.addPage();
      y = MARGIN;
    }
  }

  // ── Header ────────────────────────────────────────────────────────────
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(20, 20, 20);
  pdf.text("Lead Report", MARGIN, y);
  y += 8;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(90, 90, 90);
  const fromLabel = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${data.range.from}T00:00:00`));
  const toLabel = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${data.range.to}T00:00:00`));
  pdf.text(`Range: ${fromLabel} - ${toLabel}`, MARGIN, y);
  pdf.text(`Generated: ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}${opts.generatedByName ? ` by ${opts.generatedByName}` : ""}`, PAGE_WIDTH - MARGIN, y, { align: "right" });
  y += 8;
  pdf.setDrawColor(220, 220, 220);
  pdf.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 8;

  // ── Summary stats ─────────────────────────────────────────────────────
  const stats: [string, string | number][] = [
    ["Today's leads", data.summary.todayLeads],
    ["Total leads (range)", data.summary.totalLeads],
    ["Converted", data.summary.converted],
    ["Conversion rate", `${data.summary.convRate}%`],
    ["Destinations reached", data.summary.uniqueDestinations],
  ];
  const statBoxWidth = CONTENT_WIDTH / stats.length;
  ensureSpace(20);
  stats.forEach(([label, value], i) => {
    const x = MARGIN + i * statBoxWidth;
    pdf.setFillColor(246, 247, 249);
    pdf.roundedRect(x, y, statBoxWidth - 3, 18, 2, 2, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(20, 20, 20);
    pdf.text(String(value), x + 4, y + 9);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(110, 110, 110);
    pdf.text(label, x + 4, y + 14.5, { maxWidth: statBoxWidth - 7 });
  });
  y += 26;

  // ── Generic table drawer ─────────────────────────────────────────────
  function drawTable<T>(title: string, cols: Col[], rows: T[], cellText: (row: T, colIndex: number) => string) {
    ensureSpace(14);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(20, 20, 20);
    pdf.text(title, MARGIN, y);
    y += 6;

    const rowHeight = 6.5;
    const headerHeight = 7;

    function drawHeader() {
      pdf.setFillColor(31, 41, 55);
      pdf.rect(MARGIN, y, CONTENT_WIDTH, headerHeight, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(255, 255, 255);
      let x = MARGIN + 2;
      for (const col of cols) {
        pdf.text(col.header, col.align === "right" ? x + col.width - 4 : x, y + 4.8, { align: col.align === "right" ? "right" : "left" });
        x += col.width;
      }
      y += headerHeight;
    }

    if (rows.length === 0) {
      drawHeader();
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(140, 140, 140);
      pdf.text("No data in this range.", MARGIN + 2, y + 5);
      y += 10;
      return;
    }

    drawHeader();
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    rows.forEach((row, ri) => {
      ensureSpace(rowHeight + 2);
      if (y === MARGIN) drawHeader();
      if (ri % 2 === 1) {
        pdf.setFillColor(248, 249, 251);
        pdf.rect(MARGIN, y, CONTENT_WIDTH, rowHeight, "F");
      }
      pdf.setTextColor(40, 40, 40);
      let x = MARGIN + 2;
      cols.forEach((col, ci) => {
        const text = cellText(row, ci);
        const truncated = pdf.getTextWidth(text) > col.width - 5
          ? text.slice(0, Math.max(3, Math.floor((col.width - 5) / (pdf.getTextWidth(text) / text.length)))) + "…"
          : text;
        pdf.text(truncated, col.align === "right" ? x + col.width - 4 : x, y + 4.5, { align: col.align === "right" ? "right" : "left" });
        x += col.width;
      });
      y += rowHeight;
    });
    y += 8;
  }

  // ── Leads by destination ─────────────────────────────────────────────
  const destTotal = data.byDestination.reduce((s, d) => s + d.value, 0) || 1;
  drawTable(
    "Leads by Destination",
    [{ header: "Destination", width: 100 }, { header: "Leads", width: 40, align: "right" }, { header: "Share", width: 40, align: "right" }],
    data.byDestination,
    (d, ci) => (ci === 0 ? d.name : ci === 1 ? String(d.value) : `${Math.round((d.value / destTotal) * 100)}%`),
  );

  // ── Leads by source/channel ───────────────────────────────────────────
  const chTotal = data.byChannel.reduce((s, c) => s + c.value, 0) || 1;
  drawTable(
    "Leads by Source",
    [{ header: "Source", width: 100 }, { header: "Leads", width: 40, align: "right" }, { header: "Share", width: 40, align: "right" }],
    data.byChannel,
    (c, ci) => (ci === 0 ? c.name : ci === 1 ? String(c.value) : `${Math.round((c.value / chTotal) * 100)}%`),
  );

  // ── Full leads table ──────────────────────────────────────────────────
  const leadCols: Col[] = [
    { header: "Date", width: 22 },
    { header: "Name", width: 30 },
    { header: "Phone", width: 24 },
    { header: "Destination", width: 26 },
    { header: "Source", width: 24 },
    { header: "Status", width: 26 },
    { header: "Assigned To", width: 28 },
  ];
  drawTable(
    `All Leads (${data.reportRows.length})`,
    leadCols,
    data.reportRows,
    (row, ci) => {
      switch (ci) {
        case 0: return `${fmtDate(row.createdAt)} ${fmtTime(row.createdAt)}`;
        case 1: return row.name;
        case 2: return row.phone;
        case 3: return row.destination?.trim() || "—";
        case 4: return row.channel;
        case 5: return statusLabel(row.status);
        case 6: return row.assignedToName || "Unassigned";
        default: return "";
      }
    },
  );

  return pdf;
}
