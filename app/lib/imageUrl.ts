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
  gallery:   { width: 800,  quality: 80               },  // gallery thumbnails
  lightbox:  { width: 1600, quality: 90               },  // full-screen lightbox
} as const;

export function getImageUrl(key: string, size: ImageSize = {}): string {
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

  if (!key) return "";

  // Full URL (e.g. unsplash, external CDN) — pass through unchanged
  if (key.startsWith("http")) return key;

  // Cloudflare image transformations only work on CF-proxied domains.
  // r2.dev public URLs are served directly from R2 — /cdn-cgi/image/ is not
  // available there, so skip transforms and serve the raw R2 URL instead.
  const isCFProxied = !base.includes("r2.dev") && process.env.NODE_ENV !== "development";

  if (!isCFProxied) {
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

/**
 * A stay photo as stored on a day row, resolved to something an `<img src>`
 * can actually load.
 *
 * `custom_itineraries.accommodationPhoto` / `accommodationRoomPhotos` are
 * rendered raw — the builder document, the exported PDF and the client-facing
 * package page all do `<img src={day.accommodationPhoto}>` with no prefixing —
 * so what is stored there has to be a resolved URL, which is what every writer
 * except the hotel-request fill form was already doing. A bare R2 key that
 * slipped in resolves against the page's own origin instead and the photo
 * silently disappears, which is exactly what happened to hotel-team fills.
 *
 * Passing an already-resolved URL back through is a no-op (getImageUrl returns
 * anything starting with "http" unchanged), so this is safe to apply on read as
 * well as on write — which is how rows already written with a bare key heal
 * themselves the next time the package is opened and saved.
 */
export const resolveStayPhoto = (value: string | null | undefined): string =>
  value ? getThumbnailImage(value) : "";
