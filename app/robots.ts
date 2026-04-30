// app/robots.ts
import { MetadataRoute } from "next";
import { SITE_CONFIG } from "./lib/seo/site-config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard/",
          "/admin/",
          "/api/",
          "/_next/",
          "/checkout/",
          "/*?*",          // blocks ?page=2 style duplicate URLs
        ],
      },
    ],
    sitemap: `${SITE_CONFIG.url}/sitemap.xml`,
    host: SITE_CONFIG.url,
  };
}