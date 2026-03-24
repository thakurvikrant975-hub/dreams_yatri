// app/types/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Single entry point for all types across the app.
// Always import from "@/types" — never from individual type files directly.
//
// Usage:
//   import type { Package, CreatePackageInput } from "@/types"
//   import { createPackageSchema, paginationSchema } from "@/types"
// ─────────────────────────────────────────────────────────────────────────────

// ── DB types (Prisma inferred) ────────────────────────────────────────────────


// ── Input types (Zod inferred) ────────────────────────────────────────────────
export type {
    PaginationInput,
    CreateRegionInput,
    UpdateRegionInput,
    CreateDestinationInput,
    UpdateDestinationInput,
    CreatePackageInput,
    UpdatePackageInput,
    CreatePackageVariantInput,
    UpdatePackageVariantInput,
    ItineraryDay,
    CreateItineraryInput,
    UpdateItineraryInput,
    ImageFolder,
} from "./api.types";

// ── Zod schemas (used in validate() calls in route handlers) ──────────────────
export {
    paginationSchema,
    createRegionSchema,
    updateRegionSchema,
    createDestinationSchema,
    updateDestinationSchema,
    createPackageSchema,
    updatePackageSchema,
    createPackageVariantSchema,
    updatePackageVariantSchema,
    itineraryDaySchema,
    createItinerarySchema,
    updateItinerarySchema,
    uploadImageSchema,
    IMAGE_FOLDERS,
} from "./api.types";

// ── Common/shared types ───────────────────────────────────────────────────────
export type {
    ApiSuccess,
    ApiErrorResponse,
    PaginationMeta,
    PaginatedResult,
    AsyncState,
    UploadedImage,
    PaginatedResponse,
    PaginationParams
} from "./common.types";