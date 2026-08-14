"use client";

// ─────────────────────────────────────────────────────────────────────────────
// useUndoableState — useState, with history.
//
// Deliberately the same signature as useState, because the builder has ~50
// setForm call sites and the value of undo is that it covers ALL of them, not
// just the ones somebody remembered to route through a special API. Swapping
// the hook at the single point where `form` is declared is the whole change.
//
// Why here rather than via a reducer: undo only needs immutable snapshots of
// state, and every edit path in the builder already produces a new form object
// (see day-mutations.ts / applyFieldEdit). Converting ~50 call sites into
// reducer actions would buy the same capability for considerably more risk.
// Snapshots are cheap for the same reason — an immutable update reuses every
// untouched subtree, so a 30-day itinerary doesn't get copied 50 times over.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";

/** Edits closer together than this fold into the previous history entry.
 * Without it, typing a day title is one undo step per keystroke, which makes
 * undo useless for exactly the thing people most want to undo. Short enough
 * that two deliberate actions (pick a hotel, then delete a day) stay separate. */
const COALESCE_MS = 350;

/** Snapshots kept. Fifty is far more than anyone reaches for and still bounded,
 * so a long editing session can't grow memory without limit. */
const HISTORY_LIMIT = 50;

export type History<T> = {
  past: T[];
  present: T;
  future: T[];
  /** When `present` was last written — drives coalescing. Lives in state
   * rather than a ref because the updater below must stay pure: React can
   * (and in StrictMode does) run it twice, which would corrupt a ref. */
  at: number;
};

// ── Pure transitions ────────────────────────────────────────────────────────
// Exported and separated from the hook so the history semantics can be tested
// directly, without a React renderer.

/** Records a new value. Returns the history unchanged for a no-op edit. */
export function pushHistory<T>(h: History<T>, next: T, now: number): History<T> {
  // A no-op edit (committing text unchanged, re-picking the same room) must
  // not consume a history slot.
  if (Object.is(next, h.present)) return h;

  const coalesce = h.past.length > 0 && now - h.at < COALESCE_MS;
  // Any new edit invalidates the redo branch — standard undo semantics.
  if (coalesce) return { ...h, present: next, future: [], at: now };

  return {
    past: [...h.past, h.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
    at: now,
  };
}

export function stepBack<T>(h: History<T>): History<T> {
  if (h.past.length === 0) return h;
  return {
    past: h.past.slice(0, -1),
    present: h.past[h.past.length - 1],
    future: [h.present, ...h.future],
    // Zeroed so the next edit always begins a fresh entry rather than folding
    // itself into whatever we just stepped back onto.
    at: 0,
  };
}

export function stepForward<T>(h: History<T>): History<T> {
  if (h.future.length === 0) return h;
  return {
    past: [...h.past, h.present],
    present: h.future[0],
    future: h.future.slice(1),
    at: 0,
  };
}

export type UndoControls<T> = {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Writes the value AND clears history — for hydrating from the server.
   * Loading a package must not be undoable: the step "before" it is the empty
   * form the component was constructed with, and letting someone undo into
   * that would look exactly like losing their package.
   *
   * Takes the same updater form as setState, because hydration merges into
   * whatever is already there rather than replacing it wholesale. */
  reset: Dispatch<SetStateAction<T>>;
};

export function useUndoableState<T>(
  initial: T,
): [T, Dispatch<SetStateAction<T>>, UndoControls<T>] {
  const [hist, setHist] = useState<History<T>>({
    past: [], present: initial, future: [], at: 0,
  });

  const setState = useCallback<Dispatch<SetStateAction<T>>>((action) => {
    setHist((h) => pushHistory(
      h,
      typeof action === "function" ? (action as (prev: T) => T)(h.present) : action,
      Date.now(),
    ));
  }, []);

  const undo = useCallback(() => setHist(stepBack), []);
  const redo = useCallback(() => setHist(stepForward), []);

  const reset = useCallback<Dispatch<SetStateAction<T>>>((action) => {
    setHist((h) => ({
      past: [],
      present: typeof action === "function" ? (action as (prev: T) => T)(h.present) : action,
      future: [],
      at: 0,
    }));
  }, []);

  const controls = useMemo<UndoControls<T>>(() => ({
    undo, redo, reset,
    canUndo: hist.past.length > 0,
    canRedo: hist.future.length > 0,
  }), [undo, redo, reset, hist.past.length, hist.future.length]);

  return [hist.present, setState, controls];
}
