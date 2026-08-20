// ─────────────────────────────────────────────────────────────────────────────
// How the exec's document is presented as a web page.
//
// The document itself lives in the builder — it is the same DOM the PDF is
// captured from, and the client is meant to open exactly what the exec
// designed. What it MEANS to be published (builder chrome hidden, export
// fallbacks shown) is a property of that document and stays with it.
//
// How it then looks on the web is this file, and only this file. The two were
// together, which meant a change meant for the client's page was one typo away
// from the sheet that prints and the PDF that is captured. Neither builder nor
// either exporter imports this module, so nothing here can reach them.
//
// This is where website-only styling goes: widths, measures, type scale, and
// the styling of any interaction the web page grows that paper cannot have.
//
// Two knobs, both overridable per template:
//   --doc-content-width  the measure content stops at   (default 72rem, max-w-6xl)
//   the type scale below  one step up from the printed sizes
// ─────────────────────────────────────────────────────────────────────────────

export const PUBLISHED_THEME = `
@media screen {
  /* The page itself is edge to edge. No max-width here on purpose: capping
     the root is what leaves a band of dead ground down either side and puts
     the document back to looking like a sheet laid on a desk. Backgrounds,
     the masthead rule and the footer all want to reach the window edge. */
  /* Full width, unconditionally. */
  .itinerary-print-area[data-published]:not([data-exporting]) {
    width: 100% !important;
    max-width: none !important;
    min-height: 0 !important;
  }
  /* The measure lives INSIDE, the way the site's own header and sections do
     it: the bar spans the window, its contents stop at a width you can read
     across. The masthead row, the stats card, the body and the footer's
     columns all carry this; the hero does not, because a cover photo should
     fill the window. */
  .itinerary-print-area[data-published]:not([data-exporting]) .screen-space {
    max-width: var(--doc-content-width, 72rem);
    margin-inline: auto;
    width: 100%;
  }

  /* ── Type, one step up ────────────────────────────────────────────────
     Every size in this document is a hard pixel value — around a hundred
     of them — because it was drawn to print at 210mm. There is no base
     font-size to raise: setting one moves nothing at all.
     Set for paper, it also reads small on a screen, which is held further
     away than a sheet is. So each size is restated a step larger, and only
     here: the sheet that prints and the PDF that is captured keep the
     sizes they were designed with. Listed rather than scaled so any one of
     them can be tuned without moving the rest. */
  .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[7px\\] { font-size: 8px; }
  .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[7\\.5px\\] { font-size: 8.5px; }
  .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[8px\\] { font-size: 9px; }
  .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[8\\.5px\\] { font-size: 9.5px; }
  .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[9px\\] { font-size: 10px; }
  .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[9\\.5px\\] { font-size: 10.5px; }
  .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[10px\\] { font-size: 11px; }
  .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[10\\.5px\\] { font-size: 11.5px; }
  .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[11px\\] { font-size: 12.5px; }
  .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[11\\.5px\\] { font-size: 13px; }
  .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[12px\\] { font-size: 13.5px; }
  .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[12\\.5px\\] { font-size: 14px; }
  .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[13px\\] { font-size: 14.5px; }
  .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[16px\\] { font-size: 18px; }
  .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[32px\\] { font-size: 36px; }
  .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[34px\\] { font-size: 38px; }
  .itinerary-print-area[data-published]:not([data-exporting]) .text-xs { font-size: 13.5px; }
  .itinerary-print-area[data-published]:not([data-exporting]) .text-sm { font-size: 15.5px; }
  .itinerary-print-area[data-published]:not([data-exporting]) .text-base { font-size: 18px; }
  .itinerary-print-area[data-published]:not([data-exporting]) .text-lg { font-size: 20px; }
  .itinerary-print-area[data-published]:not([data-exporting]) .text-xl { font-size: 22px; }
}
`;
