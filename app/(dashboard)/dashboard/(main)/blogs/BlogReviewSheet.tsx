'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import {
  CheckCircle2, XCircle, Clock, User, Tag, BookOpen,
  Calendar, ExternalLink, Loader2,
} from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '../components/ui/sheet';
import BlogEditor from '@/app/components/blog/BlogEditor';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { approveBlog, rejectBlog, type AdminBlogDetail } from './actions';

interface BlogReviewSheetProps {
  post:     AdminBlogDetail | null;
  open:     boolean;
  onClose:  () => void;
  onAction: (id: string, action: 'approved' | 'rejected') => void;
}

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDING_REVIEW: { label: 'In Review',  variant: 'default'     },
  PUBLISHED:      { label: 'Published',  variant: 'secondary'   },
  REJECTED:       { label: 'Rejected',   variant: 'destructive' },
  DRAFT:          { label: 'Draft',      variant: 'outline'     },
};

export function BlogReviewSheet({ post, open, onClose, onAction }: BlogReviewSheetProps) {
  const [rejectMode,   setRejectMode]   = useState(false);
  const [rejectNote,   setRejectNote]   = useState('');
  const [isPending,    startTransition] = useTransition();

  function handleClose() {
    setRejectMode(false);
    setRejectNote('');
    onClose();
  }

  function handleApprove() {
    if (!post) return;
    startTransition(async () => {
      const result = await approveBlog(post.id);
      if (result.success) {
        toast.success('Blog approved and published!');
        onAction(post.id, 'approved');
        handleClose();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleReject() {
    if (!rejectMode) { setRejectMode(true); return; }
    if (!post) return;
    if (!rejectNote.trim()) { toast.error('Please write a rejection note'); return; }
    startTransition(async () => {
      const result = await rejectBlog(post.id, rejectNote);
      if (result.success) {
        toast.success('Blog rejected. Author will be notified.');
        onAction(post.id, 'rejected');
        handleClose();
      } else {
        toast.error(result.error);
      }
    });
  }

  if (!post) return null;

  const statusCfg = STATUS_BADGE[post.status] ?? STATUS_BADGE.DRAFT;
  const isPending_ = post.status === 'PENDING_REVIEW';

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl flex flex-col p-0 gap-0 overflow-hidden"
      >
        {/* ── Header ── */}
        <SheetHeader className="px-6 py-4 border-b border-dashboard-base-300 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <SheetTitle className="text-base font-semibold text-dashboard-base-content leading-snug pr-4 line-clamp-2">
              {post.title}
            </SheetTitle>
            <Badge variant={statusCfg.variant} className="shrink-0 mt-0.5">
              {statusCfg.label}
            </Badge>
          </div>

          {/* Author + meta row */}
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <div className="flex items-center gap-1.5 text-xs text-dashboard-base-content/60">
              <User className="size-3.5" />
              <span>{post.author_name ?? post.author_email ?? 'Unknown'}</span>
            </div>
            {post.read_time && (
              <div className="flex items-center gap-1.5 text-xs text-dashboard-base-content/60">
                <Clock className="size-3.5" />
                <span>{post.read_time} min read</span>
              </div>
            )}
            {post.category && (
              <div className="flex items-center gap-1.5 text-xs text-dashboard-base-content/60">
                <BookOpen className="size-3.5" />
                <span>{post.category}</span>
              </div>
            )}
            {post.submitted_at && (
              <div className="flex items-center gap-1.5 text-xs text-dashboard-base-content/60">
                <Calendar className="size-3.5" />
                <span>Submitted {new Date(post.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
            )}
            {post.status === 'PUBLISHED' && (
              <a
                href={`/blogs/${post.slug}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-dashboard-primary hover:underline"
              >
                <ExternalLink className="size-3" /> View live
              </a>
            )}
          </div>

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <Tag className="size-3 text-dashboard-base-content/40" />
              {post.tags.map((t) => (
                <span key={t} className="px-2 py-0.5 bg-dashboard-base-200 text-dashboard-base-content/70 text-[11px] rounded-full">
                  {t}
                </span>
              ))}
            </div>
          )}
        </SheetHeader>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto">
          {/* Cover image */}
          {post.cover_image && (
            <div className="relative h-52 bg-dashboard-base-200">
              <Image
                src={post.cover_image}
                alt={post.title}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          )}

          {/* Excerpt */}
          {post.excerpt && (
            <div className="px-6 pt-5 pb-0">
              <p className="text-sm text-dashboard-base-content/70 italic border-l-2 border-dashboard-primary/30 pl-3">
                {post.excerpt}
              </p>
            </div>
          )}

          {/* Blog content — rendered client-side by Tiptap (same engine that wrote it) */}
          <div className="px-2">
            <BlogEditor
              initialContent={post.content}
              editable={false}
            />
          </div>

          {/* Previous rejection note */}
          {post.status === 'REJECTED' && post.rejection_note && (
            <div className="mx-6 mb-4 p-3 rounded-lg bg-red-50 border border-red-100">
              <p className="text-xs font-semibold text-red-600 mb-1">Previous rejection note:</p>
              <p className="text-sm text-red-700">{post.rejection_note}</p>
            </div>
          )}
        </div>

        {/* ── Action footer — only for PENDING_REVIEW ── */}
        {isPending_ && (
          <div className="shrink-0 border-t border-dashboard-base-300 bg-dashboard-base-100 px-6 py-4">
            {rejectMode ? (
              <div className="space-y-3">
                <label className="text-xs font-semibold text-dashboard-base-content">
                  Rejection note <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Explain why this post is being rejected so the author can revise it…"
                  rows={3}
                  className="w-full rounded-lg border border-dashboard-base-300 bg-dashboard-base-200 px-3 py-2 text-sm text-dashboard-base-content placeholder:text-dashboard-base-content/40 outline-none focus:ring-2 focus:ring-dashboard-primary/30 resize-none"
                />
                <div className="flex items-center gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleReject}
                    disabled={isPending || !rejectNote.trim()}
                    className="flex-1"
                  >
                    {isPending
                      ? <Loader2 className="size-3.5 animate-spin" />
                      : <XCircle className="size-3.5" />
                    }
                    Confirm Rejection
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setRejectMode(false); setRejectNote(''); }}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleApprove}
                  disabled={isPending}
                  className="flex-1 bg-dashboard-success text-dashboard-success-content hover:bg-dashboard-success/90"
                >
                  {isPending
                    ? <Loader2 className="size-3.5 animate-spin" />
                    : <CheckCircle2 className="size-3.5" />
                  }
                  Approve & Publish
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleReject}
                  disabled={isPending}
                  className="flex-1"
                >
                  <XCircle className="size-3.5" />
                  Reject
                </Button>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
