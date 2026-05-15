-- AlterTable
ALTER TABLE "regions" ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by" TEXT,
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updated_by" TEXT;

-- CreateIndex
CREATE INDEX "regions_is_deleted_idx" ON "regions"("is_deleted");
