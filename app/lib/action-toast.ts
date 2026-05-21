import { toast } from "sonner";
import type { ActionErrorType } from "./action-error";

type ActionResult =
  | { success: true;  message?: string }
  | { success: false; message?: string; errorType?: ActionErrorType };

/**
 * Call after any server action to show the right toast.
 *
 *   const result = await someAction(data);
 *   toastActionResult(result, "Saved successfully");
 */
export function toastActionResult(result: ActionResult, successMessage?: string): void {
  if (result.success) {
    toast.success(successMessage ?? result.message ?? "Done");
    return;
  }

  const msg = result.message ?? defaultMessage(result.errorType);
  toast.error(msg);
}

function defaultMessage(errorType?: ActionErrorType): string {
  switch (errorType) {
    case "NETWORK":    return "Network error — check your connection and try again.";
    case "CONSTRAINT": return "This value conflicts with existing data.";
    case "NOT_FOUND":  return "Record not found — it may have been deleted.";
    case "VALIDATION": return "Invalid data — please check your inputs.";
    case "SERVER":     return "Something went wrong on our end — please try again.";
    default:           return "An unexpected error occurred.";
  }
}
