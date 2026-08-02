import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  // Without this, Turbopack auto-detects the workspace root by walking up
  // for lockfiles — and can land on a stray lockfile well above this project,
  // picking an ancestor directory as the root and file-watching everything
  // under it (other projects, caches...), which pins next-server at very
  // high CPU continuously.
  //
  // Derived from this file's own location rather than hardcoded: this config
  // file lives at the project root, so __dirname is the project root on any
  // machine — unlike a literal absolute path, which only works on whichever
  // machine/OS it was written for.
  turbopack: {
    root: __dirname,
  },
  // Keep the dashboard layout's RSC payload (sidebar + header) cached on the
  // client across navigations so it doesn't re-fetch/flicker on every route change.
  experimental: {
    staleTimes: {
      // 0 = Next.js 15 default for dynamic routes. The router cache does NOT
      // differentiate searchParams in its cache key, so a non-zero value causes
      // the wrong tab content to appear when navigating between ?tab=N URLs on
      // the same pathname. Dashboard layout caching should be solved at the
      // layout level, not by globally caching all dynamic pages.
      dynamic: 0,
    },
    serverActions: {
      bodySizeLimit: "50mb",
    },
    // Allow the proxy to forward large upload payloads (server action photo
    // uploads pass through it before reaching the action handler).
    proxyClientMaxBodySize: "50mb",
  },
  images: {
    // The Next 16 dev image optimizer 500s on remote images locally (sharp is
    // fine; the originals load directly). Serve originals unoptimized in dev;
    // production (Vercel) still optimizes.
    unoptimized: process.env.NODE_ENV === "development",
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
      { protocol: "https", hostname: "media.istockphoto.com" },
      { protocol: "https", hostname: "pub-a6e20e31abf04b6aa8f6bab093feafab.r2.dev" },
      { protocol: "https", hostname: "pub-2eaea619c591446aa791cb2e0d5e22e8.r2.dev" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  // Site under development — keep search engines out of every response.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive, nosnippet, noimageindex",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
