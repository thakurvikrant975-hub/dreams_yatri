// app/lib/api-error.ts
import { Prisma } from "../generated/prisma/client";
import { ApiResponse } from "./api-response";

export function handleApiError(error: unknown) {
  console.error("[API_ERROR]", error);

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002":
        return ApiResponse.conflict(
          `A record with this value already exists.`
        );
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