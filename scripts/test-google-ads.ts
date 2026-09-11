/**
 * Step 0's done-when: can we reach our real Google Ads accounts?
 *
 * Authenticates as the service account, lists what it can reach, and prints
 * every account under the MCC with its currency and timezone. Read-only —
 * nothing here can change an account. Run with `npm run test:google-ads`
 * once GOOGLE_ADS_* are in .env.local (docs/ads-analytics).
 */
import { serviceAccountEmail, googleAdsAccessToken } from "../app/lib/ads/google/auth";
import { listAccessibleCustomers, gaql, GoogleAdsError, API_VERSION } from "../app/lib/ads/google/client";

/** What each failure most likely means here, so a setup slip reads as a
 * next step rather than a stack trace. */
const HINTS: Record<string, string> = {
  CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION:
    "This Google Cloud project has Test access only. Since 2026-09-09 access belongs to the Cloud project, not the " +
    "developer token — apply for Explorer access on the project's Google Ads API page in the Cloud console.",
  USER_PERMISSION_DENIED:
    "The service account isn't a user on this account, or GOOGLE_ADS_LOGIN_CUSTOMER_ID isn't the MCC it was added to.",
  CUSTOMER_NOT_ENABLED: "The account is cancelled or not yet set up.",
  NOT_ADS_USER: "The service account isn't a user on any Google Ads account yet (MCC → Admin → Access and security).",
};

async function main() {
  // No developer token: since 2026-09-09 Google ignores it (see client.ts).
  const missing = ["GOOGLE_ADS_LOGIN_CUSTOMER_ID", "GOOGLE_ADS_SERVICE_ACCOUNT"]
    .filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    console.error(`missing from .env.local: ${missing.join(", ")}`);
    process.exit(1);
  }

  console.log(`API ${API_VERSION}, as ${serviceAccountEmail()}`);
  await googleAdsAccessToken();
  console.log("  ✓ service account authenticated");

  const reachable = await listAccessibleCustomers();
  console.log(`  ✓ directly reachable: ${reachable.join(", ") || "(none)"}`);

  const mcc = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID!.replace(/\D/g, "");
  type Row = { customerClient: {
    id: string; descriptiveName?: string; manager?: boolean; level?: string;
    currencyCode?: string; timeZone?: string; status?: string;
  } };
  const rows = await gaql<Row>(mcc, `
    SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager,
           customer_client.level, customer_client.currency_code, customer_client.time_zone,
           customer_client.status
    FROM customer_client
    ORDER BY customer_client.level`);
  console.log(`  ✓ ${rows.length} account(s) under MCC ${mcc}:`);
  console.table(rows.map(({ customerClient: c }) => ({
    id: c.id, name: c.descriptiveName ?? "", manager: !!c.manager, level: c.level,
    currency: c.currencyCode, timezone: c.timeZone, status: c.status,
  })));
  console.log("\nall good — Step 0 is done");
}

main().catch((e) => {
  console.error(`\n✗ ${e instanceof Error ? e.message : e}`);
  if (e instanceof GoogleAdsError) {
    for (const c of e.codes) if (HINTS[c]) console.error(`  → ${HINTS[c]}`);
    if (e.requestId) console.error(`  (request-id ${e.requestId}, for Google support)`);
  }
  process.exit(1);
});
