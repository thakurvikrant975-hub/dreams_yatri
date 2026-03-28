// app/lib/result.ts

export type Result<T> =
    | { success: true; data: T }
    | { success: false; error: AppError };

export type AppError = {
    code: AppErrorCode;
    message: string;
    cause?: unknown;
};

export type AppErrorCode =
    | "NOT_FOUND"
    | "VALIDATION_ERROR"
    | "DB_ERROR"
    | "CONFLICT"
    | "UNAUTHORIZED"
    | "FORBIDDEN";


export const Ok = <T>(data: T): Result<T> => ({
    success: true,
    data,
});

export const Err = (
    code: AppErrorCode,
    message: string,
    cause?: unknown
): Result<never> => ({
    success: false,
    error: { code, message, cause },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

export const Result = {
    notFound:    (resource = "Resource") =>
        Err("NOT_FOUND", `${resource} not found`),

    conflict:    (message: string) =>
        Err("CONFLICT", message),

    validation:  (message: string) =>
        Err("VALIDATION_ERROR", message),

    unauthorized: (message = "Unauthorized") =>
        Err("UNAUTHORIZED", message),

    forbidden:   (message = "Forbidden") =>
        Err("FORBIDDEN", message),

    dbError:     (cause: unknown, message = "Database operation failed") =>
        Err("DB_ERROR", message, cause),
};

// ── Map Result error code → HTTP status ──────────────────────────────────────
// Use this in route handlers to bridge Result → ApiResponse

export const errorCodeToStatus: Record<AppErrorCode, number> = {
    NOT_FOUND:        404,
    VALIDATION_ERROR: 400,
    DB_ERROR:         500,
    CONFLICT:         409,
    UNAUTHORIZED:     401,
    FORBIDDEN:        403,
};