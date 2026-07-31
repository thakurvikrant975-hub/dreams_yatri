import { NextRequest, NextResponse } from "next/server";
import dns from "node:dns/promises";
import net from "node:net";

// The PDF-export capture reads photos from various origins (R2-hosted
// uploads, third-party catalog/stock images) into a <canvas> via
// html2canvas — an origin without CORS headers (as-is the case for our own
// R2 bucket) makes the browser refuse to read those pixels at all, even
// though the <img> itself loads and displays fine. Fetching the bytes
// server-side sidesteps that entirely (CORS only applies to browser
// requests), so the client swaps each <img src> for this proxy's URL right
// before capture and gets back a same-origin response it can safely read.

function isPrivateIp(ip: string): boolean {
  if (net.isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 127 || a === 10 || a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  if (net.isIP(ip) === 6) {
    const lower = ip.toLowerCase();
    return lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80");
  }
  return true; // unrecognized — fail closed
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "Unsupported protocol" }, { status: 400 });
  }

  try {
    const { address } = await dns.lookup(parsed.hostname);
    if (isPrivateIp(address)) {
      console.error(`[pdf-image-proxy] blocked private IP for ${parsed.hostname} (${address})`);
      return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
    }
  } catch (e) {
    console.error(`[pdf-image-proxy] DNS lookup failed for ${parsed.hostname}:`, e);
    return NextResponse.json({ error: "Could not resolve host" }, { status: 400 });
  }

  // No explicit timeout — an earlier attempt to add an 8s AbortController
  // here turned out to be the actual regression: production legitimately
  // takes longer than that for some of these (large, multi-MB, third-party)
  // images, so the "fix" was cutting off fetches that would otherwise have
  // succeeded. Whatever the hosting platform's own outer function-timeout
  // is remains the real ceiling; better to let a slow-but-successful fetch
  // finish than to fail it early ourselves.
  const start = Date.now();
  let upstream: Response;
  try {
    upstream = await fetch(parsed.toString());
  } catch (e) {
    console.error(`[pdf-image-proxy] upstream fetch failed for ${url} after ${Date.now() - start}ms:`, e);
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    console.error(`[pdf-image-proxy] upstream returned ${upstream.status} for ${url} after ${Date.now() - start}ms`);
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }
  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    console.error(`[pdf-image-proxy] non-image content-type "${contentType}" for ${url}`);
    return NextResponse.json({ error: "Not an image" }, { status: 415 });
  }

  const buf = await upstream.arrayBuffer();
  console.log(`[pdf-image-proxy] ok: ${url} (${buf.byteLength} bytes, ${Date.now() - start}ms)`);
  return new NextResponse(buf, {
    headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=300" },
  });
}
