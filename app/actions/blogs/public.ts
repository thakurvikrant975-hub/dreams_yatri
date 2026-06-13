import "server-only";
import { db } from "@/app/lib/db";
import { tiptapToHtml } from "@/app/lib/tiptap/renderHtml";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PublishedBlogItem = {
  id:           string;
  slug:         string;
  title:        string;
  excerpt:      string | null;
  cover_image:  string | null;
  read_time:    number | null;
  published_at: string;
  author_name:  string | null;
  author_image: string | null;
  category:     string | null;
  tags:         string[];
};

export type PublishedBlogDetail = PublishedBlogItem & {
  content_html: string;
};

export type PublicBlogCategory = { id: number; name: string; slug: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function toItem(p: {
  id: string; slug: string; title: string; excerpt: string | null;
  cover_image: string | null; read_time: number | null; published_at: Date | null;
  author: { name: string | null; image: string | null };
  categories: { category: { name: string } }[];
  tags: { tag: { name: string } }[];
}): PublishedBlogItem {
  return {
    id:           p.id,
    slug:         p.slug,
    title:        p.title,
    excerpt:      p.excerpt,
    cover_image:  p.cover_image,
    read_time:    p.read_time,
    published_at: p.published_at!.toISOString(),
    author_name:  p.author.name,
    author_image: p.author.image,
    category:     p.categories[0]?.category.name ?? null,
    tags:         p.tags.map((t) => t.tag.name),
  };
}

const BLOG_SELECT = {
  id: true, slug: true, title: true, excerpt: true,
  cover_image: true, read_time: true, published_at: true,
  author:     { select: { name: true, image: true } },
  categories: { take: 1, select: { category: { select: { name: true } } } },
  tags:       { select: { tag: { select: { name: true } } } },
} as const;

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getPublishedBlogs(opts: {
  categoryId?: number | null;
  limit?: number;
  offset?: number;
} = {}): Promise<{ posts: PublishedBlogItem[]; total: number }> {
  const { categoryId, limit = 12, offset = 0 } = opts;

  const where = {
    status: "PUBLISHED" as const,
    ...(categoryId
      ? { categories: { some: { category_id: categoryId } } }
      : {}),
  };

  const [posts, total] = await Promise.all([
    db.blog_posts.findMany({
      where,
      orderBy: { published_at: "desc" },
      take:    limit,
      skip:    offset,
      select:  BLOG_SELECT,
    }),
    db.blog_posts.count({ where }),
  ]);

  return { posts: posts.map(toItem), total };
}

export async function getPublishedBlogBySlug(slug: string): Promise<PublishedBlogDetail | null> {
  const post = await db.blog_posts.findFirst({
    where:  { slug, status: "PUBLISHED" },
    select: {
      ...BLOG_SELECT,
      content: true,
    },
  });

  if (!post || !post.published_at) return null;

  const content_html = tiptapToHtml(post.content);

  return { ...toItem(post), content_html };
}

export async function getRelatedBlogs(
  currentId: string,
  categoryName: string | null,
  limit = 3,
): Promise<PublishedBlogItem[]> {
  const posts = await db.blog_posts.findMany({
    where: {
      status: "PUBLISHED",
      id:     { not: currentId },
      ...(categoryName
        ? { categories: { some: { category: { name: categoryName } } } }
        : {}),
    },
    orderBy: { published_at: "desc" },
    take:    limit,
    select:  BLOG_SELECT,
  });

  // If not enough same-category posts, pad with latest published
  if (posts.length < limit) {
    const ids    = [currentId, ...posts.map((p) => p.id)];
    const extras = await db.blog_posts.findMany({
      where:   { status: "PUBLISHED", id: { notIn: ids } },
      orderBy: { published_at: "desc" },
      take:    limit - posts.length,
      select:  BLOG_SELECT,
    });
    return [...posts, ...extras].map(toItem);
  }

  return posts.map(toItem);
}

export async function getPublicBlogCategories(): Promise<PublicBlogCategory[]> {
  return db.blog_categories.findMany({
    where:   { is_active: true },
    orderBy: { sort_order: "asc" },
    select:  { id: true, name: true, slug: true },
  });
}

export async function getAllPublishedBlogSlugs(): Promise<string[]> {
  const rows = await db.blog_posts.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true },
  });
  return rows.map((r) => r.slug);
}
