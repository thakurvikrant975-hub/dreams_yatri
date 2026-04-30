// // app/sitemap.ts
// import { MetadataRoute } from "next";
// import { SITE_CONFIG } from "./lib/seo/site-config";
// import { getAllPackages } from "@/lib/db/packages";
// import { getAllBlogs } from "@/lib/db/blogs";

// export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
//   const packages = await getAllPackages();
//   const blogs = await getAllBlogs();

//   const staticPages: MetadataRoute.Sitemap = [
//     { url: SITE_CONFIG.url, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
//     { url: `${SITE_CONFIG.url}/packages`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
//     { url: `${SITE_CONFIG.url}/hotels`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
//     { url: `${SITE_CONFIG.url}/activities`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
//     { url: `${SITE_CONFIG.url}/cabs`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
//     { url: `${SITE_CONFIG.url}/helicopter`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
//     { url: `${SITE_CONFIG.url}/blog`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
//     { url: `${SITE_CONFIG.url}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
//     { url: `${SITE_CONFIG.url}/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
//     { url: `${SITE_CONFIG.url}/testimonials`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
//     { url: `${SITE_CONFIG.url}/faq`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
//     { url: `${SITE_CONFIG.url}/careers`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
//     { url: `${SITE_CONFIG.url}/privacy-policy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
//     { url: `${SITE_CONFIG.url}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
//   ];

//   const packagePages: MetadataRoute.Sitemap = packages.map((pkg) => ({
//     url: `${SITE_CONFIG.url}/packages/${pkg.slug}`,
//     lastModified: pkg.updatedAt,
//     changeFrequency: "weekly",
//     priority: 0.9,
//   }));

//   const blogPages: MetadataRoute.Sitemap = blogs.map((post) => ({
//     url: `${SITE_CONFIG.url}/blog/${post.slug}`,
//     lastModified: post.updatedAt,
//     changeFrequency: "monthly",
//     priority: 0.6,
//   }));

//   return [...staticPages, ...packagePages, ...blogPages];
// }