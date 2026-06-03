'use client';

import { useState } from 'react';
import { cn } from '@/app/lib/utils';
import { BlogCard } from './BlogCard';
import type { PublishedBlogItem, PublicBlogCategory } from '@/app/actions/blogs/public';

interface Props {
  posts:      PublishedBlogItem[];
  categories: PublicBlogCategory[];
}

export default function BlogListingClient({ posts, categories }: Props) {
  const [activeCat, setActiveCat] = useState<number | null>(null);

  const filtered =
    activeCat === null
      ? posts
      : posts.filter((p) =>
          p.category === categories.find((c) => c.id === activeCat)?.name
        );

  return (
    <div className="space-y-8">
      {/* Category filter */}
      {categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveCat(null)}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer',
              activeCat === null
                ? 'bg-neutral-900 text-white'
                : 'bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-400',
            )}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCat(c.id === activeCat ? null : c.id)}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer',
                activeCat === c.id
                  ? 'bg-primary-500 text-white'
                  : 'bg-white border border-neutral-200 text-neutral-600 hover:border-primary-400 hover:text-primary-600',
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((post) => (
            <BlogCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <p className="text-center py-16 text-neutral-400 text-sm">
          No posts in this category yet.
        </p>
      )}
    </div>
  );
}
