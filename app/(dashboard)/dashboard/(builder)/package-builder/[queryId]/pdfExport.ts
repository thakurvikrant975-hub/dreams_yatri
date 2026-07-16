import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

export type PdfPage = {
  dataUrl: string;
  /** Rendered image height in mm at A4 (210mm) width — the last page (or any
   * page shortened to avoid slicing through a card) is naturally shorter
   * than a full 297mm; the PDF page below it is just left blank. */
  heightMm: number;
};

/** Elements the document already marks as "don't split across a page break"
 * (breakInside/breakAfter: avoid, used throughout ItineraryDocument for
 * cards, tables, section headers) — read back off computed style so this
 * stays in sync with that markup without needing a second source of truth. */
function findUnsafeRanges(root: HTMLElement): { top: number; bottom: number }[] {
  const rootTop = root.getBoundingClientRect().top;
  const ranges: { top: number; bottom: number }[] = [];
  const all = root.querySelectorAll<HTMLElement>("*");
  for (const el of all) {
    const style = getComputedStyle(el);
    if (style.breakInside === "avoid" || style.breakInside === "avoid-page") {
      const rect = el.getBoundingClientRect();
      if (rect.height <= 0) continue;
      ranges.push({ top: rect.top - rootTop, bottom: rect.bottom - rootTop });
    }
  }
  return ranges;
}

/** Walks down the content computing where each page should end. A tentative
 * cut at `pageHeightPx` gets pushed back to the start of whichever "unsafe"
 * (don't-split) block it would otherwise fall inside of — same effect as
 * print's break-inside:avoid, except we control the result directly instead
 * of hoping the browser's own paginator agrees. */
function computePageBreaks(totalHeightPx: number, pageHeightPx: number, unsafeRanges: { top: number; bottom: number }[]): number[] {
  const breaks: number[] = [];
  let cursor = 0;
  while (cursor < totalHeightPx) {
    let next = Math.min(cursor + pageHeightPx, totalHeightPx);
    const blocking = unsafeRanges.find((r) => r.top < next && next < r.bottom && r.top > cursor);
    if (blocking) {
      // Only push back if that still leaves a non-trivial page — an
      // oversized block taller than one full page can't be avoided, so let
      // it get cut rather than looping forever on zero progress.
      if (blocking.top - cursor > pageHeightPx * 0.15) {
        next = blocking.top;
      }
    }
    breaks.push(next);
    cursor = next;
  }
  return breaks;
}

/**
 * Captures `root` (must already be laid out at exactly 210mm CSS width, with
 * natural height for its full content) and slices it into A4 page images.
 * `useCORS: true` is required for any hotel/activity photo served from a
 * different origin — if that origin doesn't send CORS headers, that specific
 * image will render blank in the capture (a canvas/CORS limitation, not
 * something this code can work around).
 */
export async function captureToPdfPages(root: HTMLElement, scale = 2): Promise<PdfPage[]> {
  const rootWidthPx = root.offsetWidth;
  const pageHeightPx = rootWidthPx * (A4_HEIGHT_MM / A4_WIDTH_MM);
  const unsafeRanges = findUnsafeRanges(root);

  const canvas = await html2canvas(root, {
    scale,
    useCORS: true,
    backgroundColor: "#ffffff",
    windowWidth: rootWidthPx,
  });

  const totalHeightPx = canvas.height / scale;
  const breaksPx = computePageBreaks(totalHeightPx, pageHeightPx, unsafeRanges);

  const pages: PdfPage[] = [];
  let cursorPx = 0;
  for (const breakPx of breaksPx) {
    const sliceHeightPx = breakPx - cursorPx;
    if (sliceHeightPx <= 0) { cursorPx = breakPx; continue; }

    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceHeightPx * scale;
    const ctx = sliceCanvas.getContext("2d")!;
    ctx.drawImage(
      canvas,
      0, cursorPx * scale, canvas.width, sliceHeightPx * scale,
      0, 0, canvas.width, sliceHeightPx * scale,
    );

    pages.push({
      dataUrl: sliceCanvas.toDataURL("image/jpeg", 0.92),
      heightMm: (sliceHeightPx / rootWidthPx) * A4_WIDTH_MM,
    });
    cursorPx = breakPx;
  }

  return pages;
}

export function buildPdf(pages: PdfPage[]): jsPDF {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  pages.forEach((page, i) => {
    if (i > 0) pdf.addPage();
    pdf.addImage(page.dataUrl, "JPEG", 0, 0, A4_WIDTH_MM, page.heightMm);
  });
  return pdf;
}
