-- CreateEnum
CREATE TYPE "BlogStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED');

-- CreateTable: blog_categories
CREATE TABLE "blog_categories" (
    "id"          SERIAL       NOT NULL,
    "name"        TEXT         NOT NULL,
    "slug"        TEXT         NOT NULL,
    "description" TEXT,
    "is_active"   BOOLEAN      NOT NULL DEFAULT true,
    "sort_order"  INTEGER      NOT NULL DEFAULT 0,
    CONSTRAINT "blog_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable: blog_tags
CREATE TABLE "blog_tags" (
    "id"   SERIAL NOT NULL,
    "name" TEXT   NOT NULL,
    "slug" TEXT   NOT NULL,
    CONSTRAINT "blog_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable: blog_posts
CREATE TABLE "blog_posts" (
    "id"              TEXT          NOT NULL,
    "slug"            TEXT          NOT NULL,
    "title"           TEXT          NOT NULL,
    "excerpt"         TEXT,
    "content"         JSONB         NOT NULL,
    "cover_image"     TEXT,
    "status"          "BlogStatus"  NOT NULL DEFAULT 'DRAFT',
    "rejection_note"  TEXT,
    "read_time"       INTEGER,
    "published_at"    TIMESTAMP(3),
    "author_id"       TEXT          NOT NULL,
    "reviewed_by_id"  TEXT,
    "reviewed_at"     TIMESTAMP(3),
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: blog_post_categories (join)
CREATE TABLE "blog_post_categories" (
    "post_id"     TEXT    NOT NULL,
    "category_id" INTEGER NOT NULL,
    CONSTRAINT "blog_post_categories_pkey" PRIMARY KEY ("post_id","category_id")
);

-- CreateTable: blog_post_tags (join)
CREATE TABLE "blog_post_tags" (
    "post_id" TEXT    NOT NULL,
    "tag_id"  INTEGER NOT NULL,
    CONSTRAINT "blog_post_tags_pkey" PRIMARY KEY ("post_id","tag_id")
);

-- Unique indexes
CREATE UNIQUE INDEX "blog_categories_name_key" ON "blog_categories"("name");
CREATE UNIQUE INDEX "blog_categories_slug_key" ON "blog_categories"("slug");
CREATE UNIQUE INDEX "blog_tags_name_key" ON "blog_tags"("name");
CREATE UNIQUE INDEX "blog_tags_slug_key" ON "blog_tags"("slug");
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- Standard indexes
CREATE INDEX "blog_categories_slug_idx" ON "blog_categories"("slug");
CREATE INDEX "blog_categories_is_active_idx" ON "blog_categories"("is_active");
CREATE INDEX "blog_tags_slug_idx" ON "blog_tags"("slug");
CREATE INDEX "blog_posts_author_id_idx" ON "blog_posts"("author_id");
CREATE INDEX "blog_posts_status_idx" ON "blog_posts"("status");
CREATE INDEX "blog_posts_slug_idx" ON "blog_posts"("slug");
CREATE INDEX "blog_posts_published_at_idx" ON "blog_posts"("published_at");
CREATE INDEX "blog_post_categories_category_id_idx" ON "blog_post_categories"("category_id");
CREATE INDEX "blog_post_tags_tag_id_idx" ON "blog_post_tags"("tag_id");

-- Foreign keys
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "blog_post_categories" ADD CONSTRAINT "blog_post_categories_post_id_fkey"
    FOREIGN KEY ("post_id") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "blog_post_categories" ADD CONSTRAINT "blog_post_categories_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "blog_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "blog_post_tags" ADD CONSTRAINT "blog_post_tags_post_id_fkey"
    FOREIGN KEY ("post_id") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "blog_post_tags" ADD CONSTRAINT "blog_post_tags_tag_id_fkey"
    FOREIGN KEY ("tag_id") REFERENCES "blog_tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
