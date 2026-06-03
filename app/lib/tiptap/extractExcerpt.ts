/**
 * Extract a plain-text excerpt from a Tiptap JSON document.
 * Walks the node tree, collects text from the first meaningful
 * paragraph or heading, and truncates to `maxLength` characters.
 */

type TNode = {
  type?:    string;
  text?:    string;
  content?: TNode[];
};

function nodeText(node: TNode): string {
  if (node.type === "text") return node.text ?? "";
  return (node.content ?? []).map(nodeText).join("");
}

export function extractExcerpt(doc: unknown, maxLength = 220): string | null {
  if (!doc || typeof doc !== "object") return null;

  const root = doc as TNode;
  if (root.type !== "doc" || !Array.isArray(root.content)) return null;

  for (const node of root.content) {
    // Only pull from paragraphs and headings — skip blockquotes, code blocks, etc.
    if (node.type !== "paragraph" && node.type !== "heading") continue;

    const text = nodeText(node).trim();
    if (!text) continue;

    return text.length <= maxLength
      ? text
      : text.slice(0, maxLength).trimEnd() + "…";
  }

  return null;
}
