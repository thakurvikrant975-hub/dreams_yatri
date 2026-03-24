// app/services/api/client.ts
import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { ApiErrorResponse } from "@/app/types";

// ── Base Instance ──────────────────────────────────────────────────────────
export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "/api",
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json",
  },
});

// ── Request Interceptor ───────────────────────────────────────────────────────
// Runs before every request — attach auth token, log, etc.
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Attach auth token if exists (for future auth implementation)
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("auth_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// ── Response Interceptor ──────────────────────────────────────────────────────
// Runs after every response — normalize errors, handle 401, log, etc.
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    // Network error — no response received
    if (!error.response) {
      return Promise.reject(
        new ApiError("Network error. Check your connection.", "NETWORK_ERROR", 0)
      );
    }

    const { status, data } = error.response;

    // Handle specific status codes globally
    switch (status) {
      case 401:
        // Clear auth + redirect to login (implement when auth is added)
        if (typeof window !== "undefined") {
          localStorage.removeItem("auth_token");
          // window.location.href = "/login";
        }
        break;
      case 429:
        return Promise.reject(
          new ApiError("Too many requests. Please slow down.", "RATE_LIMITED", 429)
        );
      case 503:
        return Promise.reject(
          new ApiError("Service temporarily unavailable.", "SERVICE_UNAVAILABLE", 503)
        );
    }

    // Use error message from your API response if available
    const message = data?.error ?? "Something went wrong.";
    const code = data?.code ?? "UNKNOWN_ERROR";

    return Promise.reject(new ApiError(message, code, status));
  }
);

// ── Custom Error Class ────────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number
  ) {
    super(message);
    this.name = "ApiError";
  }

  isNotFound() { return this.status === 404; }
  isConflict() { return this.status === 409; }
  isBadRequest() { return this.status === 400; }
  isServerError() { return this.status >= 500; }
  isNetworkError() { return this.status === 0; }
}

