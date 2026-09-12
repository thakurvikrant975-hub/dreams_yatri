import { jsPDF } from "jspdf";
import { resolveRgb } from "../../components/dashboard/pdf-color";
import { STATUS_CONFIG, SOURCE_CONFIG } from "../../components/dashboard/CustomBadges";
import type { PackageQuery } from "./actions";

const MARGIN = 12;
const PAGE_WIDTH = 297;
const PAGE_HEIGHT = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

type Col = { header: string; width: number; align?: "left" | "right" };

/** Builds a self-contained, drawn-from-scratch report PDF — same manual
 * rect/text approach as leadReportPdf.ts, landscape instead of portrait since
 * a per-query row table needs more columns than a portrait page's ~180mm
 * width comfortably fits without truncating everything. */
export function buildQueriesReportPdf(
  queries: PackageQuery[],
  opts: { filterSummary?: string; generatedByName?: string } = {},
): jsPDF {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  let y = MARGIN;

  const primary = resolveRgb("var(--color-dashboard-primary)");

  function ensureSpace(needed: number) {
    if (y + needed > PAGE_HEIGHT - MARGIN - 10) {
      pdf.addPage();
      y = MARGIN;
    }
  }

  // ── Header banner ─────────────────────────────────────────────────────
  const bannerHeight = 22;
  pdf.setFillColor(...primary);
  pdf.rect(0, 0, PAGE_WIDTH, bannerHeight, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(17);
  pdf.setTextColor(255, 255, 255);
  pdf.text("Queries Report", MARGIN, 13);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.text(
    `Generated ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}${opts.generatedByName ? ` by ${opts.generatedByName}` : ""}`,
    PAGE_WIDTH - MARGIN, 13, { align: "right" },
  );

  pdf.setFontSize(9);
  pdf.text(`${queries.length} quer${queries.length === 1 ? "y" : "ies"}`, MARGIN, 19);

  y = bannerHeight + 6;

  // ── Active-filter summary — makes the exported file self-explanatory
  // once it's off-screen and shared, instead of just a bare row list. ───────
  if (opts.filterSummary) {
    ensureSpace(9);
    pdf.setFillColor(248, 249, 251);
    pdf.setDrawColor(232, 233, 236);
    pdf.roundedRect(MARGIN, y, CONTENT_WIDTH, 7.5, 1.5, 1.5, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(90, 90, 90);
    pdf.text("Filtered by:", MARGIN + 3, y + 5);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(60, 60, 60);
    pdf.text(opts.filterSummary, MARGIN + 22, y + 5, { maxWidth: CONTENT_WIDTH - 25 });
    y += 11;
  } else {
    y += 2;
  }

  // ── Table ──────────────────────────────────────────────────────────────
  const cols: Col[] = [
    { header: "Lead Name",    width: 42 },
    { header: "Phone",        width: 28 },
    { header: "Destination",  width: 36 },
    { header: "Days",         width: 14, align: "right" },
    { header: "Status",       width: 30 },
    { header: "Source",       width: 26 },
    { header: "Assigned To",  width: 34 },
    { header: "Received",     width: 32 },
  ];

  const rowHeight = 7;
  const headerHeight = 8;

  function drawHeader() {
    pdf.setFillColor(31, 41, 55);
    pdf.rect(MARGIN, y, CONTENT_WIDTH, headerHeight, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor(255, 255, 255);
    let x = MARGIN + 2.5;
    for (const col of cols) {
      pdf.text(col.header, col.align === "right" ? x + col.width - 4 : x, y + 5.3, { align: col.align === "right" ? "right" : "left" });
      x += col.width;
    }
    y += headerHeight;
  }

  if (queries.length === 0) {
    drawHeader();
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(140, 140, 140);
    pdf.text("No queries match the current filters.", MARGIN + 2.5, y + 6);
    y += 12;
  } else {
    drawHeader();
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    queries.forEach((q, ri) => {
      ensureSpace(rowHeight + 2);
      if (y === MARGIN) drawHeader();
      if (ri % 2 === 1) {
        pdf.setFillColor(248, 249, 251);
        pdf.rect(MARGIN, y, CONTENT_WIDTH, rowHeight, "F");
      }

      const days = q.requirements?.journey?.noOfDays;
      const cells = [
        q.name || "—",
        q.phone || "—",
        q.destination || "—",
        days != null ? String(days) : "—",
        STATUS_CONFIG[q.status]?.label ?? q.status,
        SOURCE_CONFIG[q.source]?.label ?? q.source,
        q.assignedToName || "Unassigned",
        new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(q.createdAt)),
      ];

      pdf.setTextColor(40, 40, 40);
      let x = MARGIN + 2.5;
      cols.forEach((col, ci) => {
        const text = cells[ci];
        const truncated = pdf.getTextWidth(text) > col.width - 5
          ? text.slice(0, Math.max(3, Math.floor((col.width - 5) / (pdf.getTextWidth(text) / text.length)))) + "…"
          : text;
        pdf.text(truncated, col.align === "right" ? x + col.width - 4 : x, y + 4.8, { align: col.align === "right" ? "right" : "left" });
        x += col.width;
      });
      y += rowHeight;
    });
  }

  // ── Footer — page numbers on every page ──────────────────────────────
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(228, 229, 233);
    pdf.line(MARGIN, PAGE_HEIGHT - 10, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 10);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(140, 140, 140);
    pdf.text("Dreams Yatri · Queries Report", MARGIN, PAGE_HEIGHT - 5.5);
    pdf.text(`Page ${i} of ${totalPages}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 5.5, { align: "right" });
  }

  return pdf;
}
