import { ApiResponse } from "@/app/lib/api-response";
import { handleApiError } from "@/app/lib/api-error";
import { validate, paginationSchema } from "@/app/lib/validate";
import { packagesService } from "@/app/services/packages.services";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const pagination = validate(paginationSchema, {
            page: searchParams.get("page") ?? 1,
            limit: searchParams.get("limit") ?? 20,
        });
        const result = await packagesService.getAll(pagination);
        return ApiResponse.ok(result.data, {
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages,
        });
    } catch (error) {
        return handleApiError(error);
    }
}