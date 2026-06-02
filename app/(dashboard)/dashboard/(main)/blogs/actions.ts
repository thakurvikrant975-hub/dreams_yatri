"use server";

import { db } from "@/app/lib/db";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { revalidatePath } from "next/cache";

// ── Auth guard ────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await dashboardAuth();
  if (!session?.user?.id) return null;
  return session.user;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type AdminBlogRow = {
  id:             string;
  title:          string;
  slug:           string;
  cover_image:    string | null;
  status:         "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED";
  read_time:      number | null;
  submitted_at:   string | null;   // updated_at when status became PENDING_REVIEW
  published_at:   string | null;
  created_at:     string;
  author_name:    string | null;
  author_email:   string | null;
  author_image:   string | null;
  category:       string | null;
  word_count_est: number | null;
};

export type AdminBlogDetail = AdminBlogRow & {
  content:        object;
  excerpt:        string | null;
  rejection_note: string | null;
  tags:           string[];
};

export type BlogStats = {
  total:    number;
  pending:  number;
  published:number;
  rejected: number;
  drafts:   number;
};

export type AdminBlogAction =
  | { success: true }
  | { success: false; error: string };

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getBlogStats(): Promise<BlogStats> {
  const admin = await requireAdmin();
  if (!admin) return { total: 0, pending: 0, published: 0, rejected: 0, drafts: 0 };

  const [total, pending, published, rejected, drafts] = await Promise.all([
    db.blog_posts.count(),
    db.blog_posts.count({ where: { status: "PENDING_REVIEW" } }),
    db.blog_posts.count({ where: { status: "PUBLISHED" } }),
    db.blog_posts.count({ where: { status: "REJECTED" } }),
    db.blog_posts.count({ where: { status: "DRAFT" } }),
  ]);

  return { total, pending, published, rejected, drafts };
}

export async function getAllBlogs(opts: {
  status?: string;
  search?: string;
} = {}): Promise<AdminBlogRow[]> {
  const admin = await requireAdmin();
  if (!admin) return [];

  const { status, search } = opts;

  const rows = await db.blog_posts.findMany({
    where: {
      ...(status && status !== "all"
        ? { status: status as AdminBlogRow["status"] }
        : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { author: { name: { contains: search, mode: "insensitive" } } },
              { author: { email: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: [
      // pending first, then by updated_at desc
      { status: "asc" },
      { updated_at: "desc" },
    ],
    select: {
      id:           true,
      title:        true,
      slug:         true,
      cover_image:  true,
      status:       true,
      read_time:    true,
      published_at: true,
      updated_at:   true,
      created_at:   true,
      author: {
        select: { name: true, email: true, image: true },
      },
      categories: {
        take: 1,
        select: { category: { select: { name: true } } },
      },
    },
  });

  return rows.map((r) => ({
    id:             r.id,
    title:          r.title,
    slug:           r.slug,
    cover_image:    r.cover_image,
    status:         r.status as AdminBlogRow["status"],
    read_time:      r.read_time,
    submitted_at:   r.status === "PENDING_REVIEW" ? r.updated_at.toISOString() : null,
    published_at:   r.published_at?.toISOString() ?? null,
    created_at:     r.created_at.toISOString(),
    author_name:    r.author.name,
    author_email:   r.author.email,
    author_image:   r.author.image,
    category:       r.categories[0]?.category.name ?? null,
    word_count_est: r.read_time ? r.read_time * 200 : null,
  }));
}

export async function getBlogForReview(id: string): Promise<AdminBlogDetail | null> {
  const admin = await requireAdmin();
  if (!admin) return null;

  const post = await db.blog_posts.findUnique({
    where: { id },
    select: {
      id:             true,
      title:          true,
      slug:           true,
      excerpt:        true,
      content:        true,
      cover_image:    true,
      status:         true,
      read_time:      true,
      rejection_note: true,
      published_at:   true,
      updated_at:     true,
      created_at:     true,
      author: {
        select: { name: true, email: true, image: true },
      },
      categories: {
        take: 1,
        select: { category: { select: { name: true } } },
      },
      tags: {
        select: { tag: { select: { name: true } } },
      },
    },
  });

  if (!post) return null;

  return {
    id:             post.id,
    title:          post.title,
    slug:           post.slug,
    excerpt:        post.excerpt,
    content:        JSON.parse(JSON.stringify(post.content)) as object,
    cover_image:    post.cover_image,
    status:         post.status as AdminBlogRow["status"],
    read_time:      post.read_time,
    rejection_note: post.rejection_note,
    submitted_at:   post.status === "PENDING_REVIEW" ? post.updated_at.toISOString() : null,
    published_at:   post.published_at?.toISOString() ?? null,
    created_at:     post.created_at.toISOString(),
    author_name:    post.author.name,
    author_email:   post.author.email,
    author_image:   post.author.image,
    category:       post.categories[0]?.category.name ?? null,
    word_count_est: post.read_time ? post.read_time * 200 : null,
    tags:           post.tags.map((t) => t.tag.name),
  };
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function approveBlog(id: string): Promise<AdminBlogAction> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Unauthorized" };

  const post = await db.blog_posts.findUnique({ where: { id }, select: { status: true } });
  if (!post) return { success: false, error: "Post not found" };
  if (post.status !== "PENDING_REVIEW")
    return { success: false, error: "Only pending posts can be approved" };

  await db.blog_posts.update({
    where: { id },
    data: {
      status:         "PUBLISHED",
      published_at:   new Date(),
      reviewed_by_id: admin.id,
      reviewed_at:    new Date(),
      rejection_note: null,
    },
  });

  revalidatePath("/dashboard/blogs");
  return { success: true };
}

export async function rejectBlog(id: string, note: string): Promise<AdminBlogAction> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Unauthorized" };

  if (!note.trim()) return { success: false, error: "Rejection note is required" };

  const post = await db.blog_posts.findUnique({ where: { id }, select: { status: true } });
  if (!post) return { success: false, error: "Post not found" };
  if (post.status !== "PENDING_REVIEW")
    return { success: false, error: "Only pending posts can be rejected" };

  await db.blog_posts.update({
    where: { id },
    data: {
      status:         "REJECTED",
      rejection_note: note.trim(),
      reviewed_by_id: admin.id,
      reviewed_at:    new Date(),
    },
  });

  revalidatePath("/dashboard/blogs");
  return { success: true };
}
