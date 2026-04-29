"use client";

import { CSSProperties } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type HeadingLevel = "h1" | "h2" | "h3";
export type HeadingVariant = "light" | "dark";
export type HeadingFont = "playfair" | "jakarta";
export type HighlightPosition = "inline" | "prefix" | "suffix";
export type SectionHeadingProps = {
  /** Plain (non-highlighted) portion of the heading */
  text: string;

  /**
   * The word / phrase to render in red-500.
   * Set `highlightPosition` to control where it appears.
   * Leave undefined for no highlight.
   */
  highlight?: string;

  /** Where to place the highlight relative to `text`. Default: "suffix" */
  highlightPosition?: HighlightPosition;

  /** h1 | h2 | h3. Default: "h2" */
  level?: HeadingLevel;

  /**
   * "light" — for white / gray backgrounds  → text-gray-900
   * "dark"  — for dark / navy backgrounds   → text-white
   * Default: "light"
   */
  variant?: HeadingVariant;

  /**
   * "playfair" — serif editorial (used in heroes, story pages)
   * "jakarta"  — sans-serif bold  (used in section headings)
   * Default: "jakarta" for h2/h3, "playfair" for h1
   */
  font?: HeadingFont;

  /**
   * Whether to italicise the highlight span.
   * Default: true when font="playfair", false otherwise.
   */
  italicHighlight?: boolean;

  /**
   * Whether to render the squiggly red underline beneath the highlight.
   * Default: false
   */
  squiggle?: boolean;

  /** Optional CSS animation string e.g. "hero-rise 0.6s ease 0.1s both" */
  animation?: string;

  /** Extra Tailwind classes on the wrapper element */
  className?: string;

  /** Override inline styles on the wrapper element */
  style?: CSSProperties;
};

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────────────────

const FONT_FAMILY: Record<HeadingFont, string> = {
  playfair: "'Playfair Display', Georgia, serif",
  jakarta:  "'Plus Jakarta Sans', 'Inter', sans-serif",
};

/** Base font-size scale per level — Tailwind clamp equivalents */
const FONT_SIZE: Record<HeadingLevel, string> = {
  h1: "clamp(2.2rem, 5.5vw, 3.8rem)",
  h2: "clamp(1.7rem, 3.5vw, 2.6rem)",
  h3: "clamp(1.3rem, 2.5vw, 1.8rem)",
};

const FONT_WEIGHT: Record<HeadingFont, number> = {
  playfair: 800,
  jakarta:  800,
};

const LINE_HEIGHT: Record<HeadingLevel, number> = {
  h1: 1.1,
  h2: 1.2,
  h3: 1.25,
};

/** Text color for the main (non-highlighted) text */
const TEXT_COLOR: Record<HeadingVariant, string> = {
  light: "#111827", // gray-900
  dark:  "#ffffff",
};

const HIGHLIGHT_COLOR = "#EF4444"; // red-500

// ─────────────────────────────────────────────────────────────────────────────
// Squiggle SVG
// ─────────────────────────────────────────────────────────────────────────────

function Squiggle() {
  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: "-10px",
        display: "block",
        lineHeight: 0,
        pointerEvents: "none",
      }}
    >
      <svg
        viewBox="0 0 300 10"
        preserveAspectRatio="none"
        style={{ width: "100%", height: "8px", display: "block" }}
      >
        <path
          d="M0 7 Q37.5 1 75 7 Q112.5 13 150 7 Q187.5 1 225 7 Q262.5 13 300 7"
          stroke={HIGHLIGHT_COLOR}
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Highlight span
// ─────────────────────────────────────────────────────────────────────────────

function HighlightSpan({
  text,
  italic,
  squiggle,
}: {
  text: string;
  italic: boolean;
  squiggle: boolean;
}) {
  return (
    <span
      style={{
        color: HIGHLIGHT_COLOR,
        fontStyle: italic ? "italic" : "normal",
        position: "relative",
        display: "inline-block",
        paddingBottom: squiggle ? "10px" : undefined,
      }}
    >
      {text}
      {squiggle && <Squiggle />}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function SectionHeading({
  text,
  highlight,
  highlightPosition = "suffix",
  level = "h2",
  variant = "light",
  font,
  italicHighlight,
  squiggle = false,
  animation,
  className = "",
  style = {},
}: SectionHeadingProps) {
  // Default font: playfair for h1, jakarta for h2/h3
  const resolvedFont: HeadingFont = font ?? (level === "h1" ? "playfair" : "jakarta");

  // Default italic: true for playfair, false for jakarta
  const resolvedItalic = italicHighlight ?? (resolvedFont === "playfair");

  const Tag = level;

  const baseStyle: CSSProperties = {
    fontFamily:  FONT_FAMILY[resolvedFont],
    fontSize:    FONT_SIZE[level],
    fontWeight:  FONT_WEIGHT[resolvedFont],
    lineHeight:  LINE_HEIGHT[level],
    color:       TEXT_COLOR[variant],
    margin:      0,
    padding:     0,
    animation:   animation,
    ...style,
  };

  // Build the inner content based on position
  const highlightNode = highlight ? (
    <HighlightSpan
      text={highlight}
      italic={resolvedItalic}
      squiggle={squiggle}
    />
  ) : null;

  const content = (() => {
    if (!highlight) return text;

    switch (highlightPosition) {
      case "prefix":
        return (
          <>
            {highlightNode}
            {" "}
            {text}
          </>
        );
      case "suffix":
        return (
          <>
            {text}
            {" "}
            {highlightNode}
          </>
        );
      case "inline":
        // `text` is treated as the part BEFORE the highlight;
        // use a separate `textAfter` prop pattern isn't needed —
        // just pass text="" and highlight="full string" when you
        // want full control, or split manually.
        return (
          <>
            {text}
            {highlightNode}
          </>
        );
      default:
        return text;
    }
  })();

  return (
    <Tag className={className} style={baseStyle}>
      {content}
    </Tag>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Named shorthand exports (optional DX convenience)
// ─────────────────────────────────────────────────────────────────────────────

/** Hero heading — h1, Playfair, works on both variants */
export function PageHeading(props: Omit<SectionHeadingProps, "level">) {
  return <SectionHeading {...props} level="h1" font={props.font ?? "playfair"} />;
}

/** Section heading — h2, Plus Jakarta Sans */
export function SectionTitle(props: Omit<SectionHeadingProps, "level">) {
  return <SectionHeading {...props} level="h2" font={props.font ?? "jakarta"} />;
}

/** Sub-section heading — h3, Plus Jakarta Sans */
export function SubHeading(props: Omit<SectionHeadingProps, "level">) {
  return <SectionHeading {...props} level="h3" font={props.font ?? "jakarta"} />;
}