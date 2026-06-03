// app/api/user/avatar/route.ts
import { NextRequest }            from "next/server";
import { uploadToR2 }             from "@/app/lib/r2/r2upload";
import { db }                     from "@/app/lib/db";
import { ApiResponse }            from "@/app/lib/api-response";
import { handleApiError }         from "@/app/lib/api-error";
import { getAuthenticatedUser }   from "@/app/lib/functions/getAuthenticatedUser";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_SIZE      = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getAuthenticatedUser();
    if (!sessionUser) return ApiResponse.error("Unauthorized", "UNAUTHORIZED", 401);

    const formData = await req.formData();
    const file     = formData.get("image") as File | null;

    if (!file)                          return ApiResponse.badRequest("No image provided.");
    if (!ALLOWED_TYPES.includes(file.type)) return ApiResponse.badRequest("Only JPEG, PNG, and WebP are allowed.");
    if (file.size > MAX_SIZE)           return ApiResponse.badRequest("Image must be under 5 MB.");

    const buffer = Buffer.from(await file.arrayBuffer());

    const { url } = await uploadToR2({
      file:        buffer,
      folder:      "avatars",
      fileName:    file.name,
      contentType: file.type,
    });

    await db.user.update({
      where: { id: sessionUser.id },
      data:  { image: url },
    });

    return ApiResponse.ok({ url });
  } catch (error) {
    return handleApiError(error);
  }
}
