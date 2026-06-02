'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import {
  Search, Eye, CheckCircle2, XCircle,
  Clock, FileText, Hourglass, AlertCircle, Filter,
} from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { BlogReviewSheet } from './BlogReviewSheet';
import {
  getAllBlogs, getBlogForReview, approveBlog,
  type AdminBlogRow, type AdminBlogDetail,
} from './actions';

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG = {
  DRAFT:          { label: 'Draft',      icon: FileText,    color: 'bg-neutral-100 text-neutral-600' },
  PENDING_REVIEW: { label: 'In Review',  icon: Hourglass,   color: 'bg-amber-50 text-amber-600'     },
  PUBLISHED:      { label: 'Published',  icon: CheckCircle2,color: 'bg-green-50 text-green-700'     },
  REJECTED:       { label: 'Rejected',   icon: AlertCircle, color: 'bg-red-50 text-red-600'         },
} as const;

const STATUS_FILTERS = [
  { key: 'all',           label: 'All'       },
  { key: 'PENDING_REVIEW',label: 'Pending'   },
  { key: 'PUBLISHED',     label: 'Published' },
  { key: 'REJECTED',      label: 'Rejected'  },
  { key: 'DRAFT',         label: 'Drafts'    },
] as const;

type StatusFilter = typeof STATUS_FILTERS[number]['key'];

function StatusPill({ status }: { status: AdminBlogRow['status'] }) {
  const cfg = STATUS_CFG[status];
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold', cfg.color)}>
      <Icon className="size-3" />{cfg.label}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BlogsTable({ initialRows }: { initialRows: AdminBlogRow[] }) {
  const [rows,       setRows]       = useState<AdminBlogRow[]>(initialRows);
  const [search,     setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sheetPost,  setSheetPost]  = useState<AdminBlogDetail | null>(null);
  const [sheetOpen,  setSheetOpen]  = useState(false);
  const [loadingId,  setLoadingId]  = useState<string | null>(null);
  const [, startTransition]         = useTransition();

  // ── Client-side filter ────────────────────────────────────────────────────
  const filtered = rows.filter((r) => {
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      r.title.toLowerCase().includes(q) ||
      (r.author_name ?? '').toLowerCase().includes(q) ||
      (r.author_email ?? '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  // ── Open review sheet ─────────────────────────────────────────────────────
  async function openReview(id: string) {
    setLoadingId(id);
    const detail = await getBlogForReview(id);
    setLoadingId(null);
    if (!detail) { toast.error('Could not load post'); return; }
    setSheetPost(detail);
    setSheetOpen(true);
  }

  // ── Quick-approve directly from the table ────────────────────────────────
  function handleQuickApprove(id: string) {
    startTransition(async () => {
      const result = await approveBlog(id);
      if (result.success) {
        toast.success('Blog approved and published!');
        setRows((prev) =>
          prev.map((r) => r.id === id ? { ...r, status: 'PUBLISHED' } : r)
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  // ── Sheet close / action callback ────────────────────────────────────────
  function handleSheetAction(id: string, action: 'approved' | 'rejected') {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, status: action === 'approved' ? 'PUBLISHED' : 'REJECTED' }
          : r
      )
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-dashboard-base-300 bg-dashboard-base-100">
        <FileText className="size-10 text-dashboard-base-content/20 mb-3" />
        <p className="text-sm font-medium text-dashboard-base-content/60">No blog posts yet</p>
        <p className="text-xs text-dashboard-base-content/40 mt-1">Posts submitted by users will appear here</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-52 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-dashboard-base-content/40" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or author…"
            className="pl-8 h-9 text-sm"
          />
        </div>

        {/* Status filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="size-3.5 text-dashboard-base-content/40 shrink-0" />
          {STATUS_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer',
                statusFilter === key
                  ? 'bg-dashboard-primary text-dashboard-primary-content'
                  : 'bg-dashboard-base-200 text-dashboard-base-content/70 hover:bg-dashboard-base-300',
              )}
            >
              {label}
              <span className="ml-1 opacity-60">
                {key === 'all'
                  ? rows.length
                  : rows.filter((r) => r.status === key).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 overflow-hidden">
        {/* Head */}
        <div className="hidden lg:grid grid-cols-[2fr_1.2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-2.5 bg-dashboard-base-200 border-b border-dashboard-base-300 text-[11px] font-semibold uppercase tracking-wide text-dashboard-base-content/50">
          <span>Post</span>
          <span>Author</span>
          <span>Status</span>
          <span>Category</span>
          <span>Submitted</span>
          <span className="text-right">Actions</span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-dashboard-base-content/40">
            No posts match your filters
          </div>
        ) : (
          filtered.map((row) => (
            <div
              key={row.id}
              className={cn(
                'grid grid-cols-1 lg:grid-cols-[2fr_1.2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 border-b border-dashboard-base-300 last:border-b-0 items-center hover:bg-dashboard-base-200/50 transition-colors',
                row.status === 'PENDING_REVIEW' && 'bg-amber-50/40',
              )}
            >
              {/* Post */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-10 rounded-lg overflow-hidden bg-dashboard-base-200 shrink-0">
                  {row.cover_image
                    ? <Image src={row.cover_image} alt="" width={40} height={40} className="w-full h-full object-cover" unoptimized />
                    : <FileText className="size-5 text-dashboard-base-content/20 m-auto mt-2.5" />
                  }
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-dashboard-base-content truncate">{row.title}</p>
                  {row.read_time && (
                    <p className="text-[11px] text-dashboard-base-content/50 flex items-center gap-1">
                      <Clock className="size-3" />{row.read_time} min read
                    </p>
                  )}
                </div>
              </div>

              {/* Author */}
              <div className="min-w-0">
                <p className="text-sm text-dashboard-base-content truncate">{row.author_name ?? '—'}</p>
                <p className="text-[11px] text-dashboard-base-content/50 truncate">{row.author_email ?? ''}</p>
              </div>

              {/* Status */}
              <div><StatusPill status={row.status} /></div>

              {/* Category */}
              <div>
                {row.category
                  ? <Badge variant="outline" className="text-[11px]">{row.category}</Badge>
                  : <span className="text-xs text-dashboard-base-content/30">—</span>
                }
              </div>

              {/* Date */}
              <div className="text-xs text-dashboard-base-content/60">
                {row.submitted_at
                  ? new Date(row.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                  : new Date(row.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                }
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openReview(row.id)}
                  disabled={loadingId === row.id}
                  className="h-8 px-2.5 gap-1 text-xs"
                >
                  {loadingId === row.id
                    ? <span className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    : <Eye className="size-3.5" />
                  }
                  Review
                </Button>

                {/* Quick-approve directly from table row */}
                {row.status === 'PENDING_REVIEW' && (
                  <Button
                    size="sm"
                    onClick={() => handleQuickApprove(row.id)}
                    className="h-8 px-2.5 gap-1 text-xs bg-dashboard-success text-dashboard-success-content hover:bg-dashboard-success/90"
                  >
                    <CheckCircle2 className="size-3.5" />
                    Approve
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Review sheet ── */}
      <BlogReviewSheet
        post={sheetPost}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onAction={handleSheetAction}
      />
    </>
  );
}
