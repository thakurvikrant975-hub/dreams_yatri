"use client";

import { Check } from "lucide-react";
import { cn } from "@/app/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

export type SelectableImage = {
  id: number | string;
  url: string;          // R2 key or full URL
  is_primary?: boolean;
  label?: string;
};

type Props = {
  images: SelectableImage[];
  value: string | null;         // selected url/key
  onChange: (url: string | null) => void;
  emptyMessage?: string;
  cols?: 3 | 4 | 5;
  className?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────

const R2_BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";

function toDisplayUrl(url: string) {
  if (url.startsWith("http")) return url;
  return `${R2_BASE}/${url}`;
}

// ── Component ──────────────────────────────────────────────────────────────

export function DBImageSelector({
  images,
  value,
  onChange,
  emptyMessage = "No images available. Upload images in the Images tab first.",
  cols = 4,
  className,
}: Props) {
  const colClass = {
    3: "grid-cols-3",
    4: "grid-cols-4",
    5: "grid-cols-5",
  }[cols];

  if (images.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed bg-muted/30 py-8 px-4 text-center">
        <p className="text-xs text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className={cn("grid gap-2", colClass)}>
        {images.map((img) => {
          const isSelected = value === img.url;
          return (
            <button
              key={img.id}
              type="button"
              onClick={() => onChange(isSelected ? null : img.url)}
              className={cn(
                "group relative aspect-square rounded-lg overflow-hidden border-2 transition-all",
                isSelected
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border hover:border-primary/50",
              )}
            >
              <img
                src={toDisplayUrl(img.url)}
                alt={img.label ?? ""}
                className="w-full h-full object-cover"
              />

              {/* Selected checkmark */}
              {isSelected && (
                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                  <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center shadow">
                    <Check className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                </div>
              )}

              {/* Hover overlay for unselected */}
              {!isSelected && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              )}

              {/* Primary badge */}
              {img.is_primary && (
                <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-[9px] font-semibold px-1.5 py-0.5 rounded pointer-events-none">
                  Primary
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Clear selection */}
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-muted-foreground hover:text-destructive underline-offset-2 hover:underline"
        >
          Remove thumbnail
        </button>
      )}
    </div>
  );
}
