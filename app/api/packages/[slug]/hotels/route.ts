import { packagesService } from "@/app/services/packages.services";
import { ApiResponse }     from "@/app/lib/api-response";
import { handleApiError }  from "@/app/lib/api-error";
import { CacheProfile }    from "@/app/lib/api-response";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const data = await packagesService.getHotels(slug);
    if (!data) return ApiResponse.notFound("Package");
    return ApiResponse.ok(data, undefined, 200, CacheProfile.long);
  } catch (error) {
    return handleApiError(error);
  }
}