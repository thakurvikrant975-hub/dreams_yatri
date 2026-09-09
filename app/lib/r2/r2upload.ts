import "server-only";
import { randomBytes } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2, R2_BUCKET, R2_PUBLIC_URL } from "./r2";

export type ImageFolder =
  | "regions"
  | "destinations"
  | "hotels"
  | "hotel-docs"
  | "hotel-reviews"
  | "packages"
  | "activities"
  | "team-members"
  | "blogs"
  | "avatars"
  | "chat-attachments"
  | "landing-pages"
  | "payment-proofs";

export type UploadResult = {
  key: string;
  url: string;
};

function slugify(input: string, maxLen = 40): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen);
}

// nameHint lets callers name the object after what it actually depicts (a
// hotel, activity, package, region, etc.) instead of the visitor's raw
// upload filename — which is often a meaningless browser-generated string
// like "unnamed-2026-07-28T11:36:14-1785218784628" (clipboard pastes,
// screenshots, cropped canvases have no real name to fall back to).
//
// The unique suffix is a short random id rather than a millisecond
// timestamp — "paragliding-in-manali-a1b2c3d4.webp" reads as a real,
// permanent asset URL; a 13-digit epoch stamp reads as generated/temporary,
// which is exactly the impression an SEO-facing image URL shouldn't give.
function generateKey(folder: ImageFolder, originalName: string, nameHint?: string): string {
  const unique = randomBytes(4).toString("hex");
  const ext    = originalName.split(".").pop()?.toLowerCase() ?? "jpg";
  const base   = slugify(nameHint || originalName.split(".")[0], 60) || "image";

  return `${folder}/${base}-${unique}.${ext}`;
}

export async function uploadToR2({
  file,
  folder,
  fileName,
  nameHint,
  contentType,
}: {
  file:        Buffer;
  folder:      ImageFolder;
  fileName:    string;
  nameHint?:   string;
  contentType: string;
}): Promise<UploadResult> {

  const key = generateKey(folder, fileName, nameHint);

  await r2.send(
    new PutObjectCommand({
      Bucket:       R2_BUCKET,
      Key:          key,
      Body:         file,
      ContentType:  contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return {
    key,
    url: `${R2_PUBLIC_URL}/${key}`,
  };
}