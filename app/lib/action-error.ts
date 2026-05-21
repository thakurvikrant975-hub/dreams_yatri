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
      case "P2002":
        return { errorType: "CONSTRAINT",  message: "This value already exists — try a different one." };
      case "P2003":
        return { errorType: "CONSTRAINT",  message: "A related record is missing — check your selections." };
      case "P2011":
        return { errorType: "CONSTRAINT",  message: "A required field is missing." };
      case "P2014":
        return { errorType: "CONSTRAINT",  message: "This change would violate a required relationship." };

      // Not found
      case "P2025":
        return { errorType: "NOT_FOUND",   message: "Record not found — it may have been deleted." };
    }
  }

  // ── Prisma validation error (bad query / schema mismatch) ────────────────
  if (error instanceof Prisma.PrismaClientValidationError) {
    return { errorType: "VALIDATION", message: "Invalid data — please check your inputs and try again." };
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
