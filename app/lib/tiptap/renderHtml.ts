/**
 * Zero-dependency Tiptap JSON → HTML serialiser for server-side rendering.
 * Handles every node/mark type used in BlogEditor without importing @tiptap/core,
 * so it never throws on null/unknown attribute values from the live editor.
 */

type Mark = { type: string; attrs?: Record<string, unknown> };

type TNode = {
  type?:    string;
  text?:    string;
  attrs?:   Record<string, unknown>;
  content?: TNode[];
  marks?:   Mark[];
};

// ── HTML-escape a plain text value ────────────────────────────────────────────
function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Apply inline marks to an already-escaped text string ─────────────────────
function applyMarks(html: string, marks: Mark[] = []): string {
  return marks.reduce((acc, mark) => {
    const a = mark.attrs ?? {};
    switch (mark.type) {
      case "bold":      return `<strong>${acc}</strong>`;
      case "italic":    return `<em>${acc}</em>`;
      case "underline": return `<u>${acc}</u>`;
      case "strike":    return `<s>${acc}</s>`;
      case "code":      return `<code>${acc}</code>`;
      case "highlight": return `<mark>${acc}</mark>`;
      case "link": {
        const href   = esc(a.href ?? "#");
        const target = a.target ? ` target="${esc(a.target)}"` : "";
        const rel    = a.target === "_blank" ? ' rel="noopener noreferrer"' : "";
        return `<a href="${href}"${target}${rel}>${acc}</a>`;
      }
      default: return acc;
    }
  }, html);
}

// ── Render a single node (recursive) ─────────────────────────────────────────
function renderNode(node: TNode): string {
  // Text leaf
  if (node.type === "text") {
    return applyMarks(esc(node.text), node.marks);
  }

  const inner = (node.content ?? []).map(renderNode).join("");
  const a     = node.attrs ?? {};

  // textAlign attribute — only emit style when meaningfully set
  const align =
    a.textAlign && a.textAlign !== null && a.textAlign !== "left"
      ? ` style="text-align: ${esc(a.textAlign)}"`
      : "";

  switch (node.type) {
    case "doc":
      return inner;

    case "paragraph":
      return `<p${align}>${inner}</p>`;

    case "heading": {
      const lvl = Number(a.level) || 1;
      return `<h${lvl}${align}>${inner}</h${lvl}>`;
    }

    case "bulletList":
      return `<ul>${inner}</ul>`;

    case "orderedList":
      return `<ol>${inner}</ol>`;

    case "listItem":
      return `<li>${inner}</li>`;

    case "blockquote":
      return `<blockquote>${inner}</blockquote>`;

    case "codeBlock": {
      const lang = a.language ? ` class="language-${esc(a.language)}"` : "";
      return `<pre><code${lang}>${inner}</code></pre>`;
    }

    case "horizontalRule":
      return "<hr>";

    case "hardBreak":
      return "<br>";

    case "image": {
      const raw = String(a.src ?? "").trim();
      if (!raw) return "";            // node saved without src — skip silently
      const src    = esc(raw);
      const alt    = esc(a.alt ?? "");
      const width  = a.width  ? ` width="${Number(a.width)}"`  : "";
      const height = a.height ? ` height="${Number(a.height)}"` : "";
      return `<img src="${src}" alt="${alt}"${width}${height} loading="lazy">`;
    }

    case "youtube": {
      // YouTube embed — the extension stores the embed URL in src or in the
      // original URL; normalise to nocookie embed format
      const raw = String(a.src ?? "");
      const src = raw.includes("youtube-nocookie.com") || raw.includes("youtu")
        ? raw.replace("youtube.com/watch?v=", "www.youtube-nocookie.com/embed/")
             .replace("youtu.be/", "www.youtube-nocookie.com/embed/")
        : raw;
      return src
        ? `<iframe src="${esc(src)}" width="640" height="360" allowfullscreen loading="lazy" class="youtube-embed"></iframe>`
        : "";
    }

    default:
      // Unknown node — render children so content isn't lost
      return inner;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function tiptapToHtml(doc: unknown): string {
  if (!doc || typeof doc !== "object") return "";
  try {
    return renderNode(doc as TNode);
  } catch {
    return "";
  }
}
