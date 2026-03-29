import { packagesService } from "@/app/services/packages.services";
import { ApiResponse }     from "@/app/lib/api-response";
import { handleApiError }  from "@/app/lib/api-error";
import { CacheProfile }    from "@/app/lib/api-response";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; duration: string }> }
) {
  try {
    const { slug, duration } = await params;
    const data = await packagesService.getPageData(slug, duration);
    if (!data) return ApiResponse.notFound("Package");
    return ApiResponse.ok(data, undefined, 200, CacheProfile.long);
  } catch (error) {
    return handleApiError(error);
  }
}