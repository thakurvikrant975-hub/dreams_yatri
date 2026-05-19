"use server";

import { db } from "@/app/lib/db";

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}

async function uniqueSlug(table: "tags" | "categories", base: string): Promise<string> {
  const model = table === "tags" ? db.tags : db.categories;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exists = await (model as any).findUnique({ where: { slug: base } });
  if (!exists) return base;
  let i = 2;
  while (true) {
    const cand = `${base}-${i}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conflict = await (model as any).findUnique({ where: { slug: cand } });
    if (!conflict) return cand;
    i++;
  }
}

export async function createTag(name: string): Promise<{ id: number; label: string }> {
  const slug = await uniqueSlug("tags", slugify(name));
  const row = await db.tags.create({ data: { name: name.trim(), slug }, select: { id: true, name: true } });
  return { id: row.id, label: row.name };
}

export async function createCategory(name: string): Promise<{ id: number; label: string }> {
  const slug = await uniqueSlug("categories", slugify(name));
  const row = await db.categories.create({ data: { name: name.trim(), slug, is_active: true }, select: { id: true, name: true } });
  return { id: row.id, label: row.name };
}

export async function searchDestinations(query: string) {
  const rows = await db.destinations.findMany({
    where: {
      is_active: true,
      ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 15,
  });
  return rows.map(r => ({ id: r.id, label: r.name }));
}

export async function searchTags(query: string) {
  const rows = await db.tags.findMany({
    where: query ? { name: { contains: query, mode: "insensitive" } } : {},
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 20,
  });
  return rows.map(r => ({ id: r.id, label: r.name }));
}

export async function searchCategories(query: string) {
  const rows = await db.categories.findMany({
    where: {
      is_active: true,
      ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 20,
  });
  return rows.map(r => ({ id: r.id, label: r.name }));
}
