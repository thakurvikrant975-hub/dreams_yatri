import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  // Without this, Turbopack auto-detects the workspace root by walking up
  // for lockfiles — and finds a stray package-lock.json at /Users/apple,
  // so it picks the *entire home directory* as the root and file-watches
  // everything under it (Desktop, Documents, other projects, caches...).
  // That's what was pinning next-server at 500%+ CPU continuously.
  //
  // Hardcoded on purpose, not derived: __dirname resolved one directory too
  // high in this config file, and process.cwd() also turned out to resolve
  // to the *parent* of this project (whatever launches `npm run dev` here —
  // an editor task, an alias, an npm --prefix/workspace invocation — doesn't
  // necessarily cd into this folder first). An absolute literal path removes
  // that ambiguity regardless of how/where the process gets launched from.
  turbopack: {
    root: "/Users/apple/Desktop/projects/dreams_yatri",
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
    // Allow the middleware proxy to forward large upload payloads (server action
    // photo uploads go through the middleware before reaching the action handler).
    middlewareClientMaxBodySize: "50mb",
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
