"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EditableText — click text in the preview, type, done.
//
// The builder's preview document doubles as the PDF source and as the public
// client-facing page, so this has three hard requirements beyond "let people
// type":
//
//   1. Outside the builder (the website) it must render as plain text with no
//      affordances at all — handled by useOptionalBuilder() returning null.
//   2. When the package is locked for costing review it must be inert, same as
//      every other edit surface. One check, via canEdit.
//   3. Nothing it adds may reach the PDF. pdfExport.ts rasterises this very
//      DOM, so the hover ring and placeholder carry `no-print`, and the input
//      is only ever in the tree while actually editing.
//
// Uses a real <textarea>/<input> swapped in on click rather than
// contentEditable: contentEditable pastes arbitrary HTML into a document that
// later gets rasterised, and the sanitising needed to make that safe is more
// work than swapping an element.
// ─────────────────────────────────────────────────────────────────────────────

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/app/lib/utils";
import { useOptionalBuilder, applyFieldEdit, fieldKey, type EditableField } from "./builder-context";

export function EditableText({
  value, field, placeholder, fallback, className, style, multiline = false, as: Tag = "span",
}: {
  value: string;
  field: EditableField;
  /** Shown (muted, italic) when the value is empty and editing is available —
   * an empty day description should invite a click, not be invisible. Never
   * rendered when editing is off, so the PDF and the website only ever show
   * real content. */
  placeholder?: string;
  /** Stand-in for an empty value when editing is OFF — e.g. a day with no
   * title still needs to read "Day 3" on the client's copy. Without one, an
   * empty value renders nothing at all rather than an empty box taking up
   * layout, which is what the conditional `{x && <p>…}` wrappers this replaced
   * used to do. */
  fallback?: string;
  className?: string;
  /** Carried onto every render path including the input, so an edited field
   * keeps the document's own colour and letter-spacing while being typed in
   * rather than snapping to browser defaults mid-edit. */
  style?: React.CSSProperties;
  multiline?: boolean;
  as?: "span" | "p" | "h1" | "h2" | "h3" | "div";
}) {
  const builder = useOptionalBuilder();
  const canEdit = !!builder?.canEdit;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  // Re-sync when the value changes underneath us (a drawer action, a reload) —
  // but never mid-edit, which would yank the caret out from under someone who
  // is still typing. Adjusting state during render behind a changed-check is
  // React's own recommended shape for this, and it's the pattern HeroCover in
  // ItineraryDocument already uses for the same reason; an effect here would
  // render once with the stale value before correcting it.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (!editing) setDraft(value);
  }

  // Grow a multiline field to fit its content. Layout effect so it happens
  // before paint and the box never visibly jumps a frame after opening.
  useLayoutEffect(() => {
    if (!editing || !multiline) return;
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [editing, multiline, draft]);

  if (!canEdit) {
    // Exactly what the document rendered before any of this existed: real
    // text, a caller-supplied stand-in, or nothing at all — never an empty
    // element holding open space the content doesn't need.
    const shown = value.trim() || fallback?.trim() || "";
    if (!shown) return null;
    return <Tag className={className} style={style}>{shown}</Tag>;
  }

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next === value) return;
    builder!.setForm((f) => applyFieldEdit(f, field, next));
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  if (editing) {
    const shared = {
      ref: inputRef as never,
      style,
      value: draft,
      autoFocus: true,
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Escape") { e.preventDefault(); cancel(); }
        // Enter commits a single-line field; in a multiline one it's a real
        // newline, so only ⌘/Ctrl+Enter commits there.
        if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          commit();
        }
      },
      className: cn(
        className,
        "no-print w-full bg-white/95 outline-none resize-none",
        "rounded-[3px] ring-2 ring-dashboard-primary/40 px-1 -mx-1",
      ),
    };
    return multiline
      ? <textarea {...shared} rows={1} />
      : <input {...shared} type="text" />;
  }

  const isEmpty = !value.trim();
  return (
    <Tag
      role="button"
      tabIndex={0}
      // How requestFieldFocus finds this editor — see builder-context.
      data-field={fieldKey(field)}
      onClick={() => setEditing(true)}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditing(true); }
      }}
      title="Click to edit"
      style={style}
      className={cn(
        className,
        // Hover/focus rings are pure CSS state and never appear in a static
        // capture, so they need no special handling. The empty-state
        // placeholder is real rendered text and does — `builder-only` is what
        // keeps "Add a description…" out of the exported PDF and out of print.
        "cursor-text rounded-[3px] transition-colors",
        "hover:bg-dashboard-primary/8 focus-visible:outline-2 focus-visible:outline-dashboard-primary/60",
        isEmpty && "builder-only no-print italic opacity-45",
      )}
    >
      {isEmpty ? (placeholder ?? "Click to add") : value}
    </Tag>
  );
}
