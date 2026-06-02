"use server";

import { db } from "@/app/lib/db";
import { auth } from "@/app/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/app/generated/prisma/client";
import { extractExcerpt } from "@/app/lib/tiptap/extractExcerpt";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 100) || "untitled";
}

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type BlogActionResult =
  | { success: true; id: string }
  | { success: false; error: string };

export type MyBlogItem = {
  id: string;
  slug: string;
  title: string;
  cover_image: string | null;
  status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED";
  read_time: number | null;
  rejection_note: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  category: { id: number; name: string } | null;
};

export type BlogForEdit = {
  id: string;
  title: string;
  excerpt: string | null;
  content: object;
  cover_image: string | null;
  status: "DRAFT" | "REJECTED";
  read_time: number | null;
  category_id: number | null;
  tags: string[];
};

export type BlogCategory = { id: number; name: string };

// ── Validation ─────────────────────────────────────────────────────────────────

const SaveDraftSchema = z.object({
  id:          z.string().optional(),
  title:       z.string().min(1, "Title is required").max(255),
  excerpt:     z.string().max(500).optional().nullable(),
  content:     z.any(),                             // Tiptap JSON — validated by Prisma
  cover_image: z.string().optional().nullable(),    // R2 URL or null/empty — skip url() to avoid RSC proxy issues
  category_id: z.number().int().positive().optional().nullable(),
  tags:        z.array(z.string().max(50)).max(10).optional(),
  read_time:   z.number().int().min(1).optional().nullable(),
});

export type SaveDraftInput = z.infer<typeof SaveDraftSchema>;

// ── Actions ───────────────────────────────────────────────────────────────────

export async function saveBlogDraft(input: SaveDraftInput): Promise<BlogActionResult> {
  const user = await requireUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const parsed = SaveDraftSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { id, title, cover_image, category_id, tags = [], read_time } = parsed.data;
  // Strip React RSC proxy markers — Prisma's type validator accesses Symbol.toStringTag
  // which throws on React proxy objects passed from client components via server actions.
  const content = JSON.parse(JSON.stringify(parsed.data.content)) as Prisma.InputJsonValue;
  // Auto-extract excerpt from first paragraph when the user left it blank
  const excerpt = parsed.data.excerpt?.trim() || extractExcerpt(content) || null;

  // ── Tag upsert ── find-or-create each tag by slug
  const tagRecords = await Promise.all(
    tags.map((name) => {
      const slug = toSlug(name);
      return db.blog_tags.upsert({
        where:  { slug },
        update: {},
        create: { name: name.trim(), slug },
      });
    })
  );

  const tagLinks = tagRecords.map((t) => ({ tag_id: t.id }));

  // ── Category link ──
  const catLinks = category_id ? [{ category_id }] : [];

  if (id) {
    // ── Update existing draft / rejected post ───────────────────────────────
    const existing = await db.blog_posts.findFirst({
      where: { id, author_id: user.id },
    });
    if (!existing) return { success: false, error: "Post not found" };
    if (existing.status !== "DRAFT" && existing.status !== "REJECTED")
      return { success: false, error: "Only drafts and rejected posts can be edited" };

    await db.blog_posts.update({
      where: { id },
      data: {
        title,
        excerpt:     excerpt ?? null,
        content,
        cover_image: cover_image ?? null,
        read_time:   read_time ?? null,
        categories: { deleteMany: {}, create: catLinks },
        tags:       { deleteMany: {}, create: tagLinks },
      },
    });

    return { success: true, id };
  }

  // ── Create new draft ────────────────────────────────────────────────────────
  let slug = toSlug(title);
  let counter = 2;
  while (await db.blog_posts.findFirst({ where: { slug } })) {
    slug = `${toSlug(title)}-${counter++}`;
  }

  const post = await db.blog_posts.create({
    data: {
      title,
      slug,
      excerpt:     excerpt ?? null,
      content:     content as Prisma.InputJsonValue,
      cover_image: cover_image ?? null,
      read_time:   read_time ?? null,
      status:      "DRAFT",
      author_id:   user.id,
      categories:  { create: catLinks },
      tags:        { create: tagLinks },
    },
  });

  return { success: true, id: post.id };
}

export async function submitBlogForReview(id: string): Promise<BlogActionResult> {
  const user = await requireUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const post = await db.blog_posts.findFirst({ where: { id, author_id: user.id } });
  if (!post) return { success: false, error: "Post not found" };
  if (post.status !== "DRAFT" && post.status !== "REJECTED")
    return { success: false, error: "Only drafts or rejected posts can be submitted" };

  const contentObj = post.content as Record<string, unknown>;
  const isEmpty =
    !post.title?.trim() ||
    !contentObj?.content ||
    (Array.isArray(contentObj.content) && contentObj.content.length === 0);

  if (isEmpty) return { success: false, error: "Add a title and some content before submitting" };

  await db.blog_posts.update({
    where: { id },
    data:  { status: "PENDING_REVIEW", rejection_note: null },
  });

  revalidatePath("/blogs/my-blogs");
  return { success: true, id };
}

export async function deleteBlog(id: string): Promise<BlogActionResult> {
  const user = await requireUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const post = await db.blog_posts.findFirst({ where: { id, author_id: user.id } });
  if (!post) return { success: false, error: "Post not found" };
  if (post.status !== "DRAFT" && post.status !== "REJECTED")
    return { success: false, error: "Only drafts and rejected posts can be deleted" };

  await db.blog_posts.delete({ where: { id } });
  revalidatePath("/blogs/my-blogs");
  return { success: true, id };
}

export async function getMyBlogs(): Promise<MyBlogItem[]> {
  const user = await requireUser();
  if (!user) return [];

  const posts = await db.blog_posts.findMany({
    where:   { author_id: user.id },
    orderBy: { updated_at: "desc" },
    select: {
      id:             true,
      slug:           true,
      title:          true,
      cover_image:    true,
      status:         true,
      read_time:      true,
      rejection_note: true,
      published_at:   true,
      created_at:     true,
      updated_at:     true,
      categories: {
        take: 1,
        select: { category: { select: { id: true, name: true } } },
      },
    },
  });

  return posts.map((p) => ({
    id:             p.id,
    slug:           p.slug,
    title:          p.title,
    cover_image:    p.cover_image,
    status:         p.status as MyBlogItem["status"],
    read_time:      p.read_time,
    rejection_note: p.rejection_note,
    published_at:   p.published_at?.toISOString() ?? null,
    created_at:     p.created_at.toISOString(),
    updated_at:     p.updated_at.toISOString(),
    category:       p.categories[0]?.category ?? null,
  }));
}

export async function getBlogForEdit(id: string): Promise<BlogForEdit | null> {
  const user = await requireUser();
  if (!user) return null;

  const post = await db.blog_posts.findFirst({
    where: { id, author_id: user.id },
    select: {
      id:          true,
      title:       true,
      excerpt:     true,
      content:     true,
      cover_image: true,
      status:      true,
      read_time:   true,
      categories:  { select: { category_id: true } },
      tags:        { select: { tag: { select: { name: true } } } },
    },
  });

  if (!post) return null;
  if (post.status !== "DRAFT" && post.status !== "REJECTED") return null;

  return {
    id:          post.id,
    title:       post.title,
    excerpt:     post.excerpt,
    content:     JSON.parse(JSON.stringify(post.content)) as object,
    cover_image: post.cover_image ?? null,
    status:      post.status as "DRAFT" | "REJECTED",
    read_time:   post.read_time,
    category_id: post.categories[0]?.category_id ?? null,
    tags:        post.tags.map((t) => t.tag.name),
  };
}

export async function getBlogCategories(): Promise<BlogCategory[]> {
  const cats = await db.blog_categories.findMany({
    where:   { is_active: true },
    orderBy: { sort_order: "asc" },
    select:  { id: true, name: true },
  });
  return cats;
}
