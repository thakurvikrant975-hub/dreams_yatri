'use client'

import { useRef, useState } from "react";
import { cn } from "@/app/lib/utils";
import { CameraIcon } from "@heroicons/react/24/solid";
import Image from "next/image";
import { useRouter } from "next/navigation";

interface AvatarUploadProps {
  name?:  string | null;
  image?: string | null;
}

export function AvatarUpload({ name, image }: AvatarUploadProps) {
  const router    = useRouter();
  const inputRef  = useRef<HTMLInputElement>(null);
  const [preview,   setPreview]   = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const initials = name
    ? name.trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  const displayImage = preview ?? image ?? null;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setPreview(URL.createObjectURL(file));
    setUploading(true);

    try {
      const fd = new FormData();
      fd.append("image", file);

      const res  = await fetch("/api/user/avatar", { method: "POST", body: fd });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Upload failed.");
        setPreview(null);
        return;
      }

      router.refresh();
    } catch {
      setError("Upload failed. Please try again.");
      setPreview(null);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="relative group inline-block">
      <div className="size-24 sm:size-28 rounded-2xl overflow-hidden ring-4 ring-white shadow-lg">
        {displayImage ? (
          <Image
            src={displayImage}
            alt={name ?? "Profile"}
            width={112}
            height={112}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="size-full bg-linear-to-br from-primary-300 to-primary-600 flex items-center justify-center">
            <span className="text-3xl font-bold text-white select-none">{initials}</span>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-2xl">
            <svg className="size-6 animate-spin text-white" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
            </svg>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={cn(
          'absolute -bottom-1.5 -right-1.5 size-8 rounded-lg',
          'bg-white border border-neutral-200 shadow-md',
          'flex items-center justify-center',
          'hover:bg-primary-50 hover:border-primary/30 transition-all',
          'group-hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed'
        )}
        aria-label="Change profile photo"
      >
        <CameraIcon className="size-4 text-primary" />
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {error && (
        <p className="absolute top-full left-0 mt-1 text-[10px] text-red-500 whitespace-nowrap">{error}</p>
      )}
    </div>
  );
}
