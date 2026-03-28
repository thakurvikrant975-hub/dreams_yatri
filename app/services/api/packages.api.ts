// app/services/api/packages.api.ts
import { apiClient } from "./client";
import type { ApiSuccess, PaginationParams } from "@/app/types";
import type { PackagePageData, PackageHotel, PackageActivity } from "@/app/types/package-page.types";

// app/types/package-page.types.ts
export type PricingRow = {
    route_index: number | null;
    stay_category_id: number;
    price: number;
    original_price: number | null;
};

export const packagesApi = {

    // ── List ──────────────────────────────────────────────────────────────────
    getAll: async (params: PaginationParams = {}) => {
        const res = await apiClient.get<ApiSuccess<any[]>>("/packages", {
            params: { page: params.page ?? 1, limit: params.limit ?? 20 },
        });
        return { data: res.data.data, meta: res.data.meta! };
    },

    // ── SSR page data — used in server components directly ────────────────────
    // Don't call this from client — use server component instead
    getPageData: async (slug: string, duration: string): Promise<PackagePageData> => {
        const res = await apiClient.get<ApiSuccess<PackagePageData>>(
            `/packages/${slug}/${duration}`
        );
        return res.data.data;
    },

    // ── Fresh pricing — called client side, bypasses ISR ─────────────────────
    getPricing: async (slug: string): Promise<PricingRow[]> => {
        const res = await apiClient.get<ApiSuccess<PricingRow[]>>(
            `/packages/${slug}/pricing`
        );
        return res.data.data;
    },

    // ── Hotels — loaded when Hotels tab clicked ───────────────────────────────
    getHotels: async (slug: string): Promise<PackageHotel[]> => {
        const res = await apiClient.get<ApiSuccess<PackageHotel[]>>(
            `/packages/${slug}/hotels`
        );
        return res.data.data;
    },

    // ── Activities — loaded when Activities tab clicked ───────────────────────
    getActivities: async (slug: string): Promise<PackageActivity[]> => {
        const res = await apiClient.get<ApiSuccess<PackageActivity[]>>(
            `/packages/${slug}/activities`
        );
        return res.data.data;
    },

};