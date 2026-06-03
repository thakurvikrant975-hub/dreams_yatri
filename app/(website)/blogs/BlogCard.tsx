import Image from "next/image";
import Link from "next/link";
import { Clock, Calendar, ArrowRight, BookOpen } from "lucide-react";
import { Heading, Text } from "@/app/components/ui/Typography";
import type { PublishedBlogItem } from "@/app/actions/blogs/public";

export function BlogCard({ post }: { post: PublishedBlogItem }) {
  const date = new Date(post.published_at).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <Link href={`/blogs/${post.slug}`} className="group block">
      <div className="h-full rounded-2xl overflow-hidden bg-white border border-neutral-100 hover:shadow-lg hover:shadow-neutral-200/60 shadow-lg transition-shadow duration-300">
        {/* Cover */}
        <div className="relative h-52 overflow-hidden bg-neutral-100">
          {post.cover_image ? (
            <Image
              src={post.cover_image}
              alt={post.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-neutral-100 to-neutral-200 flex items-center justify-center">
              <BookOpen className="size-10 text-neutral-300" />
            </div>
          )}
          {post.category && (
            <span className="absolute top-3 left-3 px-2.5 py-1 bg-white/90 backdrop-blur-sm text-primary-600 text-[11px] font-bold rounded-full">
              {post.category}
            </span>
          )}
        </div>

        {/* Body */}
        <div className="p-5">
          <div className="flex items-center gap-2.5 text-[11px] text-neutral-400 mb-2.5">
            <span className="flex items-center gap-1">
              <Calendar className="size-3" />
              {date}
            </span>
            {post.read_time && (
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {post.read_time} min
              </span>
            )}
          </div>

          <Heading level={5} className="text-neutral-900 leading-snug mb-2 truncate group-hover:text-primary-600 transition-colors text-base font-semibold">
            {post.title}
          </Heading>

          {post.excerpt && (
            <Text size="sm" intent="secondary" className="line-clamp-2 text-sm leading-relaxed mb-4">
              {post.excerpt}
            </Text>
          )}

          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 group-hover:gap-2.5 transition-all">
            Read more <ArrowRight className="size-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
