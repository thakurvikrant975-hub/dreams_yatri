import type { MetadataRoute } from "next";
import { db } from "@/app/lib/db";
import { SITE_URL } from "@/app/lib/seo/site-config";
import { getActivePackageParams } from "@/app/actions/packages/fetch-page-data";

// Static pages that never change structurally
const STATIC_PAGES: MetadataRoute.Sitemap = [
  { url: SITE_URL,                      changeFrequency: "weekly",  priority: 1.0 },
  { url: `${SITE_URL}/blogs`,           changeFrequency: "daily",   priority: 0.9 },
  { url: `${SITE_URL}/packages`,        changeFrequency: "daily",   priority: 0.9 },
  { url: `${SITE_URL}/hotels`,          changeFrequency: "weekly",  priority: 0.8 },
  { url: `${SITE_URL}/about`,           changeFrequency: "monthly", priority: 0.6 },
  { url: `${SITE_URL}/contact`,         changeFrequency: "monthly", priority: 0.7 },
  { url: `${SITE_URL}/faqs`,            changeFrequency: "monthly", priority: 0.5 },
  { url: `${SITE_URL}/careers`,         changeFrequency: "monthly", priority: 0.5 },
  { url: `${SITE_URL}/our-story`,       changeFrequency: "monthly", priority: 0.4 },
  { url: `${SITE_URL}/support`,         changeFrequency: "monthly", priority: 0.5 },
  { url: `${SITE_URL}/testimonials`,    changeFrequency: "monthly", priority: 0.5 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [blogs, destinations, regions, packageParams] = await Promise.all([
    db.blog_posts.findMany({
      where:   { status: "PUBLISHED" },
      select:  { slug: true, updated_at: true },
      orderBy: { published_at: "desc" },
    }),

    db.destinations.findMany({
      where:  { is_active: true, is_deleted: false },
      select: { slug: true, updated_at: true },
    }),

    db.custom_regions.findMany({
      where:  { is_active: true, is_deleted: false },
      select: { slug: true, updated_at: true },
    }),

    getActivePackageParams(),
  ]);

  const blogUrls: MetadataRoute.Sitemap = blogs.map((b) => ({
    url:             `${SITE_URL}/blogs/${b.slug}`,
    lastModified:    b.updated_at,
    changeFrequency: "monthly",
    priority:        0.7,
  }));

  const destUrls: MetadataRoute.Sitemap = destinations.map((d) => ({
    url:             `${SITE_URL}/destination/${d.slug}`,
    lastModified:    d.updated_at,
    changeFrequency: "weekly",
    priority:        0.8,
  }));

  const regionUrls: MetadataRoute.Sitemap = regions.map((r) => ({
    url:             `${SITE_URL}/region/${r.slug}`,
    lastModified:    r.updated_at,
    changeFrequency: "weekly",
    priority:        0.8,
  }));

  const packageUrls: MetadataRoute.Sitemap = packageParams.map((p) => ({
    url:             `${SITE_URL}/packages/${p.slug}/${p.duration}/${p.route}/${p.stay}`,
    changeFrequency: "weekly",
    priority:        0.9,
  }));

  return [...STATIC_PAGES, ...packageUrls, ...blogUrls, ...destUrls, ...regionUrls];
}
