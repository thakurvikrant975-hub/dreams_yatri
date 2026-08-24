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
//   --doc-content-width  the measure content stops at   (default 56rem, max-w-4xl)
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
    max-width: var(--doc-content-width, 56rem);
    margin-inline: auto;
    width: 100%;
  }

  /* ── A texture on the paper ───────────────────────────────────────────
     The document's ground is one flat near-white, which on paper is exactly
     right and on a screen reads as empty rather than as stock. A faint grain
     gives the page something to sit on, and makes the white cards above it
     read as cards.

     Painted as a background-image so the inline paper colour stays the base
     layer underneath — the two compose rather than compete, and a template
     that changes its paper keeps its own colour showing through the dots.

     Deliberately weak. It is behind a client's quote, not a hero section:
     at 0.055 alpha it registers as texture and never as pattern, and every
     block that carries text — the cards, the hero, the dark footer — paints
     its own opaque ground on top, so nothing is ever read across it.

     For cross-hatch instead of dots, swap the two properties below for:
       background-image:
         repeating-linear-gradient(0deg,  VAR 0 1px, transparent 1px 100%),
         repeating-linear-gradient(90deg, VAR 0 1px, transparent 1px 100%);
       background-size: 26px 26px;
     Both knobs are custom properties, so a template can retune or remove the
     texture without touching this file. */
  .itinerary-print-area[data-published]:not([data-exporting]) {
    background-image:
      radial-gradient(var(--doc-texture-ink, rgba(15, 23, 42, 0.055)) 1px, transparent 1px);
    background-size: var(--doc-texture-size, 22px) var(--doc-texture-size, 22px);
    background-position: 0 0;
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

  /* ── Masthead contacts, collapsed on a phone ──────────────────────────
     The helpline and email sit beside the logo on paper, where the measure
     is 210mm and there is always room. At 390px they wrap onto their own
     line under the logo, so the first thing the client sees on opening
     their itinerary is two lines of our contact details. Collapsed behind
     a toggle instead, one tap from the reader who wants them.

     Screen only, by sitting inside the @media screen block above: the
     sheet this page prints (there is a Print button on it) is untouched
     and still carries the contacts inline, open or closed. */
  @media (max-width: 639.98px) {
    .itinerary-print-area[data-published] .masthead-contact {
      width: 100%;
      height: auto;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.375rem;
      padding-top: 0.625rem;
    }
    .itinerary-print-area[data-published] .masthead-contact:not([data-open]) {
      display: none;
    }
  }

  /* Above the phone breakpoint the contacts are simply always there, so the
     button has nothing to do. */
  @media (min-width: 640px) {
    .itinerary-print-area[data-published] .masthead-contact-toggle { display: none; }
  }
}

/* The toggle is an affordance of this page, not of the document, so paper
   never shows it — including the sheet printed from this very page, which is
   why this rule sits outside the @media screen block above rather than in it. */
@media print {
  .masthead-contact-toggle { display: none !important; }
}
`;
