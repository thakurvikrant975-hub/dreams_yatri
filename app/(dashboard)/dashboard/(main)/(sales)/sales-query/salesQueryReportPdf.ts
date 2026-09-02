import { jsPDF } from "jspdf";
import { resolveRgb } from "../../components/dashboard/pdf-color";
import type { SalesQueryRow } from "./actions";

const MARGIN = 14;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

type Col = { header: string; width: number; align?: "left" | "right" };

function statusLabel(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
}
function fmtDate(d: Date | null) {
  return d ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "2-digit" }).format(new Date(d)) : "—";
}

export type SalesQueryReportSummary = {
  totalCount: number;
  newToday: number;
  inProgress: number;
  followUpCount: number;
  closedCount: number;
  bookedCount: number;
  convRate: number;
};

/** Drawn-from-scratch report PDF (no DOM capture) — same structure as
 * leadReportPdf.ts: brand banner, a stat-box row, one paginated data table.
 * Manages its own page breaks and re-draws the table header on every new page. */
export function buildSalesQueryReportPdf(
  rows: SalesQueryRow[],
  summary: SalesQueryReportSummary,
  opts: { from: string; to: string; isAllTime: boolean; generatedByName?: string },
): jsPDF {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  const primary   = resolveRgb("var(--color-dashboard-primary)");
  const info      = resolveRgb("var(--color-dashboard-info)");
  const success   = resolveRgb("var(--color-dashboard-success)");
  const warning   = resolveRgb("var(--color-dashboard-warning)");
  const secondary = resolveRgb("var(--color-dashboard-secondary)");
  const accent    = resolveRgb("var(--color-dashboard-accent)");

  function ensureSpace(needed: number) {
    if (y + needed > PAGE_HEIGHT - MARGIN - 10) {
      pdf.addPage();
      y = MARGIN;
    }
  }

  // ── Header banner ─────────────────────────────────────────────────────
  const bannerHeight = 26;
  pdf.setFillColor(...primary);
  pdf.rect(0, 0, PAGE_WIDTH, bannerHeight, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(19);
  pdf.setTextColor(255, 255, 255);
  pdf.text("Sales Query Report", MARGIN, 14);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  const rangeLabel = opts.isAllTime
    ? "All Time"
    : `${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${opts.from}T00:00:00`))}  –  ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${opts.to}T00:00:00`))}`;
  pdf.setTextColor(255, 255, 255);
  pdf.text(rangeLabel, MARGIN, 21);

  pdf.setFontSize(8.5);
  pdf.text(
    `Generated ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}${opts.generatedByName ? ` by ${opts.generatedByName}` : ""}`,
    PAGE_WIDTH - MARGIN, 21, { align: "right" },
  );

  y = bannerHeight + 10;

  // ── Summary stats ─────────────────────────────────────────────────────
  const stats: [string, string | number, [number, number, number]][] = [
    ["Total queries", summary.totalCount, primary],
    ["New today", summary.newToday, info],
    ["In progress", summary.inProgress, warning],
    ["Follow up", summary.followUpCount, [217, 119, 6]],
    ["Closed", summary.closedCount, success],
    ["Converted", summary.bookedCount, secondary],
    ["Conv. rate", `${summary.convRate}%`, accent],
  ];
  const statGap = 2.5;
  const statBoxWidth = (CONTENT_WIDTH - statGap * (stats.length - 1)) / stats.length;
  ensureSpace(22);
  stats.forEach(([label, value, accentColor], i) => {
    const x = MARGIN + i * (statBoxWidth + statGap);
    pdf.setFillColor(250, 250, 251);
    pdf.setDrawColor(232, 233, 236);
    pdf.roundedRect(x, y, statBoxWidth, 20, 2, 2, "FD");
    pdf.setFillColor(...accentColor);
    pdf.roundedRect(x, y, statBoxWidth, 2.2, 1, 1, "F");
    pdf.rect(x, y + 1.1, statBoxWidth, 1.1, "F");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(...accentColor);
    pdf.text(String(value), x + 3.5, y + 11.5);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.6);
    pdf.setTextColor(105, 105, 110);
    pdf.text(label, x + 3.5, y + 16.5, { maxWidth: statBoxWidth - 6 });
  });
  y += 28;

  function sectionTitle(title: string, subtitle?: string) {
    y += 5;
    ensureSpace(subtitle ? 13 : 9);
    pdf.setFillColor(...primary);
    pdf.roundedRect(MARGIN, y - 3.2, 2, 4.2, 0.6, 0.6, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12.5);
    pdf.setTextColor(20, 20, 20);
    pdf.text(title, MARGIN + 4.5, y);
    y += 5.5;
    if (subtitle) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(120, 120, 120);
      pdf.text(subtitle, MARGIN + 4.5, y);
      y += 5.5;
    }
    y += 1.5;
  }

  // ── Generic table drawer ─────────────────────────────────────────────
  function drawTable<T>(cols: Col[], data: T[], cellText: (row: T, colIndex: number) => string) {
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

    if (data.length === 0) {
      drawHeader();
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(140, 140, 140);
      pdf.text("No queries in this range.", MARGIN + 2, y + 5);
      y += 10;
      return;
    }

    drawHeader();
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.6);
    data.forEach((row, ri) => {
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
          ? text.slice(0, Math.max(3, Math.floor((col.width - 5) / (pdf.getTextWidth(text) / (text.length || 1))))) + "…"
          : text;
        pdf.text(truncated, col.align === "right" ? x + col.width - 4 : x, y + 4.5, { align: col.align === "right" ? "right" : "left" });
        x += col.width;
      });
      y += rowHeight;
    });
    y += 8;
  }

  sectionTitle("Queries", `${rows.length} quer${rows.length === 1 ? "y" : "ies"} in this range`);
  drawTable(
    [
      { header: "Date", width: 20 },
      { header: "Lead", width: 38 },
      { header: "Phone", width: 26 },
      { header: "Destination", width: 30 },
      { header: "Status", width: 26 },
      { header: "Source", width: 20 },
      { header: "Assigned To", width: 22 },
      { header: "Travel Date", width: 18, align: "right" },
    ],
    rows,
    (q, ci) => {
      switch (ci) {
        case 0: return fmtDate(q.createdAt);
        case 1: return q.name;
        case 2: return q.phone;
        case 3: return q.destination ?? "—";
        case 4: return statusLabel(q.status);
        case 5: return statusLabel(q.source);
        case 6: return q.assignedToName ?? "—";
        case 7: return fmtDate(q.travelDate);
        default: return "";
      }
    },
  );

  // ── Footer — page numbers, added last so the final count is known ──────
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(228, 229, 233);
    pdf.line(MARGIN, PAGE_HEIGHT - 12, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 12);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(140, 140, 140);
    pdf.text("Dreams Yatri · Sales Query Report", MARGIN, PAGE_HEIGHT - 7);
    pdf.text(`Page ${i} of ${totalPages}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 7, { align: "right" });
  }

  return pdf;
}
