"use server";

import { createPackageSchema } from "@/app/validators/package.validator";
import { createPackages } from "@/app/services/package.service";
import { createPackagesTypes } from "@/app/types/package";
import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";

export async function createPackage(data: createPackagesTypes) {
  // 1. Validate input
  const parsed = createPackageSchema.safeParse(data);

  if (!parsed.success) {
    return {
      success: false,
      type: "validation",
      error: parsed.error.issues,
    };
  }

  try {
    const res = await createPackages(parsed.data);

    return {
      success: true,
      data: res,
    };
  } catch (error: any) {
    console.error("Create Package Error:", error);

    if (error.code === "P2002") {
      return {
        success: false,
        type: "conflict",
        message: "Slug already exists",
      };
    }

    return {
      success: false,
      type: "server",
      message: "Something went wrong",
    };
  }
}

// ── Update Basic Info ──────────────────────────────────────────────────────

export async function updatePackageBasicInfo(id: number, data: createPackagesTypes) {
  const parsed = createPackageSchema.safeParse(data);

  if (!parsed.success) {
    return {
      success: false as const,
      type: "validation" as const,
      error: parsed.error.issues,
    };
  }

  // Slug uniqueness check — exclude the current package
  const slugConflict = await db.packages.findFirst({
    where: { slug: parsed.data.slug, NOT: { id } },
    select: { id: true },
  });

  if (slugConflict) {
    return {
      success: false as const,
      type: "conflict" as const,
      message: "Slug already exists",
    };
  }

  try {
    // Upsert tags and categories so new names auto-create records
    const tagRecords = await Promise.all(
      parsed.data.tags.map(name =>
        db.tags.upsert({
          where: { name },
          update: {},
          create: { name, slug: name.toLowerCase().replace(/\s+/g, "-") },
        })
      )
    );

    const categoryRecords = await Promise.all(
      parsed.data.category.map(name =>
        db.categories.upsert({
          where: { name },
          update: {},
          create: { name, slug: name.toLowerCase().replace(/\s+/g, "-") },
        })
      )
    );

    await db.$transaction(async tx => {
      // Sync tags
      await tx.package_tags.deleteMany({ where: { package_id: id } });
      if (tagRecords.length > 0) {
        await tx.package_tags.createMany({
          data: tagRecords.map(t => ({ package_id: id, tag_id: t.id })),
        });
      }

      // Sync categories
      await tx.package_categories.deleteMany({ where: { package_id: id } });
      if (categoryRecords.length > 0) {
        await tx.package_categories.createMany({
          data: categoryRecords.map(c => ({ package_id: id, category_id: c.id })),
        });
      }

      // Update core fields
      await tx.packages.update({
        where: { id },
        data: {
          title: parsed.data.title,
          slug: parsed.data.slug,
          thumbnail: parsed.data.thumbnail ?? null,
          description: parsed.data.description ?? null,
          destination_id: parsed.data.destination_id,
          inclusions: parsed.data.inclusions,
          exclusions: parsed.data.exclusions,
        },
      });
    });

    revalidatePath("/dashboard/packages");
    revalidatePath(`/dashboard/packages/${id}`);

    return { success: true as const };
  } catch {
    return {
      success: false as const,
      type: "server" as const,
      message: "Something went wrong",
    };
  }
}