// app/lib/validate.ts
import { z } from "zod";
import { ApiValidationError } from "./api-error";

export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues
      .map((issue: z.ZodIssue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    throw new ApiValidationError(message);
  }
  return result.data;
}

export const paginationSchema = z.object({
  page:  z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;