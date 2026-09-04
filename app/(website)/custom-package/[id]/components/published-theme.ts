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
const DOODLE_OPACITY = 0.1;
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
     Thirty-two travel doodles and six small filler shapes, 180 of them on a
     460px tile. Four things make a tiled pattern read as pattern rather than
     as a grid of stamps, and it took getting all four wrong to learn them:

     Density. The first attempts were sprinkled; the field has to be close to
     full or the eye reads the gaps instead of the marks.

     No overlap. Placement is rejection-sampled against every glyph already
     down, and the distance is measured on a TORUS — two glyphs near opposite
     edges become neighbours once the tile repeats, so plain distance would
     let them collide in the seam.

     Wrapping. Any glyph crossing an edge is drawn again on the far side, so
     the pattern packs to the border. Keeping glyphs inside instead leaves an
     empty ring around each tile, and that ring is what makes a tile visible.

     Variety. Thirty-two kinds, not the nine it started with — at 85 icon
     placements, nine meant seeing the same suitcase nine times per tile.
     Sizes run 0.95x to 1.75x, and stroke width deliberately does not follow:
     non-scaling-stroke keeps every line at 1.5, so a small icon is small
     rather than faint.

     The filler shapes are not decoration. They sit in the gaps the icons
     cannot fill, which is what turns a scatter of objects into an even field.

     Generated from a seeded sequence, so the tile is stable and only changes
     when someone means it to. Inline as a data URI: one request fewer, cannot
     404, and it stays inside this stylesheet, which is what keeps it off the
     printed sheet and out of the captured PDF. Colour and strength are the
     constants at the top of this file; tile scale is a custom property. */
  .itinerary-print-area[data-published]:not([data-exporting]) {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='460' height='460' viewBox='0 0 460 460'%3E%3Cg ${DOODLE_FILLED ? '' : "fill='none' "}${DOODLE_PAINT}stroke-width='1.5' vector-effect='non-scaling-stroke' stroke-linecap='round' stroke-linejoin='round'%3E%3Cg transform='translate(360.9 390.0) rotate(24) scale(1.36) translate(-12 -12)'%3E%3Cpath d='M12 3.5 A8.5 8.5 0 1 1 11.99 3.5 Z M3.5 12 h17 M12 3.5 C15 7 15 17 12 20.5 M12 3.5 C9 7 9 17 12 20.5'/%3E%3C/g%3E%3Cg transform='translate(22.5 306.9) rotate(28) scale(1.66) translate(-12 -12)'%3E%3Cpath d='M6 8.5 h12 v11 H6 Z M9 8.5 A3 3 0 0 1 15 8.5 M9.5 13 h5 v3 h-5 Z'/%3E%3C/g%3E%3Cg transform='translate(224.4 179.1) rotate(21) scale(1.08) translate(-12 -12)'%3E%3Cpath d='M12 12 v7 a2 2 0 0 1 -4 0 M2.5 12 A9.5 9.5 0 0 1 21.5 12 Z M12 2.5 V12'/%3E%3C/g%3E%3Cg transform='translate(358.4 139.4) rotate(19) scale(1.51) translate(-12 -12)'%3E%3Cpath d='M6 21 V4 M6 4.5 h11 l-2 3.2 l2 3.3 H6'/%3E%3C/g%3E%3Cg transform='translate(26.1 85.2) rotate(-29) scale(1.12) translate(-12 -12)'%3E%3Cpath d='M3 17 h18 l-2.5 4 H5.5 Z M12 15.5 V4 M12 6 L18.5 13 H12'/%3E%3C/g%3E%3Cg transform='translate(182.1 274.4) rotate(-11) scale(1.17) translate(-12 -12)'%3E%3Cpath d='M3 10 h7 v2.5 a3 3 0 0 1 -6 0 Z M14 10 h7 v2.5 a3 3 0 0 1 -6 0 Z M10 11 h4'/%3E%3C/g%3E%3Cg transform='translate(62.4 123.1) rotate(-17) scale(1.34) translate(-12 -12)'%3E%3Cpath d='M2 5 L22 8 M12 6.6 V9 M6 9 h12 v8 a2 2 0 0 1 -2 2 H8 a2 2 0 0 1 -2 -2 Z M6 13 h12'/%3E%3C/g%3E%3Cg transform='translate(186.6 -8.1) rotate(29) scale(1.64) translate(-12 -12)'%3E%3Cpath d='M6 18 A3.5 3.5 0 1 1 5.99 18 Z M18 18 A3.5 3.5 0 1 1 17.99 18 Z M6 18 L10 8 h5 M10 8 L14 18 M13 8 h3 l2 10'/%3E%3C/g%3E%3Cg transform='translate(186.6 451.9) rotate(29) scale(1.64) translate(-12 -12)'%3E%3Cpath d='M6 18 A3.5 3.5 0 1 1 5.99 18 Z M18 18 A3.5 3.5 0 1 1 17.99 18 Z M6 18 L10 8 h5 M10 8 L14 18 M13 8 h3 l2 10'/%3E%3C/g%3E%3Cg transform='translate(224.5 5.7) rotate(1) scale(1.01) translate(-12 -12)'%3E%3Cpath d='M3 6 h18 v12 H3 Z M13 9.5 h5 M13 12.5 h5 M6 9.5 h4 v5 H6 Z'/%3E%3C/g%3E%3Cg transform='translate(224.5 465.7) rotate(1) scale(1.01) translate(-12 -12)'%3E%3Cpath d='M3 6 h18 v12 H3 Z M13 9.5 h5 M13 12.5 h5 M6 9.5 h4 v5 H6 Z'/%3E%3C/g%3E%3Cg transform='translate(417.8 265.7) rotate(30) scale(1.06) translate(-12 -12)'%3E%3Cpath d='M6 21 V4 M6 4.5 h11 l-2 3.2 l2 3.3 H6'/%3E%3C/g%3E%3Cg transform='translate(360.0 71.6) rotate(1) scale(1.49) translate(-12 -12)'%3E%3Cpath d='M12 21 C12 21 18.5 14.5 18.5 9.5 A6.5 6.5 0 1 0 5.5 9.5 C5.5 14.5 12 21 12 21 Z M12 9.5 A2.4 2.4 0 1 1 11.99 9.5 Z'/%3E%3C/g%3E%3Cg transform='translate(-1.2 201.6) rotate(12) scale(1.48) translate(-12 -12)'%3E%3Cpath d='M4 5.5 h16 v10 h-16 Z M4 15.5 v3 h3 v-3 M17 15.5 v3 h3 v-3 M4 9 h16 M8 5.5 v3.5 M16 5.5 v3.5 M7 18.5 h10'/%3E%3C/g%3E%3Cg transform='translate(458.8 201.6) rotate(12) scale(1.48) translate(-12 -12)'%3E%3Cpath d='M4 5.5 h16 v10 h-16 Z M4 15.5 v3 h3 v-3 M17 15.5 v3 h3 v-3 M4 9 h16 M8 5.5 v3.5 M16 5.5 v3.5 M7 18.5 h10'/%3E%3C/g%3E%3Cg transform='translate(183.1 163.7) rotate(0) scale(1.71) translate(-12 -12)'%3E%3Cpath d='M7 18 A4.2 4.2 0 0 1 7.4 9.7 A5.6 5.6 0 0 1 18 10.6 A3.8 3.8 0 0 1 17.6 18 Z'/%3E%3C/g%3E%3Cg transform='translate(297.1 279.3) rotate(-26) scale(1.05) translate(-12 -12)'%3E%3Cpath d='M3 6 h18 v12 H3 Z M13 9.5 h5 M13 12.5 h5 M6 9.5 h4 v5 H6 Z'/%3E%3C/g%3E%3Cg transform='translate(270.7 39.9) rotate(-8) scale(1.20) translate(-12 -12)'%3E%3Cpath d='M2 13 L22 3.5 L14 20.5 L11.2 13.8 Z'/%3E%3C/g%3E%3Cg transform='translate(65.1 323.9) rotate(-29) scale(1.21) translate(-12 -12)'%3E%3Cpath d='M3 6 h18 v12 H3 Z M13 9.5 h5 M13 12.5 h5 M6 9.5 h4 v5 H6 Z'/%3E%3C/g%3E%3Cg transform='translate(216.9 96.6) rotate(1) scale(1.36) translate(-12 -12)'%3E%3Cpath d='M2 19 h20 M12 19 C12 15 12 13 12 11.5 M12 11.5 C9 9.5 6.5 10 5.5 11.5 M12 11.5 C10.5 7.5 8 6.5 6 7.2 M12 11.5 C14 7.5 17 7 18.5 8.5'/%3E%3C/g%3E%3Cg transform='translate(260.9 308.7) rotate(-11) scale(1.27) translate(-12 -12)'%3E%3Cpath d='M2 19 h20 M12 19 C12 15 12 13 12 11.5 M12 11.5 C9 9.5 6.5 10 5.5 11.5 M12 11.5 C10.5 7.5 8 6.5 6 7.2 M12 11.5 C14 7.5 17 7 18.5 8.5'/%3E%3C/g%3E%3Cg transform='translate(294.7 359.7) rotate(21) scale(1.10) translate(-12 -12)'%3E%3Cpath d='M3.5 8.5 h17 v3 a2 2 0 0 0 0 4 v3 h-17 v-3 a2 2 0 0 0 0-4 Z'/%3E%3C/g%3E%3Cg transform='translate(115.3 -13.9) rotate(-7) scale(1.62) translate(-12 -12)'%3E%3Cpath d='M3 6 h18 v12 H3 Z M13 9.5 h5 M13 12.5 h5 M6 9.5 h4 v5 H6 Z'/%3E%3C/g%3E%3Cg transform='translate(115.3 446.1) rotate(-7) scale(1.62) translate(-12 -12)'%3E%3Cpath d='M3 6 h18 v12 H3 Z M13 9.5 h5 M13 12.5 h5 M6 9.5 h4 v5 H6 Z'/%3E%3C/g%3E%3Cg transform='translate(415.9 106.8) rotate(-12) scale(1.17) translate(-12 -12)'%3E%3Cpath d='M12 3.5 A8.5 8.5 0 1 1 11.99 3.5 Z M3.5 12 h17 M12 3.5 C15 7 15 17 12 20.5 M12 3.5 C9 7 9 17 12 20.5'/%3E%3C/g%3E%3Cg transform='translate(243.0 122.5) rotate(7) scale(1.40) translate(-12 -12)'%3E%3Cpath d='M3.5 8.5 h17 v3 a2 2 0 0 0 0 4 v3 h-17 v-3 a2 2 0 0 0 0-4 Z'/%3E%3C/g%3E%3Cg transform='translate(200.9 371.3) rotate(-13) scale(1.11) translate(-12 -12)'%3E%3Cpath d='M2.5 19.5 L12 5 L21.5 19.5 Z M12 5 V19.5 M8 19.5 L12 13 L16 19.5'/%3E%3C/g%3E%3Cg transform='translate(429.4 59.0) rotate(9) scale(1.08) translate(-12 -12)'%3E%3Cpath d='M9.5 3.5 h5 v3 l1.5 2.5 v11 h-8 v-11 L9.5 6.5 Z M8 12.5 h8'/%3E%3C/g%3E%3Cg transform='translate(431.2 6.6) rotate(29) scale(1.67) translate(-12 -12)'%3E%3Cpath d='M9 20.5 h6 M9.5 20.5 L11 8 h2 l1.5 12.5 M9.5 5 h5 l-.7 3 h-3.6 Z M12 2.5 V5'/%3E%3C/g%3E%3Cg transform='translate(431.2 466.6) rotate(29) scale(1.67) translate(-12 -12)'%3E%3Cpath d='M9 20.5 h6 M9.5 20.5 L11 8 h2 l1.5 12.5 M9.5 5 h5 l-.7 3 h-3.6 Z M12 2.5 V5'/%3E%3C/g%3E%3Cg transform='translate(211.5 238.9) rotate(-0) scale(1.38) translate(-12 -12)'%3E%3Cpath d='M6 18 A3.5 3.5 0 1 1 5.99 18 Z M18 18 A3.5 3.5 0 1 1 17.99 18 Z M6 18 L10 8 h5 M10 8 L14 18 M13 8 h3 l2 10'/%3E%3C/g%3E%3Cg transform='translate(185.0 328.4) rotate(23) scale(1.73) translate(-12 -12)'%3E%3Cpath d='M3 17 h18 l-2.5 4 H5.5 Z M12 15.5 V4 M12 6 L18.5 13 H12'/%3E%3C/g%3E%3Cg transform='translate(156.6 50.0) rotate(23) scale(1.32) translate(-12 -12)'%3E%3Cpath d='M2 19 L8.5 7 L13 14.5 L16 10 L22 19 Z'/%3E%3C/g%3E%3Cg transform='translate(345.1 351.4) rotate(27) scale(1.66) translate(-12 -12)'%3E%3Cpath d='M6 4 h12 v11 a3 3 0 0 1 -3 3 h-6 a3 3 0 0 1 -3 -3 Z M6 9.5 h12 M9 21 l2-3 M15 21 l-2-3 M9.5 13 h1 M13.5 13 h1'/%3E%3C/g%3E%3Cg transform='translate(137.8 134.7) rotate(28) scale(1.50) translate(-12 -12)'%3E%3Cpath d='M3.5 8.5 h17 v3 a2 2 0 0 0 0 4 v3 h-17 v-3 a2 2 0 0 0 0-4 Z'/%3E%3C/g%3E%3Cg transform='translate(299.8 143.4) rotate(-16) scale(0.99) translate(-12 -12)'%3E%3Cpath d='M6 4 h12 v11 a3 3 0 0 1 -3 3 h-6 a3 3 0 0 1 -3 -3 Z M6 9.5 h12 M9 21 l2-3 M15 21 l-2-3 M9.5 13 h1 M13.5 13 h1'/%3E%3C/g%3E%3Cg transform='translate(21.5 370.4) rotate(5) scale(1.52) translate(-12 -12)'%3E%3Cpath d='M2.5 19.5 L12 5 L21.5 19.5 Z M12 5 V19.5 M8 19.5 L12 13 L16 19.5'/%3E%3C/g%3E%3Cg transform='translate(248.7 398.2) rotate(30) scale(1.45) translate(-12 -12)'%3E%3Cpath d='M12 3.5 A8.5 8.5 0 1 1 11.99 3.5 Z M3.5 12 h17 M12 3.5 C15 7 15 17 12 20.5 M12 3.5 C9 7 9 17 12 20.5'/%3E%3C/g%3E%3Cg transform='translate(170.4 240.5) rotate(18) scale(1.42) translate(-12 -12)'%3E%3Cpath d='M5 9 h11 v5.5 a4.5 4.5 0 0 1 -4.5 4.5 h-2 A4.5 4.5 0 0 1 5 14.5 Z M16 10.5 h2 a2.2 2.2 0 0 1 0 4.4 h-2'/%3E%3C/g%3E%3Cg transform='translate(52.7 271.6) rotate(16) scale(1.72) translate(-12 -12)'%3E%3Cpath d='M12 12 v7 a2 2 0 0 1 -4 0 M2.5 12 A9.5 9.5 0 0 1 21.5 12 Z M12 2.5 V12'/%3E%3C/g%3E%3Cg transform='translate(47.4 213.9) rotate(23) scale(1.60) translate(-12 -12)'%3E%3Cpath d='M5.5 8.5 h13 l1 11h-15 Z M9 8.5 A3 3 0 0 1 15 8.5'/%3E%3C/g%3E%3Cg transform='translate(111.7 235.6) rotate(-26) scale(0.99) translate(-12 -12)'%3E%3Cpath d='M5 9 h11 v5.5 a4.5 4.5 0 0 1 -4.5 4.5 h-2 A4.5 4.5 0 0 1 5 14.5 Z M16 10.5 h2 a2.2 2.2 0 0 1 0 4.4 h-2'/%3E%3C/g%3E%3Cg transform='translate(164.7 194.9) rotate(22) scale(0.99) translate(-12 -12)'%3E%3Cpath d='M6 8.5 h12 v11 H6 Z M9 8.5 A3 3 0 0 1 15 8.5 M9.5 13 h5 v3 h-5 Z'/%3E%3C/g%3E%3Cg transform='translate(395.1 229.3) rotate(-18) scale(1.06) translate(-12 -12)'%3E%3Cpath d='M12 8 A4 4 0 1 1 11.99 8 Z M12 3 v2 M12 19 v2 M3 12 h2 M19 12 h2 M5.6 5.6 l1.4 1.4 M17 17 l1.4 1.4 M18.4 5.6 l-1.4 1.4 M7 17 l-1.4 1.4'/%3E%3C/g%3E%3Cg transform='translate(12.1 38.2) rotate(-18) scale(1.31) translate(-12 -12)'%3E%3Cpath d='M9 20.5 h6 M9.5 20.5 L11 8 h2 l1.5 12.5 M9.5 5 h5 l-.7 3 h-3.6 Z M12 2.5 V5'/%3E%3C/g%3E%3Cg transform='translate(472.1 38.2) rotate(-18) scale(1.31) translate(-12 -12)'%3E%3Cpath d='M9 20.5 h6 M9.5 20.5 L11 8 h2 l1.5 12.5 M9.5 5 h5 l-.7 3 h-3.6 Z M12 2.5 V5'/%3E%3C/g%3E%3Cg transform='translate(299.3 102.3) rotate(-18) scale(1.28) translate(-12 -12)'%3E%3Cpath d='M7 18 A4.2 4.2 0 0 1 7.4 9.7 A5.6 5.6 0 0 1 18 10.6 A3.8 3.8 0 0 1 17.6 18 Z'/%3E%3C/g%3E%3Cg transform='translate(354.3 278.3) rotate(7) scale(1.61) translate(-12 -12)'%3E%3Cpath d='M12 12 v7 a2 2 0 0 1 -4 0 M2.5 12 A9.5 9.5 0 0 1 21.5 12 Z M12 2.5 V12'/%3E%3C/g%3E%3Cg transform='translate(327.1 215.5) rotate(1) scale(1.68) translate(-12 -12)'%3E%3Cpath d='M9 20.5 h6 M9.5 20.5 L11 8 h2 l1.5 12.5 M9.5 5 h5 l-.7 3 h-3.6 Z M12 2.5 V5'/%3E%3C/g%3E%3Cg transform='translate(384.4 18.4) rotate(-29) scale(1.07) translate(-12 -12)'%3E%3Cpath d='M12 12 v7 a2 2 0 0 1 -4 0 M2.5 12 A9.5 9.5 0 0 1 21.5 12 Z M12 2.5 V12'/%3E%3C/g%3E%3Cg transform='translate(56.9 391.8) rotate(-14) scale(1.66) translate(-12 -12)'%3E%3Cpath d='M12 2.5 L20 8 H4 Z M6 8 v11 M18 8 v11 M4 19 h16 M10 19 v-5 h4 v5'/%3E%3C/g%3E%3Cg transform='translate(419.2 423.1) rotate(2) scale(1.57) translate(-12 -12)'%3E%3Cpath d='M2.5 19.5 L12 5 L21.5 19.5 Z M12 5 V19.5 M8 19.5 L12 13 L16 19.5'/%3E%3C/g%3E%3Cg transform='translate(93.9 142.0) rotate(-12) scale(1.05) translate(-12 -12)'%3E%3Cpath d='M8 15.5 A4 4 0 1 1 7.99 15.5 Z M10.8 12.7 L20 3.5 M17.5 6 l2 2 M15.5 8 l2 2'/%3E%3C/g%3E%3Cg transform='translate(85.4 74.6) rotate(-18) scale(1.62) translate(-12 -12)'%3E%3Cpath d='M2 19 h20 M12 19 C12 15 12 13 12 11.5 M12 11.5 C9 9.5 6.5 10 5.5 11.5 M12 11.5 C10.5 7.5 8 6.5 6 7.2 M12 11.5 C14 7.5 17 7 18.5 8.5'/%3E%3C/g%3E%3Cg transform='translate(161.9 424.7) rotate(2) scale(1.08) translate(-12 -12)'%3E%3Cpath d='M12 3.5 A8.5 8.5 0 1 1 11.99 3.5 Z M3.5 12 h17 M12 3.5 C15 7 15 17 12 20.5 M12 3.5 C9 7 9 17 12 20.5'/%3E%3C/g%3E%3Cg transform='translate(398.9 145.7) rotate(-12) scale(1.67) translate(-12 -12)'%3E%3Cpath d='M3 8.5 h4 L9 6 h6 L17 8.5 h4 v11 H3 Z M12 10.5 A3.2 3.2 0 1 1 11.99 10.5 Z'/%3E%3C/g%3E%3Cg transform='translate(328.1 41.3) rotate(4) scale(1.75) translate(-12 -12)'%3E%3Cpath d='M2.5 19.5 L12 5 L21.5 19.5 Z M12 5 V19.5 M8 19.5 L12 13 L16 19.5'/%3E%3C/g%3E%3Cg transform='translate(440.1 132.1) rotate(16) scale(1.38) translate(-12 -12)'%3E%3Cpath d='M6 4 h12 v11 a3 3 0 0 1 -3 3 h-6 a3 3 0 0 1 -3 -3 Z M6 9.5 h12 M9 21 l2-3 M15 21 l-2-3 M9.5 13 h1 M13.5 13 h1'/%3E%3C/g%3E%3Cg transform='translate(407.0 317.7) rotate(23) scale(1.60) translate(-12 -12)'%3E%3Cpath d='M9 20.5 h6 M9.5 20.5 L11 8 h2 l1.5 12.5 M9.5 5 h5 l-.7 3 h-3.6 Z M12 2.5 V5'/%3E%3C/g%3E%3Cg transform='translate(256.8 195.7) rotate(28) scale(1.22) translate(-12 -12)'%3E%3Cpath d='M3.5 8.5 h17 v3 a2 2 0 0 0 0 4 v3 h-17 v-3 a2 2 0 0 0 0-4 Z'/%3E%3C/g%3E%3Cg transform='translate(317.5 434.6) rotate(14) scale(1.37) translate(-12 -12)'%3E%3Cpath d='M12 15.5 C8 15.5 5 12 5 9 A7 7 0 1 1 19 9 C19 12 16 15.5 12 15.5 Z M10.5 15.5 h3 v3 h-3 Z'/%3E%3C/g%3E%3Cg transform='translate(424.1 190.0) rotate(13) scale(1.22) translate(-12 -12)'%3E%3Cpath d='M3 10 h7 v2.5 a3 3 0 0 1 -6 0 Z M14 10 h7 v2.5 a3 3 0 0 1 -6 0 Z M10 11 h4'/%3E%3C/g%3E%3Cg transform='translate(206.3 411.2) rotate(8) scale(1.33) translate(-12 -12)'%3E%3Cpath d='M7 18 A4.2 4.2 0 0 1 7.4 9.7 A5.6 5.6 0 0 1 18 10.6 A3.8 3.8 0 0 1 17.6 18 Z'/%3E%3C/g%3E%3Cg transform='translate(95.8 24.3) rotate(21) scale(1.50) translate(-12 -12)'%3E%3Cpath d='M2 13 L22 3.5 L14 20.5 L11.2 13.8 Z'/%3E%3C/g%3E%3Cg transform='translate(435.6 366.1) rotate(-9) scale(1.72) translate(-12 -12)'%3E%3Cpath d='M2 13 L22 3.5 L14 20.5 L11.2 13.8 Z'/%3E%3C/g%3E%3Cg transform='translate(395.2 66.6) rotate(7) scale(1.01) translate(-12 -12)'%3E%3Cpath d='M6 21 V4 M6 4.5 h11 l-2 3.2 l2 3.3 H6'/%3E%3C/g%3E%3Cg transform='translate(123.7 197.6) rotate(6) scale(1.42) translate(-12 -12)'%3E%3Cpath d='M12 15.5 C8 15.5 5 12 5 9 A7 7 0 1 1 19 9 C19 12 16 15.5 12 15.5 Z M10.5 15.5 h3 v3 h-3 Z'/%3E%3C/g%3E%3Cg transform='translate(229.3 282.1) rotate(22) scale(1.39) translate(-12 -12)'%3E%3Cpath d='M12 21 C12 21 18.5 14.5 18.5 9.5 A6.5 6.5 0 1 0 5.5 9.5 C5.5 14.5 12 21 12 21 Z M12 9.5 A2.4 2.4 0 1 1 11.99 9.5 Z'/%3E%3C/g%3E%3Cg transform='translate(285.3 5.3) rotate(-27) scale(1.35) translate(-12 -12)'%3E%3Cpath d='M4 5.5 h16 v10 h-16 Z M4 15.5 v3 h3 v-3 M17 15.5 v3 h3 v-3 M4 9 h16 M8 5.5 v3.5 M16 5.5 v3.5 M7 18.5 h10'/%3E%3C/g%3E%3Cg transform='translate(285.3 465.3) rotate(-27) scale(1.35) translate(-12 -12)'%3E%3Cpath d='M4 5.5 h16 v10 h-16 Z M4 15.5 v3 h3 v-3 M17 15.5 v3 h3 v-3 M4 9 h16 M8 5.5 v3.5 M16 5.5 v3.5 M7 18.5 h10'/%3E%3C/g%3E%3Cg transform='translate(443.9 288.5) rotate(4) scale(1.13) translate(-12 -12)'%3E%3Cpath d='M9.5 3.5 h5 v3 l1.5 2.5 v11 h-8 v-11 L9.5 6.5 Z M8 12.5 h8'/%3E%3C/g%3E%3Cg transform='translate(174.6 83.2) rotate(25) scale(1.51) translate(-12 -12)'%3E%3Cpath d='M4 5.5 h16 v10 h-16 Z M4 15.5 v3 h3 v-3 M17 15.5 v3 h3 v-3 M4 9 h16 M8 5.5 v3.5 M16 5.5 v3.5 M7 18.5 h10'/%3E%3C/g%3E%3Cg transform='translate(125.0 352.6) rotate(11) scale(1.43) translate(-12 -12)'%3E%3Cpath d='M12 3.5 A8.5 8.5 0 1 1 11.99 3.5 Z M3.5 12 h17 M12 3.5 C15 7 15 17 12 20.5 M12 3.5 C9 7 9 17 12 20.5'/%3E%3C/g%3E%3Cg transform='translate(54.3 6.9) rotate(-2) scale(1.52) translate(-12 -12)'%3E%3Cpath d='M12 3.5 A8.5 8.5 0 1 1 11.99 3.5 Z M3.5 12 h17 M12 3.5 C15 7 15 17 12 20.5 M12 3.5 C9 7 9 17 12 20.5'/%3E%3C/g%3E%3Cg transform='translate(54.3 466.9) rotate(-2) scale(1.52) translate(-12 -12)'%3E%3Cpath d='M12 3.5 A8.5 8.5 0 1 1 11.99 3.5 Z M3.5 12 h17 M12 3.5 C15 7 15 17 12 20.5 M12 3.5 C9 7 9 17 12 20.5'/%3E%3C/g%3E%3Cg transform='translate(131.7 276.3) rotate(-22) scale(0.99) translate(-12 -12)'%3E%3Cpath d='M3 6 h18 v12 H3 Z M13 9.5 h5 M13 12.5 h5 M6 9.5 h4 v5 H6 Z'/%3E%3C/g%3E%3Cg transform='translate(111.3 298.8) rotate(12) scale(1.30) translate(-12 -12)'%3E%3Cpath d='M12 15.5 C8 15.5 5 12 5 9 A7 7 0 1 1 19 9 C19 12 16 15.5 12 15.5 Z M10.5 15.5 h3 v3 h-3 Z'/%3E%3C/g%3E%3Cg transform='translate(337.5 100.5) rotate(14) scale(1.14) translate(-12 -12)'%3E%3Cpath d='M4 5.5 h16 v10 h-16 Z M4 15.5 v3 h3 v-3 M17 15.5 v3 h3 v-3 M4 9 h16 M8 5.5 v3.5 M16 5.5 v3.5 M7 18.5 h10'/%3E%3C/g%3E%3Cg transform='translate(288.7 238.7) rotate(-28) scale(1.25) translate(-12 -12)'%3E%3Cpath d='M5.5 8.5 h13 l1 11h-15 Z M9 8.5 A3 3 0 0 1 15 8.5'/%3E%3C/g%3E%3Cg transform='translate(14.5 150.9) rotate(-28) scale(1.20) translate(-12 -12)'%3E%3Cpath d='M3.5 8 h17 v11.5 h-17 Z M9 8 V5.5 h6 V8'/%3E%3C/g%3E%3Cg transform='translate(73.8 169.3) rotate(13) scale(1.28) translate(-12 -12)'%3E%3Cpath d='M6 8.5 h12 v11 H6 Z M9 8.5 A3 3 0 0 1 15 8.5 M9.5 13 h5 v3 h-5 Z'/%3E%3C/g%3E%3Cg transform='translate(159.8 300.2) rotate(-6) scale(1.10) translate(-12 -12)'%3E%3Cpath d='M2 13 L22 3.5 L14 20.5 L11.2 13.8 Z'/%3E%3C/g%3E%3Cg transform='translate(140.7 399.2) rotate(-19) scale(1.21) translate(-12 -12)'%3E%3Cpath d='M8 15.5 A4 4 0 1 1 7.99 15.5 Z M10.8 12.7 L20 3.5 M17.5 6 l2 2 M15.5 8 l2 2'/%3E%3C/g%3E%3Cg transform='translate(125.5 72.0) rotate(-12) scale(1.48) translate(-12 -12)'%3E%3Cpath d='M12 8 A4 4 0 1 1 11.99 8 Z M12 3 v2 M12 19 v2 M3 12 h2 M19 12 h2 M5.6 5.6 l1.4 1.4 M17 17 l1.4 1.4 M18.4 5.6 l-1.4 1.4 M7 17 l-1.4 1.4'/%3E%3C/g%3E%3Cg transform='translate(28.0 423.6) rotate(14) scale(1.31) translate(-12 -12)'%3E%3Cpath d='M4 5.5 h16 v10 h-16 Z M4 15.5 v3 h3 v-3 M17 15.5 v3 h3 v-3 M4 9 h16 M8 5.5 v3.5 M16 5.5 v3.5 M7 18.5 h10'/%3E%3C/g%3E%3Cg transform='translate(249.6 244.4) rotate(-13) scale(1.49) translate(-12 -12)'%3E%3Cpath d='M12 21.5 C12 17 11.6 13.5 11.2 10.8 M11.2 10.8 C7.5 8 4.5 8.8 3 10.5 M11.2 10.8 C9.5 6.5 6 5 3.8 5.8 M11.2 10.8 C13 6.5 16.5 5.4 18.8 6.8 M11.2 10.8 C14.8 9 18.5 9.8 20.5 12'/%3E%3C/g%3E%3Cg transform='translate(302.6 323.4) rotate(-14) scale(1.23) translate(-12 -12)'%3E%3Cpath d='M6 4 h12 v11 a3 3 0 0 1 -3 3 h-6 a3 3 0 0 1 -3 -3 Z M6 9.5 h12 M9 21 l2-3 M15 21 l-2-3 M9.5 13 h1 M13.5 13 h1'/%3E%3C/g%3E%3Cg transform='translate(292.6 189.1) rotate(-7) scale(1.01) translate(-12 -12)'%3E%3Cpath d='M3.5 8.5 h17 v3 a2 2 0 0 0 0 4 v3 h-17 v-3 a2 2 0 0 0 0-4 Z'/%3E%3C/g%3E%3Cg transform='translate(5.5 243.7) rotate(-25) scale(1.41) translate(-12 -12)'%3E%3Cpath d='M6 18 A3.5 3.5 0 1 1 5.99 18 Z M18 18 A3.5 3.5 0 1 1 17.99 18 Z M6 18 L10 8 h5 M10 8 L14 18 M13 8 h3 l2 10'/%3E%3C/g%3E%3Cg transform='translate(465.5 243.7) rotate(-25) scale(1.41) translate(-12 -12)'%3E%3Cpath d='M6 18 A3.5 3.5 0 1 1 5.99 18 Z M18 18 A3.5 3.5 0 1 1 17.99 18 Z M6 18 L10 8 h5 M10 8 L14 18 M13 8 h3 l2 10'/%3E%3C/g%3E%3Cg transform='translate(379.0 199.3) rotate(22) scale(1.38) translate(-12 -12)'%3E%3Cpath d='M3 6 h18 v12 H3 Z M13 9.5 h5 M13 12.5 h5 M6 9.5 h4 v5 H6 Z'/%3E%3C/g%3E%3Cg transform='translate(370.3 442.0) rotate(-13) scale(1.40) translate(-12 -12)'%3E%3Cpath d='M9 20.5 h6 M9.5 20.5 L11 8 h2 l1.5 12.5 M9.5 5 h5 l-.7 3 h-3.6 Z M12 2.5 V5'/%3E%3C/g%3E%3Cg transform='translate(89.1 365.5) rotate(28) scale(1.03) translate(-12 -12)'%3E%3Cpath d='M12 15.5 C8 15.5 5 12 5 9 A7 7 0 1 1 19 9 C19 12 16 15.5 12 15.5 Z M10.5 15.5 h3 v3 h-3 Z'/%3E%3C/g%3E%3Cg transform='translate(233.1 56.6) rotate(-29) scale(1.07) translate(-12 -12)'%3E%3Cpath d='M12 21.5 C12 17 11.6 13.5 11.2 10.8 M11.2 10.8 C7.5 8 4.5 8.8 3 10.5 M11.2 10.8 C9.5 6.5 6 5 3.8 5.8 M11.2 10.8 C13 6.5 16.5 5.4 18.8 6.8 M11.2 10.8 C14.8 9 18.5 9.8 20.5 12'/%3E%3C/g%3E%3Cg transform='translate(340.8 306.3) rotate(-28) scale(0.76) translate(-12 -12)'%3E%3Cpath d='M12 10.5 A1.5 1.5 0 1 1 11.99 10.5 Z'/%3E%3C/g%3E%3Cg transform='translate(384.1 275.1) rotate(27) scale(0.46) translate(-12 -12)'%3E%3Cpath d='M12 6 v12 M6 12 h12'/%3E%3C/g%3E%3Cg transform='translate(181.5 381.8) rotate(-20) scale(0.52) translate(-12 -12)'%3E%3Cpath d='M12 8 A4 4 0 1 1 11.99 8 Z'/%3E%3C/g%3E%3Cg transform='translate(285.1 162.6) rotate(3) scale(0.64) translate(-12 -12)'%3E%3Cpath d='M12 4 L13.6 10.4 L20 12 L13.6 13.6 L12 20 L10.4 13.6 L4 12 L10.4 10.4 Z'/%3E%3C/g%3E%3Cg transform='translate(275.8 77.2) rotate(-25) scale(0.54) translate(-12 -12)'%3E%3Cpath d='M12 4 L13.6 10.4 L20 12 L13.6 13.6 L12 20 L10.4 13.6 L4 12 L10.4 10.4 Z'/%3E%3C/g%3E%3Cg transform='translate(41.4 343.5) rotate(27) scale(0.77) translate(-12 -12)'%3E%3Cpath d='M12 10.5 A1.5 1.5 0 1 1 11.99 10.5 Z'/%3E%3C/g%3E%3Cg transform='translate(279.3 339.0) rotate(-23) scale(0.64) translate(-12 -12)'%3E%3Cpath d='M4 12 q3 -3 6 0 t6 0'/%3E%3C/g%3E%3Cg transform='translate(252.7 357.7) rotate(-22) scale(0.50) translate(-12 -12)'%3E%3Cpath d='M12 4 L13.6 10.4 L20 12 L13.6 13.6 L12 20 L10.4 13.6 L4 12 L10.4 10.4 Z'/%3E%3C/g%3E%3Cg transform='translate(98.4 162.0) rotate(11) scale(0.48) translate(-12 -12)'%3E%3Cpath d='M12 4 L13.6 10.4 L20 12 L13.6 13.6 L12 20 L10.4 13.6 L4 12 L10.4 10.4 Z'/%3E%3C/g%3E%3Cg transform='translate(354.2 230.0) rotate(13) scale(0.66) translate(-12 -12)'%3E%3Cpath d='M4 12 q3 -3 6 0 t6 0'/%3E%3C/g%3E%3Cg transform='translate(277.9 405.0) rotate(-11) scale(0.46) translate(-12 -12)'%3E%3Cpath d='M12 10.5 A1.5 1.5 0 1 1 11.99 10.5 Z'/%3E%3C/g%3E%3Cg transform='translate(195.4 25.7) rotate(16) scale(0.57) translate(-12 -12)'%3E%3Cpath d='M4 12 q3 -3 6 0 t6 0'/%3E%3C/g%3E%3Cg transform='translate(94.0 333.7) rotate(5) scale(0.79) translate(-12 -12)'%3E%3Cpath d='M4 12 q3 -3 6 0 t6 0'/%3E%3C/g%3E%3Cg transform='translate(124.2 18.7) rotate(24) scale(0.48) translate(-12 -12)'%3E%3Cpath d='M4 12 q3 -3 6 0 t6 0'/%3E%3C/g%3E%3Cg transform='translate(53.3 78.7) rotate(-1) scale(0.64) translate(-12 -12)'%3E%3Cpath d='M12 6 L18 17 H6 Z'/%3E%3C/g%3E%3Cg transform='translate(246.1 331.3) rotate(-19) scale(0.78) translate(-12 -12)'%3E%3Cpath d='M12 10.5 A1.5 1.5 0 1 1 11.99 10.5 Z'/%3E%3C/g%3E%3Cg transform='translate(339.6 -6.5) rotate(24) scale(0.76) translate(-12 -12)'%3E%3Cpath d='M12 6 v12 M6 12 h12'/%3E%3C/g%3E%3Cg transform='translate(339.6 453.5) rotate(24) scale(0.76) translate(-12 -12)'%3E%3Cpath d='M12 6 v12 M6 12 h12'/%3E%3C/g%3E%3Cg transform='translate(396.2 38.8) rotate(-27) scale(0.56) translate(-12 -12)'%3E%3Cpath d='M12 4 L13.6 10.4 L20 12 L13.6 13.6 L12 20 L10.4 13.6 L4 12 L10.4 10.4 Z'/%3E%3C/g%3E%3Cg transform='translate(19.4 277.0) rotate(27) scale(0.53) translate(-12 -12)'%3E%3Cpath d='M12 8 A4 4 0 1 1 11.99 8 Z'/%3E%3C/g%3E%3Cg transform='translate(320.9 6.1) rotate(18) scale(0.61) translate(-12 -12)'%3E%3Cpath d='M12 6 L18 17 H6 Z'/%3E%3C/g%3E%3Cg transform='translate(320.9 466.1) rotate(18) scale(0.61) translate(-12 -12)'%3E%3Cpath d='M12 6 L18 17 H6 Z'/%3E%3C/g%3E%3Cg transform='translate(246.7 430.2) rotate(21) scale(0.74) translate(-12 -12)'%3E%3Cpath d='M12 8 A4 4 0 1 1 11.99 8 Z'/%3E%3C/g%3E%3Cg transform='translate(448.1 324.1) rotate(-11) scale(0.53) translate(-12 -12)'%3E%3Cpath d='M12 4 L13.6 10.4 L20 12 L13.6 13.6 L12 20 L10.4 13.6 L4 12 L10.4 10.4 Z'/%3E%3C/g%3E%3Cg transform='translate(195.7 60.4) rotate(9) scale(0.50) translate(-12 -12)'%3E%3Cpath d='M12 6 L18 17 H6 Z'/%3E%3C/g%3E%3Cg transform='translate(117.3 155.1) rotate(-29) scale(0.51) translate(-12 -12)'%3E%3Cpath d='M12 10.5 A1.5 1.5 0 1 1 11.99 10.5 Z'/%3E%3C/g%3E%3Cg transform='translate(265.5 372.6) rotate(22) scale(0.54) translate(-12 -12)'%3E%3Cpath d='M12 4 L13.6 10.4 L20 12 L13.6 13.6 L12 20 L10.4 13.6 L4 12 L10.4 10.4 Z'/%3E%3C/g%3E%3Cg transform='translate(382.2 340.9) rotate(-21) scale(0.48) translate(-12 -12)'%3E%3Cpath d='M12 6 v12 M6 12 h12'/%3E%3C/g%3E%3Cg transform='translate(20.1 178.4) rotate(-26) scale(0.59) translate(-12 -12)'%3E%3Cpath d='M12 8 A4 4 0 1 1 11.99 8 Z'/%3E%3C/g%3E%3Cg transform='translate(316.1 78.1) rotate(22) scale(0.52) translate(-12 -12)'%3E%3Cpath d='M12 6 v12 M6 12 h12'/%3E%3C/g%3E%3Cg transform='translate(395.0 388.1) rotate(21) scale(0.75) translate(-12 -12)'%3E%3Cpath d='M4 12 q3 -3 6 0 t6 0'/%3E%3C/g%3E%3Cg transform='translate(193.4 213.3) rotate(-18) scale(0.73) translate(-12 -12)'%3E%3Cpath d='M4 12 q3 -3 6 0 t6 0'/%3E%3C/g%3E%3Cg transform='translate(425.2 221.3) rotate(1) scale(0.49) translate(-12 -12)'%3E%3Cpath d='M12 6 L18 17 H6 Z'/%3E%3C/g%3E%3Cg transform='translate(332.6 77.5) rotate(28) scale(0.60) translate(-12 -12)'%3E%3Cpath d='M12 8 A4 4 0 1 1 11.99 8 Z'/%3E%3C/g%3E%3Cg transform='translate(67.0 364.3) rotate(-13) scale(0.61) translate(-12 -12)'%3E%3Cpath d='M12 6 L18 17 H6 Z'/%3E%3C/g%3E%3Cg transform='translate(259.1 171.1) rotate(10) scale(0.56) translate(-12 -12)'%3E%3Cpath d='M12 6 v12 M6 12 h12'/%3E%3C/g%3E%3Cg transform='translate(118.0 410.2) rotate(18) scale(0.55) translate(-12 -12)'%3E%3Cpath d='M12 8 A4 4 0 1 1 11.99 8 Z'/%3E%3C/g%3E%3Cg transform='translate(332.2 178.2) rotate(10) scale(0.64) translate(-12 -12)'%3E%3Cpath d='M12 8 A4 4 0 1 1 11.99 8 Z'/%3E%3C/g%3E%3Cg transform='translate(84.5 258.6) rotate(24) scale(0.77) translate(-12 -12)'%3E%3Cpath d='M12 6 L18 17 H6 Z'/%3E%3C/g%3E%3Cg transform='translate(301.8 381.4) rotate(-29) scale(0.51) translate(-12 -12)'%3E%3Cpath d='M12 6 L18 17 H6 Z'/%3E%3C/g%3E%3Cg transform='translate(403.3 -6.1) rotate(16) scale(0.70) translate(-12 -12)'%3E%3Cpath d='M12 10.5 A1.5 1.5 0 1 1 11.99 10.5 Z'/%3E%3C/g%3E%3Cg transform='translate(403.3 453.9) rotate(16) scale(0.70) translate(-12 -12)'%3E%3Cpath d='M12 10.5 A1.5 1.5 0 1 1 11.99 10.5 Z'/%3E%3C/g%3E%3Cg transform='translate(51.5 153.1) rotate(5) scale(0.58) translate(-12 -12)'%3E%3Cpath d='M4 12 q3 -3 6 0 t6 0'/%3E%3C/g%3E%3Cg transform='translate(391.8 113.6) rotate(10) scale(0.66) translate(-12 -12)'%3E%3Cpath d='M12 10.5 A1.5 1.5 0 1 1 11.99 10.5 Z'/%3E%3C/g%3E%3Cg transform='translate(328.1 160.8) rotate(-13) scale(0.65) translate(-12 -12)'%3E%3Cpath d='M12 4 L13.6 10.4 L20 12 L13.6 13.6 L12 20 L10.4 13.6 L4 12 L10.4 10.4 Z'/%3E%3C/g%3E%3Cg transform='translate(366.4 112.2) rotate(24) scale(0.49) translate(-12 -12)'%3E%3Cpath d='M12 10.5 A1.5 1.5 0 1 1 11.99 10.5 Z'/%3E%3C/g%3E%3Cg transform='translate(86.1 453.2) rotate(4) scale(0.46) translate(-12 -12)'%3E%3Cpath d='M12 4 L13.6 10.4 L20 12 L13.6 13.6 L12 20 L10.4 13.6 L4 12 L10.4 10.4 Z'/%3E%3C/g%3E%3Cg transform='translate(279.0 421.1) rotate(-16) scale(0.45) translate(-12 -12)'%3E%3Cpath d='M12 6 L18 17 H6 Z'/%3E%3C/g%3E%3Cg transform='translate(60.0 424.8) rotate(-8) scale(0.63) translate(-12 -12)'%3E%3Cpath d='M12 4 L13.6 10.4 L20 12 L13.6 13.6 L12 20 L10.4 13.6 L4 12 L10.4 10.4 Z'/%3E%3C/g%3E%3Cg transform='translate(276.1 145.4) rotate(15) scale(0.74) translate(-12 -12)'%3E%3Cpath d='M12 6 L18 17 H6 Z'/%3E%3C/g%3E%3Cg transform='translate(266.7 98.9) rotate(-23) scale(0.54) translate(-12 -12)'%3E%3Cpath d='M12 6 L18 17 H6 Z'/%3E%3C/g%3E%3Cg transform='translate(-1.3 1.4) rotate(14) scale(0.45) translate(-12 -12)'%3E%3Cpath d='M12 6 L18 17 H6 Z'/%3E%3C/g%3E%3Cg transform='translate(-1.3 461.4) rotate(14) scale(0.45) translate(-12 -12)'%3E%3Cpath d='M12 6 L18 17 H6 Z'/%3E%3C/g%3E%3Cg transform='translate(458.7 1.4) rotate(14) scale(0.45) translate(-12 -12)'%3E%3Cpath d='M12 6 L18 17 H6 Z'/%3E%3C/g%3E%3Cg transform='translate(458.7 461.4) rotate(14) scale(0.45) translate(-12 -12)'%3E%3Cpath d='M12 6 L18 17 H6 Z'/%3E%3C/g%3E%3Cg transform='translate(39.2 109.2) rotate(6) scale(0.58) translate(-12 -12)'%3E%3Cpath d='M12 10.5 A1.5 1.5 0 1 1 11.99 10.5 Z'/%3E%3C/g%3E%3Cg transform='translate(311.1 176.3) rotate(-17) scale(0.56) translate(-12 -12)'%3E%3Cpath d='M12 10.5 A1.5 1.5 0 1 1 11.99 10.5 Z'/%3E%3C/g%3E%3Cg transform='translate(274.3 440.9) rotate(-14) scale(0.57) translate(-12 -12)'%3E%3Cpath d='M12 6 v12 M6 12 h12'/%3E%3C/g%3E%3Cg transform='translate(134.1 239.5) rotate(-19) scale(0.55) translate(-12 -12)'%3E%3Cpath d='M4 12 q3 -3 6 0 t6 0'/%3E%3C/g%3E%3Cg transform='translate(275.1 124.9) rotate(-17) scale(0.62) translate(-12 -12)'%3E%3Cpath d='M12 6 L18 17 H6 Z'/%3E%3C/g%3E%3Cg transform='translate(231.0 311.1) rotate(-5) scale(0.67) translate(-12 -12)'%3E%3Cpath d='M12 8 A4 4 0 1 1 11.99 8 Z'/%3E%3C/g%3E%3Cg transform='translate(104.1 102.3) rotate(8) scale(0.71) translate(-12 -12)'%3E%3Cpath d='M12 6 v12 M6 12 h12'/%3E%3C/g%3E%3Cg transform='translate(108.9 273.9) rotate(19) scale(0.60) translate(-12 -12)'%3E%3Cpath d='M12 4 L13.6 10.4 L20 12 L13.6 13.6 L12 20 L10.4 13.6 L4 12 L10.4 10.4 Z'/%3E%3C/g%3E%3Cg transform='translate(253.1 66.8) rotate(15) scale(0.60) translate(-12 -12)'%3E%3Cpath d='M12 4 L13.6 10.4 L20 12 L13.6 13.6 L12 20 L10.4 13.6 L4 12 L10.4 10.4 Z'/%3E%3C/g%3E%3Cg transform='translate(446.2 265.1) rotate(-4) scale(0.62) translate(-12 -12)'%3E%3Cpath d='M12 6 L18 17 H6 Z'/%3E%3C/g%3E%3Cg transform='translate(44.5 41.2) rotate(9) scale(0.71) translate(-12 -12)'%3E%3Cpath d='M12 8 A4 4 0 1 1 11.99 8 Z'/%3E%3C/g%3E%3Cg transform='translate(105.1 401.8) rotate(-14) scale(0.52) translate(-12 -12)'%3E%3Cpath d='M12 6 v12 M6 12 h12'/%3E%3C/g%3E%3Cg transform='translate(170.9 123.9) rotate(5) scale(0.75) translate(-12 -12)'%3E%3Cpath d='M4 12 q3 -3 6 0 t6 0'/%3E%3C/g%3E%3Cg transform='translate(333.2 392.4) rotate(21) scale(0.77) translate(-12 -12)'%3E%3Cpath d='M4 12 q3 -3 6 0 t6 0'/%3E%3C/g%3E%3Cg transform='translate(211.5 203.3) rotate(13) scale(0.52) translate(-12 -12)'%3E%3Cpath d='M12 8 A4 4 0 1 1 11.99 8 Z'/%3E%3C/g%3E%3Cg transform='translate(93.9 116.1) rotate(-10) scale(0.50) translate(-12 -12)'%3E%3Cpath d='M4 12 q3 -3 6 0 t6 0'/%3E%3C/g%3E%3Cg transform='translate(260.8 284.4) rotate(-29) scale(0.46) translate(-12 -12)'%3E%3Cpath d='M12 6 v12 M6 12 h12'/%3E%3C/g%3E%3Cg transform='translate(91.8 430.8) rotate(2) scale(0.50) translate(-12 -12)'%3E%3Cpath d='M12 6 L18 17 H6 Z'/%3E%3C/g%3E%3Cg transform='translate(362.5 247.2) rotate(-5) scale(0.58) translate(-12 -12)'%3E%3Cpath d='M4 12 q3 -3 6 0 t6 0'/%3E%3C/g%3E%3Cg transform='translate(150.6 366.5) rotate(8) scale(0.50) translate(-12 -12)'%3E%3Cpath d='M12 4 L13.6 10.4 L20 12 L13.6 13.6 L12 20 L10.4 13.6 L4 12 L10.4 10.4 Z'/%3E%3C/g%3E%3Cg transform='translate(424.8 236.8) rotate(-12) scale(0.64) translate(-12 -12)'%3E%3Cpath d='M12 8 A4 4 0 1 1 11.99 8 Z'/%3E%3C/g%3E%3Cg transform='translate(21.0 341.3) rotate(28) scale(0.72) translate(-12 -12)'%3E%3Cpath d='M12 6 L18 17 H6 Z'/%3E%3C/g%3E%3Cg transform='translate(251.0 15.5) rotate(20) scale(0.67) translate(-12 -12)'%3E%3Cpath d='M12 10.5 A1.5 1.5 0 1 1 11.99 10.5 Z'/%3E%3C/g%3E%3Cg transform='translate(202.9 291.1) rotate(-15) scale(0.65) translate(-12 -12)'%3E%3Cpath d='M4 12 q3 -3 6 0 t6 0'/%3E%3C/g%3E%3Cg transform='translate(41.3 180.0) rotate(-4) scale(0.51) translate(-12 -12)'%3E%3Cpath d='M4 12 q3 -3 6 0 t6 0'/%3E%3C/g%3E%3Cg transform='translate(93.3 207.7) rotate(13) scale(0.64) translate(-12 -12)'%3E%3Cpath d='M12 6 L18 17 H6 Z'/%3E%3C/g%3E%3Cg transform='translate(4.6 97.0) rotate(-17) scale(0.71) translate(-12 -12)'%3E%3Cpath d='M12 6 v12 M6 12 h12'/%3E%3C/g%3E%3Cg transform='translate(464.6 97.0) rotate(-17) scale(0.71) translate(-12 -12)'%3E%3Cpath d='M12 6 v12 M6 12 h12'/%3E%3C/g%3E%3Cg transform='translate(448.6 398.9) rotate(25) scale(0.53) translate(-12 -12)'%3E%3Cpath d='M4 12 q3 -3 6 0 t6 0'/%3E%3C/g%3E%3Cg transform='translate(330.4 255.3) rotate(23) scale(0.59) translate(-12 -12)'%3E%3Cpath d='M4 12 q3 -3 6 0 t6 0'/%3E%3C/g%3E%3Cg transform='translate(248.7 159.4) rotate(-1) scale(0.49) translate(-12 -12)'%3E%3Cpath d='M12 10.5 A1.5 1.5 0 1 1 11.99 10.5 Z'/%3E%3C/g%3E%3Cg transform='translate(127.2 102.9) rotate(-3) scale(0.63) translate(-12 -12)'%3E%3Cpath d='M12 10.5 A1.5 1.5 0 1 1 11.99 10.5 Z'/%3E%3C/g%3E%3Cg transform='translate(204.5 123.5) rotate(9) scale(0.71) translate(-12 -12)'%3E%3Cpath d='M12 6 L18 17 H6 Z'/%3E%3C/g%3E%3Cg transform='translate(71.1 295.7) rotate(-25) scale(0.51) translate(-12 -12)'%3E%3Cpath d='M12 8 A4 4 0 1 1 11.99 8 Z'/%3E%3C/g%3E%3Cg transform='translate(118.6 254.7) rotate(-27) scale(0.51) translate(-12 -12)'%3E%3Cpath d='M12 8 A4 4 0 1 1 11.99 8 Z'/%3E%3C/g%3E%3Cg transform='translate(320.5 409.1) rotate(9) scale(0.61) translate(-12 -12)'%3E%3Cpath d='M12 4 L13.6 10.4 L20 12 L13.6 13.6 L12 20 L10.4 13.6 L4 12 L10.4 10.4 Z'/%3E%3C/g%3E%3Cg transform='translate(436.4 94.4) rotate(7) scale(0.66) translate(-12 -12)'%3E%3Cpath d='M4 12 q3 -3 6 0 t6 0'/%3E%3C/g%3E%3Cg transform='translate(-6.5 58.7) rotate(3) scale(0.71) translate(-12 -12)'%3E%3Cpath d='M12 4 L13.6 10.4 L20 12 L13.6 13.6 L12 20 L10.4 13.6 L4 12 L10.4 10.4 Z'/%3E%3C/g%3E%3Cg transform='translate(453.5 58.7) rotate(3) scale(0.71) translate(-12 -12)'%3E%3Cpath d='M12 4 L13.6 10.4 L20 12 L13.6 13.6 L12 20 L10.4 13.6 L4 12 L10.4 10.4 Z'/%3E%3C/g%3E%3Cg transform='translate(256.9 -5.9) rotate(20) scale(0.76) translate(-12 -12)'%3E%3Cpath d='M12 8 A4 4 0 1 1 11.99 8 Z'/%3E%3C/g%3E%3Cg transform='translate(256.9 454.1) rotate(20) scale(0.76) translate(-12 -12)'%3E%3Cpath d='M12 8 A4 4 0 1 1 11.99 8 Z'/%3E%3C/g%3E%3Cg transform='translate(382.8 261.1) rotate(26) scale(0.52) translate(-12 -12)'%3E%3Cpath d='M12 6 L18 17 H6 Z'/%3E%3C/g%3E%3Cg transform='translate(67.7 51.6) rotate(-30) scale(0.50) translate(-12 -12)'%3E%3Cpath d='M12 4 L13.6 10.4 L20 12 L13.6 13.6 L12 20 L10.4 13.6 L4 12 L10.4 10.4 Z'/%3E%3C/g%3E%3Cg transform='translate(128.9 318.0) rotate(-22) scale(0.49) translate(-12 -12)'%3E%3Cpath d='M4 12 q3 -3 6 0 t6 0'/%3E%3C/g%3E%3Cg transform='translate(203.9 186.4) rotate(-21) scale(0.46) translate(-12 -12)'%3E%3Cpath d='M12 8 A4 4 0 1 1 11.99 8 Z'/%3E%3C/g%3E%3Cg transform='translate(366.3 30.8) rotate(23) scale(0.47) translate(-12 -12)'%3E%3Cpath d='M12 4 L13.6 10.4 L20 12 L13.6 13.6 L12 20 L10.4 13.6 L4 12 L10.4 10.4 Z'/%3E%3C/g%3E%3Cg transform='translate(88.9 239.9) rotate(0) scale(0.47) translate(-12 -12)'%3E%3Cpath d='M12 6 L18 17 H6 Z'/%3E%3C/g%3E%3Cg transform='translate(155.9 4.7) rotate(8) scale(0.74) translate(-12 -12)'%3E%3Cpath d='M4 12 q3 -3 6 0 t6 0'/%3E%3C/g%3E%3Cg transform='translate(155.9 464.7) rotate(8) scale(0.74) translate(-12 -12)'%3E%3Cpath d='M4 12 q3 -3 6 0 t6 0'/%3E%3C/g%3E%3Cg transform='translate(73.7 441.3) rotate(9) scale(0.68) translate(-12 -12)'%3E%3Cpath d='M4 12 q3 -3 6 0 t6 0'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
    background-size: var(--doc-texture-size, 460px) var(--doc-texture-size, 460px);
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

  /* ── Type, back down again on a phone ─────────────────────────────────
     The step up above is for a screen held at arm's length showing the
     document at its designed measure. A phone is neither: 390px carries
     less than half the 210mm the sizes were drawn against, so the same
     type that reads comfortably on a laptop arrives oversized — a title
     wrapping across three lines, a client's name filling the card.

     So the scale is restated a third time, below the printed sizes rather
     than above them, and the display sizes are cut hardest because they
     are the ones the narrow measure punishes. Same selectors as the block
     above, later in the file, so they simply win inside the query.
     Listed rather than scaled, for the same reason as above: any one of
     them can be tuned without moving the rest. */
  @media (max-width: 639.98px) {
    .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[7px\\] { font-size: 7px; }
    .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[7\\.5px\\] { font-size: 7.5px; }
    .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[8px\\] { font-size: 8px; }
    .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[8\\.5px\\] { font-size: 8.5px; }
    .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[9px\\] { font-size: 9px; }
    .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[9\\.5px\\] { font-size: 9.5px; }
    .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[10px\\] { font-size: 9.5px; }
    .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[10\\.5px\\] { font-size: 10px; }
    .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[11px\\] { font-size: 10.5px; }
    .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[11\\.5px\\] { font-size: 11px; }
    .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[12px\\] { font-size: 11px; }
    .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[12\\.5px\\] { font-size: 11.5px; }
    .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[13px\\] { font-size: 12px; }
    .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[13\\.5px\\] { font-size: 12px; }
    .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[14px\\] { font-size: 12.5px; }
    .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[14\\.5px\\] { font-size: 12.5px; }
    .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[15px\\] { font-size: 13px; }
    .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[16px\\] { font-size: 13.5px; }
    .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[18px\\] { font-size: 15px; }
    .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[20px\\] { font-size: 16px; }
    .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[22px\\] { font-size: 17px; }
    .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[34px\\] { font-size: 25px; }
    .itinerary-print-area[data-published]:not([data-exporting]) .text-\\[36px\\] { font-size: 26px; }
    .itinerary-print-area[data-published]:not([data-exporting]) .text-xs { font-size: 11px; }
    .itinerary-print-area[data-published]:not([data-exporting]) .text-sm { font-size: 12px; }
    .itinerary-print-area[data-published]:not([data-exporting]) .text-base { font-size: 13.5px; }
    .itinerary-print-area[data-published]:not([data-exporting]) .text-lg { font-size: 15px; }
    .itinerary-print-area[data-published]:not([data-exporting]) .text-xl { font-size: 16px; }

    /* Three sizes in the document are set inline — the day number, the
       lead price and the per-standard price — so a plain rule cannot
       reach them. They carry a hook class for exactly this; !important is
       what it takes to outrank a style attribute, and it is confined to
       this query. */
    .itinerary-print-area[data-published]:not([data-exporting]) .doc-day-number { font-size: 24px !important; }
    .itinerary-print-area[data-published]:not([data-exporting]) .doc-price-lead { font-size: 21px !important; }
    .itinerary-print-area[data-published]:not([data-exporting]) .doc-price-option { font-size: 14.5px !important; }
  }

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
