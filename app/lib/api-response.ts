// app/lib/api-response.ts
import { NextResponse } from "next/server";

export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiError = {
  success: false;
  error: string;
  code: string;
};

export const CacheProfile = {
  static: "public, s-maxage=86400, stale-while-revalidate=604800",
  long:   "public, s-maxage=3600, stale-while-revalidate=86400",
  medium: "public, s-maxage=600, stale-while-revalidate=3600",
  none:   "no-store",
} as const;

// Dev flag — set to true when going to production
const IS_PRODUCTION = process.env.NODE_ENV === "production";

export const ApiResponse = {
  ok: <T>(
    data: T,
    meta?: Record<string, unknown>,
    status = 200,
    cache: string = CacheProfile.medium
  ) =>
    NextResponse.json<ApiSuccess<T>>(
      { success: true, data, ...(meta && { meta }) },
      {
        status,
        headers: {
          // In development — never cache, always hit DB
          "Cache-Control": IS_PRODUCTION ? cache : CacheProfile.none,
        },
      }
    ),

  created: <T>(data: T) =>
    NextResponse.json<ApiSuccess<T>>(
      { success: true, data },
      {
        status:  201,
        headers: { "Cache-Control": CacheProfile.none },
      }
    ),

  error: (message: string, code: string, status: number) =>
    NextResponse.json<ApiError>(
      { success: false, error: message, code },
      {
        status,
        headers: { "Cache-Control": CacheProfile.none },
      }
    ),

  notFound:    (resource = "Resource") =>
    ApiResponse.error(`${resource} not found`, "NOT_FOUND", 404),
  badRequest:  (message: string) =>
    ApiResponse.error(message, "BAD_REQUEST", 400),
  conflict:    (message: string) =>
    ApiResponse.error(message, "CONFLICT", 409),
  serverError: () =>
    ApiResponse.error("Internal server error", "SERVER_ERROR", 500),
};