"use server";

import { db } from "@/app/lib/db";

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
