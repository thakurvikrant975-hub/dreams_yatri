"use client";

import { useEffect } from "react";

/**
 * Keeps a focused `<input type="number">` from eating scroll input.
 *
 * Browsers treat the wheel and the up/down arrows as "step this number" while a
 * number input has focus, so scrolling with the pointer over a focused price
 * field silently rewrites it. It barely shows on a trackpad, which is why this
 * only surfaced on Windows mice — a rate can be off by dozens of steps before
 * anyone notices.
 *
 * The obvious fix — blur the field on wheel — is wrong here: several dashboard
 * screens commit on blur (landing-page items, the sales package dialog), so
 * scrolling past a field would fire saves. Instead the default step is
 * cancelled and the scroll the user actually asked for is performed by hand, on
 * the nearest scrolling ancestor. That matters because the dashboard scrolls in
 * its own `<main>`, not the window.
 *
 * Mounted once in the dashboard layout: the number inputs across these screens
 * are a mix of the shared <Input> and bare <input>, and this covers both,
 * including ones added later.
 */

/** One arrow press ≈ one wheel notch. */
const ARROW_STEP_PX = 48;
/** Firefox on Windows reports wheel deltas in lines rather than pixels. */
const LINE_HEIGHT_PX = 16;

function focusedNumberInput(): HTMLInputElement | null {
  const el = document.activeElement;
  return el instanceof HTMLInputElement && el.type === "number" ? el : null;
}

type Scroller = { scrollBy: (options: ScrollToOptions) => void; height: number };

function scrollerFor(el: HTMLElement): Scroller {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (/(auto|scroll|overlay)/.test(overflowY) && node.scrollHeight > node.clientHeight) {
      return { scrollBy: (o) => node!.scrollBy(o), height: node.clientHeight };
    }
  }
  return { scrollBy: (o) => window.scrollBy(o), height: window.innerHeight };
}

function toPixels(delta: number, mode: number, viewport: number): number {
  if (mode === WheelEvent.DOM_DELTA_LINE) return delta * LINE_HEIGHT_PX;
  if (mode === WheelEvent.DOM_DELTA_PAGE) return delta * viewport;
  return delta;
}

export function NumberInputScrollGuard() {
  useEffect(() => {
    function onWheel(e: WheelEvent) {
      const input = focusedNumberInput();
      // Only when the wheel is over the focused field — that's the only case
      // the browser would have stepped, and anywhere else must scroll natively.
      if (!input || !(e.target instanceof Node) || !input.contains(e.target)) return;

      const scroller = scrollerFor(input);
      e.preventDefault();
      scroller.scrollBy({
        top: toPixels(e.deltaY, e.deltaMode, scroller.height),
        left: toPixels(e.deltaX, e.deltaMode, scroller.height),
      });
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      const input = focusedNumberInput();
      if (!input || e.target !== input) return;

      e.preventDefault();
      scrollerFor(input).scrollBy({ top: e.key === "ArrowDown" ? ARROW_STEP_PX : -ARROW_STEP_PX });
    }

    // Non-passive: preventDefault on a wheel listener is ignored otherwise.
    document.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("wheel", onWheel);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return null;
}
