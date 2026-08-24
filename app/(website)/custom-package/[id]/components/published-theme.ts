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


// ── The background doodles ───────────────────────────────────────────────────
// Pulled out of the tile so they are editable without reading a 1,900-character
// data URI. Change these two and nothing else.
//
// DOODLE_INK is a plain hex colour: the "#" is percent-encoded into the URI
// below, which is why it does not appear as one there.
const DOODLE_INK = "#0f172a";
/** How present the pattern is. 0.13 reads as pattern while keeping text over
 *  it at 11:1; 0.08 is a whisper, 0.20 is assertive. */
const DOODLE_OPACITY = 0.09;
/** Outline by default. Set true for solid silhouettes — but see the note in
 *  the tile: several glyphs are open line work and need redrawing to fill
 *  properly, so this is not yet a flag worth flipping. */
const DOODLE_FILLED = false;

const DOODLE_PAINT = DOODLE_FILLED
  ? `fill='${DOODLE_INK.replace("#", "%23")}' fill-opacity='${DOODLE_OPACITY}' stroke='none' `
  : `stroke='${DOODLE_INK.replace("#", "%23")}' stroke-opacity='${DOODLE_OPACITY}' `;

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
    /* clip, not hidden. The document is clipped either way, but overflow
       hidden makes the element a scroll container, and a scroll container is
       what position: sticky measures itself against — so the masthead below
       would stick to a box that never scrolls, which looks exactly like not
       being sticky at all. Clip clips without creating one, leaving sticky to
       measure against the viewport, where it belongs.
       The hero clips itself, so nothing here depends on the root's own. */
    overflow: clip !important;
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

  /* ── A doodled travel pattern on the paper ────────────────────────────
     Dots gave the page grain but said nothing. These are the things the
     document is about — a plane, a palm, a compass, a camera, a mountain, a
     sun, a suitcase, a pin, a ticket — drawn as open line work and set very
     faint, so the paper feels like a travel company's stock rather than a
     blank sheet.

     Seamless by construction rather than by wrap-around maths: every glyph is
     placed well inside the 220px tile, so nothing is clipped at an edge and
     the tile repeats cleanly in both directions. The nine sit at varied
     angles and uneven positions so a repeating tile does not read as a grid.

     An inline SVG data URI, so it is one HTTP request fewer than an asset and
     cannot 404 — and it stays entirely inside this stylesheet, which is what
     keeps it off the printed sheet and out of the PDF.

     Strength is baked into stroke-opacity because a data URI cannot read a
     custom property. At 0.13 the lines register as pattern and text over them
     still measures 11.04:1 against a 4.5 floor — and only the package
     description sits on the paper directly; every other block paints its own
     opaque ground. To soften or strengthen it, that one number in the URI
     below is the knob; the tile scale stays a custom property. */
  .itinerary-print-area[data-published]:not([data-exporting]) {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220' viewBox='0 0 220 220'%3E%3Cg ${DOODLE_FILLED ? '' : "fill='none' "}${DOODLE_PAINT}stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cg transform='translate(26 30) rotate(-18) scale(1.25) translate(-12 -12)'%3E%3Cpath d='M2 12.5 L22 3 L14.5 21 L11 13.5 Z M11 13.5 L22 3'/%3E%3C/g%3E%3Cg transform='translate(118 22) rotate(8) scale(1.15) translate(-12 -12)'%3E%3Cpath d='M12 22 C12 17 11.5 13 11 10 M11 10 C7 7 4 8 2.5 10 M11 10 C9 5.5 5.5 4 3 4.5 M11 10 C13 5.5 17 4.5 19.5 6 M11 10 C15 8 19 9 21 11.5'/%3E%3C/g%3E%3Cg transform='translate(186 64) rotate(-10) scale(1.05) translate(-12 -12)'%3E%3Cpath d='M12 3 A9 9 0 1 1 11.99 3 Z M15.5 8.5 L13.5 13.5 L8.5 15.5 L10.5 10.5 Z'/%3E%3C/g%3E%3Cg transform='translate(58 106) rotate(6) scale(1.1) translate(-12 -12)'%3E%3Cpath d='M3 8.5 h3.5 L8.5 6 h7 L17.5 8.5 H21 v11 H3 Z M12 10 A3.5 3.5 0 1 1 11.99 10 Z'/%3E%3C/g%3E%3Cg transform='translate(152 132) rotate(-6) scale(1.2) translate(-12 -12)'%3E%3Cpath d='M2 19 L8.5 7.5 L12.5 14 L15.5 9.5 L22 19 Z M8.5 7.5 L10.5 11 L6.5 11 Z'/%3E%3C/g%3E%3Cg transform='translate(108 176) rotate(0) scale(1.0) translate(-12 -12)'%3E%3Cpath d='M12 7.5 A4.5 4.5 0 1 1 11.99 7.5 Z M12 2 v2.5 M12 19.5 V22 M2 12 h2.5 M19.5 12 H22 M5 5 l1.8 1.8 M17.2 17.2 L19 19 M19 5 l-1.8 1.8 M6.8 17.2 L5 19'/%3E%3C/g%3E%3Cg transform='translate(24 168) rotate(12) scale(1.05) translate(-12 -12)'%3E%3Cpath d='M3 8 h18 v12 H3 Z M9 8 V5.5 h6 V8 M3 13 h18'/%3E%3C/g%3E%3Cg transform='translate(190 168) rotate(-8) scale(1.05) translate(-12 -12)'%3E%3Cpath d='M12 21.5 C12 21.5 19 14.5 19 9.5 A7 7 0 1 0 5 9.5 C5 14.5 12 21.5 12 21.5 Z M12 9.5 A2.6 2.6 0 1 1 11.99 9.5 Z'/%3E%3C/g%3E%3Cg transform='translate(88 74) rotate(16) scale(0.95) translate(-12 -12)'%3E%3Cpath d='M3 8 h18 v3 a2 2 0 0 0 0 4 v3 H3 v-3 a2 2 0 0 0 0-4 Z M9 8 v12'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
    background-size: var(--doc-texture-size, 220px) var(--doc-texture-size, 220px);
    background-repeat: repeat;
    background-position: 0 0;
    /* The pattern belongs to the page, not to the scroll. Anchored to the
       viewport it stays put while the itinerary moves over it, which is what
       makes it read as stock the document is printed on rather than as a
       second thing sliding past at the same speed.
       iOS Safari has never honoured this properly and will fall back to
       scrolling it. That degrades to exactly the previous behaviour, so it
       costs nothing to ask for. */
    background-attachment: fixed;
  }

  /* The masthead sits above the texture, not on it.
     It is the first thing on the page and the only place the company's own
     mark appears, so it wants clean ground under it — grain running behind a
     logo reads as a printing fault rather than as stock. Painting it opaque
     also gives the page a definite top edge, which the hairline below it then
     closes.

     Targeted as the root's own header rather than by adding a class, so the
     shared document needs no knowledge that a website exists. */
  .itinerary-print-area[data-published]:not([data-exporting]) > header {
    background-color: var(--doc-header-bg, #ffffff);
    /* Follows the reader down. It carries the company's mark, the phone
       number and the email — the three things a client wants at the moment
       they decide to ask something, which is rarely while looking at the top
       of the page.
       Above z-30, the highest the document uses, so nothing scrolls over it.
       The hairline it already carries is what separates it from the content
       passing underneath. */
    position: sticky;
    top: 0;
    z-index: 40;
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
