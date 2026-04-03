/*
  Warnings:

  - You are about to drop the column `thumbnail_key` on the `activity_images` table. All the data in the column will be lost.
  - You are about to drop the column `cover_key` on the `destinations` table. All the data in the column will be lost.
  - You are about to drop the column `thumbnail_key` on the `destinations` table. All the data in the column will be lost.
  - You are about to drop the column `thumbnail_key` on the `hotel_images` table. All the data in the column will be lost.
  - You are about to drop the column `thumbnail_key_key` on the `images` table. All the data in the column will be lost.
  - You are about to drop the column `thumbnail_key_url` on the `images` table. All the data in the column will be lost.
  - You are about to drop the column `thumbnail_key` on the `package_images` table. All the data in the column will be lost.
  - You are about to drop the column `cover_key` on the `packages` table. All the data in the column will be lost.
  - You are about to drop the column `thumbnail_key` on the `packages` table. All the data in the column will be lost.
  - You are about to drop the column `cover_key` on the `regions` table. All the data in the column will be lost.
  - You are about to drop the column `thumbnail_key` on the `regions` table. All the data in the column will be lost.
  - Added the required column `thumbnail_key` to the `images` table without a default value. This is not possible if the table is not empty.
  - Added the required column `thumbnail_url` to the `images` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "activity_images" DROP COLUMN "thumbnail_key",
ADD COLUMN     "thumbnail" TEXT;

-- AlterTable
ALTER TABLE "destinations" DROP COLUMN "cover_key",
DROP COLUMN "thumbnail_key",
ADD COLUMN     "cover_image" TEXT,
ADD COLUMN     "thumbnail" TEXT;

-- AlterTable
ALTER TABLE "hotel_images" DROP COLUMN "thumbnail_key",
ADD COLUMN     "thumbnail" TEXT;

-- AlterTable
ALTER TABLE "images" DROP COLUMN "thumbnail_key_key",
DROP COLUMN "thumbnail_key_url",
ADD COLUMN     "thumbnail_key" TEXT NOT NULL,
ADD COLUMN     "thumbnail_url" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "package_images" DROP COLUMN "thumbnail_key",
ADD COLUMN     "thumbnail" TEXT;

-- AlterTable
ALTER TABLE "packages" DROP COLUMN "cover_key",
DROP COLUMN "thumbnail_key",
ADD COLUMN     "cover_image" TEXT,
ADD COLUMN     "thumbnail" TEXT;

-- AlterTable
ALTER TABLE "regions" DROP COLUMN "cover_key",
DROP COLUMN "thumbnail_key",
ADD COLUMN     "cover_image" TEXT,
ADD COLUMN     "thumbnail" TEXT;
