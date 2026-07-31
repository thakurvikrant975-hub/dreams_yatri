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

  // No timeout here previously meant a slow/hung upstream (a plausible
  // explanation for "works on localhost, fails in production" — a
  // serverless platform's own hard execution limit can kill this function
  // mid-fetch before it ever returns a catchable error) could run until the
  // hosting platform's own outer limit killed the function uncleanly.
  // Failing fast and loud here at least surfaces which image and why.
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let upstream: Response;
  try {
    upstream = await fetch(parsed.toString(), { signal: controller.signal });
  } catch (e) {
    console.error(`[pdf-image-proxy] upstream fetch failed for ${url} after ${Date.now() - start}ms:`, e);
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
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
