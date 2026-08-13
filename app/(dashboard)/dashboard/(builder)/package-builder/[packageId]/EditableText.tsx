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
<<<<<<< HEAD
  value, field, placeholder, fallback, displayTransform, className, style, multiline = false, as: Tag = "span",
  readOnly, readOnlyReason,
=======
  value, field, placeholder, fallback, className, style, multiline = false, as: Tag = "span",
  readOnly, readOnlyReason, display,
>>>>>>> 9dbe7e84f2c144511dbdfaa0bfdf3cfc7631426d
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
  /** Cosmetic formatting applied only to the rendered display (e.g. titleCase
   * for a destination typed in ALL CAPS) — never applied to `draft`/the live
   * `<input>` while actually editing, so it can't fight what's being typed or
   * rewrite the stored value underneath someone's cursor. */
  displayTransform?: (value: string) => string;
  className?: string;
  /** Carried onto every render path including the input, so an edited field
   * keeps the document's own colour and letter-spacing while being typed in
   * rather than snapping to browser defaults mid-edit. */
  style?: React.CSSProperties;
  multiline?: boolean;
  as?: "span" | "p" | "h1" | "h2" | "h3" | "div";
  /** Editable in principle, but not this value — a hotel's name and specs come
   * from the catalog, and letting someone retype them here would silently
   * desync the day from the room it's priced against. Renders as plain text
   * with an explanation on hover rather than as a dead control. */
  readOnly?: boolean;
  readOnlyReason?: string;
  /** Formats the value for DISPLAY only — the editor still opens on, and saves,
   * the raw string. Needed for times: the catalog stores check-in as "11:00"
   * (24h) while an exec types "11:00 AM", and the document should read the same
   * either way without rewriting what's stored underneath. */
  display?: (value: string) => string;
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

  if (!canEdit || readOnly) {
    // Exactly what the document rendered before any of this existed: real
    // text, a caller-supplied stand-in, or nothing at all — never an empty
    // element holding open space the content doesn't need.
<<<<<<< HEAD
    const raw = value.trim() || fallback?.trim() || "";
    if (!raw) return null;
    const shown = displayTransform ? displayTransform(raw) : raw;
=======
    const raw = value.trim();
    const shown = (raw && display ? display(raw) : raw) || fallback?.trim() || "";
    if (!shown) return null;
>>>>>>> 9dbe7e84f2c144511dbdfaa0bfdf3cfc7631426d
    return (
      <Tag
        className={cn(className, readOnly && canEdit && "cursor-default")}
        style={style}
        title={readOnly && canEdit ? readOnlyReason : undefined}
      >
        {shown}
      </Tag>
    );
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
      // Inline colour is dropped for the same reason as the class above — it
      // would beat any class we add. Everything else the caller set (letter
      // spacing, font variant) is kept, so the text doesn't reflow on click.
      style: style ? { ...style, color: undefined } : undefined,
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
        // The editor draws on a near-white field, but the caller's className
        // is styled for wherever the text NORMALLY sits — and some of those
        // places are dark. A destination tile's name and the hero title are
        // both `text-white` over a photo, which on this background is white
        // on white: you type and see nothing.
        //
        // Last wins: cn is twMerge, so this drops any conflicting text-* the
        // caller set while leaving size, weight and family alone. Callers with
        // a dark colour are unaffected in practice — they all resolve to
        // near-black anyway.
        "text-neutral-900",
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
      // Stable hook for targeting a specific inline editor — used by e2e
      // tests; see fieldKey in builder-context.
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
<<<<<<< HEAD
      {isEmpty ? (placeholder ?? "Click to add") : (displayTransform ? displayTransform(value) : value)}
=======
      {isEmpty ? (placeholder ?? "Click to add") : (display ? display(value) : value)}
>>>>>>> 9dbe7e84f2c144511dbdfaa0bfdf3cfc7631426d
    </Tag>
  );
}
