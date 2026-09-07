"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Fits a fixed-layout document to the screen without reflowing it.
 *
 * Extracted from InvoiceFit, which solved this for the invoice first. The
 * voucher has the identical problem for the identical reason: both are
 * documents, not web pages — drawn at one width, printed at that width — and
 * asked to render at 390px they do the only thing they can and overflow. On
 * the voucher it was the two tables: five columns of header text ("Hotel",
 * "Room Type", "Check-in", "Check-out", "Nights") crushed into a phone's width
 * until every word wrapped and the header block grew taller than the rows it
 * labelled.
 *
 * Reflowing into a phone layout would fix the overflow and cost the thing that
 * makes it a document: the same page, laid out the same way, whoever is looking
 * at it. That matters more here than on the invoice — a guest reads their
 * voucher at a hotel desk while an ops person reads the same voucher on a
 * phone, and the two have to match line for line. So it is scaled instead:
 * every proportion held, only the size changed, matching the printed copy
 * exactly.
 *
 * WHY NOT CSS ALONE. `transform: scale` does not affect layout, so the wrapper
 * would keep the unscaled height and leave a page of blank space underneath.
 * The height has to come back from a measurement, hence the ResizeObserver —
 * which also means a long voucher with fourteen days of itinerary reserves the
 * room it actually needs rather than a guess. (`zoom` would reflow and need no
 * JS, but it is not reliable across the browsers this has to print from.)
 *
 * SCREEN ONLY. Print gets the document at its natural size — scaling there
 * would shrink an A4 sheet inside an A4 sheet. Hence the print:* resets, and
 * the guard that never scales above 1: a wide window shows the document at its
 * designed size rather than blown up.
 */
export default function FitToWidth({
  width,
  children,
}: {
  /** The width the document is drawn at, in CSS pixels. Must match the
   *  document's own fixed width or the fit is wrong. */
  width: number;
  children: React.ReactNode;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const o = outer.current, i = inner.current;
    if (!o || !i) return;

    function fit() {
      const available = o!.clientWidth;
      // Never above 1: a 1400px window should show the document at its designed
      // size, not a magnified one.
      const s = Math.min(1, available / width);
      setScale(s);
      setHeight(i!.offsetHeight * s);
    }

    fit();
    // Watches the document itself, not just the window: fonts landing and
    // images decoding both change its height after the first measurement, and
    // a stale height leaves either a gap below it or a clipped last row.
    const ro = new ResizeObserver(fit);
    ro.observe(i);
    ro.observe(o);
    return () => ro.disconnect();
  }, [width]);

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
        style={{ width, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}
