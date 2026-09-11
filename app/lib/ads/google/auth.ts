import "server-only";
import { createSign } from "node:crypto";

/**
 * An access token for the Google Ads API, from a service account.
 *
 * A service account rather than a person's OAuth refresh token: the sync runs
 * unattended from a cron, and a refresh token dies with its owner's password
 * change, their departure, or — for an OAuth app left in "testing" — after
 * seven days, and the sync would stop without a sound. Google Ads accepts a
 * service account added directly as a user on the account (Admin → Access and
 * security); ours is on the MCC, read-only. Setup: docs/ads-analytics.
 *
 * The token is the standard two-legged exchange — a JWT signed with the
 * account's private key, traded at Google's token endpoint for a bearer token
 * good for an hour. Done with node:crypto rather than a Google auth library:
 * it is one signature and one POST, and the library is a large dependency for
 * a Vercel function to carry.
 */

const SCOPE = "https://www.googleapis.com/auth/adwords";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

type ServiceAccountKey = { client_email: string; private_key: string };

/**
 * The key, from GOOGLE_ADS_SERVICE_ACCOUNT. Stored base64-encoded because the
 * JSON key's private_key is multi-line, and a multi-line value is exactly what
 * .env parsers and hosting dashboards mangle. Raw JSON is accepted too.
 */
function serviceAccountKey(): ServiceAccountKey {
  const raw = process.env.GOOGLE_ADS_SERVICE_ACCOUNT?.trim();
  if (!raw) throw new Error("GOOGLE_ADS_SERVICE_ACCOUNT is not set");
  let key: Partial<ServiceAccountKey>;
  try {
    key = JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    throw new Error("GOOGLE_ADS_SERVICE_ACCOUNT is neither JSON nor base64-encoded JSON");
  }
  if (!key.client_email || !key.private_key) {
    throw new Error("GOOGLE_ADS_SERVICE_ACCOUNT is not a service account key (no client_email / private_key)");
  }
  return key as ServiceAccountKey;
}

/** The service account's email — for diagnostics; never the key. */
export function serviceAccountEmail(): string {
  return serviceAccountKey().client_email;
}

const b64url = (s: string) => Buffer.from(s).toString("base64url");

let cached: { token: string; expiresAt: number } | null = null;

export async function googleAdsAccessToken(): Promise<string> {
  // A minute's margin, so a token never expires between here and the request.
  if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;

  const key = serviceAccountKey();
  const now = Math.floor(Date.now() / 1000);
  const unsigned =
    b64url(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." +
    b64url(JSON.stringify({ iss: key.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }));
  const signature = createSign("RSA-SHA256").update(unsigned).sign(key.private_key).toString("base64url");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string; expires_in?: number; error?: string; error_description?: string;
  };
  if (!res.ok || !body.access_token) {
    throw new Error(`Google token exchange failed (${res.status}): ${body.error ?? "unknown"} — ${body.error_description ?? ""}`);
  }
  cached = { token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return cached.token;
}
