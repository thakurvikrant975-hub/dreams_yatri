export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { PenLine } from "lucide-react";
import { Heading, Text } from "@/app/components/ui/Typography";
import Breadcrumbs from "@/app/components/ui/Breadcrumps";
import { getPublishedBlogs, getPublicBlogCategories } from "@/app/actions/blogs/public";
import BlogListingClient from "./BlogListingClient";
import WriteButton from "./WriteButton";

export const metadata: Metadata = {
  title: "Travel Stories & Blogs | DreamsYatri",
  description:
    "Real travel stories from real travellers. Discover tips, destinations, and experiences shared by the DreamsYatri community.",
  alternates: { canonical: "/blogs" },
  openGraph: {
    title: "Travel Stories & Blogs | DreamsYatri",
    description: "Real travel stories from real travellers.",
    url: "/blogs",
  },
};

export default async function BlogsListingPage() {
  const [{ posts }, categories] = await Promise.all([
    getPublishedBlogs({ limit: 100 }),
    getPublicBlogCategories(),
  ]);

  const featured  = posts[0] ?? null;
  const restPosts = posts.slice(1);

  return (
    <main className="min-h-screen">

      {/* ── Hero header ── */}
      <section className="">
        <div className="screen-space flex justify-between mt-4">
          <Breadcrumbs title="Blogs" />
          <div className="mt-3 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <WriteButton />
          </div>
        </div>
      </section>

      {/* ── Content ── */}
      <div className="screen-space py-4 space-y-10">
        {posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <span className="size-16 rounded-2xl bg-primary-50 flex items-center justify-center mb-4">
              <PenLine className="size-7 text-primary-400" />
            </span>
            <Heading level={2} className="text-neutral-800 mb-2">No stories yet</Heading>
            <Text intent="secondary" className="max-w-xs mb-6">
              Be the first to share your travel experience with the community.
            </Text>
            <WriteButton />
          </div>
        ) : (
          <BlogListingClient
            featured={featured}
            restPosts={restPosts}
            categories={categories}
          />
        )}
      </div>

    </main>
  );
}
