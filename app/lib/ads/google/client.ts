import "server-only";
import { googleAdsAccessToken } from "./auth";

/**
 * The Google Ads API over REST, with plain fetch.
 *
 * Not the gRPC client libraries: GAQL over searchStream is JSON in and JSON
 * out, the libraries are heavy for a Vercel function, and they pin us to a
 * third party's release cadence each time Google ships a version. The cost is
 * this file. See docs/ads-analytics/ads-analytics-plan.md, Step 3.
 *
 * Google sunsets each version about a year after release, so bumping
 * API_VERSION is the standing maintenance of this integration — check the
 * release notes' sunset dates when it is.
 */
export const API_VERSION = "v25";
const BASE = `https://googleads.googleapis.com/${API_VERSION}`;

/** Customer ids are shown as 123-456-7890 in the UI and sent as digits. */
export const customerIdDigits = (id: string) => id.replace(/\D/g, "");

function config() {
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim();
  if (!loginCustomerId) throw new Error("GOOGLE_ADS_LOGIN_CUSTOMER_ID is not set (the MCC's id)");
  return {
    loginCustomerId: customerIdDigits(loginCustomerId),
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim() || null,
  };
}

async function headers(): Promise<Record<string, string>> {
  const { loginCustomerId, developerToken } = config();
  return {
    authorization: `Bearer ${await googleAdsAccessToken()}`,
    // Access flows through the MCC, so every call names it — including calls
    // about a child account.
    "login-customer-id": loginCustomerId,
    // Since 2026-09-09 API access belongs to the Google Cloud project, not the
    // token, and Google ignores this header. Still sent when set, for anything
    // that predates the change; never required.
    ...(developerToken ? { "developer-token": developerToken } : {}),
    "content-type": "application/json",
  };
}

/** A Google Ads API failure, with Google's own error codes kept for callers
 * that need to tell "not permitted" from "malformed query". */
export class GoogleAdsError extends Error {
  constructor(message: string, readonly status: number, readonly codes: string[], readonly requestId: string | null) {
    super(message);
    this.name = "GoogleAdsError";
  }
}

type ApiError = {
  message?: string;
  details?: { errors?: { errorCode?: Record<string, string>; message?: string }[] }[];
};

/** Google nests the useful part: error.details[].errors[], each with an
 * errorCode like { authorizationError: "USER_PERMISSION_DENIED" }. */
async function fail(res: Response): Promise<never> {
  const body: unknown = await res.json().catch(() => null);
  // searchStream reports an error as an array of batches; the rest as one object.
  const err = ((Array.isArray(body) ? body[0] : body) as { error?: ApiError } | null)?.error;
  const inner = err?.details?.flatMap((d) => d.errors ?? []) ?? [];
  const codes = inner.flatMap((e) => Object.values(e.errorCode ?? {}));
  const messages = [...new Set([...inner.map((e) => e.message), err?.message].filter(Boolean))];
  throw new GoogleAdsError(
    `Google Ads API ${res.status}: ${messages.join(" | ") || res.statusText}${codes.length ? ` [${codes.join(", ")}]` : ""}`,
    res.status, codes, res.headers.get("request-id"),
  );
}

/** The customer ids these credentials can reach directly — for a service
 * account on an MCC, that is the MCC itself. */
export async function listAccessibleCustomers(): Promise<string[]> {
  const res = await fetch(`${BASE}/customers:listAccessibleCustomers`, { headers: await headers() });
  if (!res.ok) await fail(res);
  const body = (await res.json()) as { resourceNames?: string[] };
  return (body.resourceNames ?? []).map((r) => r.replace(/^customers\//, ""));
}

/**
 * Runs a GAQL query against one customer and returns every row.
 *
 * searchStream rather than search: one request however many rows, so a
 * report never pays per page against the daily operation limit. The response
 * is a JSON array of batches, each with its own `results`.
 */
export async function gaql<Row = Record<string, unknown>>(customerId: string, query: string): Promise<Row[]> {
  const res = await fetch(`${BASE}/customers/${customerIdDigits(customerId)}/googleAds:searchStream`, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify({ query }),
  });
  if (!res.ok) await fail(res);
  const batches = (await res.json()) as { results?: Row[] }[];
  return batches.flatMap((b) => b.results ?? []);
}
