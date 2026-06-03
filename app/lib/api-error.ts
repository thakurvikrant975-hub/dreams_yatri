// app/lib/api-error.ts
import { Prisma } from "../generated/prisma/client";
import { ApiResponse } from "./api-response";

export function handleApiError(error: unknown) {
  console.error("[API_ERROR]", error);

  // instanceof can fail with Prisma 7 driver adapters — fall back to duck-typing
  const code =
    error instanceof Prisma.PrismaClientKnownRequestError
      ? error.code
      : (error as any)?.code;

  const meta =
    error instanceof Prisma.PrismaClientKnownRequestError
      ? error.meta
      : (error as any)?.meta;

  if (typeof code === "string") {
    switch (code) {
      case "P2002": {
        const fields = Array.isArray(meta?.target)
          ? (meta.target as string[]).join(", ")
          : "value";
        return ApiResponse.conflict(`${fields} is already in use.`);
      }
      case "P2025":
        return ApiResponse.notFound();
      case "P2003":
        return ApiResponse.badRequest(
          "Invalid reference — related record does not exist."
        );
    }
  }

  if (error instanceof ApiValidationError) {
    return ApiResponse.badRequest(error.message);
  }

  return ApiResponse.serverError();
}

export class ApiValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiValidationError";
  }
}