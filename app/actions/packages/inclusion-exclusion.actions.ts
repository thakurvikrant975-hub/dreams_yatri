"use server";

import { db } from "@/app/lib/db";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { formatListItem } from "@/app/lib/utils";

export type InclusionExclusionType = "inclusion" | "exclusion";

export type InclusionExclusionSuggestion = {
  id: number;
  text: string;
  usage_count: number;
};

const TOP_LIMIT = 5;
const SEARCH_LIMIT = 8;

// ── Top / most-used suggestions (shown when the field is empty) ────────────
export async function getTopInclusionExclusion(
  type: InclusionExclusionType,
): Promise<InclusionExclusionSuggestion[]> {
  return db.inclusion_exclusion_options.findMany({
    where: { type },
    orderBy: [{ usage_count: "desc" }, { text: "asc" }],
    take: TOP_LIMIT,
    select: { id: true, text: true, usage_count: true },
  });
}

// ── Search suggestions as the user types ────────────────────────────────────
export async function searchInclusionExclusion(
  type: InclusionExclusionType,
  query: string,
): Promise<InclusionExclusionSuggestion[]> {
  const q = query.trim();
  if (!q) return getTopInclusionExclusion(type);

  return db.inclusion_exclusion_options.findMany({
    where: { type, text: { contains: q, mode: "insensitive" } },
    orderBy: [{ usage_count: "desc" }, { text: "asc" }],
    take: SEARCH_LIMIT,
    select: { id: true, text: true, usage_count: true },
  });
}

// ── Record usage — upsert + increment count whenever an item is added ──────
export async function recordInclusionExclusionUsage(
  type: InclusionExclusionType,
  rawText: string,
): Promise<void> {
  const text = formatListItem(rawText);
  if (!text) return;

  const session = await dashboardAuth();
  const actor = session?.user?.id ?? undefined;

  await db.inclusion_exclusion_options.upsert({
    where: { type_text: { type, text } },
    update: { usage_count: { increment: 1 } },
    create: { type, text, usage_count: 1, created_by: actor },
  });
}
