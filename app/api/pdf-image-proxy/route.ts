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

// A long itinerary fans this out across dozens of images per PDF, so this
// route runs far more often, and under more concurrency, than any other in
// the app — raise its own ceiling explicitly rather than trust the
// platform's default function timeout, which is easy to hit on a slow,
// large, third-party image and otherwise fails silently (no app-level log,
// just a cut-off connection).
export const maxDuration = 60;

// node's default fetch sends no User-Agent at all, which several photo CDNs
// and hotlink-protected stock-photo hosts (the exact kind of URL an AI
// itinerary prompt tells users to paste — see PackageWorkspace's
// buildAIPrompt) treat as a bot and 403 — a real browser tab requesting the
// same URL succeeds because it sends one. This is the single most common
// cause of "the image displays fine everywhere else but is blank in the
// PDF": the <img> tag itself loaded straight from the browser (which does
// send a UA), only the server-side proxy fetch that html2canvas needs was
// silently rejected.
const UPSTREAM_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
};

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

// A long itinerary can push 60-90+ images through this route per PDF
// (mapWithConcurrency in pdfExport.ts caps it at 6 in flight), which means
// the same handful of hostnames (the app's own R2 bucket, a hotel chain's
// CDN reused across many packages) get looked up over and over within the
// same burst. Caching the resolved address for a few minutes cuts that
// redundant latency — and one more round-trip that can itself fail — out of
// the common case without weakening the private-IP check, which still runs
// on every cache hit.
const dnsCache = new Map<string, { address: string; expires: number }>();
const DNS_CACHE_TTL_MS = 5 * 60 * 1000;

async function resolveHost(hostname: string): Promise<string> {
  const cached = dnsCache.get(hostname);
  if (cached && cached.expires > Date.now()) return cached.address;
  const { address } = await dns.lookup(hostname);
  dnsCache.set(hostname, { address, expires: Date.now() + DNS_CACHE_TTL_MS });
  return address;
}

/** One retry, after a short delay, for failures that are plausibly transient
 * (network blip, upstream rate-limiting, a momentary 5xx) rather than a URL
 * that's simply dead or blocked — those fail the same way both times and
 * the retry just costs a few hundred ms before falling through to the same
 * error. Production runs many of these proxy fetches concurrently across
 * unrelated PDF exports, so a fraction hitting a transient blip is expected
 * at scale even when each is individually rare. */
async function fetchUpstream(target: string): Promise<Response> {
  try {
    const res = await fetch(target, { headers: UPSTREAM_HEADERS });
    if (res.ok) return res;
    if (res.status < 500) return res; // not a transient failure — no point retrying
    throw new Error(`upstream ${res.status}`);
  } catch {
    await new Promise((r) => setTimeout(r, 300));
    return fetch(target, { headers: UPSTREAM_HEADERS });
  }
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
    const address = await resolveHost(parsed.hostname);
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
  // is remains the real ceiling (now made explicit above via maxDuration);
  // better to let a slow-but-successful fetch finish than to fail it early
  // ourselves.
  const start = Date.now();
  let upstream: Response;
  try {
    upstream = await fetchUpstream(parsed.toString());
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
