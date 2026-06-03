export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Calendar, Clock, Tag, ArrowLeft, Share2 } from "lucide-react";
import { Heading, Text } from "@/app/components/ui/Typography";
import Breadcrumbs from "@/app/components/ui/Breadcrumps";
import { BlogCard } from "../BlogCard";
import {
  getPublishedBlogBySlug,
  getRelatedBlogs,
} from "@/app/actions/blogs/public";
import ShareButtons from "./ShareButtons";
import SchemaScript from "@/app/components/seo/SchemaScript";
import { blogSchema, breadcrumbSchema } from "@/app/lib/seo/schema";
import { SITE_URL } from "@/app/lib/seo/site-config";

// ── SEO ───────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedBlogBySlug(slug);
  if (!post) return { title: "Post not found | DreamsYatri" };

  const description =
    post.excerpt ??
    `Read "${post.title}" on DreamsYatri Travel Stories.`;

  return {
    title: `${post.title} | DreamsYatri`,
    description,
    alternates: { canonical: `/blogs/${slug}` },
    openGraph: {
      title: post.title,
      description,
      url: `/blogs/${slug}`,
      type: "article",
      publishedTime: post.published_at,
      authors: post.author_name ? [post.author_name] : undefined,
      images: post.cover_image ? [{ url: post.cover_image, width: 1200, height: 630 }] : [],
    },
    twitter: { card: "summary_large_image", title: post.title, description },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function BlogDetailPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPublishedBlogBySlug(slug);
  if (!post) notFound();

  const related = await getRelatedBlogs(post.id, post.category, 3);

  const pubDate = new Date(post.published_at).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  });

  const jsonLd = [
    blogSchema({
      title:       post.title,
      slug:        post.slug,
      description: post.excerpt ?? `Read "${post.title}" on DreamsYatri Travel Stories.`,
      image:       post.cover_image ?? "",
      author:      post.author_name ?? "DreamsYatri",
      publishedAt: post.published_at,
    }),
    breadcrumbSchema([
      { name: "Home",           url: SITE_URL },
      { name: "Travel Stories", url: `${SITE_URL}/blogs` },
      { name: post.title,       url: `${SITE_URL}/blogs/${post.slug}` },
    ]),
  ];

  return (
    <main className="min-h-screen bg-(--bg-page)">
      <SchemaScript data={jsonLd} />

      {/* ── Cover hero ── */}
      <div className="relative w-full h-72 sm:h-96 lg:h-[480px] overflow-hidden bg-neutral-900">
        {post.cover_image ? (
          <>
            <Image
              src={post.cover_image}
              alt={post.title}
              fill
              priority
              sizes="100vw"
              className="object-cover opacity-80"
              unoptimized
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/40 to-black/10" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary-900 via-primary-800 to-neutral-900" />
        )}

        {/* Overlay content */}
        <div className="absolute inset-0 flex items-end">
          <div className="screen-space w-full pb-8 sm:pb-10">
            <Breadcrumbs
              cat={{ label: "Travel Stories", link: "/blogs" }}
              title={post.title}
              className="**:text-white/70!"
            />

            {post.category && (
              <span className="inline-block mt-2 px-3 py-1 bg-primary-500 text-white text-xs font-bold rounded-full uppercase tracking-wide">
                {post.category}
              </span>
            )}

            <h1 className="font-heading font-bold text-white mt-3 text-2xl sm:text-3xl lg:text-4xl leading-tight max-w-4xl">
              {post.title}
            </h1>

            {post.excerpt && (
              <p className="text-white/80 mt-2 text-sm sm:text-base max-w-2xl leading-relaxed line-clamp-2">
                {post.excerpt}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Article ── */}
      <div className="screen-space py-8 lg:py-12">
        <div className=" mx-auto">

          {/* ── Meta bar ── */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-neutral-200 mb-8">
            <div className="flex flex-wrap items-center gap-4">
              {/* Author */}
              {post.author_name && (
                <div className="flex items-center gap-2.5">
                  {post.author_image ? (
                    <Image
                      src={post.author_image}
                      alt={post.author_name}
                      width={40}
                      height={40}
                      className="size-10 rounded-full object-cover ring-2 ring-neutral-100"
                      unoptimized
                    />
                  ) : (
                    <div className="size-10 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary-600">
                        {post.author_name[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-neutral-800">{post.author_name}</p>
                    <p className="text-[11px] text-neutral-400">Author</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 text-xs text-neutral-400">
                <span className="flex items-center gap-1.5">
                  <Calendar className="size-3.5" /> {pubDate}
                </span>
                {post.read_time && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-3.5" /> {post.read_time} min read
                  </span>
                )}
              </div>
            </div>

            {/* Share */}
            <ShareButtons title={post.title} />
          </div>

          {/* ── Tags ── */}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-8">
              <Tag className="size-3.5 text-neutral-400 shrink-0" />
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-0.5 bg-neutral-100 text-neutral-600 text-xs font-medium rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* ── Body content ── */}
          <article
            className="prose-article"
            dangerouslySetInnerHTML={{ __html: post.content_html }}
          />

          {/* ── Bottom actions ── */}
          <div className="mt-12 pt-8 border-t border-neutral-200 flex items-center justify-between flex-wrap gap-4">
            <Link
              href="/blogs"
              className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-primary-600 transition-colors"
            >
              <ArrowLeft className="size-4" />
              All Blogs
            </Link>
            <ShareButtons title={post.title} />
          </div>
        </div>
      </div>

      {/* ── Related posts ── */}
      {related.length > 0 && (
        <section className="bg-neutral-50 border-t border-neutral-100 py-12">
          <div className="screen-space">
            <div className="mb-7">
              <Text size="sm" intent="brand" weight="medium">Keep reading</Text>
              <Heading level={2} className="mt-1">More Travel Stories</Heading>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {related.map((p) => (
                <BlogCard key={p.id} post={p} />
              ))}
            </div>
          </div>
        </section>
      )}

    </main>
  );
}
