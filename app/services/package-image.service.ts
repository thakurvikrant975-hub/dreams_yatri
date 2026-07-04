"use server"

import { db } from "../lib/db";

export async function addPackageImages(packageId: number, imageUrls: string[]) {
    return await db.package_images.createMany({
        data: imageUrls.map((url, index) => ({
            package_id: packageId,
            url,
            sort_order: index,
            is_primary: false,
        }))
    });
}

export async function getPackageImages(packageId: number) {
    return db.package_images.findMany({
        where: { package_id: packageId },
        orderBy: { sort_order: "asc" },
    });
}

export async function setPrimaryImage(imageId: number, packageId: number) {
    await db.package_images.updateMany({
        where: { package_id: packageId },
        data: { is_primary: false },
    });

    return db.package_images.update({
        where: { id: imageId },
        data: { is_primary: true },
    });
}

export async function reorderImages(
    updates: { id: number; sort_order: number }[]
) {
    return Promise.all(
        updates.map((item) =>
            db.package_images.update({
                where: { id: item.id },
                data: { sort_order: item.sort_order },
            })
        )
    );
}

export async function getImageById(id: number) {
    return db.package_images.findUnique({ where: { id } });
}

export async function deleteImage(id: number) {
  return db.package_images.delete({
    where: { id },
  });
}