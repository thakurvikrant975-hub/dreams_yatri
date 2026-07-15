"use client";

import { useState, useRef, useEffect } from "react";
import { ImageIcon, X, Loader2, Upload, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/app/(dashboard)/dashboard/(main)/components/ui/input";
import { cn } from "@/app/lib/utils";
import { uploadImageFile } from "@/app/lib/uploadImageFile";

const POSITION_STEP = 5;

/** One image field, three ways to fill it in: drag a file onto the box,
 * click it to browse, or paste a link in the field below — all three end up
 * calling the same onChange(url), so the parent never has to care which one
 * was used. When onPositionChange is supplied, a vertical-position slider
 * appears once an image is set, for re-centering a photo that object-cover
 * crops awkwardly (e.g. a portrait shot in a wide banner). */
export function ImageDropField({
  value, onChange, position = 50, onPositionChange, folder = "packages", className,
}: {
  value: string;
  onChange: (url: string) => void;
  position?: number;
  onPositionChange?: (position: number) => void;
  folder?: string;
  className?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [urlDraft, setUrlDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keeps the "paste a link" field in sync when the image changes from
  // elsewhere (e.g. the "Use destination photo" button, or a drop directly
  // onto the live preview's cover image).
  useEffect(() => { setUrlDraft(value); }, [value]);

  // A brand-new image resets to a centered crop — the old offset was tuned
  // for the previous photo and rarely still makes sense on a different one.
  function setNewImage(url: string) {
    onChange(url);
    onPositionChange?.(50);
  }

  async function uploadAndSet(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please drop an image file");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadImageFile(file, folder);
      setNewImage(url);
      toast.success("Image uploaded");
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function commitUrlDraft() {
    const trimmed = urlDraft.trim();
    if (trimmed !== value) setNewImage(trimmed);
  }

  function nudgePosition(delta: number) {
    onPositionChange?.(Math.min(100, Math.max(0, position + delta)));
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); uploadAndSet(e.dataTransfer.files); }}
        className={cn(
          "relative rounded-xl border-2 border-dashed overflow-hidden transition-colors",
          dragOver ? "border-dashboard-primary bg-dashboard-primary/5" : "border-dashboard-base-300",
          value ? "aspect-21/9" : "aspect-21/9 min-h-24",
        )}
      >
        {value ? (
          <div className="group relative w-full h-full">
            {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary external/catalog URL, not a static app asset */}
            <img
              src={value}
              alt=""
              className="w-full h-full object-cover"
              style={{ objectPosition: `center ${position}%` }}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/45 transition-colors flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="h-8 px-3 rounded-full bg-white/95 hover:bg-white flex items-center gap-1.5 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Upload size={12} /> Change
              </button>
              <button
                type="button"
                onClick={() => onChange("")}
                className="h-8 w-8 rounded-full bg-white/95 hover:bg-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={14} />
              </button>
            </div>
            {uploading && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin text-white" />
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full h-full flex flex-col items-center justify-center gap-1.5 py-6 hover:bg-dashboard-primary/5 transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 size={18} className="animate-spin text-dashboard-base-content/40" />
                <span className="text-xs text-dashboard-base-content/50">Uploading…</span>
              </>
            ) : (
              <>
                <ImageIcon size={18} className="text-dashboard-base-content/30" />
                <span className="text-xs text-dashboard-base-content/60 text-center px-4">
                  Drag & drop an image, or <span className="text-dashboard-primary font-medium">click to browse</span>
                </span>
              </>
            )}
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="hidden"
          onChange={(e) => { uploadAndSet(e.target.files); e.target.value = ""; }}
        />
      </div>

      {value && onPositionChange && (
        <div className="flex items-center gap-2">
          <ArrowUpDown size={12} className="text-dashboard-base-content/40 shrink-0" />
          <button
            type="button"
            onClick={() => nudgePosition(-POSITION_STEP)}
            disabled={position <= 0}
            className="p-0.5 rounded hover:bg-dashboard-base-200 text-dashboard-base-content/50 disabled:opacity-30 transition-colors shrink-0"
            aria-label="Move image up"
          >
            <ChevronUp size={14} />
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={position}
            onChange={(e) => onPositionChange(Number(e.target.value))}
            className="flex-1 h-1.5 accent-dashboard-primary cursor-pointer"
          />
          <button
            type="button"
            onClick={() => nudgePosition(POSITION_STEP)}
            disabled={position >= 100}
            className="p-0.5 rounded hover:bg-dashboard-base-200 text-dashboard-base-content/50 disabled:opacity-30 transition-colors shrink-0"
            aria-label="Move image down"
          >
            <ChevronDown size={14} />
          </button>
          <span className="text-[10px] text-dashboard-base-content/40 w-7 text-right shrink-0">{position}%</span>
        </div>
      )}

      <Input
        value={urlDraft}
        onChange={(e) => setUrlDraft(e.target.value)}
        onBlur={commitUrlDraft}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
        }}
        placeholder="Or paste an image link…"
        className="text-xs h-8 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary rounded-md"
      />
    </div>
  );
}
