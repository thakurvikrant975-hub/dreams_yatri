'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  PenLine, Trash2, Eye, Clock, AlertCircle,
  CheckCircle2, Hourglass, FileText, Plus,
} from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { deleteBlog, type MyBlogItem } from '@/app/actions/blogs/actions';
import Button from '@/app/components/ui/Button';

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  DRAFT:          { label: 'Draft',       icon: FileText,    bg: 'bg-neutral-100',    text: 'text-neutral-600' },
  PENDING_REVIEW: { label: 'In Review',   icon: Hourglass,   bg: 'bg-amber-50',       text: 'text-amber-600'   },
  PUBLISHED:      { label: 'Published',   icon: CheckCircle2,bg: 'bg-success-50',     text: 'text-success-700' },
  REJECTED:       { label: 'Rejected',    icon: AlertCircle, bg: 'bg-red-50',         text: 'text-red-600'     },
} as const;

function StatusBadge({ status }: { status: MyBlogItem['status'] }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold', cfg.bg, cfg.text)}>
      <Icon className="size-3" />
      {cfg.label}
    </span>
  );
}

// ── Blog card ─────────────────────────────────────────────────────────────────

function BlogCard({ post, onDeleted }: { post: MyBlogItem; onDeleted: (id: string) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canEdit   = post.status === 'DRAFT' || post.status === 'REJECTED';
  const canDelete = post.status === 'DRAFT' || post.status === 'REJECTED';

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    startTransition(async () => {
      const result = await deleteBlog(post.id);
      if (result.success) {
        toast.success('Blog deleted');
        onDeleted(post.id);
      } else {
        toast.error(result.error);
      }
      setConfirmDelete(false);
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden hover:shadow-md hover:shadow-neutral-200/60 transition-shadow">
      {/* Cover image */}
      <div className="relative h-44 bg-neutral-100">
        {post.cover_image ? (
          <Image
            src={post.cover_image}
            alt={post.title}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <FileText className="size-10 text-neutral-200" />
          </div>
        )}
        {/* Status badge overlay */}
        <div className="absolute top-3 left-3">
          <StatusBadge status={post.status} />
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <h3 className="font-heading font-bold text-neutral-900 text-base leading-snug line-clamp-2">
          {post.title || <span className="italic text-neutral-400">Untitled</span>}
        </h3>

        {/* Meta */}
        <div className="flex items-center gap-3 text-xs text-neutral-400">
          {post.read_time && (
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {post.read_time} min read
            </span>
          )}
          {post.category && (
            <span className="px-2 py-0.5 bg-neutral-100 text-neutral-500 rounded-full">
              {post.category.name}
            </span>
          )}
          <span className="ml-auto">
            {new Date(post.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>

        {/* Rejection note */}
        {post.status === 'REJECTED' && post.rejection_note && (
          <div className="flex gap-2 p-2.5 bg-red-50 rounded-xl border border-red-100">
            <AlertCircle className="size-3.5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-600 leading-relaxed">{post.rejection_note}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/blogs/${post.id}/edit`)}
              className="flex-1 gap-1.5"
            >
              <PenLine className="size-3.5" />
              Edit
            </Button>
          )}
          {post.status === 'PUBLISHED' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/blogs/${post.slug}`)}
              className="flex-1 gap-1.5"
            >
              <Eye className="size-3.5" />
              View
            </Button>
          )}
          {canDelete && (
            <Button
              variant={confirmDelete ? 'error' : 'ghost'}
              size="sm"
              onClick={handleDelete}
              loading={pending}
              className={cn('gap-1.5', !canEdit && 'flex-1')}
            >
              <Trash2 className="size-3.5" />
              {confirmDelete ? 'Confirm?' : 'Delete'}
            </Button>
          )}
          {confirmDelete && (
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-neutral-400 hover:text-neutral-600 cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <span className="size-16 rounded-2xl bg-primary-50 flex items-center justify-center mb-4">
        <PenLine className="size-7 text-primary-400" />
      </span>
      <h2 className="font-heading font-bold text-neutral-800 text-xl mb-2">No blogs yet</h2>
      <p className="text-sm text-neutral-500 mb-6 max-w-xs">
        Share your travel stories with the world. Write your first blog post today.
      </p>
      <Link href="/blogs/write">
        <Button variant="premium" size="md">
          <Plus className="size-4" />
          Write your first blog
        </Button>
      </Link>
    </div>
  );
}

// ── Filter tabs ───────────────────────────────────────────────────────────────

type Filter = 'all' | MyBlogItem['status'];

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',           label: 'All'       },
  { key: 'DRAFT',         label: 'Drafts'    },
  { key: 'PENDING_REVIEW',label: 'In Review' },
  { key: 'PUBLISHED',     label: 'Published' },
  { key: 'REJECTED',      label: 'Rejected'  },
];

// ── Main client component ─────────────────────────────────────────────────────

export default function MyBlogsClient({ initialPosts }: { initialPosts: MyBlogItem[] }) {
  const [posts,  setPosts]  = useState(initialPosts);
  const [filter, setFilter] = useState<Filter>('all');

  function handleDeleted(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  const filtered = filter === 'all' ? posts : posts.filter((p) => p.status === filter);

  const counts = Object.fromEntries(
    FILTERS.map(({ key }) => [
      key,
      key === 'all' ? posts.length : posts.filter((p) => p.status === key).length,
    ])
  ) as Record<Filter, number>;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl text-neutral-900">My Blogs</h1>
          <p className="text-sm text-neutral-500 mt-0.5">{posts.length} {posts.length === 1 ? 'post' : 'posts'} total</p>
        </div>
        <Link href="/blogs/write">
          <Button variant="premium" size="md">
            <Plus className="size-4" />
            New Blog
          </Button>
        </Link>
      </div>

      {/* Filter tabs */}
      {posts.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {FILTERS.map(({ key, label }) => (
            counts[key] > 0 || key === 'all' ? (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer',
                  filter === key
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
                )}
              >
                {label}
                {counts[key] > 0 && (
                  <span className={cn('ml-1.5 text-xs', filter === key ? 'opacity-70' : 'opacity-50')}>
                    {counts[key]}
                  </span>
                )}
              </button>
            ) : null
          ))}
        </div>
      )}

      {/* Grid */}
      {posts.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <p className="text-center py-16 text-neutral-400 text-sm">No posts with this status.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((post) => (
            <BlogCard key={post.id} post={post} onDeleted={handleDeleted} />
          ))}
        </div>
      )}

    </div>
  );
}
