import "server-only";
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
  | "landing-pages";

export type UploadResult = {
  key: string;
  url: string;
};

function generateKey(folder: ImageFolder, originalName: string): string {
  const timestamp = Date.now();
  const ext       = originalName.split(".").pop()?.toLowerCase() ?? "jpg";
  const base      = originalName
    .split(".")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);

  return `${folder}/${base}-${timestamp}.${ext}`;
}

export async function uploadToR2({
  file,
  folder,
  fileName,
  contentType,
}: {
  file:        Buffer;
  folder:      ImageFolder;
  fileName:    string;
  contentType: string;
}): Promise<UploadResult> {

  const key = generateKey(folder, fileName);

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