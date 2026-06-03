'use client';

import { type Editor } from '@tiptap/react';
import {
  Bold, Italic, Underline, Strikethrough, Code, Highlighter,
  Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Minus,
  AlignLeft, AlignCenter, AlignRight,
  Link2, Link2Off, Image as ImageIcon, Youtube,
  Undo2, Redo2,
} from 'lucide-react';
import { useRef } from 'react';
import { toast } from 'sonner';
import { cn } from '@/app/lib/utils';

interface ToolbarProps {
  editor: Editor;
  onImageUpload: (file: File) => Promise<string>;
  uploading: boolean;
}

function ToolBtn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      disabled={disabled}
      className={cn(
        'p-1.5 rounded-lg transition-colors cursor-pointer',
        active
          ? 'bg-primary-100 text-primary-600'
          : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800',
        disabled && 'opacity-30 pointer-events-none',
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="w-px h-5 bg-neutral-200 mx-0.5 shrink-0" />;
}

export default function EditorToolbar({ editor, onImageUpload, uploading }: ToolbarProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    onImageUpload(file)
      .then((url) => {
        if (!url) { toast.error('Image upload returned no URL'); return; }
        // Use insertContent directly — more reliable across Tiptap v3 versions
        // than the setImage command shorthand.
        editor.chain().focus().insertContent({
          type:  'image',
          attrs: { src: url, alt: '', title: null },
        }).run();
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Image upload failed';
        toast.error(msg);
      });
    e.target.value = '';
  }

  function handleLinkToggle() {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt('Enter URL');
    if (url) editor.chain().focus().setLink({ href: url }).run();
  }

  function handleYoutube() {
    const url = window.prompt('Enter YouTube URL');
    if (url) editor.commands.setYoutubeVideo({ src: url });
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 border-b border-neutral-200 bg-neutral-50 rounded-t-xl">
      {/* History */}
      <ToolBtn title="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
        <Undo2 className="size-4" />
      </ToolBtn>
      <ToolBtn title="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
        <Redo2 className="size-4" />
      </ToolBtn>

      <Divider />

      {/* Headings */}
      <ToolBtn title="Heading 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })}>
        <Heading1 className="size-4" />
      </ToolBtn>
      <ToolBtn title="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })}>
        <Heading2 className="size-4" />
      </ToolBtn>
      <ToolBtn title="Heading 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })}>
        <Heading3 className="size-4" />
      </ToolBtn>

      <Divider />

      {/* Marks */}
      <ToolBtn title="Bold" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')}>
        <Bold className="size-4" />
      </ToolBtn>
      <ToolBtn title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')}>
        <Italic className="size-4" />
      </ToolBtn>
      <ToolBtn title="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')}>
        <Underline className="size-4" />
      </ToolBtn>
      <ToolBtn title="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')}>
        <Strikethrough className="size-4" />
      </ToolBtn>
      <ToolBtn title="Inline code" onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')}>
        <Code className="size-4" />
      </ToolBtn>
      <ToolBtn title="Highlight" onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')}>
        <Highlighter className="size-4" />
      </ToolBtn>

      <Divider />

      {/* Alignment */}
      <ToolBtn title="Align left" onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })}>
        <AlignLeft className="size-4" />
      </ToolBtn>
      <ToolBtn title="Align center" onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })}>
        <AlignCenter className="size-4" />
      </ToolBtn>
      <ToolBtn title="Align right" onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })}>
        <AlignRight className="size-4" />
      </ToolBtn>

      <Divider />

      {/* Lists & blocks */}
      <ToolBtn title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')}>
        <List className="size-4" />
      </ToolBtn>
      <ToolBtn title="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')}>
        <ListOrdered className="size-4" />
      </ToolBtn>
      <ToolBtn title="Blockquote" onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')}>
        <Quote className="size-4" />
      </ToolBtn>
      <ToolBtn title="Divider line" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Minus className="size-4" />
      </ToolBtn>

      <Divider />

      {/* Link */}
      <ToolBtn title={editor.isActive('link') ? 'Remove link' : 'Add link'} onClick={handleLinkToggle} active={editor.isActive('link')}>
        {editor.isActive('link') ? <Link2Off className="size-4" /> : <Link2 className="size-4" />}
      </ToolBtn>

      {/* Image */}
      <ToolBtn title="Insert image" onClick={() => fileRef.current?.click()} disabled={uploading}>
        <ImageIcon className="size-4" />
      </ToolBtn>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={handleImageFile}
      />

      {/* YouTube */}
      <ToolBtn title="Embed YouTube" onClick={handleYoutube}>
        <Youtube className="size-4" />
      </ToolBtn>

      {/* Upload indicator */}
      {uploading && (
        <span className="ml-1 text-[11px] text-primary-500 font-medium animate-pulse">
          Uploading…
        </span>
      )}
    </div>
  );
}
