// app/lib/imageUrl.ts
// Generates Cloudflare Image Transformation URLs
// Cloudflare transforms on first request → caches at edge → serves instantly after

export type ImageSize = {
  width?:   number;
  height?:  number;
  quality?: number;
  fit?:     "cover" | "contain" | "scale-down" | "crop";
};

// Pre-defined sizes — keeps transformation count low
export const IMAGE_SIZES = {
  card:      { width: 400,  height: 250, quality: 75  },  // listing cards
  thumbnail: { width: 160,  height: 120, quality: 65  },  // small previews
  hero:      { width: 1200, quality: 85               },  // detail page hero
  og:        { width: 1200, height: 630, quality: 80  },  // social/OG meta
  gallery:   { width: 800,  quality: 80               },  // gallery images
} as const;

export function getImageUrl(key: string, size: ImageSize = {}): string {
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

  if (!key) return "";

  // In development — skip transformation (Cloudflare not in the loop locally)
  if (process.env.NODE_ENV === "development") {
    return `${base}/${key}`;
  }

  const params = [
    size.width   ? `width=${size.width}`   : "",
    size.height  ? `height=${size.height}` : "",
    `quality=${size.quality ?? 80}`,
    `fit=${size.fit ?? "cover"}`,
    "format=auto",  // auto WebP/AVIF — counts as ONE transformation
  ].filter(Boolean).join(",");

  // Cloudflare transformation URL:
  // https://cdn.dreamsyatri.com/cdn-cgi/image/width=400,quality=75,format=auto/regions/image.jpg
  return `${base}/cdn-cgi/image/${params}/${key}`;
}

// Convenience wrappers
export const getCardImage      = (key: string) => getImageUrl(key, IMAGE_SIZES.card);
export const getHeroImage      = (key: string) => getImageUrl(key, IMAGE_SIZES.hero);
export const getThumbnailImage = (key: string) => getImageUrl(key, IMAGE_SIZES.thumbnail);
export const getOGImage        = (key: string) => getImageUrl(key, IMAGE_SIZES.og);
export const getGalleryImage   = (key: string) => getImageUrl(key, IMAGE_SIZES.gallery);