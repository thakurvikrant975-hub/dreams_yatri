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
     Fifteen kinds of travel line-doodle — plane, palm, compass, camera,
     mountain, sun, suitcase, pin, ticket, balloon, globe, anchor,
     binoculars, signpost, coffee — scattered 36 to a 300px tile.

     Two things make it read the way a good tiled pattern does rather than
     like a grid of stamps:

     Size varies a lot, 0.5x to 1.55x. A pattern where everything is the same
     size reads as a repeating unit however well it is placed; mixed sizes
     read as scatter. Stroke width does NOT vary with it —
     vector-effect: non-scaling-stroke keeps every line the same weight, so a
     small icon is a small icon rather than a faint one.

     And glyphs are allowed to cross the tile edge: any that does is drawn
     again on the opposite side, so the pattern packs right up to the border
     instead of leaving the empty gutter that keeping everything inside would
     force. That gutter is what makes a tile visible as a tile. Placement is
     a jittered grid — one glyph per cell at a random offset — which spreads
     them evenly without the clumps and bald patches pure randomness gives.

     Generated from a seeded sequence, so the tile is stable: it only changes
     when someone means it to.

     An inline SVG data URI. One request fewer than an asset, it cannot 404,
     and it stays inside this stylesheet, which is what keeps it off the
     printed sheet and out of the captured PDF. Colour and strength are the
     constants at the top of this file; the tile scale is a custom property. */
  .itinerary-print-area[data-published]:not([data-exporting]) {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300' viewBox='0 0 300 300'%3E%3Cg ${DOODLE_FILLED ? '' : "fill='none' "}${DOODLE_PAINT}stroke-width='1.5' vector-effect='non-scaling-stroke' stroke-linecap='round' stroke-linejoin='round'%3E%3Cg transform='translate(12.5 36.3) rotate(-31) scale(1.52) translate(-12 -12)'%3E%3Cpath d='M12 8 v13 M12 8 A2.5 2.5 0 1 1 11.99 8 Z M8 11 h8 M4 15 c0 4 4 6 8 6 s8-2 8-6 M4 15 l-1.5 1.5 M20 15 l1.5 1.5'/%3E%3C/g%3E%3Cg transform='translate(312.5 36.3) rotate(-31) scale(1.52) translate(-12 -12)'%3E%3Cpath d='M12 8 v13 M12 8 A2.5 2.5 0 1 1 11.99 8 Z M8 11 h8 M4 15 c0 4 4 6 8 6 s8-2 8-6 M4 15 l-1.5 1.5 M20 15 l1.5 1.5'/%3E%3C/g%3E%3Cg transform='translate(66.0 6.1) rotate(-16) scale(1.03) translate(-12 -12)'%3E%3Cpath d='M3 8.5 h3.5 L8.5 6 h7 L17.5 8.5 H21 v11 H3 Z M12 10 A3.5 3.5 0 1 1 11.99 10 Z'/%3E%3C/g%3E%3Cg transform='translate(66.0 306.1) rotate(-16) scale(1.03) translate(-12 -12)'%3E%3Cpath d='M3 8.5 h3.5 L8.5 6 h7 L17.5 8.5 H21 v11 H3 Z M12 10 A3.5 3.5 0 1 1 11.99 10 Z'/%3E%3C/g%3E%3Cg transform='translate(140.5 35.5) rotate(-11) scale(1.44) translate(-12 -12)'%3E%3Cpath d='M12 21.5 C12 21.5 19 14.5 19 9.5 A7 7 0 1 0 5 9.5 C5 14.5 12 21.5 12 21.5 Z M12 9.5 A2.6 2.6 0 1 1 11.99 9.5 Z'/%3E%3C/g%3E%3Cg transform='translate(159.1 34.6) rotate(3) scale(1.40) translate(-12 -12)'%3E%3Cpath d='M2 12.5 L22 3 L14.5 21 L11 13.5 Z M11 13.5 L22 3'/%3E%3C/g%3E%3Cg transform='translate(222.4 39.5) rotate(28) scale(0.89) translate(-12 -12)'%3E%3Cpath d='M8 21 A3.5 3.5 0 1 1 7.99 21 Z M16 21 A3.5 3.5 0 1 1 15.99 21 Z M6 18 L8 5 h3 v13 M18 18 L16 5 h-3 v13 M11 9 h2'/%3E%3C/g%3E%3Cg transform='translate(263.6 29.6) rotate(5) scale(1.35) translate(-12 -12)'%3E%3Cpath d='M12 22 C12 17 11.5 13 11 10 M11 10 C7 7 4 8 2.5 10 M11 10 C9 5.5 5.5 4 3 4.5 M11 10 C13 5.5 17 4.5 19.5 6 M11 10 C15 8 19 9 21 11.5'/%3E%3C/g%3E%3Cg transform='translate(19.2 84.5) rotate(-23) scale(1.25) translate(-12 -12)'%3E%3Cpath d='M12 21.5 C12 21.5 19 14.5 19 9.5 A7 7 0 1 0 5 9.5 C5 14.5 12 21.5 12 21.5 Z M12 9.5 A2.6 2.6 0 1 1 11.99 9.5 Z'/%3E%3C/g%3E%3Cg transform='translate(319.2 84.5) rotate(-23) scale(1.25) translate(-12 -12)'%3E%3Cpath d='M12 21.5 C12 21.5 19 14.5 19 9.5 A7 7 0 1 0 5 9.5 C5 14.5 12 21.5 12 21.5 Z M12 9.5 A2.6 2.6 0 1 1 11.99 9.5 Z'/%3E%3C/g%3E%3Cg transform='translate(89.6 71.5) rotate(-8) scale(0.54) translate(-12 -12)'%3E%3Cpath d='M12 16 C7.5 16 4.5 12 4.5 9 A7.5 7.5 0 1 1 19.5 9 C19.5 12 16.5 16 12 16 Z M10 16 l1 2.5 h2 l1-2.5 M10.5 18.5 h3 v2.5 h-3 Z'/%3E%3C/g%3E%3Cg transform='translate(119.8 61.1) rotate(-5) scale(1.33) translate(-12 -12)'%3E%3Cpath d='M2 12.5 L22 3 L14.5 21 L11 13.5 Z M11 13.5 L22 3'/%3E%3C/g%3E%3Cg transform='translate(157.8 88.0) rotate(19) scale(1.50) translate(-12 -12)'%3E%3Cpath d='M8 21 A3.5 3.5 0 1 1 7.99 21 Z M16 21 A3.5 3.5 0 1 1 15.99 21 Z M6 18 L8 5 h3 v13 M18 18 L16 5 h-3 v13 M11 9 h2'/%3E%3C/g%3E%3Cg transform='translate(208.5 87.9) rotate(-5) scale(1.11) translate(-12 -12)'%3E%3Cpath d='M12 21.5 C12 21.5 19 14.5 19 9.5 A7 7 0 1 0 5 9.5 C5 14.5 12 21.5 12 21.5 Z M12 9.5 A2.6 2.6 0 1 1 11.99 9.5 Z'/%3E%3C/g%3E%3Cg transform='translate(-22.7 86.9) rotate(-31) scale(1.50) translate(-12 -12)'%3E%3Cpath d='M2 19 L8.5 7.5 L12.5 14 L15.5 9.5 L22 19 Z M8.5 7.5 L10.5 11 L6.5 11 Z'/%3E%3C/g%3E%3Cg transform='translate(277.3 86.9) rotate(-31) scale(1.50) translate(-12 -12)'%3E%3Cpath d='M2 19 L8.5 7.5 L12.5 14 L15.5 9.5 L22 19 Z M8.5 7.5 L10.5 11 L6.5 11 Z'/%3E%3C/g%3E%3Cg transform='translate(37.8 110.1) rotate(-16) scale(1.09) translate(-12 -12)'%3E%3Cpath d='M2 19 L8.5 7.5 L12.5 14 L15.5 9.5 L22 19 Z M8.5 7.5 L10.5 11 L6.5 11 Z'/%3E%3C/g%3E%3Cg transform='translate(60.2 114.6) rotate(-30) scale(1.44) translate(-12 -12)'%3E%3Cpath d='M2 19 L8.5 7.5 L12.5 14 L15.5 9.5 L22 19 Z M8.5 7.5 L10.5 11 L6.5 11 Z'/%3E%3C/g%3E%3Cg transform='translate(122.9 115.8) rotate(16) scale(0.55) translate(-12 -12)'%3E%3Cpath d='M12 16 C7.5 16 4.5 12 4.5 9 A7.5 7.5 0 1 1 19.5 9 C19.5 12 16.5 16 12 16 Z M10 16 l1 2.5 h2 l1-2.5 M10.5 18.5 h3 v2.5 h-3 Z'/%3E%3C/g%3E%3Cg transform='translate(183.2 113.7) rotate(-29) scale(1.00) translate(-12 -12)'%3E%3Cpath d='M4 9 h13 v6 a5 5 0 0 1 -5 5 H9 a5 5 0 0 1 -5 -5 Z M17 10.5 h2.5 a2.5 2.5 0 0 1 0 5 H17 M7 6 V3.5 M11 6 V3.5'/%3E%3C/g%3E%3Cg transform='translate(208.9 129.4) rotate(-27) scale(1.01) translate(-12 -12)'%3E%3Cpath d='M8 21 A3.5 3.5 0 1 1 7.99 21 Z M16 21 A3.5 3.5 0 1 1 15.99 21 Z M6 18 L8 5 h3 v13 M18 18 L16 5 h-3 v13 M11 9 h2'/%3E%3C/g%3E%3Cg transform='translate(-20.6 133.4) rotate(32) scale(1.48) translate(-12 -12)'%3E%3Cpath d='M12 21 V4 M12 6 h8 l-2 2.5 l2 2.5 h-8 M12 13 H4 l2 2.5 l-2 2.5 h8'/%3E%3C/g%3E%3Cg transform='translate(279.4 133.4) rotate(32) scale(1.48) translate(-12 -12)'%3E%3Cpath d='M12 21 V4 M12 6 h8 l-2 2.5 l2 2.5 h-8 M12 13 H4 l2 2.5 l-2 2.5 h8'/%3E%3C/g%3E%3Cg transform='translate(25.1 161.5) rotate(1) scale(1.29) translate(-12 -12)'%3E%3Cpath d='M2 19 L8.5 7.5 L12.5 14 L15.5 9.5 L22 19 Z M8.5 7.5 L10.5 11 L6.5 11 Z'/%3E%3C/g%3E%3Cg transform='translate(90.1 171.6) rotate(7) scale(1.24) translate(-12 -12)'%3E%3Cpath d='M2 19 L8.5 7.5 L12.5 14 L15.5 9.5 L22 19 Z M8.5 7.5 L10.5 11 L6.5 11 Z'/%3E%3C/g%3E%3Cg transform='translate(106.7 184.9) rotate(-5) scale(0.56) translate(-12 -12)'%3E%3Cpath d='M12 7.5 A4.5 4.5 0 1 1 11.99 7.5 Z M12 2 v2.5 M12 19.5 V22 M2 12 h2.5 M19.5 12 H22 M5 5 l1.8 1.8 M17.2 17.2 L19 19 M19 5 l-1.8 1.8 M6.8 17.2 L5 19'/%3E%3C/g%3E%3Cg transform='translate(183.0 173.4) rotate(28) scale(1.11) translate(-12 -12)'%3E%3Cpath d='M12 7.5 A4.5 4.5 0 1 1 11.99 7.5 Z M12 2 v2.5 M12 19.5 V22 M2 12 h2.5 M19.5 12 H22 M5 5 l1.8 1.8 M17.2 17.2 L19 19 M19 5 l-1.8 1.8 M6.8 17.2 L5 19'/%3E%3C/g%3E%3Cg transform='translate(213.4 184.6) rotate(-16) scale(0.51) translate(-12 -12)'%3E%3Cpath d='M2 12.5 L22 3 L14.5 21 L11 13.5 Z M11 13.5 L22 3'/%3E%3C/g%3E%3Cg transform='translate(262.7 192.3) rotate(27) scale(1.42) translate(-12 -12)'%3E%3Cpath d='M12 7.5 A4.5 4.5 0 1 1 11.99 7.5 Z M12 2 v2.5 M12 19.5 V22 M2 12 h2.5 M19.5 12 H22 M5 5 l1.8 1.8 M17.2 17.2 L19 19 M19 5 l-1.8 1.8 M6.8 17.2 L5 19'/%3E%3C/g%3E%3Cg transform='translate(29.8 214.9) rotate(-18) scale(0.67) translate(-12 -12)'%3E%3Cpath d='M3 8.5 h3.5 L8.5 6 h7 L17.5 8.5 H21 v11 H3 Z M12 10 A3.5 3.5 0 1 1 11.99 10 Z'/%3E%3C/g%3E%3Cg transform='translate(91.1 234.8) rotate(-4) scale(1.39) translate(-12 -12)'%3E%3Cpath d='M12 21.5 C12 21.5 19 14.5 19 9.5 A7 7 0 1 0 5 9.5 C5 14.5 12 21.5 12 21.5 Z M12 9.5 A2.6 2.6 0 1 1 11.99 9.5 Z'/%3E%3C/g%3E%3Cg transform='translate(115.5 224.2) rotate(-22) scale(0.63) translate(-12 -12)'%3E%3Cpath d='M12 21 V4 M12 6 h8 l-2 2.5 l2 2.5 h-8 M12 13 H4 l2 2.5 l-2 2.5 h8'/%3E%3C/g%3E%3Cg transform='translate(175.3 224.3) rotate(-20) scale(0.98) translate(-12 -12)'%3E%3Cpath d='M2 19 L8.5 7.5 L12.5 14 L15.5 9.5 L22 19 Z M8.5 7.5 L10.5 11 L6.5 11 Z'/%3E%3C/g%3E%3Cg transform='translate(231.2 240.9) rotate(30) scale(0.67) translate(-12 -12)'%3E%3Cpath d='M12 7.5 A4.5 4.5 0 1 1 11.99 7.5 Z M12 2 v2.5 M12 19.5 V22 M2 12 h2.5 M19.5 12 H22 M5 5 l1.8 1.8 M17.2 17.2 L19 19 M19 5 l-1.8 1.8 M6.8 17.2 L5 19'/%3E%3C/g%3E%3Cg transform='translate(281.6 243.9) rotate(-10) scale(0.73) translate(-12 -12)'%3E%3Cpath d='M3 8 h18 v12 H3 Z M9 8 V5.5 h6 V8 M3 13 h18'/%3E%3C/g%3E%3Cg transform='translate(33.9 277.8) rotate(29) scale(1.02) translate(-12 -12)'%3E%3Cpath d='M12 8 v13 M12 8 A2.5 2.5 0 1 1 11.99 8 Z M8 11 h8 M4 15 c0 4 4 6 8 6 s8-2 8-6 M4 15 l-1.5 1.5 M20 15 l1.5 1.5'/%3E%3C/g%3E%3Cg transform='translate(67.0 256.6) rotate(18) scale(0.90) translate(-12 -12)'%3E%3Cpath d='M4 9 h13 v6 a5 5 0 0 1 -5 5 H9 a5 5 0 0 1 -5 -5 Z M17 10.5 h2.5 a2.5 2.5 0 0 1 0 5 H17 M7 6 V3.5 M11 6 V3.5'/%3E%3C/g%3E%3Cg transform='translate(138.8 272.0) rotate(6) scale(0.91) translate(-12 -12)'%3E%3Cpath d='M12 8 v13 M12 8 A2.5 2.5 0 1 1 11.99 8 Z M8 11 h8 M4 15 c0 4 4 6 8 6 s8-2 8-6 M4 15 l-1.5 1.5 M20 15 l1.5 1.5'/%3E%3C/g%3E%3Cg transform='translate(190.8 279.6) rotate(23) scale(0.74) translate(-12 -12)'%3E%3Cpath d='M2 12.5 L22 3 L14.5 21 L11 13.5 Z M11 13.5 L22 3'/%3E%3C/g%3E%3Cg transform='translate(209.2 -10.4) rotate(4) scale(1.36) translate(-12 -12)'%3E%3Cpath d='M3 8 h18 v3 a2 2 0 0 0 0 4 v3 H3 v-3 a2 2 0 0 0 0-4 Z M9 8 v12'/%3E%3C/g%3E%3Cg transform='translate(209.2 289.6) rotate(4) scale(1.36) translate(-12 -12)'%3E%3Cpath d='M3 8 h18 v3 a2 2 0 0 0 0 4 v3 H3 v-3 a2 2 0 0 0 0-4 Z M9 8 v12'/%3E%3C/g%3E%3Cg transform='translate(288.6 256.5) rotate(-32) scale(0.60) translate(-12 -12)'%3E%3Cpath d='M8 21 A3.5 3.5 0 1 1 7.99 21 Z M16 21 A3.5 3.5 0 1 1 15.99 21 Z M6 18 L8 5 h3 v13 M18 18 L16 5 h-3 v13 M11 9 h2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
    background-size: var(--doc-texture-size, 300px) var(--doc-texture-size, 300px);
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
