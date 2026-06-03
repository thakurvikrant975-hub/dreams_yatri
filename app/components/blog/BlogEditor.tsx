'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExtension from '@tiptap/extension-image';
import LinkExtension from '@tiptap/extension-link';
import PlaceholderExtension from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Youtube from '@tiptap/extension-youtube';
import Underline from '@tiptap/extension-underline';
import { useState, useCallback } from 'react';
import EditorToolbar from './EditorToolbar';
import { cn } from '@/app/lib/utils';

interface BlogEditorProps {
  initialContent?: object | null;
  onChange?: (json: object, wordCount: number) => void;
  onImageInserted?: (latestJson: object) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
}

async function uploadImageToR2(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('folder', 'blogs');

  let res: Response;
  try {
    res = await fetch('/api/upload', { method: 'POST', body: fd });
  } catch {
    throw new Error('Could not reach the upload server. Check your connection.');
  }

  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).error ?? ''; } catch { /* ignore */ }
    throw new Error(detail || `Upload failed (${res.status})`);
  }

  const { url } = await res.json();
  if (!url) throw new Error('Upload succeeded but no URL was returned.');
  return url as string;
}

export default function BlogEditor({
  initialContent,
  onChange,
  onImageInserted,
  placeholder = 'Start writing your story…',
  className,
  editable = true,
}: BlogEditorProps) {
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Highlight,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      LinkExtension.configure({ openOnClick: false, autolink: true }),
      ImageExtension.configure({ inline: false, allowBase64: false }),
      Youtube.configure({ width: 640, height: 360, nocookie: true }),
      CharacterCount,
      PlaceholderExtension.configure({ placeholder }),
    ],
    content: initialContent ?? undefined,
    editable,
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[320px] px-6 py-5 prose-editor',
      },
    },
    onUpdate({ editor }) {
      const words = editor.storage.characterCount.words() as number;
      onChange?.(editor.getJSON(), words);
    },
  });

  const handleImageUpload = useCallback(async (file: File): Promise<string> => {
    setUploading(true);
    try {
      const url = await uploadImageToR2(file);
      return url;
    } finally {
      setUploading(false);
    }
  }, []);

  if (!editor) return null;

  const words: number = editor.storage.characterCount.words();
  const readTime = Math.max(1, Math.ceil(words / 200));

  return (
    <div className={cn('border border-neutral-200 rounded-xl bg-white overflow-hidden', className)}>
      {editable && (
        <EditorToolbar
          editor={editor}
          onImageUpload={handleImageUpload}
          onImageInserted={onImageInserted}
          uploading={uploading}
        />
      )}

      <EditorContent editor={editor} />

      {editable && (
        <div className="flex items-center gap-4 px-4 py-2 border-t border-neutral-100 bg-neutral-50/60">
          <span className="text-[11px] text-neutral-400">
            {words.toLocaleString()} {words === 1 ? 'word' : 'words'}
          </span>
          <span className="text-[11px] text-neutral-400">·</span>
          <span className="text-[11px] text-neutral-400">{readTime} min read</span>
        </div>
      )}
    </div>
  );
}
