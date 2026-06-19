import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Calendar, Clock, ArrowLeft } from "lucide-react";
import { Heading, Text } from "@/app/components/ui/Typography";
import { BlogCard } from "../BlogCard";
import {
  getPublishedBlogBySlug,
  getRelatedBlogs,
  getAllPublishedBlogSlugs,
} from "@/app/actions/blogs/public";
import ShareButtons from "./ShareButtons";
import SchemaScript from "@/app/components/seo/SchemaScript";
import { blogSchema, breadcrumbSchema } from "@/app/lib/seo/schema";
import { SITE_URL, SITE_CONFIG } from "@/app/lib/seo/site-config";

export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    const slugs = await getAllPublishedBlogSlugs();
    return slugs.map((slug) => ({ slug }));
  } catch {
    return [];
  }
}

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
  const canonical = `${SITE_URL}/blogs/${slug}`;
  const ogImage = post.cover_image ?? SITE_CONFIG.defaultOgImage;

  return {
    title: `${post.title} | DreamsYatri`,
    description,
    alternates: { canonical },
    openGraph: {
      title: post.title,
      description,
      url: canonical,
      siteName: SITE_CONFIG.name,
      type: "article",
      publishedTime: post.published_at,
      authors: post.author_name ? [post.author_name] : undefined,
      images: [{ url: ogImage, width: 1200, height: 630, alt: post.title }],
    },
    twitter: { card: "summary_large_image", title: post.title, description, images: [ogImage] },
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

      <div className="screen-space py-8 lg:py-12">
        <div className="max-w-6xl mx-auto">

          {/* ── Back link ── */}
          <Link
            href="/blogs"
            className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-primary-600 transition-colors mb-6"
          >
            <ArrowLeft className="size-4" />
            Back to Blog
          </Link>

          {/* ── Tags ── */}
          {(post.category || post.tags.length > 0) && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {post.category && (
                <span className="px-3 py-1 bg-primary-100 text-primary-700 text-xs font-semibold rounded-full uppercase tracking-wide">
                  {post.category}
                </span>
              )}
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-neutral-100 text-neutral-600 text-xs font-medium rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* ── Title ── */}
          <h1 className="font-heading font-bold text-neutral-900 text-2xl sm:text-3xl lg:text-4xl leading-tight mb-4">
            {post.title}
          </h1>

          {/* ── Meta: date · read time · author ── */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-neutral-500 mb-7">
            <span className="flex items-center gap-1.5">
              <Calendar className="size-4" /> {pubDate}
            </span>
            {post.read_time && (
              <span className="flex items-center gap-1.5">
                <Clock className="size-4" /> {post.read_time} min read
              </span>
            )}
            {post.author_name && (
              <span>
                By <span className="text-neutral-700 font-medium">{post.author_name}</span>
              </span>
            )}
          </div>

          {/* ── Thumbnail ── */}
          {post.cover_image && (
            <div className="rounded-xl flex items-center justify-center overflow-hidden mb-8">
              <Image
                src={post.cover_image}
                alt={post.title}
                width={800}
                height={450}
                className="w-full h-auto object-cover max-w-3xl rounded-lg transition-transform duration-300 shadow-lg"
                priority
                unoptimized
              />
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
