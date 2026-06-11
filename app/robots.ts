// app/robots.ts
import { MetadataRoute } from "next";

// Site is in testing — block all crawlers from everything until launch.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        disallow: "/",
      },
    ],
  };
}