import { jsPDF } from "jspdf";
import type { LeadManagerAnalyticsData } from "../../actions/lead-manager-analytics-actions";

const MARGIN = 14;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

type Col = { header: string; width: number; align?: "left" | "right" };

/** Chart colors are CSS (var(--color-dashboard-primary), oklch(), hex, named
 * colors, …) since they're shared with the on-screen recharts components —
 * jsPDF needs plain RGB triples. Resolving var() via getComputedStyle and
 * then letting a 1x1 canvas parse whatever's left is the only way to handle
 * every color form (including oklch) without hand-rolling a CSS color
 * parser; cached since the same handful of colors repeat across the report. */
const colorCache = new Map<string, [number, number, number]>();
function resolveRgb(color: string): [number, number, number] {
  const cached = colorCache.get(color);
  if (cached) return cached;

  let resolved = color;
  if (resolved.startsWith("var(")) {
    const varName = resolved.slice(4, -1).trim();
    resolved = getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || "#6b7280";
  }
  let rgb: [number, number, number] = [107, 114, 128];
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = resolved;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    rgb = [r, g, b];
  } catch {
    // fall back to the default gray above
  }
  colorCache.set(color, rgb);
  return rgb;
}

/** Builds a self-contained, drawn-from-scratch report PDF (no DOM capture —
 * this is a data report, not a screenshot of the UI). Manages its own page
 * breaks and re-draws section headers on every new page. */
export function buildLeadReportPdf(data: LeadManagerAnalyticsData, opts: { generatedByName?: string } = {}): jsPDF {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  // Brand palette, resolved once from the same CSS custom properties the
  // on-screen dashboard uses — keeps the PDF visually consistent with the
  // app instead of looking like a generic plain-text export.
  const primary   = resolveRgb("var(--color-dashboard-primary)");
  const info      = resolveRgb("var(--color-dashboard-info)");
  const success   = resolveRgb("var(--color-dashboard-success)");
  const warning   = resolveRgb("var(--color-dashboard-warning)");
  const secondary = resolveRgb("var(--color-dashboard-secondary)");

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
  pdf.text("Lead Report", MARGIN, 14);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  const fromLabel = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${data.range.from}T00:00:00`));
  const toLabel = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${data.range.to}T00:00:00`));
  pdf.setTextColor(255, 255, 255);
  pdf.text(`${fromLabel}  –  ${toLabel}`, MARGIN, 21);

  pdf.setFontSize(8.5);
  pdf.text(
    `Generated ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}${opts.generatedByName ? ` by ${opts.generatedByName}` : ""}`,
    PAGE_WIDTH - MARGIN, 21, { align: "right" },
  );

  y = bannerHeight + 10;

  // ── Summary stats ─────────────────────────────────────────────────────
  const stats: [string, string | number, [number, number, number]][] = [
    ["Today's leads", data.summary.todayLeads, primary],
    ["Total leads (range)", data.summary.totalLeads, info],
    ["Converted", data.summary.converted, success],
    ["Conversion rate", `${data.summary.convRate}%`, warning],
    ["Destinations reached", data.summary.uniqueDestinations, secondary],
  ];
  const statGap = 3;
  const statBoxWidth = (CONTENT_WIDTH - statGap * (stats.length - 1)) / stats.length;
  ensureSpace(22);
  stats.forEach(([label, value, accent], i) => {
    const x = MARGIN + i * (statBoxWidth + statGap);
    pdf.setFillColor(250, 250, 251);
    pdf.setDrawColor(232, 233, 236);
    pdf.roundedRect(x, y, statBoxWidth, 20, 2, 2, "FD");
    // Colored top accent strip — clipped to the card's rounded top edge via a
    // slightly-inset thin rect rather than a hard-cornered overlay.
    pdf.setFillColor(...accent);
    pdf.roundedRect(x, y, statBoxWidth, 2.2, 1, 1, "F");
    pdf.rect(x, y + 1.1, statBoxWidth, 1.1, "F");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(...accent);
    pdf.text(String(value), x + 4, y + 11.5);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.2);
    pdf.setTextColor(105, 105, 110);
    pdf.text(label, x + 4, y + 16.5, { maxWidth: statBoxWidth - 7 });
  });
  y += 28;

  function sectionTitle(title: string, subtitle?: string) {
    // Extra breathing room above every section heading — otherwise a
    // heading landed right up against the previous table's last row with
    // barely any visual separation between sections.
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
  function drawTable<T>(cols: Col[], rows: T[], cellText: (row: T, colIndex: number) => string) {
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

  // ── Leads by destination (quick totals) ───────────────────────────────
  const destTotal = data.byDestination.reduce((s, d) => s + d.value, 0) || 1;
  sectionTitle("Leads by Destination");
  drawTable(
    [{ header: "Destination", width: 100 }, { header: "Leads", width: 40, align: "right" }, { header: "Share", width: 40, align: "right" }],
    data.byDestination,
    (d, ci) => (ci === 0 ? d.name : ci === 1 ? String(d.value) : `${Math.round((d.value / destTotal) * 100)}%`),
  );

  // ── Leads by source/channel ───────────────────────────────────────────
  const chTotal = data.byChannel.reduce((s, c) => s + c.value, 0) || 1;
  sectionTitle("Leads by Source");
  drawTable(
    [{ header: "Source", width: 100 }, { header: "Leads", width: 40, align: "right" }, { header: "Share", width: 40, align: "right" }],
    data.byChannel,
    (c, ci) => (ci === 0 ? c.name : ci === 1 ? String(c.value) : `${Math.round((c.value / chTotal) * 100)}%`),
  );

  // ── Destination x source breakdown — "for Gujarat, how many leads from
  // which source" — for every destination, a mini bar per source. ─────────
  sectionTitle("Destination-wise Source Breakdown", "How each destination's leads split across marketing sources");

  const rowH = 6;
  const headerH = 9;
  const blockGap = 5;
  const dotX = MARGIN + 3;
  const nameX = MARGIN + 8;
  const barX = MARGIN + 64;
  const barWidth = 76;
  const trackHeight = 3;

  if (data.destinationChannelBreakdown.length === 0) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(140, 140, 140);
    pdf.text("No data in this range.", MARGIN, y + 4);
    y += 12;
  }

  data.destinationChannelBreakdown.forEach((dest) => {
    const blockHeight = headerH + dest.channels.length * rowH + blockGap;
    ensureSpace(blockHeight);

    // Header bar — destination name + total-leads badge, right-aligned.
    pdf.setFillColor(243, 244, 246);
    pdf.roundedRect(MARGIN, y, CONTENT_WIDTH, headerH - 2, 1.5, 1.5, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10.5);
    pdf.setTextColor(30, 30, 30);
    pdf.text(dest.destination, MARGIN + 3, y + 5);

    const badgeText = `${dest.total} lead${dest.total !== 1 ? "s" : ""}`;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    const badgeW = pdf.getTextWidth(badgeText) + 6;
    const badgeX = MARGIN + CONTENT_WIDTH - badgeW - 2.5;
    pdf.setFillColor(31, 41, 55);
    pdf.roundedRect(badgeX, y + 1.2, badgeW, 5, 2.5, 2.5, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.text(badgeText, badgeX + badgeW / 2, y + 4.6, { align: "center" });

    y += headerH;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.3);
    dest.channels.forEach((ch) => {
      const [r, g, b] = resolveRgb(ch.color);
      const share = dest.total > 0 ? ch.value / dest.total : 0;

      pdf.setFillColor(r, g, b);
      pdf.circle(dotX, y + rowH / 2 - 0.4, 1.3, "F");

      pdf.setTextColor(60, 60, 60);
      pdf.text(ch.name, nameX, y + rowH / 2 + 1);

      pdf.setFillColor(233, 234, 238);
      pdf.roundedRect(barX, y + 1.1, barWidth, trackHeight, 1, 1, "F");
      const fillW = Math.max(1.5, barWidth * share);
      pdf.setFillColor(r, g, b);
      pdf.roundedRect(barX, y + 1.1, fillW, trackHeight, 1, 1, "F");

      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(45, 45, 45);
      pdf.text(`${ch.value} (${Math.round(share * 100)}%)`, MARGIN + CONTENT_WIDTH - 2, y + rowH / 2 + 1, { align: "right" });
      pdf.setFont("helvetica", "normal");

      y += rowH;
    });

    y += blockGap;
  });

  // ── Leads by team member ──────────────────────────────────────────────
  const memberTotal = data.byTeamMember.reduce((s, m) => s + m.value, 0) || 1;
  sectionTitle("Leads by Team Member", "How many leads (in this range) are currently assigned to each sales exec");
  drawTable(
    [{ header: "Team Member", width: 110 }, { header: "Leads Assigned", width: 45, align: "right" }, { header: "Share", width: 25, align: "right" }],
    data.byTeamMember,
    (m, ci) => (ci === 0 ? m.name : ci === 1 ? String(m.value) : `${Math.round((m.value / memberTotal) * 100)}%`),
  );

  // ── Footer — page numbers on every page, added last so the final count
  // is known. ──────────────────────────────────────────────────────────
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(228, 229, 233);
    pdf.line(MARGIN, PAGE_HEIGHT - 12, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 12);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(140, 140, 140);
    pdf.text("Dreams Yatri · Lead Report", MARGIN, PAGE_HEIGHT - 7);
    pdf.text(`Page ${i} of ${totalPages}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 7, { align: "right" });
  }

  return pdf;
}
