"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Fits the invoice to the screen without reflowing it.
 *
 * An invoice is not a web page. It is a fixed-layout document — a header row
 * whose two halves sit at opposite edges, a four-column meta row, a costed
 * table — drawn at one width (see INVOICE_WIDTH) and printed at that width.
 * Asked to render at 390px it did the only thing it could: overflowed. The
 * GSTIN, the CIN and the word INVOICE itself ran off the right edge, and the
 * meta row broke "INV-DY-260907-B8A406" across three lines.
 *
 * Reflowing it into a phone layout would fix the overflow and cost the thing
 * that makes it an invoice: the same document, laid out the same way, whoever
 * is looking at it. So it is scaled instead — every proportion held, only the
 * size changed, which is what a reader expects of a document and what the
 * printed copy will match exactly.
 *
 * WHY NOT CSS ALONE. `transform: scale` does not affect layout, so the wrapper
 * would keep the unscaled height and leave a page of blank space under a
 * shrunk invoice. The height has to come back from a measurement, hence the
 * ResizeObserver — it watches the document's own height, so a long invoice
 * with many line items reserves the room it actually needs rather than a
 * guess. (`zoom` would reflow and need no JS, but it is not reliable across
 * the browsers this has to print from.)
 *
 * SCREEN ONLY. Print gets the document at its natural size — scaling there
 * would shrink an A4 sheet inside an A4 sheet. Hence the print:* resets, and
 * the guard that never scales above 1: a wide window shows the invoice at its
 * designed size rather than blown up.
 *
 * NOTE ON LEGIBILITY. At 390px this lands near 0.45×, so the 10px labels
 * render around 4.5px. That is small, and deliberately so — it is a faithful
 * thumbnail of a document you pinch to read or download, not body copy. The
 * alternative is a reflowed mobile layout that no longer matches the PDF.
 */

/** The width the invoice is drawn at — max-w-215 on the document itself.
 *  Kept here as the single number the scale is computed from; change both or
 *  the fit is wrong. */
const INVOICE_WIDTH = 860;

export default function InvoiceFit({ children }: { children: React.ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const o = outer.current, i = inner.current;
    if (!o || !i) return;

    function fit() {
      const available = o!.clientWidth;
      // Never above 1: a 1400px window should show the invoice at its designed
      // size, not a magnified one.
      const s = Math.min(1, available / INVOICE_WIDTH);
      setScale(s);
      setHeight(i!.offsetHeight * s);
    }

    fit();
    // Watches the invoice itself, not just the window: fonts landing and
    // images decoding both change its height after the first measurement, and
    // a stale height leaves either a gap below it or a clipped last row.
    const ro = new ResizeObserver(fit);
    ro.observe(i);
    ro.observe(o);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={outer}
      className="w-full print:h-auto"
      // Height is the scaled height — without it the wrapper keeps the
      // document's full unscaled height and leaves blank space beneath.
      style={height != null ? { height } : undefined}
    >
      <div
        ref={inner}
        className="origin-top-left print:transform-none print:w-auto"
        style={{ width: INVOICE_WIDTH, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}
