import { classifyActionError } from "./action-error";

/** Human-readable reason a single file was rejected before upload started. */
export function describeSizeRejection(file: File, maxBytes: number): string {
  const gotMb = (file.size / (1024 * 1024)).toFixed(1);
  const maxMb = maxBytes / (1024 * 1024);
  return `${file.name} (${gotMb}MB — max is ${maxMb}MB)`;
}

export function describeTypeRejection(file: File): string {
  return `${file.name} (unsupported file type)`;
}

/** Human-readable reason an upload attempt threw mid-flight (network, R2, DB). */
export function describeUploadFailure(file: File, err: unknown): string {
  const { message } = classifyActionError(err);
  return `${file.name} (${message})`;
}
