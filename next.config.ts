import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the dashboard layout's RSC payload (sidebar + header) cached on the
  // client across navigations so it doesn't re-fetch/flicker on every route change.
  experimental: {
    staleTimes: {
      dynamic: 30,
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "plus.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "media.istockphoto.com",
      },
      {
        protocol: "https",
        hostname: "pub-a6e20e31abf04b6aa8f6bab093feafab.r2.dev",
      },
      {
        protocol: "https",
        hostname: "pub-2eaea619c591446aa791cb2e0d5e22e8.r2.dev",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  // Site is in testing — keep search engines out of every response.
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
}

module.exports = nextConfig

export default nextConfig;
