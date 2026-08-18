import { Prisma } from "@/app/generated/prisma";

export type ActionErrorType =
  | "NETWORK"     // DB unreachable or fetch failure
  | "CONSTRAINT"  // Unique / FK / null constraint violation
  | "NOT_FOUND"   // Record does not exist
  | "VALIDATION"  // Schema mismatch or invalid query shape
  | "SERVER";     // Unexpected server-side error

export type ActionFailure = {
  success: false;
  errorType: ActionErrorType;
  message: string;
};

/** Field name(s) a Prisma error is actually about, when Prisma tells us —
 * `meta` on known-request errors, or parsed out of a validation error's
 * message, which is the only place that error carries the field at all. */
function fieldFrom(meta: unknown, key: string): string | null {
  const v = (meta as Record<string, unknown> | undefined)?.[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.join(", ");
  return null;
}

/** Prisma's validation error message embeds the offending argument(s) as
 * `Argument \`field\`: Invalid value provided. Expected Float, provided
 * String.` (or `Argument \`field\` is missing.`) rather than exposing them
 * as structured data — regexing them out is the only way to name the field
 * back to the user instead of a dead-end "invalid data" message. */
function fieldsFromValidationMessage(message: string): string[] {
  const found: string[] = [];
  for (const m of message.matchAll(/Argument `([^`]+)`: Invalid value provided\. Expected ([^,]+), provided ([^.]+)\./g)) {
    found.push(`"${m[1]}" (expected ${m[2].trim()}, got ${m[3].trim()})`);
  }
  for (const m of message.matchAll(/Argument `([^`]+)` is missing\.?/g)) {
    found.push(`"${m[1]}" (required, but missing)`);
  }
  return found;
}

export function classifyActionError(error: unknown): { errorType: ActionErrorType; message: string } {
  // ── Prisma known request errors ──────────────────────────────────────────
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      // Connection / reachability
      case "P1001":
      case "P1002":
      case "P1008":
      case "P1017":
        return { errorType: "NETWORK",     message: "Cannot reach the database — please try again." };

      // Constraint violations
      case "P2000": {
        const column = fieldFrom(error.meta, "column_name");
        return { errorType: "CONSTRAINT", message: column ? `"${column}" is too long — please shorten it and try again.` : "One of the values is too long — please shorten it and try again." };
      }
      case "P2002": {
        const target = fieldFrom(error.meta, "target");
        return { errorType: "CONSTRAINT", message: target ? `"${target}" already exists — try a different value.` : "This value already exists — try a different one." };
      }
      case "P2003": {
        const field = fieldFrom(error.meta, "field_name");
        return { errorType: "CONSTRAINT", message: field ? `The related record for "${field}" is missing — check your selections.` : "A related record is missing — check your selections." };
      }
      case "P2011": {
        const constraint = fieldFrom(error.meta, "constraint");
        return { errorType: "CONSTRAINT", message: constraint ? `"${constraint}" is required but missing.` : "A required field is missing." };
      }
      case "P2014":
        return { errorType: "CONSTRAINT",  message: "This change would violate a required relationship." };

      // Not found
      case "P2025":
        return { errorType: "NOT_FOUND",   message: "Record not found — it may have been deleted." };
    }
  }

  // ── Prisma validation error (bad query / schema mismatch) ────────────────
  if (error instanceof Prisma.PrismaClientValidationError) {
    const fields = fieldsFromValidationMessage(error.message);
    return {
      errorType: "VALIDATION",
      message: fields.length > 0
        ? `Invalid value for ${fields.join(", ")} — please check that and try again.`
        : "Invalid data — please check your inputs and try again.",
    };
  }

  // ── Prisma initialization / connection error ─────────────────────────────
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return { errorType: "NETWORK", message: "Cannot connect to the database — please try again." };
  }

  // ── Network / fetch errors (e.g. calls to external APIs inside actions) ──
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("fetch failed") ||
      msg.includes("econnrefused") ||
      msg.includes("etimedout") ||
      msg.includes("enotfound") ||
      msg.includes("network") ||
      msg.includes("socket hang up")
    ) {
      return { errorType: "NETWORK", message: "Network error — check your connection and try again." };
    }
  }

  // ── Everything else ──────────────────────────────────────────────────────
  return { errorType: "SERVER", message: "Something went wrong on our end — please try again." };
}

/**
 * Use in server action catch blocks:
 *   } catch (e) { console.error(e); return actionError(e); }
 */
export function actionError(error: unknown): ActionFailure {
  return { success: false, ...classifyActionError(error) };
}
