// app/types/common.types.ts

// ── API response wrappers ─────────────────────────────────────────────────────
export type ApiSuccess<T> = {
  success: true;
  data:    T;
  meta?:   PaginationMeta;
};

export type ApiErrorResponse = {
  success: false;
  error:   string;
  code:    string;
};

// ── Pagination ────────────────────────────────────────────────────────────────
export type PaginationMeta = {
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
};

export type PaginatedResult<T> = {
  data: T[];
  meta: PaginationMeta;
};

// ── Async state — for client components ──────────────────────────────────────
export type AsyncState<T> = {
  data:    T | null;
  loading: boolean;
  error:   string | null;
};

// ── Uploaded image response ───────────────────────────────────────────────────
export type UploadedImage = {
  id:            number;
  original_url:  string;
  thumbnail_url: string;
  blur_base64:   string;
  width:         number;
  height:        number;
  aspect_ratio:  string;
  size_bytes:    number;
  original_size: number;
  compression:   string;
};


export type PaginatedResponse<T> = {
  data: T[];
  meta: PaginationMeta;
};

export type PaginationParams = {
  page?: number;
  limit?: number;
};