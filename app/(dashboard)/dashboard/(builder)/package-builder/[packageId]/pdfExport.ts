import { missingTravellerAgesError } from "@/app/(dashboard)/dashboard/(builder)/package-builder/traveller-ages";
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
/** Top margin applied when placing a page's image (matches the 10mm
 * left/right margin already baked into the document's own horizontal
 * padding) — but ONLY when that page's own content already leaves at least
 * this much slack below A4_HEIGHT_MM (see buildPdf). Pages are sliced using
 * the FULL page height (no budget pre-shrunk for a margin): reserving less
 * content budget up front just makes "push a whole card to the next page"
 * gaps more frequent and bigger, without helping the page that's actually
 * tightly packed at all. So instead: a page that already has slack (because
 * something got pushed off it) gets a clean top margin, since it costs
 * nothing there — a page with none skips it rather than clipping content
 * that was already using the full page. First page always skips it too, so
 * the cover photo can bleed to the true top edge. */
export const PAGE_MARGIN_MM = 10;

/**
 * The travel date and traveller count feed the document's own header/cover
 * fields directly (see ItineraryDocument.tsx) — a package missing either
 * still "generates" a PDF, just one with a blank or zero-traveller cover,
 * which is never actually meant to go out. Checked once here so Download,
 * Preview, and the emailed attachment all enforce the same rule instead of
 * each silently producing a half-finished document.
 */
export function validateItineraryRequiredFields(form: {
  travelDate: string;
  adults: number;
  children: number;
  infants: number;
  /** -1 = not yet entered — see resizeAges in TripSetupPanel. Only present
   * once children/infants > 0, since that's what grows these arrays. */
  childrenAges?: number[];
  infantAges?: number[];
}): string | null {
  if (!form.travelDate) return "Add a travel date before generating the PDF or sending to the client.";
  if ((form.adults || 0) + (form.children || 0) + (form.infants || 0) < 1) {
    return "Add at least one traveller before generating the PDF or sending to the client.";
  }
  // Ages go through the shared rule rather than being re-tested here. Two
  // implementations of "does every child have an age" arrived independently —
  // one in this function, one in traveller-ages.ts behind Mark Ready and
  // markPackageReady's server-side guard — and they agreed on the -1 sentinel
  // but not on their thresholds. One of them had to win, and it has to be the
  // one the server also enforces, or the builder and the submit could disagree.
  const agesError = missingTravellerAgesError({
    children: form.children || 0,
    infants: form.infants || 0,
    childrenAges: form.childrenAges ?? [],
    infantAges: form.infantAges ?? [],
  });
  if (agesError) return agesError;
  return null;
}

export type PdfPage = {
  dataUrl: string;
  /** Rendered image height in mm at A4 (210mm) width — the last page (or any
   * page shortened to avoid slicing through a card) is naturally shorter
   * than a full 297mm; the PDF page below it is just left blank. */
  heightMm: number;
};

/** Elements the document already marks as "don't split across a page break"
 * (breakInside: avoid, used throughout ItineraryDocument for cards, table
 * rows, activity/ticket blocks) — read back off computed style so this stays
 * in sync with that markup without needing a second source of truth. Also
 * covers breakAfter: avoid (SectionHeader's "keep with next" hint, which the
 * real print/@page pipeline honors natively but this canvas-based one
 * otherwise has no concept of at all) by padding a little past the element
 * itself, so a heading can never end up as the last thing on a page with its
 * content starting fresh on the next one. */
function findUnsafeRanges(root: HTMLElement): { top: number; bottom: number }[] {
  const rootTop = root.getBoundingClientRect().top;
  const ranges: { top: number; bottom: number }[] = [];
  const all = root.querySelectorAll<HTMLElement>("*");
  for (const el of all) {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (rect.height <= 0) continue;
    if (style.breakInside === "avoid" || style.breakInside === "avoid-page") {
      ranges.push({ top: rect.top - rootTop, bottom: rect.bottom - rootTop });
    }
    if (style.breakAfter === "avoid" || style.breakAfter === "avoid-page") {
      ranges.push({ top: rect.top - rootTop, bottom: rect.bottom - rootTop + 40 });
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
    const tentative = Math.min(cursor + pageHeightPx, totalHeightPx);
    const next = Math.max(cursor + 1, resolveBreak(cursor, tentative, pageHeightPx, unsafeRanges));
    breaks.push(next);
    cursor = next;
  }
  return breaks;
}

/** Walks a tentative cut back to the top of the don't-split block it lands
 * inside of, repeating until the cut is clear of every one of them.
 *
 * Two things this has to get right, both of which the earlier single
 * `unsafeRanges.find(...)` got wrong:
 *
 *  1. **An oversized range must not hide the one that actually matters.**
 *     Ranges arrive in DOM order, so an ancestor always comes before its own
 *     children — and the document body (`<main>`) is itself marked
 *     break-inside:avoid. Taking the FIRST straddling range therefore picked
 *     `<main>` for the very first cut every time; being taller than a page it
 *     was then left alone as "nowhere it could fit", and the card genuinely
 *     being split — nested inside it, never even looked at — got sliced
 *     through. That is the half-line of text at the page 1/2 seam. Ranges
 *     too tall to ever fit a page are now filtered out first, so the search
 *     always continues down to a block that CAN be moved.
 *
 *  2. **Moving the cut can land it inside a different block.** Pushing back
 *     to a card's top can drop the cut into the middle of whatever sits just
 *     above it (a section heading's keep-with-next padding, most often), so
 *     the walk repeats rather than trusting one pass. Bounded, because a
 *     malformed set of ranges must not spin here; the loop always moves the
 *     cut strictly earlier, so it terminates on its own well before the cap
 *     in every real document.
 */
function resolveBreak(
  cursor: number, tentative: number, pageHeightPx: number,
  unsafeRanges: { top: number; bottom: number }[],
): number {
  let next = tentative;
  for (let pass = 0; pass < 32; pass++) {
    let earliest: number | null = null;
    for (const r of unsafeRanges) {
      // A block taller than a whole page has no page-sized spot it could
      // ever fit into no matter where it starts, so it gets split wherever
      // the cut falls — but it must not stop the search for a splittable
      // block nested inside it.
      if (r.bottom - r.top > pageHeightPx) continue;
      if (r.top > cursor && r.top < next && next < r.bottom) {
        if (earliest === null || r.top < earliest) earliest = r.top;
      }
    }
    // A page ending with some extra blank space reads far more professional
    // than a photo or paragraph sliced in half, so the block moves whole to
    // the next page.
    if (earliest === null) return next;
    next = earliest;
  }
  return next;
}

/** Cross-origin images load and display fine as a plain <img>/mask source,
 * but html2canvas can't read pixels from them into a canvas unless that
 * origin sends CORS headers — our own R2 bucket doesn't, so those specific
 * images render blank (or, for a canvas draw, throw) even though they're
 * visibly loaded. Routes through /api/pdf-image-proxy, which fetches the
 * bytes server-side (no CORS involved for a server-to-server request), and
 * returns a same-origin blob: URL that's always canvas-safe. Same-origin
 * URLs are returned unchanged. */
async function toCanvasSafeUrl(url: string): Promise<{ url: string; warning?: string }> {
  if (url.startsWith("data:") || url.startsWith("blob:")) return { url };

  let sameOrigin = true;
  try {
    sameOrigin = new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    // relative/unparsable URL — treat as same-origin, nothing to proxy
  }
  if (sameOrigin) return { url };

  // Falling through to the `return url` paths below is what produces a
  // blank/gradient-fallback image in the exported PDF (see HeroCover/
  // StopTile's onError handler in ItineraryDocument.tsx). Logged to the
  // console AND returned as a human-readable warning string — the export UI
  // (ItineraryPdfExport.tsx) surfaces that directly in a toast, so a
  // production-only failure is visible without anyone needing devtools open.
  //
  // No client-side timeout either — same reasoning as the proxy route
  // itself (see its comment): an earlier 12s AbortController here was the
  // actual regression, cutting off fetches that legitimately just take
  // longer than that for large third-party images under production
  // conditions but do eventually succeed.
  const start = Date.now();
  try {
    const res = await fetch(`/api/pdf-image-proxy?url=${encodeURIComponent(url)}`);
    if (!res.ok) {
      const warning = `proxy returned HTTP ${res.status} after ${Date.now() - start}ms`;
      console.warn(`[pdf-export] image proxy returned ${res.status} for ${url} after ${Date.now() - start}ms — falling back to the original (likely cross-origin, canvas-unsafe) URL`);
      return { url, warning };
    }
    const blob = await res.blob();
    return { url: URL.createObjectURL(blob) };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    const warning = `proxy fetch failed after ${Date.now() - start}ms (${reason})`;
    console.warn(`[pdf-export] image proxy fetch failed for ${url} after ${Date.now() - start}ms — falling back to the original URL:`, e);
    return { url, warning }; // best-effort — leave the original if the proxy fetch fails
  }
}

async function inlineCrossOriginImages(root: HTMLElement): Promise<string[]> {
  const images = Array.from(root.querySelectorAll("img"));
  const resolved = await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute("src");
      if (!src) return null;
      const { url: safeUrl, warning } = await toCanvasSafeUrl(src);
      return { img, safeUrl, warning };
    }),
  );
  const warnings: string[] = [];
  for (const r of resolved) {
    if (!r) continue;
    r.img.src = r.safeUrl;
    if (r.warning) warnings.push(`${r.img.alt || "photo"}: ${r.warning}`);
  }
  return warnings;
}

export type MaskedElementPatch = {
  /** Position relative to `root`, in unscaled CSS px — the same coordinate
   * space computePageBreaks/findUnsafeRanges already use. */
  top: number;
  left: number;
  width: number;
  height: number;
  image: HTMLImageElement;
};

/** html2canvas doesn't implement CSS mask-image at all (it's outside the
 * subset of CSS it supports) — an element like DyLogo that recolors an SVG
 * silhouette via `mask-image` + `background: currentColor` just renders as
 * a solid, unmasked block of that background color. Rasterize the mask
 * ourselves (draw the mask image to a canvas, then paint the element's
 * actual computed color into it with "source-in" compositing — exactly what
 * a CSS mask does).
 *
 * The rasterized result is deliberately NOT injected back into the DOM as an
 * <img> or background-image: html2canvas keeps a single size-limited LRU
 * cache for every image resource on the page (background-image and <img>
 * alike), and on a long itinerary with dozens of real photos, an entry
 * registered early — like a logo in the header, one of the first elements
 * processed — reliably gets evicted before html2canvas gets around to
 * actually painting it, rendering blank (confirmed via html2canvas's own
 * "Cache: Evicted LRU entry" / "Error loading image" logging; happens
 * identically whether it's a background-image or a real <img>). Instead,
 * the element is hidden from html2canvas entirely (so it paints nothing
 * there) and the rasterized image is composited directly onto html2canvas's
 * OUTPUT canvas afterward — see the `patches` return value — bypassing its
 * image pipeline altogether. */
async function rasterizeMaskedElements(root: HTMLElement): Promise<MaskedElementPatch[]> {
  const rootRect = root.getBoundingClientRect();
  const all = Array.from(root.querySelectorAll<HTMLElement>("*"));
  const targets = all
    .map((el) => {
      const style = getComputedStyle(el);
      const maskImage = style.maskImage !== "none" ? style.maskImage : style.webkitMaskImage;
      if (!maskImage || maskImage === "none") return null;
      const match = maskImage.match(/url\((["']?)(.*?)\1\)/);
      if (!match) return null;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      return {
        el, maskUrl: match[2], color: style.color,
        top: rect.top - rootRect.top, left: rect.left - rootRect.left,
        width: rect.width, height: rect.height,
      };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);

  const results = await Promise.all(
    targets.map(async (t) => {
      try {
        const { url: safeUrl } = await toCanvasSafeUrl(t.maskUrl);
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
          const src = new Image();
          src.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(t.width * 2);
            canvas.height = Math.round(t.height * 2);
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
            ctx.globalCompositeOperation = "source-in";
            ctx.fillStyle = t.color;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            const out = new Image();
            out.onload = () => resolve(out);
            out.onerror = reject;
            out.src = canvas.toDataURL("image/png");
          };
          src.onerror = reject;
          src.src = safeUrl;
        });
        return { el: t.el, top: t.top, left: t.left, width: t.width, height: t.height, image };
      } catch {
        return null; // best-effort — leave the mask as-is (will render as a solid block)
      }
    }),
  );

  const patches: MaskedElementPatch[] = [];
  for (const result of results) {
    if (!result) continue;
    const { el, ...patch } = result;
    el.style.visibility = "hidden";
    patches.push(patch);
  }
  return patches;
}

/** The capture root normally sits off-screen (so it doesn't flash on screen
 * during editing), and a long itinerary can have dozens of photos queued
 * behind the browser's per-host connection limit — html2canvas only waits
 * for images it catches mid-load at the moment it runs, so anything that
 * hadn't started downloading yet would silently render blank. Wait for every
 * <img> to actually finish (or fail) first so the DOM is fully ready. */
async function waitForImages(root: HTMLElement, timeoutMs = 15000): Promise<string[]> {
  const images = Array.from(root.querySelectorAll("img"));
  const results = await Promise.all(
    images.map((img) => {
      const startedComplete = img.complete;
      const start = Date.now();
      const settled = startedComplete ? Promise.resolve<"load" | "error" | "timeout">("load") : new Promise<"load" | "error" | "timeout">((resolve) => {
        const onLoad = () => resolve("load");
        const onError = () => resolve("error");
        img.addEventListener("load", onLoad, { once: true });
        img.addEventListener("error", onError, { once: true });
        setTimeout(() => resolve("timeout"), timeoutMs);
      });
      // naturalWidth === 0 after settling means the image never actually
      // decoded (broken src, load error, or it just never finished within
      // timeoutMs) — this is the direct DOM-level signal for "this photo is
      // about to render blank in the capture," logged here since by this
      // point React's own onError fallback (the gradient box) may already
      // have fired and replaced the <img> entirely, hiding the original cause.
      return settled.then((outcome) => {
        if (img.naturalWidth === 0) {
          const reason = outcome === "timeout" ? `timed out after ${timeoutMs}ms` : `${outcome} event fired but never decoded`;
          console.warn(`[pdf-export] image never loaded (naturalWidth=0), will render blank: ${img.src} — ${reason} (took ${Date.now() - start}ms)`);
          return `${img.alt || "photo"}: ${reason}`;
        }
        return null;
      });
    }),
  );
  return results.filter((r): r is string => r !== null);
}

/** The route map (Leaflet + Mapbox) initializes itself well after mount: a
 * geocoding API call, a dynamic `import("leaflet")`, then `fitBounds()` once
 * results land, only THEN does it append tile <img> elements. None of that
 * is done by the time the rest of this pipeline would otherwise be ready —
 * capturing too early means either no tiles at all (blank map) or a
 * `fitBounds()` that hasn't run yet, showing whatever default/previous view
 * instead of the actual route. Poll for the map container to even exist,
 * then for its tiles to exist and finish loading, before doing anything
 * else — the rest of the pipeline can otherwise safely assume the DOM is at
 * its final shape once this returns. */
async function waitForLeafletMaps(root: HTMLElement, timeoutMs = 20000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  let containers: HTMLElement[] = [];
  while (Date.now() < deadline) {
    containers = Array.from(root.querySelectorAll<HTMLElement>(".leaflet-container"));
    if (containers.length > 0) break;
    await sleep(200);
  }
  if (containers.length === 0) return; // no map on this document — nothing to wait for

  // Require the tile count to hold steady across two consecutive checks
  // before treating it as "done" — Leaflet can still be appending more tiles
  // (a pan, a re-render once the road route replaces the straight-line
  // placeholder) even after the ones present so far have all loaded, so
  // "some tiles exist and are complete" alone isn't a safe stopping point.
  let lastCount = -1;
  let stableSince = 0;
  while (Date.now() < deadline) {
    const tiles = Array.from(root.querySelectorAll<HTMLImageElement>(".leaflet-tile"));
    const allComplete = tiles.length > 0 && tiles.every((t) => t.complete);
    if (allComplete && tiles.length === lastCount) {
      if (Date.now() - stableSince > 400) break;
    } else {
      lastCount = tiles.length;
      stableSince = Date.now();
    }
    await sleep(200);
  }

  // A short settle — fitBounds()/pan/the road-route swap can still be
  // adjusting layer positions right after the last tile lands.
  await sleep(300);
}

export type MapPatch = {
  top: number;
  left: number;
  width: number;
  height: number;
  canvas: HTMLCanvasElement;
};

/** Once Leaflet's tiles have all loaded (see waitForLeafletMaps), capture
 * each map SEPARATELY, in its own isolated html2canvas call, rather than
 * letting it render as part of the whole document. html2canvas keeps a
 * single size-limited LRU cache for every image on the page — a wide route
 * (a flight arriving from north India down to Kerala, say) can need dozens
 * of 512px tiles, and against a long itinerary's worth of hotel/activity
 * photos also competing for the same cache, tiles registered early
 * routinely get evicted before html2canvas paints them, leaving the base
 * map blank (gray) while the marker/route SVG overlay — unaffected, since
 * it's not image-based — renders fine.
 *
 * Compositing a fix directly onto the main canvas (as done for the masked
 * logo) doesn't work here the way it did there: html2canvas's output has NO
 * true transparency anywhere on the page — the document's own root element
 * paints an opaque bg-white that's baked into the single flat raster before
 * anything else is drawn, so there's no "hole" a separately-rendered layer
 * could show through while the markers/routes html2canvas *did* draw
 * correctly on top of that opaque backdrop stay visible. An isolated
 * capture of just the map (tiles + markers + routes together) has no such
 * problem — with no competing photos, nothing gets evicted — and is pasted
 * wholesale over whatever the main capture produced for that rectangle. */
async function captureMapsSeparately(root: HTMLElement, scale: number): Promise<MapPatch[]> {
  const rootRect = root.getBoundingClientRect();
  const patches: MapPatch[] = [];
  for (const container of root.querySelectorAll<HTMLElement>(".leaflet-container")) {
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    const canvas = await html2canvas(container, {
      scale,
      useCORS: true,
      backgroundColor: null,
      windowWidth: container.offsetWidth,
    });
    patches.push({
      top: rect.top - rootRect.top,
      left: rect.left - rootRect.left,
      width: rect.width,
      height: rect.height,
      canvas,
    });
  }
  return patches;
}

// ─────────────────────────────────────────────────────────────────────────────
// Capture-time CSS shims
//
// html2canvas-pro re-implements CSS painting by hand, and two of the things it
// gets wrong are used on nearly every card in the document — which is why the
// exported PDF stopped looking like the template it was captured from. Both are
// fixed the same way: rewrite the offending declaration into something the
// library DOES paint correctly, on the off-screen capture twin only, and undo
// it once the capture is done. Nothing here touches the on-screen preview, the
// published page, or Cmd-P print, all three of which render in a real browser
// engine and were always correct.
//
// Verified against html2canvas-pro 2.2.4 in Chromium. If a future version fixes
// these natively, the shims become no-ops rather than a second wrong answer:
// each one first reads what the browser actually computed and re-expresses that
// same value, so a correctly-rendered declaration ends up unchanged.
// ─────────────────────────────────────────────────────────────────────────────

/** Colour-interpolation hints in a gradient, e.g. the ` in oklab` that Tailwind
 * v4 puts in EVERY `bg-linear-*` / `bg-radial-*` it generates.
 *
 * html2canvas's gradient parser predates that syntax and does not skip it, with
 * two different failure modes depending on the direction:
 *
 *   `bg-linear-to-b`  → Chrome computes `linear-gradient(in oklab, A, B)`
 *                       (it drops the redundant `to bottom`), and the parser
 *                       reads `in oklab` as if it were a colour stop — one
 *                       bogus stop is prepended and the whole ramp is wrong.
 *   `bg-linear-to-br` → Chrome computes `linear-gradient(to right bottom in
 *                       oklab, A, B)`; the parser matches the direction by
 *                       exact string, fails, and falls back to 0rad — a
 *                       to-bottom-right gradient renders bottom-to-TOP.
 *
 * Stripping the hint leaves a plain gradient both the parser and the browser
 * agree on. The only thing lost is the interpolation space itself: stops are
 * blended through sRGB rather than Oklab, which moves the mid-tones of a
 * two-colour ramp by a shade and is invisible next to the ramp running
 * backwards. */
const GRADIENT_INTERPOLATION_HINT =
  /\s*\bin\s+(?:oklab|oklch|srgb-linear|srgb|hsl|hwb|lab|lch|xyz-d50|xyz-d65|xyz)(?:\s+(?:shorter|longer|increasing|decreasing)\s+hue)?/g;

function stripGradientInterpolationHints(root: HTMLElement): () => void {
  const restore: [HTMLElement, string][] = [];
  for (const el of [root, ...root.querySelectorAll<HTMLElement>("*")]) {
    const computed = getComputedStyle(el).backgroundImage;
    if (!computed || computed === "none" || !computed.includes("gradient(")) continue;
    const rewritten = computed
      .replace(GRADIENT_INTERPOLATION_HINT, "")
      // `linear-gradient(in oklab, A, B)` strips down to a leading comma —
      // `linear-gradient(, A, B)` is not a value the browser will accept, and
      // an unparsable background-image would drop the gradient altogether.
      .replace(/\(\s*,\s*/g, "(");
    if (rewritten === computed) continue;
    restore.push([el, el.style.backgroundImage]);
    el.style.backgroundImage = rewritten;
  }
  return () => { for (const [el, value] of restore) el.style.backgroundImage = value; };
}

type ShadowLayer = { color: string; x: number; y: number; blur: number; spread: number; inset: boolean };

/** Splits a computed `box-shadow` into its layers. Chrome serialises each one
 * colour-first (`rgba(0, 0, 0, 0.1) 0px 10px 15px -3px`, `inset` last if
 * present) and separates layers with commas that the colour functions also
 * contain, hence the depth-aware split rather than `.split(",")`. */
function parseBoxShadow(value: string): ShadowLayer[] {
  const raw: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) { raw.push(value.slice(start, i)); start = i + 1; }
  }
  raw.push(value.slice(start));

  const layers: ShadowLayer[] = [];
  for (const entry of raw) {
    const inset = /\binset\b/.test(entry);
    const rest = entry.replace(/\binset\b/g, " ").trim();
    const color = rest.match(/^(?:[a-zA-Z-]+\([^)]*\)|#[0-9a-fA-F]{3,8}|[a-zA-Z]+)/)?.[0];
    if (!color) continue;
    const lengths = rest.slice(color.length).trim().split(/\s+/).filter(Boolean).map(parseFloat);
    if (lengths.length < 2 || lengths.some(Number.isNaN)) continue;
    layers.push({
      color, inset,
      x: lengths[0], y: lengths[1], blur: lengths[2] ?? 0, spread: lengths[3] ?? 0,
    });
  }
  return layers;
}

type Radii = [number, number, number, number];

/** Corner radii in px, in CSS order (TL, TR, BR, BL), resolved against the box
 * and clamped the way the browser clamps them — `rounded-pill` computes to
 * 9999px and has to come back as half the shorter side, or every rounded-rect
 * drawn below would be a garbled self-intersecting path. */
function readRadii(style: CSSStyleDeclaration, width: number, height: number): Radii {
  const one = (value: string, extent: number): number => {
    const first = value.trim().split(/\s+/)[0] ?? "0";
    const n = parseFloat(first);
    if (Number.isNaN(n)) return 0;
    return first.endsWith("%") ? (n / 100) * extent : n;
  };
  const radii: Radii = [
    one(style.borderTopLeftRadius, width),
    one(style.borderTopRightRadius, width),
    one(style.borderBottomRightRadius, width),
    one(style.borderBottomLeftRadius, width),
  ];
  // CSS "overlapping curves" rule: scale every corner by the tightest side.
  const factor = Math.min(
    1,
    width / Math.max(radii[0] + radii[1], 0.001),
    width / Math.max(radii[3] + radii[2], 0.001),
    height / Math.max(radii[0] + radii[3], 0.001),
    height / Math.max(radii[1] + radii[2], 0.001),
  );
  return radii.map((r) => Math.max(0, r * factor)) as Radii;
}

function roundedRectPath(x: number, y: number, w: number, h: number, radii: Radii): string {
  const max = Math.min(w, h) / 2;
  const [tl, tr, br, bl] = radii.map((r) => Math.max(0, Math.min(r, max)));
  return [
    `M${x + tl},${y}`,
    `H${x + w - tr}`, tr ? `A${tr},${tr} 0 0 1 ${x + w},${y + tr}` : "",
    `V${y + h - br}`, br ? `A${br},${br} 0 0 1 ${x + w - br},${y + h}` : "",
    `H${x + bl}`, bl ? `A${bl},${bl} 0 0 1 ${x},${y + h - bl}` : "",
    `V${y + tl}`, tl ? `A${tl},${tl} 0 0 1 ${x + tl},${y}` : "",
    "Z",
  ].filter(Boolean).join(" ");
}

let shadowNodeSeq = 0;

/**
 * Repaints every `box-shadow` in the document as something html2canvas can
 * actually draw, because its own box-shadow renderer is wrong in both
 * directions and both are all over this template:
 *
 *  - **An outer shadow renders as nothing at all.** Every `shadow-lg
 *    shadow-neutral-200/80` card lost the lift that separates it from the
 *    paper, which is most of why the exported page reads flat next to the
 *    preview it was captured from.
 *  - **An inset shadow — every `ring-inset` — renders as a thick opaque slab
 *    OUTSIDE the element, with square corners.** On a `rounded-pill` it floods
 *    the whole shape: the hero's "3 Days | 2 Nights" chip exported as a solid
 *    red blob rather than a hairline outline, and the Prepared-For card
 *    exported inside a grey band it does not have on screen.
 *
 * Both are replaced by an absolutely-positioned stand-in inserted immediately
 * before the element, so it paints behind it exactly where the real shadow sat,
 * and removed again afterwards:
 *
 *  - outer → an inline `<svg>` whose blurred rounded rect html2canvas rasterises
 *    through the browser itself (it serialises SVG to an image rather than
 *    re-implementing it, so `feGaussianBlur` is the browser's own and comes out
 *    right). Masked to punch out the element's own box, since CSS never paints
 *    an outer shadow inside the border box and the stand-in must not either.
 *  - inset ring → a plain bordered box, the one border-ish thing html2canvas
 *    draws correctly, laid over the element's padding box.
 *
 * Only the pure ring form of an inset shadow (no offset, no blur) is
 * reconstructed — that is what `ring-inset` generates and all this document
 * uses. A blurred inset shadow is simply dropped rather than approximated
 * badly; dropping one is what the library already did with every outer shadow.
 */
function repaintBoxShadows(root: HTMLElement): () => void {
  const restore: [HTMLElement, string, string][] = [];
  const added: HTMLElement[] = [];

  for (const el of root.querySelectorAll<HTMLElement>("*")) {
    const style = getComputedStyle(el);
    if (style.boxShadow === "none" || !style.boxShadow) continue;
    if (style.visibility === "hidden" || style.display === "none") continue;
    const parent = el.parentElement;
    if (!parent) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;

    const layers = parseBoxShadow(style.boxShadow);
    if (layers.length === 0) continue;

    restore.push([el, el.style.boxShadow, el.style.position]);
    el.style.boxShadow = "none";
    // A stand-in only paints behind its element if the element is itself
    // positioned — an unpositioned box is painted in an earlier pass than any
    // positioned sibling, whatever the DOM order. `relative` with no offsets
    // moves nothing, and is undone with the rest of this below.
    //
    // Skipped where it would not be free: `relative` also makes the element a
    // containing block, so an absolutely-positioned descendant currently
    // anchored to some ancestor further up would jump to this box instead —
    // a photo caption or a hero scrim landing somewhere it does not belong,
    // which is a far worse export than the thing being fixed. Those keep
    // their stand-in painted in front; it is masked to the element's own
    // outline either way, so all that costs is a pale halo drawn over a
    // neighbour instead of under it.
    if (style.position === "static" && !hasPositionedDescendant(el)) {
      el.style.position = "relative";
    }

    const radii = readRadii(style, rect.width, rect.height);
    const outer = layers.filter((l) => !l.inset);
    const rings = layers.filter((l) => l.inset && l.blur === 0 && l.x === 0 && l.y === 0 && l.spread > 0);

    if (outer.length > 0) added.push(placeStandIn(parent, el, rect, outerShadowSvg(rect, radii, outer)));
    for (const ring of rings) {
      added.push(placeStandIn(parent, el, rect, insetRingBox(style, rect, radii, ring)));
    }
  }

  return () => {
    for (const node of added) node.remove();
    for (const [el, boxShadow, position] of restore) {
      el.style.boxShadow = boxShadow;
      el.style.position = position;
    }
  };
}

function hasPositionedDescendant(el: HTMLElement): boolean {
  for (const child of el.querySelectorAll<HTMLElement>("*")) {
    const position = getComputedStyle(child).position;
    if (position === "absolute" || position === "fixed") return true;
  }
  return false;
}

/** A stand-in, and where its top-left corner sits relative to the element's
 * border box — negative for a shadow, whose blur spills outwards, positive for
 * a ring, which sits in on the padding box. */
type StandIn = { node: HTMLElement; dx: number; dy: number };

/** Drops a stand-in into the flow immediately before `el` and nudges it onto
 * `el`'s own rectangle. Absolute positioning resolves against whichever
 * ancestor happens to be positioned, which is not knowable from here on an
 * arbitrary card — so rather than guess, the node is inserted at 0,0, measured
 * where it actually landed, and offset by the difference. Being absolute, it
 * takes no space, which is what keeps it safe to do inside a flex row or a
 * grid cell. */
function placeStandIn(parent: HTMLElement, el: HTMLElement, rect: DOMRect, standIn: StandIn): HTMLElement {
  const { node, dx, dy } = standIn;
  node.style.position = "absolute";
  node.style.left = "0";
  node.style.top = "0";
  node.style.pointerEvents = "none";
  parent.insertBefore(node, el);
  const placed = node.getBoundingClientRect();
  node.style.left = `${rect.left + dx - placed.left}px`;
  node.style.top = `${rect.top + dy - placed.top}px`;
  return node;
}

function outerShadowSvg(rect: DOMRect, radii: Radii, layers: ShadowLayer[]): StandIn {
  const bleed = Math.ceil(Math.max(
    ...layers.map((l) => Math.abs(l.x) + Math.abs(l.y) + l.blur * 1.5 + Math.max(l.spread, 0)),
  )) + 2;
  const w = rect.width + bleed * 2;
  const h = rect.height + bleed * 2;
  const id = `dy-shadow-${shadowNodeSeq++}`;

  // Painted back to front so the FIRST layer in the CSS value ends up on top,
  // which is the order the spec stacks them in.
  const shapes = layers.slice().reverse().map((l, i) => {
    const grow = l.spread;
    const x = bleed + l.x - grow;
    const y = bleed + l.y - grow;
    const sw = Math.max(0, rect.width + grow * 2);
    const sh = Math.max(0, rect.height + grow * 2);
    const spreadRadii = radii.map((r) => (r > 0 ? Math.max(0, r + grow) : 0)) as Radii;
    const path = roundedRectPath(x, y, sw, sh, spreadRadii);
    const filter = l.blur > 0 ? ` filter="url(#${id}-b${i})"` : "";
    return `<path d="${path}" fill="${l.color}"${filter}/>`;
  }).join("");

  // A CSS blur radius is twice the Gaussian's standard deviation.
  const filters = layers.slice().reverse().map((l, i) => (l.blur > 0
    ? `<filter id="${id}-b${i}" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="${l.blur / 2}"/></filter>`
    : "")).join("");

  const node = document.createElement("div");
  node.setAttribute("data-pdf-shadow", "");
  node.style.width = `${w}px`;
  node.style.height = `${h}px`;
  node.innerHTML =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
    + `<defs>${filters}`
    // Everything is drawn through a mask that knocks out the element's own
    // box: the stand-in sits behind the element, but an element with a
    // translucent (or absent) background would otherwise show the shadow
    // through its middle, which a real box-shadow never does.
    + `<mask id="${id}-m" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}">`
    + `<rect x="0" y="0" width="${w}" height="${h}" fill="#fff"/>`
    + `<path d="${roundedRectPath(bleed, bleed, rect.width, rect.height, radii)}" fill="#000"/>`
    + `</mask></defs>`
    + `<g mask="url(#${id}-m)">${shapes}</g>`
    + `</svg>`;
  return { node, dx: -bleed, dy: -bleed };
}

function insetRingBox(style: CSSStyleDeclaration, rect: DOMRect, radii: Radii, ring: ShadowLayer): StandIn {
  // An inset shadow is painted inside the border, so the ring sits on the
  // padding box — which matters for the hero's duration chip, the one place
  // here that carries a border and a ring at once.
  const top = parseFloat(style.borderTopWidth) || 0;
  const right = parseFloat(style.borderRightWidth) || 0;
  const bottom = parseFloat(style.borderBottomWidth) || 0;
  const left = parseFloat(style.borderLeftWidth) || 0;
  const w = Math.max(0, rect.width - left - right);
  const h = Math.max(0, rect.height - top - bottom);
  const inner: Radii = [
    Math.max(0, radii[0] - Math.max(top, left)),
    Math.max(0, radii[1] - Math.max(top, right)),
    Math.max(0, radii[2] - Math.max(bottom, right)),
    Math.max(0, radii[3] - Math.max(bottom, left)),
  ];

  const node = document.createElement("div");
  node.setAttribute("data-pdf-ring", "");
  node.style.boxSizing = "border-box";
  node.style.width = `${w}px`;
  node.style.height = `${h}px`;
  node.style.border = `${ring.spread}px solid ${ring.color}`;
  node.style.borderRadius = inner.map((r) => `${r}px`).join(" ");
  return { node, dx: left, dy: top };
}

/** Every capture-time CSS rewrite, applied together and undone together. */
function applyCaptureCssShims(root: HTMLElement): () => void {
  const undo = [stripGradientInterpolationHints(root), repaintBoxShadows(root)];
  return () => { for (const fn of undo.reverse()) fn(); };
}

export type PdfCaptureResult = {
  pages: PdfPage[];
  /** Human-readable "<photo label>: <reason>" entries for any photo that
   * ended up rendering blank — surfaced directly in a toast by
   * ItineraryPdfExport.tsx so a production-only image failure is visible
   * without anyone needing devtools open. Empty when everything loaded. */
  imageWarnings: string[];
};

/**
 * Captures `root` (must already be laid out at exactly 210mm CSS width, with
 * natural height for its full content) and slices it into A4 page images.
 */
export async function captureToPdfPages(root: HTMLElement, scale = 2): Promise<PdfCaptureResult> {
  // Hide builder-only chrome for the duration of the capture.
  //
  // html2canvas rasterises the *screen* DOM — @media print never runs — so the
  // document's own `.no-print` rule (which lives inside @media print) has no
  // effect here at all. Anything that exists only to make the preview editable
  // would otherwise be baked into the client's PDF: most visibly the "Click to
  // add…" placeholders EditableText shows for empty fields.
  //
  // Driven by an attribute rather than by mutating each element so it covers
  // every edit affordance added later without this function needing to know
  // about them; the matching rule is in ItineraryDocument's PRINT_STYLES,
  // outside the @media print block for exactly this reason.
  root.setAttribute("data-exporting", "true");
  try {
    return await captureToPdfPagesInner(root, scale);
  } finally {
    root.removeAttribute("data-exporting");
  }
}

async function captureToPdfPagesInner(root: HTMLElement, scale: number): Promise<PdfCaptureResult> {
  const rootWidthPx = root.offsetWidth;
  // Slice using the FULL page height — shrinking this budget up front to
  // "make room for a margin" only forces more (and bigger) whole-card
  // pushes to the next page, which is worse than the thing it's trying to
  // avoid. Margins are applied afterward, per page, only where they're free
  // (see buildPdf) — never at the cost of pushing content that would
  // otherwise have fit.
  const pageHeightPx = rootWidthPx * (A4_HEIGHT_MM / A4_WIDTH_MM);

  await waitForLeafletMaps(root);
  // Captured before the main html2canvas pass touches anything else — see
  // captureMapsSeparately for why each map needs its own isolated capture.
  const mapPatches = await captureMapsSeparately(root, scale);
  const maskPatches = await rasterizeMaskedElements(root);
  const proxyWarnings = await inlineCrossOriginImages(root);
  const loadWarnings = await waitForImages(root);
  // A proxy failure (recorded pre-swap, by alt label) and a post-swap load
  // failure (recorded independently) can both fire for the same photo —
  // de-dupe by label so the toast doesn't repeat "Cover photo" twice.
  const seenLabels = new Set<string>();
  const imageWarnings = [...proxyWarnings, ...loadWarnings].filter((w) => {
    const label = w.split(":")[0];
    if (seenLabels.has(label)) return false;
    seenLabels.add(label);
    return true;
  });

  // Measured after every async step above has settled the DOM to its final
  // shape — measuring earlier (e.g. while the map is still showing its
  // "Loading map…" placeholder) would capture stale geometry for anything
  // whose height changes once its content finishes loading.
  const unsafeRanges = findUnsafeRanges(root);

  // Rewrites of the declarations html2canvas paints incorrectly — gradients
  // and box-shadows, see applyCaptureCssShims. Applied last, once every
  // measurement above is taken: the stand-ins they insert are absolutely
  // positioned and change no geometry, but they'd add meaningless entries to
  // the unsafe-range list if they were in the tree when it was built.
  const undoShims = applyCaptureCssShims(root);
  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(root, {
      scale,
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: rootWidthPx,
    });
  } finally {
    undoShims();
  }

  // Paint onto a FRESH canvas rather than reusing html2canvas's own output
  // context directly: html2canvas's internal renderer performs many nested
  // ctx.save()/ctx.clip()/ctx.restore() calls (for overflow, rounded
  // corners, etc.) — if that leaves the context with a stray, unbalanced
  // clip region active by the time it hands control back, every subsequent
  // draw (including a plain fillRect, confirmed while debugging this)
  // silently no-ops without throwing. Copying the finished bitmap into a
  // brand-new canvas gives a context with no such history.
  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = canvas.width;
  finalCanvas.height = canvas.height;
  const finalCtx = finalCanvas.getContext("2d")!;
  finalCtx.drawImage(canvas, 0, 0);

  // Each map's isolated (tiles + markers + routes, all correct) capture
  // pastes wholesale over whatever the main capture produced for that exact
  // rectangle — no need to separate layers since the isolated version is
  // already complete on its own.
  for (const patch of mapPatches) {
    finalCtx.drawImage(
      patch.canvas,
      patch.left * scale, patch.top * scale, patch.width * scale, patch.height * scale,
    );
  }
  for (const patch of maskPatches) {
    finalCtx.drawImage(
      patch.image,
      patch.left * scale, patch.top * scale, patch.width * scale, patch.height * scale,
    );
  }

  const totalHeightPx = finalCanvas.height / scale;
  const breaksPx = computePageBreaks(totalHeightPx, pageHeightPx, unsafeRanges);

  const pages: PdfPage[] = [];
  let cursorPx = 0;
  for (const breakPx of breaksPx) {
    const sliceHeightPx = breakPx - cursorPx;
    if (sliceHeightPx <= 0) { cursorPx = breakPx; continue; }

    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = finalCanvas.width;
    sliceCanvas.height = sliceHeightPx * scale;
    const ctx = sliceCanvas.getContext("2d")!;
    ctx.drawImage(
      finalCanvas,
      0, cursorPx * scale, finalCanvas.width, sliceHeightPx * scale,
      0, 0, finalCanvas.width, sliceHeightPx * scale,
    );

    pages.push({
      dataUrl: sliceCanvas.toDataURL("image/jpeg", 0.92),
      heightMm: (sliceHeightPx / rootWidthPx) * A4_WIDTH_MM,
    });
    cursorPx = breakPx;
  }

  return { pages, imageWarnings };
}

export function buildPdf(pages: PdfPage[]): jsPDF {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  pages.forEach((page, i) => {
    if (i > 0) pdf.addPage();
    const slackMm = A4_HEIGHT_MM - page.heightMm;
    const isFirst = i === 0;
    const isLast = i === pages.length - 1;

    let y: number;
    if (isFirst) {
      // First page always bleeds to the true top edge — a margin there
      // would just be a blank band above the cover photo.
      y = 0;
    } else if (isLast) {
      // Bottom-anchor the last page: DocumentFooter is always the final
      // element in the document, so whatever slack this page has (it's
      // almost never a full 297mm — the footer is usually alone or nearly
      // alone on it) collects ABOVE the content instead of being left below
      // the footer. That pins the footer to the true bottom edge, the same
      // way the header bleeds to the true top edge on page one, instead of
      // it floating wherever the fixed-height slicing cursor happened to
      // land.
      y = Math.max(0, slackMm);
    } else {
      // Every interior page gets as much of the top margin as it can
      // actually afford: the full 10mm when there's slack to spare (this
      // page ended early because a card got pushed whole to the next one,
      // so the margin is free), scaled down to whatever's left when
      // there's only a little, and 0 only for the rare page that fills the
      // full height exactly — never enough clipped off to cut into real
      // content.
      y = Math.max(0, Math.min(PAGE_MARGIN_MM, slackMm));
    }
    pdf.addImage(page.dataUrl, "JPEG", 0, y, A4_WIDTH_MM, page.heightMm);
  });
  return pdf;
}
