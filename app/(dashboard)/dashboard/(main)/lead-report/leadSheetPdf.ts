import { jsPDF } from "jspdf";
import type { LeadReportData, PlatformBlock, Platform, Medium } from "./actions";

/**
 * Draws the lead manager's daily report as a PDF, laid out to mirror the
 * handwritten sheet it replaces: the two ad platforms side by side across
 * the top, then the per-destination cost table, then the day's payments.
 *
 * Drawn from primitives rather than captured from the DOM — this is a
 * printed document, not a screenshot of the page, and it has to stay legible
 * at A4 regardless of how the dashboard is laid out on screen.
 */

const MARGIN = 14;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

/** A table header plus two rows — the least that should ever appear together
 * at the bottom of a page. */
const TABLE_KEEP = 7 + 6.2 * 2;

const INK: [number, number, number] = [24, 24, 27];
const MUTED: [number, number, number] = [113, 113, 122];
const RULE: [number, number, number] = [228, 228, 231];
const GOOGLE: [number, number, number] = [234, 67, 53];
const META: [number, number, number] = [24, 119, 242];
const NEUTRAL: [number, number, number] = [113, 113, 122];
const MONEY: [number, number, number] = [22, 132, 84];

const PLATFORM_INK: Record<Platform, [number, number, number]> = {
  GOOGLE, META, OTHER: NEUTRAL,
};

/** Ad spend for the window, typed into the report form. Kept out of the
 * database deliberately for now — see the page's own note — so it arrives
 * here as plain input alongside the queried data. */
export type SpendInput = {
  google: { budget: number | null; spent: number | null };
  meta: { budget: number | null; spent: number | null };
  /** Lower-cased destination name → spend attributed to it. */
  perDestination: Record<string, number>;
};

export const EMPTY_SPEND: SpendInput = {
  google: { budget: null, spent: null },
  meta: { budget: null, spent: null },
  perDestination: {},
};

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

function money(n: number): string {
  return `Rs ${inr.format(Math.round(n))}`;
}

/** Cost per lead, or null when either half of the division is unusable —
 * no spend entered, or no leads to divide by (a zero-lead destination still
 * costs money, and that case is reported as spend with no CPL rather than
 * as a division by zero). */
export function cpl(spent: number | null | undefined, leads: number): number | null {
  if (spent == null || !Number.isFinite(spent)) return null;
  if (leads <= 0) return null;
  return spent / leads;
}

function fmtIstRange(fromIso: string, toIso: string): string {
  const dt = (iso: string, withYear: boolean) =>
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}),
      hour: "numeric", minute: "2-digit", hour12: true,
    }).format(new Date(iso));
  return `${dt(fromIso, false)}  to  ${dt(toIso, true)}  IST`;
}

function fmtIstClock(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(iso));
}

/** "Today" / "Yesterday" / a plain date, matching the page's payment
 * headings. Resolved against the IST day so a report generated late at
 * night still names the buckets the way the reader would. */
function dayHeading(dayKey: string): string {
  const istDay = (d: Date) => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
  if (dayKey === istDay(now)) return "Today";
  if (dayKey === istDay(yesterday)) return "Yesterday";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(`${dayKey}T00:00:00`));
}

const MEDIUM_LABEL: Record<Medium, string> = {
  FORM: "form", CALL: "call", WHATSAPP: "WhatsApp",
};

function sourcePhrase(platform: Platform | null, medium: Medium | null): string {
  if (!platform || !medium) return "Direct / no lead";
  const p = platform === "OTHER" ? "Untagged" : platform === "GOOGLE" ? "Google" : "Meta";
  return `${p} ${MEDIUM_LABEL[medium]}`;
}

export function buildLeadSheetPdf(
  data: LeadReportData,
  spend: SpendInput,
  opts: { generatedByName?: string } = {},
): jsPDF {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  function ensureSpace(needed: number) {
    if (y + needed > PAGE_HEIGHT - MARGIN - 12) {
      pdf.addPage();
      y = MARGIN;
    }
  }

  function setInk(c: [number, number, number]) {
    pdf.setTextColor(c[0], c[1], c[2]);
  }

  // ── Header ────────────────────────────────────────────────────────────
  pdf.setFillColor(INK[0], INK[1], INK[2]);
  pdf.rect(0, 0, PAGE_WIDTH, 27, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(255, 255, 255);
  pdf.text("Lead Report", MARGIN, 13);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.text(fmtIstRange(data.range.from, data.range.to), MARGIN, 20.5);

  pdf.setFontSize(8);
  pdf.setTextColor(190, 190, 195);
  const stamp = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short",
  }).format(new Date());
  pdf.text(
    `Generated ${stamp}${opts.generatedByName ? ` by ${opts.generatedByName}` : ""}`,
    PAGE_WIDTH - MARGIN, 20.5, { align: "right" },
  );

  y = 27 + 9;

  // ── Summary strip ─────────────────────────────────────────────────────
  const totalSpent = (spend.google.spent ?? 0) + (spend.meta.spent ?? 0);
  const anySpend = spend.google.spent != null || spend.meta.spent != null;
  const blendedCpl = anySpend ? cpl(totalSpent, data.totals.leads) : null;

  const summary: [string, string][] = [
    ["Total leads", String(data.totals.leads)],
    ["Given to team", String(data.totals.assignedInWindow)],
    ["Cost per lead", blendedCpl != null ? money(blendedCpl) : "—"],
    ["Payments", String(data.payments.length)],
    ["Payment value", money(data.paymentsTotal)],
  ];
  const gap = 3;
  const boxW = (CONTENT_WIDTH - gap * (summary.length - 1)) / summary.length;
  ensureSpace(20);
  summary.forEach(([label, value], i) => {
    const x = MARGIN + i * (boxW + gap);
    pdf.setDrawColor(RULE[0], RULE[1], RULE[2]);
    pdf.setFillColor(250, 250, 251);
    pdf.roundedRect(x, y, boxW, 17, 2, 2, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    setInk(INK);
    pdf.text(value, x + 3.5, y + 8.5, { maxWidth: boxW - 6 });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    setInk(MUTED);
    pdf.text(label.toUpperCase(), x + 3.5, y + 13.5);
  });
  y += 24;

  // ── Section heading helper ────────────────────────────────────────────
  /** `reserve` is the height of the block that follows, so a heading is never
   * left stranded at the foot of a page with its table overleaf — the break
   * happens before the heading instead of after it. */
  function sectionTitle(title: string, subtitle?: string, reserve = 0) {
    y += 3;
    ensureSpace((subtitle ? 14 : 10) + reserve);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11.5);
    setInk(INK);
    pdf.text(title, MARGIN, y);
    y += 4;
    if (subtitle) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      setInk(MUTED);
      pdf.text(subtitle, MARGIN, y);
      y += 4;
    }
    pdf.setDrawColor(RULE[0], RULE[1], RULE[2]);
    pdf.line(MARGIN, y - 1, MARGIN + CONTENT_WIDTH, y - 1);
    y += 4;
  }

  // ── The two platform panels, side by side ─────────────────────────────
  // This is the shape of the handwritten sheet: Google on the left, Meta on
  // the right, each with its own lead split and cost figures.
  const panelGap = 6;
  const panelW = (CONTENT_WIDTH - panelGap) / 2;

  function drawPanel(x: number, top: number, block: PlatformBlock, budget: number | null, spent: number | null): number {
    const accent = PLATFORM_INK[block.platform];
    const rows: [string, string][] = [
      ["Form / mail leads", String(block.formLeads)],
      ["Calling leads", String(block.callLeads)],
      ["WhatsApp leads", String(block.whatsappLeads)],
    ];
    const costRows: [string, string][] = [];
    if (spent != null) costRows.push(["Spend used", money(spent)]);
    if (budget != null && spent != null) costRows.push(["Budget left", money(Math.max(0, budget - spent))]);

    const rowH = 5.6;
    const headerH = 11;
    const totalH = 9;
    const cplH = spent != null ? 11 : 0;
    const panelH = headerH + rows.length * rowH + totalH + costRows.length * rowH + cplH + 6;

    // Card
    pdf.setDrawColor(RULE[0], RULE[1], RULE[2]);
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(x, top, panelW, panelH, 2, 2, "FD");
    // Accent rule along the top edge
    pdf.setFillColor(accent[0], accent[1], accent[2]);
    pdf.roundedRect(x, top, panelW, 1.8, 0.9, 0.9, "F");
    pdf.rect(x, top + 0.9, panelW, 0.9, "F");

    let py = top + 8;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10.5);
    setInk(accent);
    pdf.text(`Leads by ${block.label}`, x + 4, py);
    py += 5;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    for (const [label, value] of rows) {
      setInk(MUTED);
      pdf.text(label, x + 4, py + 3);
      pdf.setFont("helvetica", "bold");
      setInk(INK);
      pdf.text(value, x + panelW - 4, py + 3, { align: "right" });
      pdf.setFont("helvetica", "normal");
      py += rowH;
    }

    // Total — boxed the way it was circled on the sheet
    py += 1.5;
    pdf.setFillColor(245, 245, 247);
    pdf.roundedRect(x + 3, py, panelW - 6, 7.5, 1.5, 1.5, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    setInk(INK);
    pdf.text(`Total ${block.label} leads`, x + 5.5, py + 5);
    pdf.text(String(block.total), x + panelW - 5.5, py + 5, { align: "right" });
    py += totalH + 1;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    for (const [label, value] of costRows) {
      setInk(MUTED);
      pdf.text(label, x + 4, py + 3);
      pdf.setFont("helvetica", "bold");
      setInk(INK);
      pdf.text(value, x + panelW - 4, py + 3, { align: "right" });
      pdf.setFont("helvetica", "normal");
      py += rowH;
    }

    if (spent != null) {
      const value = cpl(spent, block.total);
      py += 1;
      pdf.setFillColor(accent[0], accent[1], accent[2]);
      pdf.roundedRect(x + 3, py, panelW - 6, 8, 1.5, 1.5, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(255, 255, 255);
      pdf.text("Cost per lead", x + 5.5, py + 5.4);
      pdf.text(value != null ? money(value) : "no leads", x + panelW - 5.5, py + 5.4, { align: "right" });
    }

    return panelH;
  }

  sectionTitle("Leads by platform", "Where the leads in this window came from, and what they cost", 60);
  const panelTop = y;
  const hGoogle = drawPanel(MARGIN, panelTop, data.platforms[0], spend.google.budget, spend.google.spent);
  const hMeta = drawPanel(MARGIN + panelW + panelGap, panelTop, data.platforms[1], spend.meta.budget, spend.meta.spent);
  y = panelTop + Math.max(hGoogle, hMeta) + 6;

  // Untagged leads only earn a line when there are some — on a clean day
  // this section is silently absent rather than showing a row of zeroes.
  const other = data.platforms[2];
  if (other.total > 0) {
    ensureSpace(14);
    pdf.setDrawColor(RULE[0], RULE[1], RULE[2]);
    pdf.setFillColor(252, 252, 253);
    pdf.roundedRect(MARGIN, y, CONTENT_WIDTH, 11, 2, 2, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    setInk(INK);
    pdf.text(`Other / untagged: ${other.total} lead${other.total === 1 ? "" : "s"}`, MARGIN + 4, y + 4.8);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    setInk(MUTED);
    pdf.text(
      `${other.formLeads} form · ${other.callLeads} calling · ${other.whatsappLeads} WhatsApp — referrals, organic, and leads entered without a source tag.`,
      MARGIN + 4, y + 8.6,
    );
    y += 15;
  }

  // ── Destination table ─────────────────────────────────────────────────
  const destCols: { header: string; width: number; align?: "right" }[] = [
    { header: "Destination", width: 52 },
    { header: "Leads", width: 18, align: "right" },
    { header: "Google", width: 20, align: "right" },
    { header: "Meta", width: 18, align: "right" },
    { header: "Other", width: 18, align: "right" },
    { header: "Spend", width: 26, align: "right" },
    { header: "CPL", width: 30, align: "right" },
  ];

  // Destinations that took spend but produced nothing still belong on the
  // report — that's exactly the signal worth acting on — so the rows are the
  // union of what got leads and what got money.
  const destRows = [...data.destinations];
  const seen = new Set(destRows.map((d) => d.destination.toLowerCase()));
  for (const [key, amount] of Object.entries(spend.perDestination)) {
    if (amount > 0 && !seen.has(key.toLowerCase())) {
      destRows.push({
        destination: key.replace(/\b\w/g, (c) => c.toUpperCase()),
        total: 0, google: 0, meta: 0, other: 0, assigned: 0,
      });
    }
  }

  sectionTitle("Leads by destination", "Cost per lead is spend for the destination divided by its leads in this window", TABLE_KEEP);

  function drawTableHeader(cols: typeof destCols) {
    // A header stranded at the foot of a page with its rows overleaf reads as
    // a mistake, so it only gets drawn where at least a couple of rows can
    // follow it.
    ensureSpace(TABLE_KEEP);
    pdf.setFillColor(INK[0], INK[1], INK[2]);
    pdf.rect(MARGIN, y, CONTENT_WIDTH, 7, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(255, 255, 255);
    let x = MARGIN + 2.5;
    for (const col of cols) {
      pdf.text(col.header, col.align === "right" ? x + col.width - 5 : x, y + 4.7, {
        align: col.align === "right" ? "right" : "left",
      });
      x += col.width;
    }
    y += 7;
  }

  function truncate(text: string, width: number): string {
    if (pdf.getTextWidth(text) <= width - 6) return text;
    let cut = text;
    while (cut.length > 3 && pdf.getTextWidth(`${cut}…`) > width - 6) cut = cut.slice(0, -1);
    return `${cut}…`;
  }

  if (destRows.length === 0) {
    drawTableHeader(destCols);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    setInk(MUTED);
    pdf.text("No leads in this window.", MARGIN + 2.5, y + 5);
    y += 11;
  } else {
    drawTableHeader(destCols);
    destRows.forEach((row, i) => {
      ensureSpace(8);
      if (y === MARGIN) drawTableHeader(destCols);
      if (i % 2 === 1) {
        pdf.setFillColor(249, 249, 250);
        pdf.rect(MARGIN, y, CONTENT_WIDTH, 6.2, "F");
      }
      const destSpend = spend.perDestination[row.destination.toLowerCase()] ?? null;
      const destCpl = cpl(destSpend, row.total);
      const cells = [
        row.destination,
        String(row.total),
        String(row.google),
        String(row.meta),
        String(row.other),
        destSpend != null ? money(destSpend) : "—",
        destCpl != null ? money(destCpl) : destSpend != null ? "0 leads" : "—",
      ];
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      let x = MARGIN + 2.5;
      destCols.forEach((col, ci) => {
        // A destination that consumed budget and returned nothing is the one
        // row that should catch the eye when this is read on paper.
        const dead = destSpend != null && row.total === 0;
        const emphasised = ci === 0 || ci === 1;
        if (ci === 0) pdf.setFont("helvetica", "bold");
        setInk(dead ? GOOGLE : emphasised ? INK : MUTED);
        pdf.text(truncate(cells[ci], col.width), col.align === "right" ? x + col.width - 5 : x, y + 4.3, {
          align: col.align === "right" ? "right" : "left",
        });
        if (ci === 0) pdf.setFont("helvetica", "normal");
        x += col.width;
      });
      y += 6.2;
    });
    y += 6;
  }

  // ── Payments ──────────────────────────────────────────────────────────
  sectionTitle(
    "Payments received",
    "Every payment captured in this window, with the lead source it came from",
    TABLE_KEEP,
  );

  const payCols: { header: string; width: number; align?: "right" }[] = [
    { header: "Time", width: 30 },
    { header: "Client", width: 36 },
    { header: "Sales exec", width: 32 },
    { header: "Destination", width: 30 },
    { header: "Source", width: 30 },
    { header: "Amount", width: 24, align: "right" },
  ];

  if (data.payments.length === 0) {
    drawTableHeader(payCols);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    setInk(MUTED);
    pdf.text("No payments captured in this window.", MARGIN + 2.5, y + 5);
    y += 11;
  } else {
    // Grouped by IST day, matching the page: "what came in overnight" and
    // "what came in today" were separate boxes on the handwritten sheet, and
    // on a window spanning midnight one flat list loses that.
    const groups = new Map<string, typeof data.payments>();
    for (const p of data.payments) {
      const bucket = groups.get(p.dayKey) ?? [];
      bucket.push(p);
      groups.set(p.dayKey, bucket);
    }
    const days = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    for (const [dayKey, rows] of days) {
      const dayTotal = rows.reduce((sum, r) => sum + r.amount, 0);

      // Day heading — kept with its own header and first rows.
      ensureSpace(8 + TABLE_KEEP);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9.5);
      setInk(INK);
      pdf.text(dayHeading(dayKey), MARGIN, y + 4);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      setInk(MUTED);
      pdf.text(
        `${rows.length} payment${rows.length === 1 ? "" : "s"} · ${money(dayTotal)}`,
        MARGIN + CONTENT_WIDTH, y + 4, { align: "right" },
      );
      y += 7;

      drawTableHeader(payCols);
      rows.forEach((p, i) => {
        ensureSpace(8);
        if (y === MARGIN) drawTableHeader(payCols);
        if (i % 2 === 1) {
          pdf.setFillColor(249, 249, 250);
          pdf.rect(MARGIN, y, CONTENT_WIDTH, 6.2, "F");
        }
        const cells = [
          fmtIstClock(p.paidAt),
          p.clientName,
          p.agentName ?? "—",
          p.destination ?? "—",
          sourcePhrase(p.platform, p.medium),
          money(p.amount),
        ];
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        let x = MARGIN + 2.5;
        payCols.forEach((col, ci) => {
          if (ci === 5) {
            pdf.setFont("helvetica", "bold");
            setInk(MONEY);
          } else {
            setInk(ci === 1 ? INK : MUTED);
          }
          pdf.text(truncate(cells[ci], col.width), col.align === "right" ? x + col.width - 5 : x, y + 4.3, {
            align: col.align === "right" ? "right" : "left",
          });
          if (ci === 5) pdf.setFont("helvetica", "normal");
          x += col.width;
        });
        y += 6.2;
      });
      y += 4;
    }

    // Grand total across every day in the window.
    ensureSpace(9);
    pdf.setFillColor(240, 240, 242);
    pdf.rect(MARGIN, y, CONTENT_WIDTH, 7, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    setInk(INK);
    pdf.text(
      `${data.payments.length} payment${data.payments.length === 1 ? "" : "s"} in this window`,
      MARGIN + 2.5, y + 4.8,
    );
    setInk(MONEY);
    pdf.text(money(data.paymentsTotal), MARGIN + CONTENT_WIDTH - 5, y + 4.8, { align: "right" });
    y += 12;
  }

  // ── Accuracy note ─────────────────────────────────────────────────────
  // Printed on the report itself rather than only on screen, so the caveat
  // travels with the copy that gets forwarded and read away from the app.
  if (data.totals.untaggedCalls > 0) {
    ensureSpace(13);
    pdf.setFillColor(255, 251, 235);
    pdf.setDrawColor(252, 211, 77);
    pdf.roundedRect(MARGIN, y, CONTENT_WIDTH, 10, 2, 2, "FD");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(146, 100, 12);
    pdf.text(
      `Note: ${data.totals.untaggedCalls} phone lead${data.totals.untaggedCalls === 1 ? "" : "s"} in this window carried no source tag, so ${data.totals.untaggedCalls === 1 ? "it is" : "they are"} counted under "Other / untagged" rather than against Google or Meta. The calling-lead counts above are understated by that amount.`,
      MARGIN + 3.5, y + 4, { maxWidth: CONTENT_WIDTH - 7 },
    );
    y += 14;
  }

  // ── Footer ────────────────────────────────────────────────────────────
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(RULE[0], RULE[1], RULE[2]);
    pdf.line(MARGIN, PAGE_HEIGHT - 12, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 12);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    setInk(MUTED);
    pdf.text("Dreams Yatri · Lead Report", MARGIN, PAGE_HEIGHT - 7);
    pdf.text(`Page ${i} of ${pages}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 7, { align: "right" });
  }

  return pdf;
}
