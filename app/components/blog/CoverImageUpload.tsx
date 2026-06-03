'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { ImageIcon, Upload, X, Loader2 } from 'lucide-react';
import { cn } from '@/app/lib/utils';

interface CoverImageUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  className?: string;
}

export default function CoverImageUpload({ value, onChange, className }: CoverImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) { setError('Only images allowed'); return; }
    if (file.size > 20 * 1024 * 1024) { setError('Max 20 MB'); return; }

    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'blogs');
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      const { url } = await res.json();
      onChange(url as string);
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  if (value) {
    return (
      <div className={cn('relative rounded-xl overflow-hidden group', className)}>
        <Image
          src={value}
          alt="Cover"
          width={1200}
          height={480}
          className="w-full h-56 object-cover"
          unoptimized
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 bg-white/90 text-neutral-800 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer"
          >
            <Upload className="size-3.5" />
            Replace
          </button>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="flex items-center gap-1.5 bg-red-500/90 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-red-500 transition-colors cursor-pointer"
          >
            <X className="size-3.5" />
            Remove
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          className="hidden"
          onChange={handleInputChange}
        />
      </div>
    );
  }

  return (
    <div className={cn('', className)}>
      <div
        role="button"
        tabIndex={0}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => !uploading && fileRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
        className={cn(
          'flex flex-col items-center justify-center gap-3 h-44 rounded-xl border-2 border-dashed transition-colors cursor-pointer',
          uploading
            ? 'border-primary-300 bg-primary-50/40 pointer-events-none'
            : 'border-neutral-300 bg-neutral-50 hover:border-primary-400 hover:bg-primary-50/30',
        )}
      >
        {uploading ? (
          <>
            <Loader2 className="size-8 text-primary-400 animate-spin" />
            <span className="text-sm text-primary-500 font-medium">Uploading cover…</span>
          </>
        ) : (
          <>
            <span className="size-12 rounded-full bg-neutral-100 flex items-center justify-center">
              <ImageIcon className="size-5 text-neutral-400" />
            </span>
            <div className="text-center">
              <p className="text-sm font-medium text-neutral-700">Add a cover image</p>
              <p className="text-xs text-neutral-400 mt-0.5">Drag & drop or click — JPG, PNG, WebP up to 20 MB</p>
            </div>
          </>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  );
}
