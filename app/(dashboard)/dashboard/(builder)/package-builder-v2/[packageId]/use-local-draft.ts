"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Local draft — the half of autosave that survives a crash.
//
// Server autosave already runs every few seconds, but "few seconds" is exactly
// the window in which a browser crash, a closed laptop or a stray refresh
// loses work. This writes the form to localStorage on every change, which is
// synchronous, free, and needs no network.
//
// The two halves are tied together by one rule:
//
//     a successful server save DELETES the local draft.
//
// So a draft existing on load means precisely "there were unsaved changes when
// this tab last stopped" — no timestamp comparison against the server, no
// guessing which copy is newer. Nothing to get subtly wrong.
//
// Restoring is not silent. It happens (losing work is worse than surprising
// someone) but it says so, with a way back — the draft is at most a few
// seconds ahead of the server copy, so undoing it is cheap.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";

/** Bumped if the shape ever changes incompatibly, so an old draft is ignored
 * rather than restored into a form that no longer matches it. */
const DRAFT_VERSION = 1;

/** Long enough that typing doesn't write on every keystroke, short enough that
 * almost nothing is lost to a crash. */
const WRITE_DELAY_MS = 800;

type StoredDraft<T> = { v: number; at: number; form: T };

export function draftKey(packageId: string): string {
  return `dy:pkgdraft:${packageId}`;
}

export function readDraft<T>(packageId: string): { form: T; at: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(draftKey(packageId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft<T>;
    if (parsed?.v !== DRAFT_VERSION || !parsed.form) return null;
    return { form: parsed.form, at: parsed.at };
  } catch {
    // Corrupt or unreadable — treat as no draft rather than breaking the page.
    return null;
  }
}

export function writeDraft<T>(packageId: string, form: T): void {
  try {
    const payload: StoredDraft<T> = { v: DRAFT_VERSION, at: Date.now(), form };
    window.localStorage.setItem(draftKey(packageId), JSON.stringify(payload));
  } catch {
    // Quota exceeded or storage disabled (private mode). The server autosave
    // is still running, so this is a degradation rather than a failure — and
    // throwing here would take the builder down over a cache write.
  }
}

export function dropDraft(packageId: string): void {
  try { window.localStorage.removeItem(draftKey(packageId)); } catch { /* see writeDraft */ }
}

export type LocalDraft<T> = {
  /** Unsaved work found on load, or null. */
  found: { form: T; at: number } | null;
  /** Stop offering it, and delete it. */
  dismiss: () => void;
  /** Delete it — call after a successful server save. */
  clear: () => void;
};

export function useLocalDraft<T>({ packageId, form, armed }: {
  packageId: string;
  form: T;
  /** False while the package is still loading, and while it's locked for
   * costing review — neither state should be writing drafts. */
  armed: boolean;
}): LocalDraft<T> {
  // Read once, at mount. Safe to do this early precisely because recovery is
  // NOT automatic — the draft is only offered, and by the time anyone clicks
  // Restore the package has long since hydrated. Lazy initialiser rather than
  // an effect: no setState-in-effect, and no render with the wrong answer.
  const [found, setFound] = useState<{ form: T; at: number } | null>(
    () => readDraft<T>(packageId),
  );

  // Write on change, debounced. Keyed on the form itself: every edit path
  // produces a new object (see day-mutations.ts), so this covers all of them
  // without any call site opting in.
  //
  // Held back while a recovery is still on offer. Hydration lands the SERVER
  // copy in `form`, and writing that would overwrite the very draft being
  // offered — destroying the unsaved work in the act of trying to save it.
  useEffect(() => {
    if (!armed || found) return;
    const timer = setTimeout(() => writeDraft(packageId, form), WRITE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [armed, packageId, form, found]);

  const dismiss = useCallback(() => {
    dropDraft(packageId);
    setFound(null);
  }, [packageId]);

  const clear = useCallback(() => {
    dropDraft(packageId);
  }, [packageId]);

  return { found, dismiss, clear };
}
