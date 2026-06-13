'use server';

import { db } from "../lib/db";
import { createPackagesTypes } from "@/app/types/package";



  export async function createPackages(data: createPackagesTypes, actor?: string) {
  // 1. Ensure tags exist
  const tagRecords = await Promise.all(
    data.tags.map(async (tag) => {
      return db.tags.upsert({
        where: { name: tag },
        update: {},
        create: {
          name: tag,
          slug: tag.toLowerCase().replace(/\s+/g, "-"),
        },
      });
    })
  );

  // 2. Ensure categories exist
  const categoryRecords = await Promise.all(
    data.category.map(async (cat) => {
      return db.categories.upsert({
        where: { name: cat },
        update: {},
        create: {
          name: cat,
          slug: cat.toLowerCase().replace(/\s+/g, "-"),
        },
      });
    })
  );

  // 3. Create package + connect via join tables
  return await db.packages.create({
    data: {
      title: data.title,
      slug: data.slug,
      thumbnail: data.thumbnail,
      description: data.description,
      destination_id: data.destination_id,
      inclusions: data.inclusions,
      exclusions: data.exclusions,
      created_by: actor,

      tags: {
        create: tagRecords.map((tag) => ({
          tag_id: tag.id,
        })),
      },

      categories: {
        create: categoryRecords.map((cat) => ({
          category_id: cat.id,
        })),
      },
    },
  });
}