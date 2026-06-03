'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { extractExcerpt } from '@/app/lib/tiptap/extractExcerpt';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { X, Tag, ChevronDown, Send, Save, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import BlogEditor from './BlogEditor';
import CoverImageUpload from './CoverImageUpload';
import Button from '@/app/components/ui/Button';
import {
  saveBlogDraft,
  submitBlogForReview,
  type BlogCategory,
  type BlogForEdit,
  type SaveDraftInput,
} from '@/app/actions/blogs/actions';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BlogWriteFormProps {
  categories: BlogCategory[];
  initialData?: BlogForEdit | null;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// ── Component ─────────────────────────────────────────────────────────────────

export default function BlogWriteForm({ categories, initialData }: BlogWriteFormProps) {
  const router = useRouter();

  // ── Form state ────────────────────────────────────────────────────────────
  const [postId,      setPostId]      = useState<string | null>(initialData?.id ?? null);
  const [title,       setTitle]       = useState(initialData?.title ?? '');
  const [excerpt,     setExcerpt]     = useState(initialData?.excerpt ?? '');
  const [coverImage,  setCoverImage]  = useState<string | null>(initialData?.cover_image ?? null);
  const [categoryId,  setCategoryId]  = useState<number | null>(initialData?.category_id ?? null);
  const [tags,        setTags]        = useState<string[]>(initialData?.tags ?? []);
  const [tagInput,    setTagInput]    = useState('');
  const [content,     setContent]     = useState<object>(initialData?.content ?? { type: 'doc', content: [] });
  const [wordCount,   setWordCount]   = useState(0);
  const [readTime,    setReadTime]    = useState<number>(initialData?.read_time ?? 1);
  const [catOpen,     setCatOpen]     = useState(false);

  const [saveStatus,    setSaveStatus]    = useState<SaveStatus>('idle');
  const [isSubmitting,  setIsSubmitting]  = useState(false);

  // Live preview of the auto-generated excerpt (only shown when excerpt field is empty)
  const autoExcerpt = useMemo(() => extractExcerpt(content), [content]);

  // ── Auto-save refs ────────────────────────────────────────────────────────
  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirty     = useRef(false);
  // postId lives in the ref so the memoized scheduleSave always sees the latest value
  const latestState = useRef({ postId, title, excerpt, coverImage, categoryId, tags, content, readTime });

  useEffect(() => {
    latestState.current = { postId, title, excerpt, coverImage, categoryId, tags, content, readTime };
  }, [postId, title, excerpt, coverImage, categoryId, tags, content, readTime]);

  // ── Schedule save on any field change ─────────────────────────────────────
  // useCallback with [] is intentional: the memoized fn always reads from latestState ref,
  // so it never holds stale state values in its closure.
  const scheduleSave = useCallback(() => {
    isDirty.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!isDirty.current) return;
      const s = latestState.current;
      if (!s.title.trim()) return;
      await performSaveFromRef();
    }, 2500);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => scheduleSave(), [title, excerpt, coverImage, categoryId, tags, content, scheduleSave]);

  // ── Unmount: cancel pending timer ────────────────────────────────────────
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  // Stable ref that always points to the latest performSave implementation
  const performSaveRef = useRef<() => Promise<void>>(async () => {});

  // ── Core save function ────────────────────────────────────────────────────
  async function performSave() {
    const s = latestState.current;
    setSaveStatus('saving');
    isDirty.current = false;

    const input: SaveDraftInput = {
      id:          s.postId ?? undefined,   // read from ref — never stale
      title:       s.title,
      excerpt:     s.excerpt || null,
      content:     s.content as Record<string, unknown>,
      cover_image: s.coverImage ?? null,
      category_id: s.categoryId ?? null,
      tags:        s.tags,
      read_time:   s.readTime,
    };

    try {
      const result = await saveBlogDraft(input);
      if (result.success) {
        setSaveStatus('saved');
        if (!s.postId) {
          setPostId(result.id);
          router.replace(`/blogs/${result.id}/edit`);
        }
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 4000);
      }
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 4000);
    }
  }

  // Keep the ref pointing to the latest performSave on every render
  performSaveRef.current = performSave;
  function performSaveFromRef() { return performSaveRef.current(); }

  // ── Manual save ──────────────────────────────────────────────────────────
  async function handleManualSave() {
    if (!title.trim()) { toast.error('Add a title first'); return; }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await performSave();
  }

  // ── Submit for review ─────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!title.trim()) { toast.error('Add a title before submitting'); return; }

    // Save any unsaved changes first
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const saveResult = await (async () => {
      if (!postId || isDirty.current) {
        const r = await saveBlogDraft({
          id:          postId ?? undefined,
          title,
          excerpt:     excerpt || null,
          content:     content as Record<string, unknown>,
          cover_image: coverImage,
          category_id: categoryId,
          tags,
          read_time:   readTime,
        });
        if (r.success && !postId) setPostId(r.id);
        return r;
      }
      return { success: true as const, id: postId };
    })();

    if (!saveResult.success) { toast.error('Failed to save. Try again.'); return; }

    setIsSubmitting(true);
    const result = await submitBlogForReview(saveResult.id);
    setIsSubmitting(false);

    if (result.success) {
      toast.success('Blog submitted for review!');
      router.push('/blogs/my-blogs');
    } else {
      toast.error(result.error);
    }
  }

  // ── Tag helpers ───────────────────────────────────────────────────────────
  function addTag(raw: string) {
    const name = raw.trim().toLowerCase();
    if (!name || tags.includes(name) || tags.length >= 10) return;
    setTags((prev) => [...prev, name]);
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
      setTagInput('');
    } else if (e.key === 'Backspace' && !tagInput && tags.length) {
      setTags((prev) => prev.slice(0, -1));
    }
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  // ── Editor change ─────────────────────────────────────────────────────────
  function handleEditorChange(json: object, words: number) {
    setContent(json);
    setWordCount(words);
    setReadTime(Math.max(1, Math.ceil(words / 200)));
  }

  // ── Force-save immediately after an image is inserted ─────────────────────
  // React state won't have updated yet when this fires, so the editor passes
  // the fresh JSON directly instead of us reading from latestState.current.
  async function handleImageInserted(latestJson: object) {
    if (!title.trim()) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    // Update latestState.current with the editor-fresh JSON before saving.
    latestState.current = { ...latestState.current, content: latestJson };
    setContent(latestJson); // keep React state in sync
    await performSaveFromRef();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const selectedCat = categories.find((c) => c.id === categoryId);

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ── Header bar ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1.5 text-xs text-neutral-400">
              <Loader2 className="size-3.5 animate-spin" /> Saving…
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1.5 text-xs text-success-600">
              <CheckCircle2 className="size-3.5" /> Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1.5 text-xs text-red-500">
              <AlertCircle className="size-3.5" /> Save failed
            </span>
          )}
          {wordCount > 0 && (
            <span className="text-xs text-neutral-400 flex items-center gap-1">
              <Clock className="size-3" />
              {readTime} min read · {wordCount.toLocaleString()} words
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleManualSave}
            disabled={saveStatus === 'saving'}
          >
            <Save className="size-3.5" />
            Save Draft
          </Button>
          <Button
            type="button"
            variant="premium"
            size="sm"
            onClick={handleSubmit}
            loading={isSubmitting}
          >
            <Send className="size-3.5" />
            Submit for Review
          </Button>
        </div>
      </div>

      {/* ── Cover image ── */}
      <CoverImageUpload value={coverImage} onChange={setCoverImage} />

      {/* ── Title ── */}
      <div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Your blog title…"
          maxLength={255}
          className="w-full text-3xl font-heading font-bold text-neutral-900 placeholder:text-neutral-300 bg-transparent border-none outline-none resize-none leading-tight"
        />
        <div className="mt-1 h-px bg-neutral-100" />
      </div>

      {/* ── Excerpt ── */}
      <div>
        <textarea
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          placeholder={autoExcerpt ?? "Short summary (shown on listing pages)…"}
          maxLength={500}
          rows={2}
          className="w-full text-sm text-neutral-600 placeholder:text-neutral-300 bg-transparent border-none outline-none resize-none leading-relaxed"
        />
        {!excerpt && autoExcerpt && (
          <p className="text-[11px] text-neutral-400 mt-0.5">
            Auto-summary from your content — type here to override
          </p>
        )}
      </div>

      {/* ── Meta row: Category + Tags ── */}
      <div className="flex flex-wrap items-start gap-4">

        {/* Category picker */}
        {categories.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setCatOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neutral-200 bg-white text-sm text-neutral-600 hover:border-neutral-300 transition-colors cursor-pointer"
            >
              {selectedCat ? selectedCat.name : 'Select category'}
              <ChevronDown className={cn('size-3.5 opacity-50 transition-transform', catOpen && 'rotate-180')} />
            </button>
            {catOpen && (
              <div className="absolute top-full mt-1.5 left-0 z-50 bg-white rounded-xl border border-neutral-200 shadow-lg min-w-44 py-1 overflow-hidden">
                <button
                  type="button"
                  onClick={() => { setCategoryId(null); setCatOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-50 transition-colors cursor-pointer"
                >
                  None
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setCategoryId(c.id); setCatOpen(false); }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer',
                      categoryId === c.id
                        ? 'bg-primary-50 text-primary-600 font-medium'
                        : 'text-neutral-700 hover:bg-neutral-50',
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        <div className="flex-1 min-w-60">
          <div className="flex flex-wrap items-center gap-1.5">
            <Tag className="size-3.5 text-neutral-400 shrink-0" />
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600 text-xs font-medium"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
            {tags.length < 10 && (
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => { if (tagInput.trim()) { addTag(tagInput); setTagInput(''); } }}
                placeholder={tags.length === 0 ? 'Add tags (press Enter)…' : ''}
                className="text-xs text-neutral-600 placeholder:text-neutral-300 bg-transparent outline-none min-w-24 flex-1"
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Editor ── */}
      <BlogEditor
        initialContent={initialData?.content as object ?? null}
        onChange={handleEditorChange}
        onImageInserted={handleImageInserted}
        placeholder="Start writing your travel story…"
      />

      {/* ── Bottom submit bar ── */}
      <div className="flex justify-end gap-3 pb-10">
        <Button type="button" variant="outline" size="md" onClick={handleManualSave} disabled={saveStatus === 'saving'}>
          <Save className="size-4" />
          Save Draft
        </Button>
        <Button type="button" variant="premium" size="md" onClick={handleSubmit} loading={isSubmitting}>
          <Send className="size-4" />
          Submit for Review
        </Button>
      </div>

    </div>
  );
}
