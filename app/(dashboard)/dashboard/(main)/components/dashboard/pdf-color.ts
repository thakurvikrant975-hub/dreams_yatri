/** Chart colors are CSS (var(--color-dashboard-primary), oklch(), hex, named
 * colors, …) since they're shared with the on-screen recharts components —
 * jsPDF needs plain RGB triples. Resolving var() via getComputedStyle and
 * then letting a 1x1 canvas parse whatever's left is the only way to handle
 * every color form (including oklch) without hand-rolling a CSS color
 * parser; cached since the same handful of colors repeat across a report. */
const colorCache = new Map<string, [number, number, number]>();

export function resolveRgb(color: string): [number, number, number] {
  const cached = colorCache.get(color);
  if (cached) return cached;

  let resolved = color;
  if (resolved.startsWith("var(")) {
    const varName = resolved.slice(4, -1).trim();
    resolved = getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || "#6b7280";
  }
  let rgb: [number, number, number] = [107, 114, 128];
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = resolved;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    rgb = [r, g, b];
  } catch {
    // fall back to the default gray above
  }
  colorCache.set(color, rgb);
  return rgb;
}
