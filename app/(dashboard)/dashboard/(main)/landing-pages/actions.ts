"use server";

// (main)/landing-pages/actions.ts
//
// CRUD for the CRM landing-page builder: a LandingPage (title/SEO/hero/
// tracking/contact-phone + JSON faqs/testimonials) plus an ordered list of
// LandingPageItem package cards, each either linked back to a real catalog
// `packages` row (denormalized snapshot, for traceability) or fully custom.
// Published pages render at /offers/[slug] (see app/(website)/offers/[slug]).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/app/lib/db";
import { getCurrentActor, type ActionResult } from "../(marketing)/queries/actions";
import { actionError } from "@/app/lib/action-error";

function revalidateAll(id?: string) {
  revalidatePath("/dashboard/landing-pages");
  if (id) revalidatePath(`/dashboard/landing-pages/${id}`);
}

// ── Slug ─────────────────────────────────────────────────────────────────────

/** Lowercase, hyphenated, alnum-only — matches the /offers/[slug] path segment. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── List / detail ────────────────────────────────────────────────────────────

export async function listLandingPages() {
  return db.landingPage.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, slug: true, title: true, status: true,
      createdByName: true, createdAt: true, updatedAt: true,
      _count: { select: { items: true } },
    },
  });
}

export async function getLandingPage(id: string) {
  return db.landingPage.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
}

// ── Save (create or update) base fields ──────────────────────────────────────

const faqSchema = z.object({
  question: z.string().min(1).max(300),
  answer: z.string().min(1).max(2000),
});
const testimonialSchema = z.object({
  authorName: z.string().min(1).max(120),
  authorRole: z.string().max(160).optional().nullable(),
  quote: z.string().min(1).max(1000),
  rating: z.coerce.number().int().min(1).max(5).optional().nullable(),
});

const landingPageSchema = z.object({
  id: z.string().optional(),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug can only contain lowercase letters, numbers and hyphens."),
  title: z.string().min(2, "Title is required.").max(160),
  seoTitle: z.string().min(2, "SEO title is required.").max(160),
  description: z.string().min(2, "Description is required.").max(2000),
  seoDescription: z.string().min(2, "SEO description is required.").max(320),
  heroImageUrl: z.string().min(1, "Hero image is required."),
  heroEyebrow: z.string().max(160).optional().nullable(),
  heroHeadline: z.string().max(80).optional().nullable(),
  destination: z.string().max(160).optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  popupDelaySeconds: z.coerce.number().int().min(0).max(120),
  contactPhone: z.string().min(7, "Contact phone is required.").max(20),
  googleAdsSendToForm: z.string().max(120).optional().nullable(),
  googleAdsSendToCall: z.string().max(120).optional().nullable(),
  googleAdsSendToWhatsapp: z.string().max(120).optional().nullable(),
  faqs: z.array(faqSchema).max(30),
  testimonials: z.array(testimonialSchema).max(30),
});

export type LandingPageInput = z.infer<typeof landingPageSchema>;

export async function saveLandingPage(input: LandingPageInput): Promise<ActionResult<{ id: string }>> {
  const parsed = landingPageSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const data = parsed.data;

  try {
    const { teamMemberId, teamMemberName } = await getCurrentActor();

    const payload = {
      slug: data.slug,
      title: data.title,
      seoTitle: data.seoTitle,
      description: data.description,
      seoDescription: data.seoDescription,
      heroImageUrl: data.heroImageUrl,
      heroEyebrow: data.heroEyebrow || null,
      heroHeadline: data.heroHeadline || null,
      destination: data.destination || null,
      status: data.status,
      popupDelaySeconds: data.popupDelaySeconds,
      contactPhone: data.contactPhone,
      googleAdsSendToForm: data.googleAdsSendToForm || null,
      googleAdsSendToCall: data.googleAdsSendToCall || null,
      googleAdsSendToWhatsapp: data.googleAdsSendToWhatsapp || null,
      faqs: data.faqs,
      testimonials: data.testimonials,
    };

    const saved = data.id
      ? await db.landingPage.update({ where: { id: data.id }, data: payload })
      : await db.landingPage.create({
          data: { ...payload, createdBy: teamMemberId ?? "unknown", createdByName: teamMemberName ?? "Team member" },
        });

    revalidateAll(saved.id);
    revalidatePath(`/offers/${saved.slug}`);
    return { success: true, data: { id: saved.id }, message: data.id ? "Landing page updated" : "Landing page created" };
  } catch (e) {
    console.error("[saveLandingPage] FAILED:", e);
    return actionError(e);
  }
}

export async function deleteLandingPage(id: string): Promise<ActionResult> {
  try {
    const page = await db.landingPage.delete({ where: { id } });
    revalidateAll();
    revalidatePath(`/offers/${page.slug}`);
    return { success: true, data: undefined, message: "Landing page deleted" };
  } catch (e) {
    console.error("[deleteLandingPage] FAILED:", e);
    return actionError(e);
  }
}

// ── Package picker (search the real catalog) ─────────────────────────────────

export type CatalogPackageResult = { id: number; title: string; thumbnail: string | null; destinationName: string | null };

export async function searchCatalogPackages(query: string): Promise<CatalogPackageResult[]> {
  const q = query.trim();
  if (!q) return [];
  const rows = await db.packages.findMany({
    where: { title: { contains: q, mode: "insensitive" } },
    select: { id: true, title: true, thumbnail: true, destination: { select: { name: true } } },
    orderBy: { title: "asc" },
    take: 10,
  });
  return rows.map((r) => ({ id: r.id, title: r.title, thumbnail: r.thumbnail, destinationName: r.destination?.name ?? null }));
}

// ── Landing page items (package cards) ────────────────────────────────────────

async function nextSortOrder(landingPageId: string): Promise<number> {
  const last = await db.landingPageItem.findFirst({
    where: { landingPageId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  return (last?.sortOrder ?? -1) + 1;
}

export async function addItemFromCatalog(landingPageId: string, packageId: number): Promise<ActionResult<{ id: string }>> {
  try {
    const pkg = await db.packages.findUnique({ where: { id: packageId }, select: { title: true, thumbnail: true } });
    if (!pkg) return { success: false, message: "Package not found" };

    const item = await db.landingPageItem.create({
      data: {
        landingPageId,
        packageId,
        title: pkg.title,
        imageUrl: pkg.thumbnail ?? "",
        sortOrder: await nextSortOrder(landingPageId),
      },
    });
    revalidateAll(landingPageId);
    return { success: true, data: { id: item.id }, message: "Package added" };
  } catch (e) {
    console.error("[addItemFromCatalog] FAILED:", e);
    return actionError(e);
  }
}

const customItemSchema = z.object({
  title: z.string().min(1, "Title is required.").max(160),
  imageUrl: z.string().min(1, "Image is required."),
  routeLabel: z.string().max(120).optional().nullable(),
  priceLabel: z.string().max(60).optional().nullable(),
  badgeLabel: z.string().max(40).optional().nullable(),
});

export async function addCustomItem(landingPageId: string, input: z.infer<typeof customItemSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = customItemSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  try {
    const item = await db.landingPageItem.create({
      data: {
        landingPageId,
        packageId: null,
        title: parsed.data.title,
        imageUrl: parsed.data.imageUrl,
        routeLabel: parsed.data.routeLabel || null,
        priceLabel: parsed.data.priceLabel || null,
        badgeLabel: parsed.data.badgeLabel || null,
        sortOrder: await nextSortOrder(landingPageId),
      },
    });
    revalidateAll(landingPageId);
    return { success: true, data: { id: item.id }, message: "Package card added" };
  } catch (e) {
    console.error("[addCustomItem] FAILED:", e);
    return actionError(e);
  }
}

const updateItemSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  imageUrl: z.string().min(1).optional(),
  routeLabel: z.string().max(120).optional().nullable(),
  priceLabel: z.string().max(60).optional().nullable(),
  badgeLabel: z.string().max(40).optional().nullable(),
  showInHero: z.boolean().optional(),
});

export async function updateItem(itemId: string, input: z.infer<typeof updateItemSchema>): Promise<ActionResult> {
  const parsed = updateItemSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  try {
    const item = await db.landingPageItem.update({ where: { id: itemId }, data: parsed.data });
    revalidateAll(item.landingPageId);
    return { success: true, data: undefined, message: "Updated" };
  } catch (e) {
    console.error("[updateItem] FAILED:", e);
    return actionError(e);
  }
}

export async function removeItem(itemId: string): Promise<ActionResult> {
  try {
    const item = await db.landingPageItem.delete({ where: { id: itemId } });
    revalidateAll(item.landingPageId);
    return { success: true, data: undefined, message: "Removed" };
  } catch (e) {
    console.error("[removeItem] FAILED:", e);
    return actionError(e);
  }
}

export async function reorderItems(landingPageId: string, orderedIds: string[]): Promise<ActionResult> {
  try {
    await db.$transaction(
      orderedIds.map((id, sortOrder) => db.landingPageItem.update({ where: { id }, data: { sortOrder } })),
    );
    revalidateAll(landingPageId);
    return { success: true, data: undefined, message: "Reordered" };
  } catch (e) {
    console.error("[reorderItems] FAILED:", e);
    return actionError(e);
  }
}

// ── Contact-phone picker ──────────────────────────────────────────────────────

export type PhoneOption = { id: string; name: string; phone: string };

/** Team members with a personal mobile on file — the dropdown offered
 * alongside a free-text "custom number" input in the editor. */
export async function listTeamMemberPhones(): Promise<PhoneOption[]> {
  const rows = await db.teamMember.findMany({
    where: { isActive: true, personalMobile: { not: null } },
    select: { id: true, name: true, personalMobile: true },
    orderBy: { name: "asc" },
  });
  return rows
    .filter((r) => r.personalMobile)
    .map((r) => ({ id: r.id, name: r.name, phone: r.personalMobile as string }));
}
