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
}): string | null {
  if (!form.travelDate) return "Add a travel date before generating the PDF or sending to the client.";
  if ((form.adults || 0) + (form.children || 0) + (form.infants || 0) < 1) {
    return "Add at least one traveller before generating the PDF or sending to the client.";
  }
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
    let next = Math.min(cursor + pageHeightPx, totalHeightPx);
    const blocking = unsafeRanges.find((r) => r.top < next && next < r.bottom && r.top > cursor);
    if (blocking) {
      // Always push the block to the next page instead — a page ending with
      // some extra blank space reads far more professional than a photo or
      // paragraph sliced in half. The only time it's left alone is a block
      // genuinely taller than one whole page, which has no page-sized spot
      // it could ever fit into no matter where it starts.
      const blockHeight = blocking.bottom - blocking.top;
      if (blockHeight <= pageHeightPx) {
        next = blocking.top;
      }
    }
    breaks.push(next);
    cursor = next;
  }
  return breaks;
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

  const canvas = await html2canvas(root, {
    scale,
    useCORS: true,
    backgroundColor: "#ffffff",
    windowWidth: rootWidthPx,
  });

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
