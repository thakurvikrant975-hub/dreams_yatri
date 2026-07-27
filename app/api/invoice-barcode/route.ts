// app/api/invoice-barcode/route.ts
//
// Renders a decorative barcode-style strip for the payment invoice email —
// NOT a real scannable barcode (no symbology encoding), just a deterministic
// bar pattern seeded from the reference string, so the same payment always
// gets the same-looking image. There's no scanning use case for a payment
// receipt in this app; if one shows up later, swap this for a real Code128/
// QR encoder.
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

const WIDTH = 560;
const HEIGHT = 120;

/** Simple deterministic string hash → seeded PRNG (mulberry32). */
function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildBarsSvg(ref: string): string {
  const rand = seededRandom(ref || "invoice");
  const bars: string[] = [];
  let x = 0;
  while (x < WIDTH - 4) {
    const w = 2 + Math.floor(rand() * 5); // 2-6px bar
    const gap = 1 + Math.floor(rand() * 3); // 1-3px gap
    if (rand() > 0.15) { // ~85% of slots are a black bar, rest stay blank — mirrors real barcode irregularity
      bars.push(`<rect x="${x}" y="0" width="${w}" height="${HEIGHT}" fill="#111111"/>`);
    }
    x += w + gap;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}"><rect width="${WIDTH}" height="${HEIGHT}" fill="#ffffff"/>${bars.join("")}</svg>`;
}

export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref") ?? "invoice";
  const svg = buildBarsSvg(ref);
  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      // Same ref always renders identically — safe to cache indefinitely.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
