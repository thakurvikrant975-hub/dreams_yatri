"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Keeps one broken panel from taking the whole builder with it.
//
// Without a boundary anywhere in this tree, any render error unmounts
// everything above it — which is why a crash in, say, the Destinations editor
// showed up as a blank white screen with no content and no message. Worse, the
// package being edited is in React state, so a blank screen means the exec
// can't see what they had, can't save it, and has no idea what went wrong.
//
// Two of these: one around the document, one around the sidebar panel. They're
// independent, so a drawer that throws leaves the document on screen and the
// work visible. Recovery is a re-render of the failed subtree only — `form`
// lives in the page above both boundaries and is untouched by either resetting.
//
// This does not make errors acceptable. It makes them reportable: the message
// is on screen instead of in a console nobody had open.
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import { AlertTriangle, RotateCcw } from "./builder-icons";

type Props = {
  /** Named so the message can say WHICH part failed — "the sidebar" and "the
   * preview" send someone to very different places. */
  label: string;
  children: React.ReactNode;
};

type State = { error: Error | null };

export class BuilderErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Kept: the component stack is the only thing that says which component
    // threw, and it isn't in the Error itself.
    console.error(`[builder] ${this.props.label} crashed`, error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="no-print flex flex-col items-center justify-center gap-3 p-8 text-center">
        <AlertTriangle size={22} className="text-dashboard-error/70" />
        <div className="space-y-1">
          <p className="text-[13px] font-semibold text-dashboard-base-content">
            {this.props.label} stopped working
          </p>
          <p className="text-[11.5px] text-dashboard-base-content/55 max-w-[42ch]">
            Your package is still here and still in memory — this is only the
            display. Try again, and if it keeps happening send the message below.
          </p>
        </div>
        <code className="max-w-[46ch] rounded-md bg-dashboard-base-200 px-2.5 py-1.5 text-[10.5px] text-dashboard-base-content/70 break-words">
          {error.message || String(error)}
        </code>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="flex items-center gap-1.5 rounded-lg border border-dashboard-base-300 px-3 py-1.5 text-[11.5px] font-medium hover:bg-dashboard-base-200"
        >
          <RotateCcw size={12} /> Try again
        </button>
      </div>
    );
  }
}
