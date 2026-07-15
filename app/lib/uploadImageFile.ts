// Thin client-side wrapper around the existing /api/upload route (see
// app/api/upload/route.ts) — buffers the file server-side and PUTs it to R2,
// returning a real public URL. Shared by every drag-drop/upload/paste-link
// image field so there's exactly one place that knows the upload contract.
export async function uploadImageFile(file: File, folder: string = "packages"): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  body.append("folder", folder);

  const res = await fetch("/api/upload", { method: "POST", body });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Upload failed");
  return data.url as string;
}
